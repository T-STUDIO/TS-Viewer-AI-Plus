import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command, mode }) => {
    const portNum = process.env.PORT ? parseInt(process.env.PORT) : 6003;
    return {
      base: './',
      server: {
        port: portNum,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      preview: {
        port: portNum,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
