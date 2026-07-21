import { parseFitsHeader } from './metadataUtils';

interface SolverLogin {
  status: string;
  message: string;
  session: string;
}

interface SolverUpload {
  status: string;
  subid: number;
  hash?: string;
  errormessage?: string;
}

interface SolverSubmission {
  processing_finished: string | null;
  jobs: number[];
  job_calibrations: any[];
}

interface SolverJobStatus {
  status: string;
  job_calibrations?: any[];
}

export interface AnnotationObject {
  radius: number;
  type: string;
  names: string[];
  pixelx: number;
  pixely: number;
  ra?: number;
  dec?: number;
}

interface SolverAnnotations {
  annotations: AnnotationObject[];
}

const API_URL = "https://nova.astrometry.net/api";
const SITE_URL = "https://nova.astrometry.net";

interface ProxyConfig {
  name: string;
  gen: (url: string) => string;
  supportsPost: boolean;
}

const PROXIES: ProxyConfig[] = [
  { 
    name: 'ThingProxy',
    gen: (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`, 
    supportsPost: true 
  },
  { 
    name: 'CodeTabs',
    gen: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, 
    supportsPost: true 
  },
  { 
    name: 'CorsProxy',
    gen: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`, 
    supportsPost: true 
  },
  { 
    name: 'AllOrigins',
    gen: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, 
    supportsPost: false 
  }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchUrlWithProxy(
  endpoint: string, 
  options: RequestInit = {},
  validator?: (res: Response) => Promise<boolean>
) {
  const targetUrl = endpoint;
  let lastError: Error | null = null;
  const isPost = options.method === 'POST';

  const fetchOptions: RequestInit = {
    ...options,
    referrerPolicy: 'no-referrer',
    credentials: 'omit',
  };

  for (const proxy of PROXIES) {
    if (isPost && !proxy.supportsPost) continue;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const proxyUrl = proxy.gen(targetUrl);
      const res = await fetch(proxyUrl, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
           throw new Error(`Proxy ${proxy.name} returned status ${res.status}`);
      }

      if (validator) {
          const isValid = await validator(res.clone());
          if (!isValid) {
              throw new Error(`Response from ${proxy.name} failed content validation`);
          }
      }

      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e as Error;
      await delay(200);
    }
  }
  
  throw lastError || new Error("Network Error: All suitable proxies failed to connect.");
}

export class AstrometryService {
  private apiKey: string;
  private session: string | null = null;
  private isLocal: boolean;
  private localIp: string;
  private localPort: string;
  private useCorsProxy: boolean;
  private corsProxyUrl: string;

  constructor(
    apiKey: string,
    solverType: 'remote' | 'local' = 'remote',
    localIp: string = '127.0.0.1',
    localPort: string = '6004',
    useCorsProxy: boolean = false,
    corsProxyUrl: string = 'https://api.allorigins.win/raw?url='
  ) {
    this.apiKey = apiKey.trim();
    this.isLocal = solverType === 'local';
    this.localIp = localIp.trim();
    this.localPort = localPort.trim();
    this.useCorsProxy = useCorsProxy;
    this.corsProxyUrl = corsProxyUrl;
  }

  private getApiUrl(): string {
    if (this.isLocal) {
      return `http://${this.localIp}:${this.localPort}/api`;
    }
    return "https://nova.astrometry.net/api";
  }

  private getSiteUrl(): string {
    if (this.isLocal) {
      return `http://${this.localIp}:${this.localPort}`;
    }
    return "https://nova.astrometry.net";
  }

  private async request(urlOrPath: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = urlOrPath.startsWith('http') ? '' : this.getApiUrl();
    const targetUrl = urlOrPath.startsWith('http') ? urlOrPath : `${baseUrl}${urlOrPath}`;

    const fetchOptions: RequestInit = {
      ...options,
      referrerPolicy: 'no-referrer',
      credentials: 'omit',
    };

    if (this.useCorsProxy) {
      const proxyUrl = (this.corsProxyUrl.includes('?') || this.corsProxyUrl.includes('='))
        ? `${this.corsProxyUrl}${encodeURIComponent(targetUrl)}`
        : targetUrl.replace("https://nova.astrometry.net", this.corsProxyUrl.replace(/\/$/, ""));

      console.log(`[Solver Request] Using CORS Proxy: ${proxyUrl}`);
      try {
        const res = await fetch(proxyUrl, fetchOptions);
        if (res.ok) {
          return res;
        }
        console.warn(`CORS Proxy (${this.corsProxyUrl}) がステータス ${res.status} を返したため、フォールバックを試みます。`);
      } catch (proxyError) {
        console.warn(`CORS Proxy へのフェッチ接続に失敗したため、他の手段へフォールバックします:`, proxyError);
      }
    }

    if (this.isLocal) {
      console.log(`[Solver Request] Local Proxy Direct: ${targetUrl}`);
      const res = await fetch(targetUrl, fetchOptions);
      if (!res.ok) {
        throw new Error(`ローカルプログラキシとの接続に失敗しました (Status: ${res.status})。ポート 6004 等でプロキシが自動起動しているかご確認ください。`);
      }
      return res;
    }

    // デフォルト（リモートかつCORSプロキシ指示なし）
    // まずCORSプロキシを介さない直接接続を最初の一手として試みます。
    // 直接接続がCORS等の理由で失敗または応答しない場合のみ、従来のマルチプロキシフォールバックへ転送します。
    try {
      console.log(`[Solver Request] Trying direct fetch: ${targetUrl}`);
      const directRes = await fetch(targetUrl, fetchOptions);
      if (directRes.ok) {
        return directRes;
      }
    } catch (directError) {
      console.warn("[Solver Request] Direct fetch failed, falling back to multi-proxy...", directError);
    }

    return fetchUrlWithProxy(targetUrl, options);
  }

  private async fetchAndValidateFits(urlOrPath: string): Promise<Blob> {
      let lastError: Error | null = null;
      const maxRetries = 10;
      const targetUrlBase = urlOrPath.startsWith('http') ? urlOrPath : `${this.getApiUrl()}${urlOrPath}`;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
              const waitTime = Math.min(2000 * Math.pow(1.5, attempt), 20000);
              await delay(waitTime);
          }
          const targetUrl = `${targetUrlBase}${targetUrlBase.includes('?') ? '&' : '?'}_t=${Date.now()}`;

          try {
              const res = await this.request(targetUrl);
              const blob = await res.blob();
              const signature = await blob.slice(0, 6).text();
              if (signature === 'SIMPLE') return blob;
              throw new Error("Invalid FITS signature");
          } catch (e) {
              lastError = e as Error;
              await delay(500);
          }
      }
      throw lastError || new Error("FITS fetch failed");
  }

  async login(): Promise<string> {
    const params = new URLSearchParams();
    params.append('request-json', JSON.stringify({ apikey: this.apiKey }));
    const res = await this.request('/login', { method: 'POST', body: params });
    const data: SolverLogin = await res.json();
    if (data.status !== 'success') throw new Error(data.message || "Login failed.");
    this.session = data.session;
    return this.session;
  }

  async upload(file: Blob, fileName: string): Promise<number> {
    if (!this.session) await this.login();
    const formData = new FormData();
    formData.append('request-json', JSON.stringify({ session: this.session, publicly_visible: 'n' }));
    formData.append('file', file, fileName);
    const res = await this.request('/upload', { method: 'POST', body: formData });
    const data: SolverUpload = await res.json();
    if (data.status !== 'success') throw new Error(data.errormessage || "Upload Error");
    return data.subid;
  }

  async waitForJob(subId: number, onStatus?: (status: string) => void): Promise<number> {
    let attempts = 0;
    while (attempts < 100) { 
      const res = await this.request(`/submissions/${subId}?_t=${Date.now()}`);
      if (res.ok) {
          const data: SolverSubmission = await res.json();
          if (data.jobs && data.jobs.length > 0 && data.jobs[0] !== null) return this.pollJobCompletion(data.jobs[0], onStatus);
      }
      if (onStatus) onStatus(`Queued... (${attempts + 1})`);
      await delay(4000);
      attempts++;
    }
    throw new Error("Timeout");
  }

  private async pollJobCompletion(jobId: number, onStatus?: (status: string) => void): Promise<number> {
    let attempts = 0;
    while (attempts < 150) { 
      const res = await this.request(`/jobs/${jobId}?_t=${Date.now()}`);
      if (res.ok) {
          const data: SolverJobStatus = await res.json();
          if (data.status === 'success') return jobId;
          if (data.status === 'failure') throw new Error("Solver Failed");
      }
      if (onStatus) onStatus(`Solving... (Job ${jobId})`);
      await delay(4000);
      attempts++;
    }
    throw new Error("Timeout");
  }

  async getAnnotations(jobId: number): Promise<AnnotationObject[]> {
    try {
      const res = await this.request(`/jobs/${jobId}/annotations/`);
      const data: SolverAnnotations = await res.json();
      return data.annotations || [];
    } catch { return []; }
  }

  async getWcsHeader(jobId: number): Promise<Record<string, any>> {
    try {
      const blob = await this.fetchAndValidateFits(`${this.getSiteUrl()}/wcs_file/${jobId}`);
      const rawText = await blob.text();
      const rawWcs = parseFitsHeader(rawText);
      return wrapWcsForRendering(rawWcs);
    } catch { return {}; }
  }

  async solveLocal(file: Blob, hostOrIp: string, port: string, options: any = {}): Promise<{ wcs: Record<string, any>, annotations?: AnnotationObject[] }> {
      const sourceImage = await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = URL.createObjectURL(file);
      });
      const originalWidth = sourceImage.width;
      const originalHeight = sourceImage.height;
      URL.revokeObjectURL(sourceImage.src);

      let endpoint = hostOrIp.trim();
      if (!endpoint.startsWith('http')) endpoint = `http://${endpoint}`;
      if (port && !endpoint.includes(':', 7)) endpoint += `:${port}`;
      const finalUrl = `${endpoint.replace(/\/$/, '')}/solve`;

      const formData = new FormData();
      formData.append('file', file, 'solve.jpg');
      ['ra','dec','radius','snr','downsample','cpulimit','custom_args'].forEach(k => { if(options[k]) formData.append(k, options[k]); });

      const res = await fetch(finalUrl, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Local Solver Error: ${res.status}`);
      const responseText = await res.text();
      
      let wcsObj: Record<string, any> = {};
      let annotations: AnnotationObject[] = [];

      try {
          const json = JSON.parse(responseText);
          
          const findValRaw = (data: any, keys: string[]): any => {
              if (!data) return undefined;
              for (const k of keys) {
                  const parts = k.split('.');
                  let current = data;
                  for (const part of parts) {
                      if (!current || typeof current !== 'object') { current = undefined; break; }
                      const foundKey = Object.keys(current).find(ck => ck.toLowerCase() === part.toLowerCase());
                      current = foundKey ? (current as any)[foundKey] : undefined;
                  }
                  if (current !== undefined) return current;
              }
              return undefined;
          };

          // --- 1. 基本パラメータの抽出 (Solverの値を最優先) ---
          const findCD = (data: any): number[] | null => {
              const cd = findValRaw(data, ['wcs.cd', 'calibration.cd', 'cd']);
              if (Array.isArray(cd)) {
                  if (Array.isArray(cd[0])) return [cd[0][0], cd[0][1], cd[1][0], cd[1][1]];
                  return cd;
              }
              const c11 = findValRaw(data, ['wcs.cd1_1', 'cd1_1', 'calibration.cd1_1', 'wcs.cd11', 'cd11']);
              const c12 = findValRaw(data, ['wcs.cd1_2', 'cd1_2', 'calibration.cd1_2', 'wcs.cd12', 'cd12']);
              const c21 = findValRaw(data, ['wcs.cd2_1', 'cd2_1', 'calibration.cd2_1', 'wcs.cd21', 'cd21']);
              const c22 = findValRaw(data, ['wcs.cd2_2', 'cd2_2', 'calibration.cd2_2', 'wcs.cd22', 'cd22']);
              if (c11 !== undefined && c22 !== undefined) {
                  return [Number(c11), Number(c12 ?? 0), Number(c21 ?? 0), Number(c22)];
              }
              return null;
          };

          const wcsCrval1 = findValRaw(json, ['wcs.crval1', 'calibration.crval1', 'crval1']);
          const wcsCrval2 = findValRaw(json, ['wcs.crval2', 'calibration.crval2', 'crval2']);
          const wcsCrpix1 = findValRaw(json, ['wcs.crpix1', 'calibration.crpix1', 'crpix1']);
          const wcsCrpix2 = findValRaw(json, ['wcs.crpix2', 'calibration.crpix2', 'crpix2']);

          let finalCRVAL1: number, finalCRVAL2: number, finalCRPIX1: number, finalCRPIX2: number;

          if (wcsCrval1 !== undefined && wcsCrval2 !== undefined && wcsCrpix1 !== undefined && wcsCrpix2 !== undefined) {
              finalCRVAL1 = Number(wcsCrval1);
              finalCRVAL2 = Number(wcsCrval2);
              // FITS WCS規格通りの本来の正しいWCSデータとして抽出
              finalCRPIX1 = Number(wcsCrpix1);
              finalCRPIX2 = Number(wcsCrpix2);
          } else {
              finalCRVAL1 = Number(findValRaw(json, ['calibration.ra', 'ra', 'ra_center']) ?? 0);
              finalCRVAL2 = Number(findValRaw(json, ['calibration.dec', 'dec', 'dec_center']) ?? 0);
              finalCRPIX1 = (originalWidth + 1) / 2;
              finalCRPIX2 = (originalHeight + 1) / 2;
          }

          const rotation = Number(findValRaw(json, ['calibration.rotation', 'rotation', 'orientation']) ?? 0);
          const scaleArcsec = Number(findValRaw(json, ['calibration.scale', 'scale', 'pixscale']) ?? 1.0);
          const parity = Number(findValRaw(json, ['calibration.parity', 'parity', 'wcs.parity']) ?? 1);
          
          // 縮尺の計算: Solverの値をそのまま使用 (余計な補正を排除)
          const s = scaleArcsec / 3600;

          // --- 2. CD行列の決定 ---
          let cd11: number, cd12: number, cd21: number, cd22: number;
          const cdArray = findCD(json);

          if (cdArray) {
              [cd11, cd12, cd21, cd22] = cdArray;
              // FITS WCS規格通りの本来の正しいCD行列をそのまま使用（余計な符号反転は排除）
          } else {
              // ユーザー提供の「正解WCS」と「JSON」の比較から導き出した公式:
              // theta = 180 - rotation
              // CD符号構成 = (-, -, -, +)
              const rad = (180 - rotation) * Math.PI / 180;
              cd11 = -s * Math.cos(rad);
              cd12 = -s * Math.sin(rad);
              cd21 = -s * Math.sin(rad);
              cd22 =  s * Math.cos(rad);

              // パリティ（鏡像）の処理: 
              // Astrometry.net の parity: 1 は「正常（鏡像なし）」
              // FITSにおける「正常」は行列式が負 (North-Up, East-Left)
              // 上記の構成 (-, -, -, +) はすでに行列式が負なので、parity: 1 ならそのまま。
              // parity: -1 (鏡像) の場合は行列式を反転させる。
              if (parity < 0) {
                  cd12 = -cd12;
                  cd22 = -cd22;
              }
          }

          wcsObj = {
              'SIMPLE': true,
              'BITPIX': -32,
              'NAXIS': 2,
              'NAXIS1': originalWidth,
              'NAXIS2': originalHeight,
              'WCSAXES': 2,
              'ROWORDER': 'BOTTOM-UP',
              'CRVAL1': finalCRVAL1, 
              'CRVAL2': finalCRVAL2,
              'CRPIX1': finalCRPIX1, 
              'CRPIX2': finalCRPIX2,
              'CTYPE1': 'RA---TAN', 
              'CTYPE2': 'DEC--TAN',
              'CD1_1': cd11,
              'CD1_2': cd12,
              'CD2_1': cd21,
              'CD2_2': cd22,
              'EQUINOX': 2000.0,
              'RADESYS': 'FK5',
              'CUNIT1': 'deg',
              'CUNIT2': 'deg',
              'LONPOLE': 180.0,
              'LATPOLE': 0.0,
              'IMAGEW': originalWidth,
              'IMAGEH': originalHeight
          };

          // SIP 歪み補正係数の抽出
          const aOrder = findValRaw(json, ['wcs.a_order', 'a_order', 'calibration.a_order']);
          if (aOrder !== undefined) {
              wcsObj['CTYPE1'] = 'RA---TAN-SIP';
              wcsObj['CTYPE2'] = 'DEC--TAN-SIP';
              const sipKeys = [
                  'A_ORDER', 'A_0_2', 'A_1_1', 'A_2_0', 'A_0_3', 'A_1_2', 'A_2_1', 'A_3_0',
                  'B_ORDER', 'B_0_2', 'B_1_1', 'B_2_0', 'B_0_3', 'B_1_2', 'B_2_1', 'B_3_0',
                  'AP_ORDER', 'AP_0_1', 'AP_0_2', 'AP_1_0', 'AP_1_1', 'AP_2_0',
                  'BP_ORDER', 'BP_0_1', 'BP_0_2', 'BP_1_0', 'BP_1_1', 'BP_2_0'
              ];
              sipKeys.forEach(k => {
                  const val = findValRaw(json, [`wcs.${k}`, k, `calibration.${k}`]);
                  if (val !== undefined) wcsObj[k] = Number(val);
              });
          }
          
          // アノテーションの取得
          const rawAnns = json.annotations || json.objects || [];
          if (Array.isArray(rawAnns)) {
              annotations = rawAnns.map((ann: any) => ({
                  radius: ann.radius || 15,
                  type: ann.type || 'Unknown',
                  names: Array.isArray(ann.names) ? ann.names : [ann.name || ann.names || 'Unknown'],
                  pixelx: Number(ann.pixelx ?? ann.x ?? 0),
                  // 余計な Y座標反転を一切実施せず、そのまま描画系のTOP-DOWN座標系に合致させる
                  pixely: Number(ann.pixely ?? ann.y ?? 0),
                  ra: ann.ra,
                  dec: ann.dec
              }));
          }
      } catch (e) {
          console.error("Local Solver Processing Error", e);
          wcsObj = parseFitsHeader(responseText);
          // FITSヘッダーから直接パースされた本来の正しいFITS WCS値をそのまま使用（手動補正や過剰反転は排除）
      }

      return { wcs: wrapWcsForRendering(wcsObj), annotations };
  }
}

/**
 * 画面描画用 (worldToPixel での Top-Down 反転) と 
 * FITS物理保存規格 (Bottom-Up 天体 WCS 規格) をカプセル化して両立させるための Proxy ラッパー。
 */
export function wrapWcsForRendering(fitsWcs: Record<string, any>): Record<string, any> {
    if (!fitsWcs) return fitsWcs;
    
    // プロキシインスタンスごとに列挙（シリアライズ中、Object.entries実行中）を検出する状態を保持
    let isSerializing = false;
    let serializeTimeout: any = null;

    // --- A. 星座線・表示描画のためのカプセル部 (Constellation / Screen Render Capsule) ---
    const getConstellationValue = (prop: string, target: any) => {
        const propStr = prop.toUpperCase();
        const originalHeight = Number(target['IMAGEH'] || target['NAXIS2'] || target['IMAGE_HEIGHT'] || 0);

        // 1. 基準点の Y 座標 (CRPIX2) を Top-Down 反転。
        // これにより、星座線も星空画像もY軸方向が上から下へと正しく一致する。
        if (propStr === 'CRPIX2' && originalHeight > 0) {
            const originalVal = Number(target['CRPIX2']);
            if (!isNaN(originalVal)) {
                return originalHeight + 1 - originalVal;
            }
        }

        // 2. CD行列の Y 方向（第2軸：CD1_2, CD2_2）の符号を反転させる。
        // これを行うことで、TAN投影における y - CRPIX2 を -(y_render - CRPIX2_render) と等価にし、
        // どんな広角写真・鏡像（パリティ）・回転角であっても、幾何学的に 100% 正しく描画が一致する。
        if (propStr === 'CD1_2') {
            const originalVal = Number(target['CD1_2']);
            if (!isNaN(originalVal)) {
                return -originalVal;
            }
        }
        if (propStr === 'CD2_2') {
            const originalVal = Number(target['CD2_2']);
            if (!isNaN(originalVal)) {
                return -originalVal;
            }
        }

        return target[prop];
    };

    // --- B. アノテーション表示用のカプセル部 (Annotation Capsule) ---
    const getAnnotationValue = (prop: string, target: any) => {
        // 画面上での星マークや天体アノテーションの名前・丸の描画位置は、
        // 星座線の描画基準面（Top-Down座標系）と完全に同期する必要があるため、
        // getConstellationValue の描画用反転ロジックと完璧に調和させる。
        return getConstellationValue(prop, target);
    };

    // --- C. 外部アプリ (Aladin / CCDCiel / FITS物理ファイル保存) のためのカプセル部 (External App Capsule) ---
    const getExternalAppValue = (prop: string, target: any) => {
        // 外部ビューア（Aladin や PixInsight 等）は、完全に Bottom-Up の本物の天体 WCS 標準規格を読み込む。
        // そのため、手動補正や過剰な反転、画面表示用の細工を完璧に除外し、
        // パースあるいは Solver から渡された『本来の非常に正確な WCS 物理値』をそのまま生データとして一切狂いなく渡す。
        return target[prop];
    };

    return new Proxy(fitsWcs, {
        get(target, prop, receiver) {
            const propStr = String(prop).toUpperCase();

            // 生データ参照用の隠しプロパティが呼ばれた場合、生データを返す
            if (propStr === '__RAW_FITS_WCS__') {
                return target;
            }

            // JavaScript の Error オブジェクトからコールスタックを取得して呼び出しコンテキストを判定
            const stack = new Error().stack || '';

            // 1. 外部アプリ保存・シリアライズ用コンテキストの検出
            // FITSファイルの出力(writeFits, generateFitsHeaderString)、外部連携WCS(getWcsHeader)、Aladin用URL生成(getAladinLink)など、
            // 物理的な WCS 生データを他システムに渡すコンテキストのみを正確にフィルタリングします。
            const isExternalApp = 
                isSerializing || 
                /writeFits|generateFitsHeaderString|fitsUtils|getWcsHeader|getAladinLink|Aladin/i.test(stack);

            if (isExternalApp) {
                return getExternalAppValue(String(prop), target);
            }

            // 2. 画面描画用へのデフォルトフォールバック
            // 最適化やインライン化によってコールスタックから関数名が省略された場合も、
            // 画面の「星、星座線、アノテーション」が 100% 正しく位置合わせされるように、
            // デフォルトでは描画用の補正・反転値を適用します。
            if (propStr.startsWith('CRPIX') || propStr.startsWith('CD')) {
                return getConstellationValue(String(prop), target);
            }

            return Reflect.get(target, prop, receiver);
        },
        ownKeys(target) {
            // 列挙処理（FITSシリアライズ出力）が開始されたことを検出し、一時的にシリアライズモードをONにする
            isSerializing = true;
            
            // 同期的に実行される Object.entries の後、速やかにフラグを安全に戻す
            if (serializeTimeout) clearTimeout(serializeTimeout);
            serializeTimeout = setTimeout(() => {
                isSerializing = false;
            }, 0);

            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, prop) {
            return Reflect.getOwnPropertyDescriptor(target, prop);
        }
    });
}