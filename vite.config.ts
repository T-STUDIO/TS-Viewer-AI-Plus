import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const astrometryProxyPlugin = () => ({
  name: 'astrometry-proxy-6004',
  configureServer(server) {
    const proxyServer = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,request-json');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Proxy request to nova.astrometry.net
      const targetUrl = new URL(req.url || '', 'https://nova.astrometry.net');
      const proxyReq = https.request({
        hostname: 'nova.astrometry.net',
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: 'nova.astrometry.net',
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', (err) => {
        console.error('[Astrometry Proxy Error]:', err);
        res.writeHead(500);
        res.end('Proxy Error: ' + err.message);
      });

      req.pipe(proxyReq, { end: true });
    });

    proxyServer.listen(6004, '0.0.0.0', () => {
      console.log('Astrometry CORS Proxy server automatically running on http://0.0.0.0:6004');
    });

    server.httpServer?.on('close', () => {
      proxyServer.close();
    });
  }
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
      plugins: [react(), astrometryProxyPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
