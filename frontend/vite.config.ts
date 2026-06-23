import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devProxyTarget = env.VITE_DEV_API_PROXY || 'https://quantalix-0qp4.onrender.com';

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: devProxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
