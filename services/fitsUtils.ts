export interface FitsImage {
  width: number;
  height: number;
  data: Float32Array;
  planes: number;
  min: number;
  max: number;
  header: Record<string, string>;
}

export async function parseFits(file: Blob): Promise<FitsImage> {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);
  const textDecoder = new TextDecoder("utf-8");
  let headerEnd = 0, width = 0, height = 0, bitpix = 0, bzero = 0, bscale = 1, planes = 1;
  const header: Record<string, string> = {};
  let foundEnd = false;
  
  while (!foundEnd && headerEnd < buffer.byteLength) {
    for (let i = 0; i < 2880; i += 80) {
      const lineOffset = headerEnd + i;
      if (lineOffset + 80 > buffer.byteLength) break;
      const line = textDecoder.decode(buffer.slice(lineOffset, lineOffset + 80));
      const key = line.substring(0, 8).trim();
      if (key === 'END') { foundEnd = true; break; }
      if (line.includes('=')) {
        const parts = line.split('=');
        let value = parts.slice(1).join('=').trim().split('/')[0].trim().replace(/^'|'$/g, "").trim();
        if (key) header[key] = value;
        if (key === 'BITPIX') bitpix = parseInt(value, 10);
        else if (key === 'NAXIS1') width = parseInt(value, 10);
        else if (key === 'NAXIS2') height = parseInt(value, 10);
        else if (key === 'NAXIS3') planes = parseInt(value, 10);
        else if (key === 'BZERO') bzero = parseFloat(value);
        else if (key === 'BSCALE') bscale = parseFloat(value);
      }
    }
    headerEnd += 2880;
  }

  const planeSize = width * height;
  const totalPixels = planeSize * planes;
  const resultData = new Float32Array(totalPixels);
  let offset = headerEnd, min = Infinity, max = -Infinity;
  
  const bytesPerPixel = Math.abs(bitpix) / 8;

  for (let p = 0; p < planes; p++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (offset >= buffer.byteLength) break;
        let raw = 0;
        if (bitpix === 8) raw = dataView.getUint8(offset++);
        else if (bitpix === 16) { raw = dataView.getInt16(offset, false); offset += 2; }
        else if (bitpix === 32) { raw = dataView.getInt32(offset, false); offset += 4; }
        else if (bitpix === -32) { raw = dataView.getFloat32(offset, false); offset += 4; }
        else if (bitpix === -64) { raw = dataView.getFloat64(offset, false); offset += 8; }
        
        const value = bscale * raw + bzero;
        
        // FITS standard is Bottom-Up. We store Top-Down internally.
        const targetY = height - 1 - y;
        const targetIdx = p * planeSize + (targetY * width + x);
        resultData[targetIdx] = value;
        
        if (value < min) min = value; if (value > max) max = value;
      }
    }
  }
  return { width, height, data: resultData, planes, min, max, header };
}

export function renderFitsToCanvas(fits: FitsImage, canvas: HTMLCanvasElement) {
  canvas.width = fits.width; canvas.height = fits.height;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const imageData = ctx.createImageData(fits.width, fits.height);
  const data = imageData.data;
  const range = (fits.max - fits.min) || 1;
  const planeSize = fits.width * fits.height;
  
  for (let i = 0; i < planeSize; i++) {
    const idx = i * 4;
    if (fits.planes >= 3) {
      // RGB
      data[idx]     = Math.max(0, Math.min(255, Math.floor(((fits.data[i] - fits.min) / range) * 255)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.floor(((fits.data[i + planeSize] - fits.min) / range) * 255)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.floor(((fits.data[i + 2 * planeSize] - fits.min) / range) * 255)));
    } else {
      // Grayscale
      let v = Math.floor(((fits.data[i] - fits.min) / range) * 255);
      data[idx] = data[idx+1] = data[idx+2] = Math.max(0, Math.min(255, v)); 
    }
    data[idx+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Generates a FITS-compliant header record (80 chars)
 */
export function formatFitsRecord(key: string, value: any): string {
    const keyClean = key.trim().toUpperCase();
    if (keyClean === 'END') return "END".padEnd(80, ' ');

    const kStr = keyClean.substring(0, 8).padEnd(8, ' ');
    let vStr = "";
    
    if (typeof value === 'boolean') {
        vStr = (value ? 'T' : 'F').padStart(20, ' ');
    } else if (typeof value === 'number') {
        vStr = value.toString().substring(0, 20).padStart(20, ' ');
    } else {
        const s = String(value).replace(/'/g, "''"); 
        vStr = `'${s.padEnd(8, ' ')}'`.padEnd(20, ' ');
    }
    
    return `${kStr}= ${vStr}`.padEnd(80, ' ');
}

/**
 * Generates a full Pseudo-FITS header string starting with SIMPLE=T.
 * This ensures maximum compatibility across all image formats.
 */
export function generateFitsHeaderString(width: number, height: number, wcsData: Record<string, any>, includeNewlines: boolean = false): string {
    const naxis = wcsData['NAXIS'] || 2;
    const lines: string[] = [
      formatFitsRecord("SIMPLE", true), 
      formatFitsRecord("BITPIX", -32), 
      formatFitsRecord("NAXIS", naxis),
      formatFitsRecord("NAXIS1", width), 
      formatFitsRecord("NAXIS2", height)
    ];
    if (naxis > 2 && wcsData['NAXIS3']) {
        lines.push(formatFitsRecord("NAXIS3", wcsData['NAXIS3']));
    }
    lines.push(formatFitsRecord("EXTEND", true));
    
    const ignore = ['SIMPLE', 'BITPIX', 'NAXIS', 'NAXIS1', 'NAXIS2', 'NAXIS3', 'END', 'BSCALE', 'BZERO', 'EXTEND'];
    for (const [key, val] of Object.entries(wcsData)) {
        if (!ignore.includes(key.toUpperCase())) {
            lines.push(formatFitsRecord(key, val));
        }
    }
    lines.push(formatFitsRecord("END", ""));
    
    return includeNewlines ? lines.join('\n') : lines.join('');
}

export function writeFits(data: Float32Array, width: number, height: number, header: Record<string, string | number | boolean>, planes: number = 1): Blob {
    let min = Infinity, max = -Infinity;
    for(let i=0; i<data.length; i++) { if(data[i]<min) min=data[i]; if(data[i]>max) max=data[i]; }
    
    const wcsData = { ...header, NAXIS: planes > 1 ? 3 : 2, DATAMIN: min, DATAMAX: max };
    if (planes > 1) wcsData['NAXIS3'] = planes;

    const headerBase = generateFitsHeaderString(width, height, wcsData);
    
    const hPadCount = (2880 - (headerBase.length % 2880)) % 2880;
    const hPad = "".padEnd(hPadCount, ' ');
    const hFull = headerBase + hPad;
    
    const planeSize = width * height;
    const dLen = planeSize * planes * 4;
    const dPadCount = (2880 - (dLen % 2880)) % 2880;
    
    const buf = new ArrayBuffer(hFull.length + dLen + dPadCount);
    const view = new DataView(buf);
    
    for (let i = 0; i < hFull.length; i++) view.setUint8(i, hFull.charCodeAt(i));
    
    const dStart = hFull.length;
    // Write planes sequentially
    for (let p = 0; p < planes; p++) {
        const planeOffset = p * planeSize;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcY = height - 1 - y;
                const srcIdx = planeOffset + (srcY * width + x);
                const destIdx = p * planeSize + (y * width + x);
                view.setFloat32(dStart + destIdx * 4, data[srcIdx], false);
            }
        }
    }
    for (let i = 0; i < dPadCount; i++) view.setUint8(dStart + dLen + i, 0);
    
    return new Blob([buf], { type: 'application/fits' });
}