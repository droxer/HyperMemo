import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';
import path from 'node:path';

export default defineConfig(() => ({
    plugins: [react(), crx({ manifest })],
    build: {
        sourcemap: true,
        target: 'esnext'
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{ts,tsx}']
    }
}));
