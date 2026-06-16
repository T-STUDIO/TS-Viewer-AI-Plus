import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const astrometryProxyPlugin = () => {
  let proxyServer: any = null;

  const startProxy = () => {
    if (proxyServer) return;
    try {
      proxyServer = http.createServer((req: any, res: any) => {
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
        }, (proxyRes: any) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (err: any) => {
          console.error('[Astrometry Proxy Error]:', err);
          res.writeHead(500);
          res.end('Proxy Error: ' + err.message);
        });

        req.pipe(proxyReq, { end: true });
      });

      proxyServer.on('error', (err: any) => {
        console.error('[Astrometry CORS Proxy Server Error]:', err);
        if (err.code === 'EADDRINUSE') {
          console.warn('[Astrometry CORS Proxy] Port 6004 is already in use by another process. CORS proxy skip.');
        }
        proxyServer = null;
      });

      proxyServer.listen(6004, () => {
        console.log('Astrometry CORS Proxy server automatically running on port 6004 (Dual-stack IPv4/IPv6)');
      });
    } catch (e) {
      console.error('[Astrometry CORS Proxy Setup Failed]:', e);
      proxyServer = null;
    }
  };

  return {
    name: 'astrometry-proxy-6004',
    configureServer(server: any) {
      startProxy();
      server.httpServer?.on('close', () => {
        if (proxyServer) {
          try {
            proxyServer.close();
          } catch (e) {}
          proxyServer = null;
        }
      });
    },
    configurePreviewServer(server: any) {
      startProxy();
      if (server.httpServer) {
        server.httpServer.on('close', () => {
          if (proxyServer) {
            try {
              proxyServer.close();
            } catch (e) {}
            proxyServer = null;
          }
        });
      }
    }
  };
};

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
