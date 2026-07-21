const http = require('http');
const https = require('https');
const { URL } = require('url');

// 稼働時間管理用
const startTime = Date.now();
// ログ格納用
const logs = [];
let requestCount = 0;
let currentPort = 6004;
let serverInstance = null;

// ログ記録用関数
function logMessage(level, content) {
    const timestamp = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const logObj = { time: timestamp, level, content };
    logs.push(logObj);
    // 最大500件保持
    if (logs.length > 500) {
        logs.shift();
    }
    console.log(`[${timestamp}] [${level}] ${content}`);
}

// 初期ログ
logMessage('INFO', 'Astrometry CORS Proxy & Management Dashboard initialized.');

// 管理画面HTMLテンプレート
function getDashboardHtml(port, uptime, reqs) {
    const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeStr = `${uptimeHours}時間 ${uptimeMinutes % 60}分`;

    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Astrometry CORS Proxy 管理ダッシュボード</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-color: #161b26;
            --primary-color: #3b82f6;
            --primary-hover: #2563eb;
            --text-color: #f1f5f9;
            --text-muted: #94a3b8;
            --border-color: #1e293b;
            --success-color: #10b981;
            --warning-color: #f59e0b;
        }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 900px;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
        }
        h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.025em;
        }
        .badge {
            background-color: rgba(16, 185, 129, 0.15);
            color: var(--success-color);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .card {
            background-color: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
        }
        .card-title {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.05em;
            margin-bottom: 8px;
        }
        .card-value {
            font-size: 24px;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
        }
        .form-group {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        input[type="number"] {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-color);
            padding: 8px 12px;
            font-size: 14px;
            font-family: 'JetBrains Mono', monospace;
            width: 100px;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="number"]:focus {
            border-color: var(--primary-color);
        }
        button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: background-color 0.2s;
            text-transform: uppercase;
        }
        button:hover {
            background-color: var(--primary-hover);
        }
        .log-section {
            background-color: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .log-container {
            background-color: #090c15;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            height: 300px;
            overflow-y: auto;
            padding: 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            line-height: 1.5;
            display: flex;
            flex-direction: column;
        }
        .log-line {
            margin-bottom: 4px;
            border-bottom: 1px solid rgba(255,255,255,0.02);
            padding-bottom: 4px;
            word-break: break-all;
        }
        .log-line .timestamp {
            color: var(--text-muted);
            margin-right: 8px;
        }
        .log-line .level-INFO { color: #60a5fa; }
        .log-line .level-WARN { color: #f59e0b; }
        .log-line .level-ERROR { color: #ef4444; }
        .log-line .level-SUCCESS { color: #34d399; }
        
        .docs-section {
            background-color: var(--card-color);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
        }
        .docs-section h2 {
            font-size: 16px;
            font-weight: 800;
            margin-top: 0;
            margin-bottom: 16px;
        }
        .code-block {
            background-color: #090c15;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #38bdf8;
            margin-bottom: 12px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        ol {
            margin: 0;
            padding-left: 20px;
            font-size: 13px;
            line-height: 1.6;
            color: var(--text-muted);
        }
        li {
            margin-bottom: 8px;
        }
        strong {
            color: var(--text-color);
        }
        .auto-refresh {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Astrometry CORS Proxy バックエンド</h1>
                <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0;">完全独立型高性能ノバ中継・管理コンソール</p>
            </div>
            <span class="badge">稼働中</span>
        </header>

        <div class="grid">
            <div class="card">
                <div class="card-title">現在の稼働ポート</div>
                <div class="card-value" style="color: var(--primary-color);">${port}</div>
                <form action="/change-port" method="GET" class="form-group" onsubmit="return handlePortChange(event)">
                    <input type="number" name="port" value="${port}" min="1024" max="65535" required id="portInput">
                    <button type="submit">ポート変更</button>
                </form>
            </div>
            <div class="card">
                <div class="card-title">連続稼働時間</div>
                <div class="card-value">${uptimeStr}</div>
                <p style="font-size: 11px; color: var(--text-muted); margin: 12px 0 0 0;">起動時刻: ${new Date(startTime + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(11, 19)} (JST)</p>
            </div>
            <div class="card">
                <div class="card-title">中継リクエスト件数</div>
                <div class="card-value">${reqs} <span style="font-size: 14px; font-weight: normal; color: var(--text-muted)">reqs</span></div>
                <p style="font-size: 11px; color: var(--text-muted); margin: 12px 0 0 0;">CORS対応済 / 直接接続用</p>
            </div>
        </div>

        <div class="log-section">
            <div class="log-header">
                <h3 style="margin:0; font-size: 14px; font-weight: 800;">🛰️ リアルタイム中継通信ログ（最新 100 件）</h3>
                <div class="auto-refresh">
                    <input type="checkbox" id="autoUpdateCheck" checked>
                    <label for="autoUpdateCheck">自動更新 (2秒間隔)</label>
                </div>
            </div>
            <div class="log-container" id="logContainer">
                <!-- ログがここに流れます -->
            </div>
        </div>

        <div class="docs-section">
            <h2>📦 このバックエンドを完全に別フォルダへ切り離して運用する方法</h2>
            <ol>
                <li>
                    <strong>ファイルのコピー</strong><br>
                    このアプリのルートにある <code>nova-backend.js</code> ファイルを、運用先の別のPC、またはサーバーの任意のフォルダへコピーしてください。
                </li>
                <li>
                    <strong>Node.js での単独起動</strong><br>
                    コピーしたディレクトリで、以下のコマンドを実行するだけで<b>完全に独立した常時起動バックエンド</b>として機能します（サードパーティ製ライブラリのインストールは一切不要です）。
                    <div class="code-block" style="color: #34d399;">node nova-backend.js</div>
                </li>
                <li>
                    <strong>呼び出し側アプリでのポート指定</strong><br>
                    呼び出し側のアプリ（例：本現像ビューアなど）の接続ポート設定に、上記で設定したポート（デフォルト <code>6004</code>）を割り当ててください。
                </li>
            </ol>
        </div>
    </div>

    <script>
        const logContainer = document.getElementById('logContainer');
        const portInput = document.getElementById('portInput');
        
        let lastLogCount = 0;

        function fetchLogs() {
            fetch('/get-logs')
                .then(res => res.json())
                .then(data => {
                    if (data.length === lastLogCount) return;
                    lastLogCount = data.length;
                    
                    logContainer.innerHTML = '';
                    data.forEach(log => {
                        const div = document.createElement('div');
                        div.className = 'log-line';
                        
                        const timeSpan = document.createElement('span');
                        timeSpan.className = 'timestamp';
                        timeSpan.textContent = '[' + log.time + ']';
                        
                        const lvlSpan = document.createElement('span');
                        lvlSpan.className = 'level-' + log.level;
                        lvlSpan.style.fontWeight = 'bold';
                        lvlSpan.style.marginRight = '8px';
                        lvlSpan.textContent = '[' + log.level + ']';
                        
                        const textNode = document.createTextNode(log.content);
                        
                        div.appendChild(timeSpan);
                        div.appendChild(lvlSpan);
                        div.appendChild(textNode);
                        
                        logContainer.appendChild(div);
                    });
                    
                    // スクロールを一番下に
                    logContainer.scrollTop = logContainer.scrollHeight;
                })
                .catch(err => console.error('ログの取得に失敗:', err));
        }

        // 初期ロード
        fetchLogs();

        // 2秒間隔で自動更新
        setInterval(() => {
            if (document.getElementById('autoUpdateCheck').checked) {
                fetchLogs();
            }
        }, 2000);

        // ポート動的変更処理
        function handlePortChange(event) {
            event.preventDefault();
            const newPort = portInput.value;
            if (!newPort || newPort < 1024 || newPort > 65535) {
                alert('有効なポート番号(1024〜65535)を入力してください。');
                return false;
            }

            if (confirm('ポートを ' + newPort + ' に変更して、サーバーを再起動しますか？\\n(変更後はブラウザが自動で新ポートに切り替わります)')) {
                logContainer.innerHTML += '<div class="log-line text-yellow-500">ポートを ' + newPort + ' に変更してサーバーをリスタート中...</div>';
                
                // 非同期でリパインド要求を投げる
                fetch('/change-port?port=' + newPort)
                    .then(res => res.text())
                    .then(text => {
                        alert('サーバーポートを変更しました：' + newPort + '\\n3秒後に新しいURLへナビゲーションします。');
                        setTimeout(() => {
                            window.location.href = 'http://' + window.location.hostname + ':' + newPort;
                        }, 3000);
                    })
                    .catch(err => {
                        // リバインドすると接続が一時的に切れるので、想定された切断も許容してリダイレクト
                        console.log('接続切り替えを検知:', err);
                        setTimeout(() => {
                            window.location.href = 'http://' + window.location.hostname + ':' + newPort;
                        }, 3000);
                    });
            }
            return false;
        }
    </script>
</body>
</html>`;
}

// サーバー起動ロジック
function startServer(port) {
    if (serverInstance) {
        try {
            serverInstance.close();
            logMessage('INFO', `Existing server instance on port ${currentPort} closed.`);
        } catch (e) {
            logMessage('ERROR', `Failed to close existing server: ${e.message}`);
        }
    }

    currentPort = port;
    const server = http.createServer((req, res) => {
        // CORS設定
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,request-json');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = new URL(req.url || '', `http://localhost:${currentPort}`);
        const pathname = parsedUrl.pathname;

        // 1. ダッシュボード管理画面ルート
        if (pathname === '/' || pathname === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getDashboardHtml(currentPort, Date.now() - startTime, requestCount));
            return;
        }

        // 2. ログJSON取得ルート
        if (pathname === '/get-logs') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            // 最新100件を流す
            res.end(JSON.stringify(logs.slice(-100)));
            return;
        }

        // 3. ポート動的変更ルート
        if (pathname === '/change-port') {
            const nextPortStr = parsedUrl.searchParams.get('port');
            const nextPort = parseInt(nextPortStr || '', 10);
            if (isNaN(nextPort) || nextPort < 1024 || nextPort > 65535) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('無効なポート番号です。1024から65535の間で設定してください。');
                return;
            }

            logMessage('WARN', `Port dynamic change requested: from ${currentPort} to ${nextPort}`);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Port change accepted. Restaring server to listen on port ${nextPort}...`);

            // 応答後にポートを切り替え (0.5秒おいて処理)
            setTimeout(() => {
                startServer(nextPort);
            }, 500);
            return;
        }

        // 4. Astrometry Nova CORSプロキシールート
        requestCount++;
        let requestUrl = req.url || '';
        const targetUrl = new URL(requestUrl, 'https://nova.astrometry.net');
        logMessage('INFO', `PROXY REQUEST: [${req.method}] ${parsedUrl.pathname}${parsedUrl.search}`);

        // リクエストボディのバッファリング
        const bodyChunks = [];
        req.on('data', (chunk) => { bodyChunks.push(chunk); });
        req.on('end', () => {
            const bodyBuffer = Buffer.concat(bodyChunks);
            logMessage('INFO', `Buffer received: ${bodyBuffer.length} bytes for ${parsedUrl.pathname}`);
            if (bodyBuffer.length > 0) {
                logMessage('INFO', `Body Sample: ${bodyBuffer.toString('utf8').substring(0, 300)}`);
            }

            // ヘッダー整形
            const cleanHeaders = {};
            const headersToIgnore = ['host', 'origin', 'referer', 'cookie', 'cookie2', 'connection', 'content-length'];
            for (const key of Object.keys(req.headers)) {
                if (!headersToIgnore.includes(key.toLowerCase())) {
                    cleanHeaders[key] = req.headers[key];
                }
            }

            // ホスト指定の上書き
            cleanHeaders['host'] = 'nova.astrometry.net';

            // Astrometry.net の AIスクレイパーボット対策規制を回避するため、
            // 公式ドキュメントに指定されている Referer ヘッダーを強制付与します。
            cleanHeaders['referer'] = 'https://nova.astrometry.net/api/login';
            cleanHeaders['user-agent'] = 'Astrometry.net Python Client';

            if (!cleanHeaders['accept']) {
                cleanHeaders['accept'] = 'application/json, text/plain, */*';
            }

            // WAF(ボットフィルター)での不審判定を防ぐため、ブラウザ特有のヘッダーを完全に除去
            const browserKeys = [
                'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
                'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
                'sec-fetch-user', 'upgrade-insecure-requests',
                'accept-language', 'accept-encoding', 'dnt', 'cookie', 'cookie2'
            ];
            for (const k of browserKeys) {
                delete cleanHeaders[k];
                delete cleanHeaders[k.toLowerCase()];
            }

            // Python/CGIパーサのバグ回避用
            if (cleanHeaders['content-type']) {
                const rawType = String(cleanHeaders['content-type']).toLowerCase();
                if (rawType.startsWith('application/x-www-form-urlencoded')) {
                    cleanHeaders['content-type'] = 'application/x-www-form-urlencoded';
                }
            }

            // Content-Lengthの設定
            if (bodyBuffer.length > 0) {
                cleanHeaders['content-length'] = String(bodyBuffer.length);
            } else {
                delete cleanHeaders['content-length'];
            }

            // 送信データの最適化：ログイン送信データのURLエンコードフォーマット不整合を解消
            let finalBodyBuffer = bodyBuffer;
            if (cleanHeaders['content-type'] && cleanHeaders['content-type'].includes('application/x-www-form-urlencoded')) {
                try {
                    const bodyStr = bodyBuffer.toString('utf8');
                    const parsed = new URLSearchParams(bodyStr);
                    const requestJsonVal = parsed.get('request-json');
                    if (requestJsonVal) {
                        JSON.parse(requestJsonVal);
                        const newParams = new URLSearchParams();
                        newParams.append('request-json', requestJsonVal);
                        finalBodyBuffer = Buffer.from(newParams.toString(), 'utf8');
                        cleanHeaders['content-length'] = String(finalBodyBuffer.length);
                        logMessage('INFO', `Proxy re-serialized urlencoded payload and cleaned headers successfully.`);
                    }
                } catch (e) {
                    logMessage('WARN', `Failed to re-serialize payload: ${e.message}`);
                }
            }

            // サーバーサイドでリダイレクトを自動追跡して最終結果を返すリクエスト関数
            function performProxyRequest(currentMethod, currentPath, currentHeaders, requestBody, redirectCount = 0) {
                if (redirectCount > 8) {
                    logMessage('ERROR', 'Too many redirects during backend proxy proxying.');
                    res.writeHead(500);
                    res.end('Too many redirects');
                    return;
                }

                const proxyReq = https.request({
                    hostname: 'nova.astrometry.net',
                    path: currentPath,
                    method: currentMethod,
                    headers: currentHeaders
                }, (proxyRes) => {
                    const statusCode = proxyRes.statusCode || 200;

                    // リダイレクト処理 (301, 302, 307, 308) かつ Location が存在する場合、バックエンド側で自動追従
                    if (statusCode >= 300 && statusCode < 400 && proxyRes.headers.location) {
                        const redirectUrl = new URL(proxyRes.headers.location, `https://nova.astrometry.net`);
                        logMessage('WARN', `REDIRECT DETECTED: Status ${statusCode}, Location: ${redirectUrl.href}. Following redirect...`);

                        let nextMethod = currentMethod;
                        let nextBody = requestBody;

                        // 301/302リダイレクトでPOSTがGETに変更される標準的なケースを処理
                        if ((statusCode === 301 || statusCode === 302) && currentMethod === 'POST') {
                            logMessage('INFO', 'Changing POST to GET for redirect following.');
                            nextMethod = 'GET';
                            nextBody = null;
                        }

                        const nextHeaders = { ...currentHeaders };
                        delete nextHeaders['content-length'];

                        performProxyRequest(nextMethod, redirectUrl.pathname + redirectUrl.search, nextHeaders, nextBody, redirectCount + 1);
                        return;
                    }

                    logMessage('SUCCESS', `TARGET SERVER RESPONDED [Status ${statusCode}] for URI: ${pathname}`);
                    const resHeaders = { ...proxyRes.headers };

                    // CORS設定を付与
                    resHeaders['access-control-allow-origin'] = '*';
                    resHeaders['access-control-allow-methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE';
                    resHeaders['access-control-allow-headers'] = 'X-Requested-With,content-type,Authorization,request-json';

                    // 不要な再リダイレクト制限を回避するために Location を削除して安全にレスポンス
                    delete resHeaders['location'];

                    res.writeHead(statusCode, resHeaders);
                    proxyRes.pipe(res, { end: true });
                });

                proxyReq.on('error', (err) => {
                    logMessage('ERROR', `Astrometry Connection Proxy Error: ${err.message}`);
                    res.writeHead(500);
                    res.end('Astrometry Target Request Failed: ' + err.message);
                });

                if (requestBody && requestBody.length > 0 && currentMethod !== 'GET' && currentMethod !== 'HEAD') {
                    proxyReq.end(requestBody);
                } else {
                    proxyReq.end();
                }
            }

            // Astrometry.net の API の仕様（Django等）により、末尾にスラッシュがないと302リダイレクトが発生し、
            // そのリダイレクト追従時に POST データのキーが消失する問題を防ぐため、
            // バックエンドプロキシ内だけで強制的に末尾スラッシュ付きのパスに変換して送信します。
            let targetPath = targetUrl.pathname;
            if (targetPath.startsWith('/api/') && !targetPath.endsWith('/')) {
                targetPath += '/';
            }

            performProxyRequest(req.method, targetPath + targetUrl.search, cleanHeaders, finalBodyBuffer);
        });
    });

    server.on('error', (err) => {
        logMessage('ERROR', `Server Port Bind / Communication Error: ${err.message}`);
        if (err.code === 'EADDRINUSE') {
            logMessage('ERROR', `Port ${currentPort} is already in use. Retrying with another port in 5s...`);
            setTimeout(() => {
                startServer(currentPort + 1);
            }, 5000);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        logMessage('SUCCESS', `Astrometry CORS Proxy & Admin Dashboard successfully running on port ${port} (0.0.0.0)`);
    });

    serverInstance = server;
}

// 初期ポート6004でサーバーを起動
startServer(currentPort);
