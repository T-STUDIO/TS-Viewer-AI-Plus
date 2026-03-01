
export interface HistogramData {
  counts: number[];
  maxCount: number;
}

/**
 * Calculates a 256-bin histogram from image data.
 * Optimized for performance on mobile by sampling if data is large.
 * Prevents division by zero and infinite loops with robust range checks.
 */
export function calculateHistogram(
  data: Float32Array | Uint8Array | Uint8ClampedArray, 
  min?: number, 
  max?: number
): HistogramData {
  const bins = 256;
  const counts = new Array(bins).fill(0);
  let maxCount = 0;

  if (data.length === 0) return { counts, maxCount: 1 };

  // Calculate local min/max if not provided
  let rangeMin = min;
  let rangeMax = max;

  // Sampling Logic: If the dataset is huge, process only a fraction to save memory/CPU on mobile
  // Target: ~250,000 samples for responsiveness
  const step = data.length > 500000 ? Math.floor(data.length / 250000) : 1;

  if (rangeMin === undefined || rangeMax === undefined) {
    // Find first valid finite value to initialize min/max
    let startVal = 0;
    for (let i = 0; i < data.length; i += step) {
        if (Number.isFinite(data[i])) {
            startVal = data[i];
            break;
        }
    }
    rangeMin = startVal;
    rangeMax = startVal;
    
    for (let i = 0; i < data.length; i += step) {
        const val = data[i];
        if (!Number.isFinite(val)) continue;
        if (val < rangeMin) rangeMin = val;
        if (val > rangeMax) rangeMax = val;
    }
  }

  // Prevent division by zero if image is solid color or range is invalid
  const range = (rangeMax! - rangeMin!) || 1;

  for (let i = 0; i < data.length; i += step) {
    const val = data[i];
    // Skip non-finite values (NaN, Inf) which cause binIndex to be NaN
    if (!Number.isFinite(val)) continue;
    
    let binIndex = Math.floor(((val - rangeMin!) / range) * (bins - 1));
    // Clamp index strictly
    if (binIndex < 0) binIndex = 0;
    if (binIndex >= bins) binIndex = bins - 1;
    counts[binIndex]++;
  }

  // Find max count for normalization (skip zero/full bins for scaling if they are noise)
  for (let i = 1; i < bins - 1; i++) {
    if (counts[i] > maxCount) maxCount = counts[i];
  }
  
  // Guard against extreme peaks at 0 or 255 (clipping) ruining the visualization scale
  if (counts[0] > maxCount * 5) maxCount = Math.max(maxCount, counts[0] / 5);
  if (counts[255] > maxCount * 5) maxCount = Math.max(maxCount, counts[255] / 5);
  
  // Absolute fallback
  if (maxCount === 0) {
    const absoluteMax = Math.max(...counts);
    maxCount = absoluteMax || 1;
  }

  return { counts, maxCount };
}

/**
 * Optimized luminance extractor with high-performance sampling for histogram calculation.
 * This version avoids creating massive intermediate arrays on iOS/mobile devices.
 */
export function getLuminanceArray(imageData: ImageData, sampleStep: number = 1): Uint8Array {
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    
    // Clamp sampleStep
    const step = Math.max(1, Math.floor(sampleStep));

    if (step === 1) {
        const lum = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            // Standard perceived luminance coefficients
            lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }
        return lum;
    } else {
        // Sampled path: significantly reduces memory footprint and loop iterations
        const sampledSize = Math.ceil(pixelCount / step);
        const lum = new Uint8Array(sampledSize);
        let targetIdx = 0;
        for (let i = 0; i < pixelCount; i += step) {
            const idx = i * 4;
            lum[targetIdx++] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        }
        return lum;
    }
}

/**
 * Applies color/level adjustments to pixels.
 */
export function applyLevels(
    sourceData: ImageData, 
    destData: ImageData,
    blackPoint: number,
    whitePoint: number,
    red: number = 1,
    green: number = 1,
    blue: number = 1,
    contrast: number = 0,
    mask?: Uint8ClampedArray,
    gamma: number = 1.0
) {
    const s = sourceData.data;
    const d = destData.data;
    const len = s.length;
    
    const range = (whitePoint - blackPoint) || 1;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const invGamma = 1.0 / Math.max(0.01, gamma);

    for (let i = 0; i < len; i += 4) {
        // Normalization (0-255)
        let r = ((s[i] - blackPoint) / range) * 255;
        let g = ((s[i+1] - blackPoint) / range) * 255;
        let b = ((s[i+2] - blackPoint) / range) * 255;

        // Balance
        r *= red; g *= green; b *= blue;

        // Gamma
        if (gamma !== 1.0) {
            r = Math.pow(Math.max(0, r) / 255, invGamma) * 255;
            g = Math.pow(Math.max(0, g) / 255, invGamma) * 255;
            b = Math.pow(Math.max(0, b) / 255, invGamma) * 255;
        }

        // Contrast adjustment
        let adjR = factor * (r - 128) + 128;
        let adjG = factor * (g - 128) + 128;
        let adjB = factor * (b - 128) + 128;

        // Clamp values to 0-255 range
        adjR = adjR < 0 ? 0 : (adjR > 255 ? 255 : adjR);
        adjG = adjG < 0 ? 0 : (adjG > 255 ? 255 : adjG);
        adjB = adjB < 0 ? 0 : (adjB > 255 ? 255 : adjB);

        if (mask) {
            const mIdx = i / 4;
            const alpha = mask[mIdx] / 255;
            d[i]   = s[i]   * (1 - alpha) + adjR * alpha;
            d[i+1] = s[i+1] * (1 - alpha) + adjG * alpha;
            d[i+2] = s[i+2] * (1 - alpha) + adjB * alpha;
        } else {
            d[i]   = adjR;
            d[i+1] = adjG;
            d[i+2] = adjB;
        }
        d[i+3] = s[i+3]; // Preserve original alpha channel
    }
}

/**
 * Creates feathered mask for lasso selection.
 */
export function createFeatheredMask(
    width: number, 
    height: number, 
    polygons: {x: number, y: number}[][],
    featherRadius: number = 30
): Uint8ClampedArray | null {
    if (polygons.length === 0) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'white';
    polygons.forEach(points => {
        if (points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    });

    if (featherRadius > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.filter = `blur(${featherRadius}px)`;
            tempCtx.drawImage(canvas, 0, 0);
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(tempCanvas, 0, 0);
        }
    }

    const maskData = ctx.getImageData(0, 0, width, height).data;
    const result = new Uint8ClampedArray(width * height);
    for (let i = 0; i < result.length; i++) {
        result[i] = maskData[i * 4]; 
    }
    return result;
}

/**
 * Simple auto-levels algorithm based on clipping thresholds.
 */
export function getAutoLevels(histogram: HistogramData): { black: number, white: number } {
  const total = histogram.counts.reduce((a, b) => a + b, 0);
  if (total === 0) return { black: 0, white: 255 };
  
  let sum = 0;
  let black = 0;
  let white = 255;

  // Clip 0.5% from darks and 0.2% from highlights for typical stretch
  const lowerClip = 0.005; 
  const upperClip = 0.998;

  for (let i = 0; i < histogram.counts.length; i++) {
    sum += histogram.counts[i];
    const percentage = sum / total;
    if (percentage < lowerClip) black = i;
    if (percentage > upperClip && white === 255) {
       white = i;
       break;
    }
  }
  if (black >= white - 2) { black = 0; white = 255; }
  return { black, white };
}

/**
 * Draws histogram with sqrt normalization for visibility of faint details.
 */
export function drawHistogram(
    histogram: HistogramData, 
    canvas: HTMLCanvasElement, 
    color: string = '#3b82f6'
) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
        const x = (width / 4) * i;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }
    ctx.stroke();

    ctx.fillStyle = color;
    const barWidth = width / 256;
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    const maxVal = Math.sqrt(histogram.maxCount || 1);
    
    for (let i = 0; i < 256; i++) {
        const val = histogram.counts[i] || 0;
        const normalized = Math.sqrt(val) / maxVal;
        const h = Math.min(normalized, 1.0) * (height * 0.95);
        const x = i * barWidth;
        const y = height - h;
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(width, height);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}
