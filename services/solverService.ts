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

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  private async fetchAndValidateFits(urlOrPath: string): Promise<Blob> {
      let lastError: Error | null = null;
      const maxRetries = 10;
      const targetUrlBase = urlOrPath.startsWith('http') ? urlOrPath : `${API_URL}${urlOrPath}`;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
              const waitTime = Math.min(2000 * Math.pow(1.5, attempt), 20000);
              await delay(waitTime);
          }
          const targetUrl = `${targetUrlBase}${targetUrlBase.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          let is404 = false;

          for (const proxy of PROXIES) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); 
              try {
                  const proxyUrl = proxy.gen(targetUrl);
                  const res = await fetch(proxyUrl, { referrerPolicy: 'no-referrer', credentials: 'omit', cache: 'no-store', signal: controller.signal });
                  clearTimeout(timeoutId);
                  if (res.status === 404) { is404 = true; throw new Error("HTTP 404"); }
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const blob = await res.blob();
                  const signature = await blob.slice(0, 6).text();
                  if (signature === 'SIMPLE') return blob;
                  throw new Error("Invalid FITS signature");
              } catch (e) {
                  clearTimeout(timeoutId);
                  lastError = e as Error;
                  if (is404) break;
                  await delay(500); 
              }
          }
          if (is404) continue;
      }
      throw lastError || new Error("FITS fetch failed");
  }

  async login(): Promise<string> {
    const params = new URLSearchParams();
    params.append('request-json', JSON.stringify({ apikey: this.apiKey }));
    const res = await fetchUrlWithProxy(`${API_URL}/login`, { method: 'POST', body: params });
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
    const res = await fetchUrlWithProxy(`${API_URL}/upload`, { method: 'POST', body: formData });
    const data: SolverUpload = await res.json();
    if (data.status !== 'success') throw new Error(data.errormessage || "Upload Error");
    return data.subid;
  }

  async waitForJob(subId: number, onStatus?: (status: string) => void): Promise<number> {
    let attempts = 0;
    while (attempts < 100) { 
      const res = await fetchUrlWithProxy(`${API_URL}/submissions/${subId}?_t=${Date.now()}`);
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
      const res = await fetchUrlWithProxy(`${API_URL}/jobs/${jobId}?_t=${Date.now()}`);
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
      const res = await fetchUrlWithProxy(`${API_URL}/jobs/${jobId}/annotations/`);
      const data: SolverAnnotations = await res.json();
      return data.annotations || [];
    } catch { return []; }
  }

  async getWcsHeader(jobId: number): Promise<Record<string, string | number>> {
    try {
      const blob = await this.fetchAndValidateFits(`${SITE_URL}/wcs_file/${jobId}`);
      const rawText = await blob.text();
      return parseFitsHeader(rawText);
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
                  pixely: Number(ann.pixely ?? ann.y ?? 0),
                  ra: ann.ra,
                  dec: ann.dec
              }));
          }
      } catch (e) {
          console.error("Local Solver Processing Error", e);
          wcsObj = parseFitsHeader(responseText);
      }

      return { wcs: wcsObj, annotations };
  }
}