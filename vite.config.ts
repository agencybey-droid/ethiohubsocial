import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(async ({ command }) => {
  const plugins: any[] = [react(), tailwindcss()];

  if (command === 'serve') {
    try {
      const { default: app } = await import('./server.ts');
      plugins.push({
        name: 'api-server',
        configureServer(server: any) {
          server.middlewares.use(app);
        },
      });
    } catch (err) {
      console.warn('Could not load api-server middleware during serve:', err);
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
