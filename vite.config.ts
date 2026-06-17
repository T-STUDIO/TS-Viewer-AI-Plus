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

        // Buffer the request body fully to handle POST/PUT data safely
        const bodyChunks: any[] = [];
        req.on('data', (chunk: any) => {
          bodyChunks.push(chunk);
        });

        req.on('end', () => {
          const bodyBuffer = Buffer.concat(bodyChunks);

          // Proxy request to nova.astrometry.net
          const targetUrl = new URL(req.url || '', 'https://nova.astrometry.net');

          console.log(`[Astrometry CORS Proxy] Incoming: ${req.method} ${req.url} (Body size: ${bodyBuffer.length} bytes)`);

          // Clean headers to prevent CORS redirects and WAF blockings on astrometry.net
          const cleanHeaders: any = {};

          // Copy safe headers from the original request
          const headersToIgnore = ['host', 'origin', 'referer', 'cookie', 'cookie2', 'connection', 'content-length'];
          for (const key of Object.keys(req.headers)) {
            if (!headersToIgnore.includes(key.toLowerCase())) {
              cleanHeaders[key] = req.headers[key];
            }
          }

          // Force correct host for the destination target
          cleanHeaders['host'] = 'nova.astrometry.net';
          
          if (!cleanHeaders['user-agent']) {
            cleanHeaders['user-agent'] = 'AstrometryProxy/1.0';
          }

          if (!cleanHeaders['accept']) {
            cleanHeaders['accept'] = 'application/json, text/plain, */*';
          }

          // Strict Content-Type formatting to avoid Python/CGI parser failures on astrometry.net
          if (cleanHeaders['content-type']) {
            const rawType = String(cleanHeaders['content-type']).toLowerCase();
            if (rawType.startsWith('application/x-www-form-urlencoded')) {
              cleanHeaders['content-type'] = 'application/x-www-form-urlencoded';
            }
          }

          // Adjust content-length dynamically based on buffered request body
          if (bodyBuffer.length > 0) {
            cleanHeaders['content-length'] = String(bodyBuffer.length);
          } else {
            delete cleanHeaders['content-length'];
          }

          console.log(`[Astrometry CORS Proxy] Forwarding to: https://nova.astrometry.net${targetUrl.pathname}${targetUrl.search}`);

          const proxyReq = https.request({
            hostname: 'nova.astrometry.net',
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: cleanHeaders
          }, (proxyRes: any) => {
            console.log(`[Astrometry CORS Proxy] Target responded: Status ${proxyRes.statusCode}`);
            const resHeaders = { ...proxyRes.headers };

            // Keep CORS simple and open
            resHeaders['access-control-allow-origin'] = '*';
            resHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE';
            resHeaders['access-control-allow-headers'] = 'X-Requested-With,content-type,Authorization,request-json';

            // Handle 3xx redirect Location header rewrite, to prevent browser from accessing nova.astrometry.net directly (which throws CORS error)
            if (resHeaders.location) {
              console.log(`[Astrometry CORS Proxy] Intercepted redirect location: ${resHeaders.location}`);
              try {
                const locUrl = new URL(resHeaders.location, 'https://nova.astrometry.net');
                if (locUrl.hostname === 'nova.astrometry.net') {
                  const clientHost = req.headers.host || 'localhost:6004';
                  const isSecured = req.isSpdy || req.connection?.encrypted;
                  const proto = isSecured ? 'https' : 'http';
                  resHeaders.location = `${proto}://${clientHost}${locUrl.pathname}${locUrl.search}`;
                  console.log(`[Astrometry CORS Proxy] Rewrote redirect location to: ${resHeaders.location}`);
                }
              } catch (e) {
                console.error('[Astrometry CORS Proxy] Failed to parse and rewrite location header:', e);
              }
            }

            res.writeHead(proxyRes.statusCode || 200, resHeaders);
            proxyRes.pipe(res, { end: true });
          });

          proxyReq.on('error', (err: any) => {
            console.error('[Astrometry Proxy Error]:', err);
            res.writeHead(500);
            res.end('Proxy Error: ' + err.message);
          });

          // Send request with body buffer in one unified call to prevent chunks issues on target Python CGI/Django server
          proxyReq.end(bodyBuffer);
        });
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

export default defineConfig(({ command, mode }) => {
    const portNum = process.env.PORT ? parseInt(process.env.PORT) : 6003;
    const proxyPlugin = astrometryProxyPlugin();
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
      plugins: [react(), proxyPlugin],
      define: {
        'process.env': {}
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
