export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function getPathParam(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  const remainder = url.pathname.replace(prefix, '').replace(/^\/+/, '');
  const [first] = remainder.split('/');
  return first || null;
}
