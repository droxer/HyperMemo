import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
    manifest_version: 3,
    name: 'HyperMemo',
    version: '0.1.0',
    description: 'AI-powered bookmark manager with smart tagging, instant search, and chat with your saved pages using RAG technology.',
    content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    },
    action: {
        default_popup: 'pages/popup/index.html',
        default_icon: {
            16: 'icons/icon-16.png',
            48: 'icons/icon-48.png',
            128: 'icons/icon-128.png'
        }
    },
    options_page: 'pages/dashboard/index.html',
    background: {
        service_worker: 'src/background/index.ts',
        type: 'module'
    },
    icons: {
        16: 'icons/icon-16.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
    },
    permissions: ['storage', 'tabs', 'identity', 'scripting', 'activeTab'],
    host_permissions: ['http://*/*', 'https://*/*'],
    content_scripts: [
        {
            matches: ['http://*/*', 'https://*/*'],
            js: ['src/content/index.ts'],
            run_at: 'document_idle'
        }
    ],
    web_accessible_resources: [
        {
            resources: ['assets/*', 'icons/*'],
            matches: ['<all_urls>']
        }
    ]
});
