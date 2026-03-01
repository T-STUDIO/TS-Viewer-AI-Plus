
/**
 * T-Astro Alpaca Relay Server [V61.0.0-DEBUG-PRO]
 * ROLE: TRANSPARENT HTTP-TO-WS-TO-HTTP PIPE
 */

const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const dgram = require('dgram');

const ALPACA_PORT = 11111;
const WS_PORT = 11112;
const DISCOVERY_PORT = 32227;

const wss = new WebSocket.Server({ port: WS_PORT, maxPayload: 512 * 1024 * 1024 });

let activeBridge = null;
let pendingRequests = new Map();
let requestIdCounter = 0;

wss.on('connection', (ws, req) => {
    const remoteIp = req.socket.remoteAddress;
    console.log(`[Bridge] UI Linked from ${remoteIp}`);
    if (activeBridge) activeBridge.terminate();
    activeBridge = ws;
    ws.on('message', (data) => {
        try {
            if (Buffer.isBuffer(data) && data.length >= 16 && data.readUint32LE(4) === 0) {
                const rid = data.readUint32LE(8);
                const ctx = pendingRequests.get(rid);
                if (ctx) { clearTimeout(ctx.timer); ctx.resolve({ isBinary: true, data }); pendingRequests.delete(rid); }
            } else {
                const res = JSON.parse(data.toString());
                const ctx = pendingRequests.get(res.requestId);
                if (ctx) { clearTimeout(ctx.timer); ctx.resolve(res.payload); pendingRequests.delete(res.requestId); }
            }
        } catch (e) { console.error("[Bridge] Response error", e.message); }
    });
    ws.on('close', () => { 
        console.warn('[Bridge] UI Unlinked');
        if (activeBridge === ws) activeBridge = null; 
    });
});

// Alpaca Discovery (UDP)
const udp = dgram.createSocket('udp4');
udp.on('message', (msg, rinfo) => {
    const query = msg.toString().toLowerCase();
    if (query.includes('alpacadiscovery1')) {
        console.log(`[UDP] Discovery scan from ${rinfo.address}`);
        const response = JSON.stringify({ AlpacaPort: ALPACA_PORT });
        udp.send(response, rinfo.port, rinfo.address);
    }
});
udp.bind(DISCOVERY_PORT, '0.0.0.0', () => console.log(`[UDP] Discovery listening on ${DISCOVERY_PORT}`));

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const clientIp = req.socket.remoteAddress;

    // アクセスログを常に出す
    console.log(`[HTTP] ${req.method} ${pathname} from ${clientIp}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const clientID = parseInt(parsed.query.clienttransactionid || 0) || 0;
    const internalId = ++requestIdCounter;

    // 診断用ルート
    if (pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>T-Astro Relay V61</h1><p>Status: ${activeBridge ? 'BRIDGE_CONNECTED ✅' : 'BRIDGE_OFFLINE ❌'}</p>`);
        return;
    }

    // ブリッジ（ブラウザ）がいない場合の特別処理
    if (!activeBridge || activeBridge.readyState !== WebSocket.OPEN) {
        console.warn(`[HTTP] No active UI bridge for request: ${pathname}`);
        // configureddevices の場合はエラーではなく空リストを返す（CCDCiel対策）
        if (pathname.includes('configureddevices')) {
            const empty = JSON.stringify({ Value: [], ClientTransactionID: clientID, ServerTransactionID: 0, ErrorNumber: 0, ErrorMessage: "" });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(empty);
            return;
        }
        const err = JSON.stringify({ Value: null, ClientTransactionID: clientID, ServerTransactionID: 0, ErrorNumber: 0x408, ErrorMessage: "Alpaca Bridge Offline" });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(err);
        return;
    }

    // パラメータ取得
    let body = {};
    if (req.method === 'PUT' || req.method === 'POST') {
        const raw = await new Promise(r => { let c = ''; req.on('data', d => c += d); req.on('end', () => r(c)); });
        if (raw) { try { const sp = new URLSearchParams(raw); for (const [k, v] of sp.entries()) body[k.toLowerCase()] = v; } catch(e) {} }
    }
    const params = { ...parsed.query };
    for (const k in body) params[k.toLowerCase()] = body[k];

    // ブリッジへ転送
    const result = await new Promise(resolve => {
        const timer = setTimeout(() => {
            if (pendingRequests.has(internalId)) {
                pendingRequests.delete(internalId);
                console.error(`[HTTP] Timeout on ${pathname}`);
                resolve({ Value: null, ErrorNumber: 0x408, ErrorMessage: "Timeout" });
            }
        }, 10000);
        pendingRequests.set(internalId, { resolve, timer });
        activeBridge.send(JSON.stringify({ requestId: internalId, method: req.method, path: pathname, params }));
    });

    if (result && result.isBinary) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.from(result.data));
    } else {
        const content = JSON.stringify(result);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
    }
});

server.listen(ALPACA_PORT, '0.0.0.0', () => {
    console.log(`[Relay V61] Listening on ${ALPACA_PORT}. (Bridge on ${WS_PORT})`);
});
