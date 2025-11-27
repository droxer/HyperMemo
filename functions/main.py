import math
import os
import time
from typing import Any, Dict, List

import firebase_admin
from firebase_admin import auth, firestore
from firebase_functions import https_fn
from flask import Request, jsonify, make_response
from google.cloud import aiplatform

FIREBASE_APP = firebase_admin.initialize_app() if not firebase_admin._apps else firebase_admin.get_app()
DB = firestore.client(app=FIREBASE_APP)

PROJECT_ID = os.getenv('GCP_PROJECT') or os.getenv('GCLOUD_PROJECT') or os.getenv('GOOGLE_CLOUD_PROJECT')
VERTEX_LOCATION = os.getenv('VERTEX_LOCATION', 'us-central1')
GENERATION_MODEL = os.getenv('VERTEX_SUMMARY_MODEL', 'gemini-1.5-pro-latest')
EMBEDDING_MODEL = os.getenv('VERTEX_EMBED_MODEL', 'text-embedding-004')

if not PROJECT_ID:
  raise RuntimeError('Missing GCP project id for Vertex AI.')

aiplatform.init(project=PROJECT_ID, location=VERTEX_LOCATION)
GEN_MODEL = aiplatform.GenerativeModel(GENERATION_MODEL)
EMBED_MODEL = aiplatform.TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)

CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}


def cors_response(body: Dict[str, Any], status: int = 200):
  response = make_response(body if isinstance(body, str) else jsonify(body), status)
  for key, value in CORS_HEADERS.items():
    response.headers[key] = value
  return response


def handle_cors(req: Request):
  if req.method == 'OPTIONS':
    return cors_response('', 204)
  return None


def verify_user(req: Request) -> str:
  auth_header = req.headers.get('Authorization', '')
  if not auth_header.startswith('Bearer '):
    raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED, message='Missing Authorization header')
  id_token = auth_header.split('Bearer ')[1]
  decoded = auth.verify_id_token(id_token)
  return decoded['uid']


def summarize_text(title: str = '', content: str = '', url: str = '') -> str:
  prompt_parts = [
    'You are HyperMemo, a concise research assistant.',
    f'Title: {title}' if title else '',
    f'URL: {url}' if url else '',
    'Content:',
    content[:8000]
  ]
  prompt = '\n'.join([part for part in prompt_parts if part])
  response = GEN_MODEL.generate_content(prompt)
  return getattr(response, 'text', '') or ''


def suggest_tags(title: str = '', content: str = '') -> List[str]:
  prompt = (
    'Suggest up to 5 concise tags (single words) describing the following page. '
    'Return comma-separated words only.\n\n'
    f'Title: {title}\nContent:\n{content[:4000]}'
  )
  response = GEN_MODEL.generate_content(prompt)
  text = getattr(response, 'text', '') or ''
  return [tag.strip().lower() for tag in text.split(',') if tag.strip()][:5]


def embed_text(text: str) -> List[float]:
  if not text.strip():
    return []
  embeddings = EMBED_MODEL.get_embeddings([text])
  return embeddings[0].values if embeddings else []


def cosine_similarity(a: List[float], b: List[float]) -> float:
  if not a or not b:
    return 0.0
  dot = sum(x * y for x, y in zip(a, b))
  norm_a = math.sqrt(sum(x * x for x in a))
  norm_b = math.sqrt(sum(y * y for y in b))
  if not norm_a or not norm_b:
    return 0.0
  return dot / (norm_a * norm_b)


@https_fn.on_request()
def bookmarks(req: Request):
  cors = handle_cors(req)
  if cors:
    return cors
  try:
    uid = verify_user(req)
    coll = DB.collection('users').document(uid).collection('bookmarks')

    if req.method == 'GET':
      docs = coll.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(100).stream()
      payload = [{'id': doc.id, **doc.to_dict()} for doc in docs]
      return cors_response(payload)

    data = req.get_json(silent=True) or {}
    bookmark_id = data.get('id')
    title = data.get('title', '').strip()
    url = data.get('url', '').strip()
    tags = data.get('tags', []) or []
    note = data.get('note', '')
    summary = data.get('summary', '')
    raw_content = data.get('rawContent', '')

    if not title or not url:
      raise ValueError('title and url are required')

    if not summary and raw_content:
      summary = summarize_text(title, raw_content, url)
    if not tags and raw_content:
      tags = suggest_tags(title, raw_content)

    embedding_source = '\n'.join(filter(bool, [title, summary, note, raw_content]))
    embedding = embed_text(embedding_source)

    doc_ref = coll.document(bookmark_id) if bookmark_id else coll.document()
    record = {
      'title': title,
      'url': url,
      'tags': tags,
      'summary': summary,
      'note': note,
      'rawContent': raw_content,
      'embedding': embedding,
      'updatedAt': firestore.SERVER_TIMESTAMP,
    }
    if not bookmark_id:
      record['createdAt'] = firestore.SERVER_TIMESTAMP
    doc_ref.set(record, merge=True)
    saved = doc_ref.get().to_dict()
    saved['id'] = doc_ref.id
    return cors_response(saved)
  except Exception as err:  # pylint: disable=broad-except
    return cors_response({'error': str(err)}, 500)


@https_fn.on_request()
def summaries(req: Request):
  cors = handle_cors(req)
  if cors:
    return cors
  try:
    verify_user(req)
    data = req.get_json(silent=True) or {}
    summary = summarize_text(data.get('title', ''), data.get('content', ''), data.get('url', ''))
    return cors_response({'summary': summary})
  except Exception as err:  # pylint: disable=broad-except
    return cors_response({'error': str(err)}, 500)


@https_fn.on_request()
def summary_tags(req: Request):
  cors = handle_cors(req)
  if cors:
    return cors
  try:
    verify_user(req)
    data = req.get_json(silent=True) or {}
    tags = suggest_tags(data.get('title', ''), data.get('content', ''))
    return cors_response({'tags': tags})
  except Exception as err:  # pylint: disable=broad-except
    return cors_response({'error': str(err)}, 500)


@https_fn.on_request()
def rag_query(req: Request):
  cors = handle_cors(req)
  if cors:
    return cors
  try:
    uid = verify_user(req)
    data = req.get_json(silent=True) or {}
    question = data.get('question', '').strip()
    if len(question) < 3:
      raise ValueError('Question is too short')

    query_vector = embed_text(question)
    docs = DB.collection('users').document(uid).collection('bookmarks').where('embedding', '!=', None).stream()
    matches = []
    for doc in docs:
      bookmark = doc.to_dict()
      embedding = bookmark.get('embedding') or []
      score = cosine_similarity(query_vector, embedding)
      matches.append({'bookmark': {'id': doc.id, **bookmark}, 'score': score})
    matches.sort(key=lambda item: item['score'], reverse=True)
    matches = matches[:5]

    sources_text = '\n'.join(
      f"[{idx + 1}] {match['bookmark'].get('title')} — {match['bookmark'].get('summary', '')}"
      for idx, match in enumerate(matches)
    )
    prompt = (
      'You are HyperMemo. Answer the question using ONLY the provided sources. Cite sources with [S#].\n'
      f'Question: {question}\nSources:\n{sources_text}'
    )
    completion = GEN_MODEL.generate_content(prompt)
    answer_text = getattr(completion, 'text', '') or ''
    return cors_response({'answer': answer_text, 'matches': matches})
  except Exception as err:  # pylint: disable=broad-except
    return cors_response({'error': str(err)}, 500)


@https_fn.on_request()
def export_note(req: Request):
  cors = handle_cors(req)
  if cors:
    return cors
  try:
    uid = verify_user(req)
    data = req.get_json(silent=True) or {}
    note = data.get('note') or {}
    if not note.get('title') or not note.get('body'):
      raise ValueError('Note title and body are required')

    # Placeholder: integrate Google Docs export inside this block when OAuth is available.
    doc_id = f"mock-{int(time.time() * 1000)}"
    record = {
      **note,
      'driveFileId': doc_id,
      'exportUrl': f'https://docs.google.com/document/d/{doc_id}',
      'createdAt': firestore.SERVER_TIMESTAMP,
    }
    DB.collection('users').document(uid).collection('notes').add(record)
    return cors_response(record)
  except Exception as err:  # pylint: disable=broad-except
    return cors_response({'error': str(err)}, 500)
