/**
 * Stacking Service for Astronomical Images
 * Features:
 * 1. Astro-alignment (translation, rotation) using star-centroid pattern matching
 * 2. Hot-pixel removal via isolated pixel spike detection
 * 3. Histogram optimization combining stacking with auto-stretch
 * 4. Noise reduction via multi-image averaging and background gradient flattening
 */

import { FileEntry } from '../types';

interface Star {
  x: number;
  y: number;
  brightness: number;
}

interface Transform {
  tx: number; // translation x
  ty: number; // translation y
  theta: number; // rotation angle in radians
  success: boolean; // alignment success flag
}

/**
 * Detects prominent stars (bright centroids) in the image
 */
export function detectStars(canvas: HTMLCanvasElement, maxStars = 15): Star[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Calculate luminance and standard deviation to find thresholds
  let sum = 0;
  let sumSq = 0;
  const sampleStep = Math.max(1, Math.floor((width * height) / 10000)); // Sample ~10,000 pixels for statistics
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum;
    sumSq += lum * lum;
    count++;
  }
  const avg = sum / count;
  const stdDev = Math.sqrt(Math.max(0, (sumSq / count) - (avg * avg)));
  const starThreshold = avg + 2.5 * stdDev + 15; // Set dynamic threshold of mean + 2.5 sigma

  const stars: Star[] = [];
  const searchRadius = 4;

  // Scan grid to avoid clustering and detect local peaks
  const stepX = Math.max(10, Math.floor(width / 30));
  const stepY = Math.max(10, Math.floor(height / 30));

  for (let y = searchRadius + 5; y < height - searchRadius - 5; y += stepY) {
    for (let x = searchRadius + 5; x < width - searchRadius - 5; x += stepX) {
      // Find local maximum in a 5x5 window around (x, y)
      let maxVal = -1;
      let maxPx = x;
      let maxPy = y;

      for (let wy = -3; wy <= 3; wy++) {
        for (let wx = -3; wx <= 3; wx++) {
          const px = x + wx;
          const py = y + wy;
          const idx = (py * width + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > maxVal) {
            maxVal = lum;
            maxPx = px;
            maxPy = py;
          }
        }
      }

      if (maxVal > starThreshold) {
        // Calculate sub-pixel centroid
        let sumW = 0;
        let sumWX = 0;
        let sumWY = 0;

        for (let wy = -searchRadius; wy <= searchRadius; wy++) {
          for (let wx = -searchRadius; wx <= searchRadius; wx++) {
            const px = maxPx + wx;
            const py = maxPy + wy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const w = Math.max(0, (0.299 * r + 0.587 * g + 0.114 * b) - thresholdBg(data, px, py, width, height));
              sumW += w;
              sumWX += w * px;
              sumWY += w * py;
            }
          }
        }

        if (sumW > 0) {
          const cx = sumWX / sumW;
          const cy = sumWY / sumW;
          // Check if this star is already added
          const duplicate = stars.some(s => Math.hypot(s.x - cx, s.y - cy) < 10);
          if (!duplicate) {
            stars.push({ x: cx, y: cy, brightness: maxVal });
          }
        }
      }
    }
  }

  // Sort stars by brightness descending and return top stars
  return stars.sort((a, b) => b.brightness - a.brightness).slice(0, maxStars);
}

function thresholdBg(data: Uint8ClampedArray, x: number, y: number, w: number, h: number): number {
  // Simple background estimation around pixel
  const idx = (y * w + x) * 4;
  return (data[idx] + data[idx+1] + data[idx+2]) / 6; // slightly lower than average channel
}

/**
 * Estimates optimal layout transformation (Translation + Rotation) from srcStars to refStars
 */
export function estimateTransform(refStars: Star[], srcStars: Star[]): Transform {
  if (refStars.length === 0 || srcStars.length === 0) {
    return { tx: 0, ty: 0, theta: 0, success: false };
  }

  // Fallback if there are not enough stars to compute rotation (we need at least 2 coherent pairs)
  if (refStars.length < 2 || srcStars.length < 2) {
    // If only 1 star is detected, we can only perform simple translation, which has very low reliability
    // for complex multi-image stacking. We mark it as unsuccessful to avoid stacking mismatched images.
    const tx = refStars[0].x - srcStars[0].x;
    const ty = refStars[0].y - srcStars[0].y;
    return { tx, ty, theta: 0, success: false };
  }

  // Multi-Pair Voting System (Robust RANSAC-like consensus for safety)
  let bestTx = 0;
  let bestTy = 0;
  let bestTheta = 0;
  let maxVotes = -1;

  // We check pairs from refStars vs srcStars
  for (let r1 = 0; r1 < Math.min(5, refStars.length); r1++) {
    for (let r2 = 0; r2 < Math.min(5, refStars.length); r2++) {
      if (r1 === r2) continue;
      const refDist = Math.hypot(refStars[r1].x - refStars[r2].x, refStars[r1].y - refStars[r2].y);
      if (refDist < 20) continue; // Skip items too close

      for (let s1 = 0; s1 < Math.min(8, srcStars.length); s1++) {
        for (let s2 = 0; s2 < Math.min(8, srcStars.length); s2++) {
          if (s1 === s2) continue;
          const srcDist = Math.hypot(srcStars[s1].x - srcStars[s2].x, srcStars[s1].y - srcStars[s2].y);

          // If distance ratio is close to 1 (stellar distances must match), calculate orientation
          if (Math.abs(refDist - srcDist) / refDist < 0.05) {
            // Find rotation difference
            const dxRef = refStars[r2].x - refStars[r1].x;
            const dyRef = refStars[r2].y - refStars[r1].y;
            const dxSrc = srcStars[s2].x - srcStars[s1].x;
            const dySrc = srcStars[s2].y - srcStars[s1].y;

            const angleRef = Math.atan2(dyRef, dxRef);
            const angleSrc = Math.atan2(dySrc, dxSrc);
            let theta = angleRef - angleSrc;
            
            // Normalize angle to -PI to PI
            while (theta < -Math.PI) theta += 2 * Math.PI;
            while (theta > Math.PI) theta -= 2 * Math.PI;

            // Find translation with calculated rotation
            // Rotated src1 position
            const rotX = srcStars[s1].x * Math.cos(theta) - srcStars[s1].y * Math.sin(theta);
            const rotY = srcStars[s1].x * Math.sin(theta) + srcStars[s1].y * Math.cos(theta);

            const tx = refStars[r1].x - rotX;
            const ty = refStars[r1].y - rotY;

            // Vote verification
            let votes = 0;
            for (const sStar of srcStars) {
              const rx = sStar.x * Math.cos(theta) - sStar.y * Math.sin(theta) + tx;
              const ry = sStar.x * Math.sin(theta) + sStar.y * Math.cos(theta) + ty;

              // Check if any reference star matches this projected position
              const matched = refStars.some(rStar => Math.hypot(rStar.x - rx, rStar.y - ry) < 6);
              if (matched) votes++;
            }

            if (votes > maxVotes) {
              maxVotes = votes;
              bestTx = tx;
              bestTy = ty;
              bestTheta = theta;
            }
          }
        }
      }
    }
  }

  // We require at least 2 stellar pairs matching pattern (votes >= 2) for successful precise alignment
  if (maxVotes >= 2) {
    return { tx: bestTx, ty: bestTy, theta: bestTheta, success: true };
  }

  // If voting failed to match regular pattern, it's highly likely a different region or an error frame
  const tx = refStars[0].x - srcStars[0].x;
  const ty = refStars[0].y - srcStars[0].y;
  return { tx, ty, theta: 0, success: false };
}

/**
 * Removes hot-pixels from ImageData without blurring stellar details
 */
export function removeHotPixels(imgData: ImageData): void {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  // Single pixel sudden spikes detection and correction
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Check R, G, B channels individually
      for (let c = 0; c < 3; c++) {
        const val = data[idx + c];
        if (val < 40) continue; // Skip dark pixels

        // Retrieve surrounding 8 pixel values
        let sum = 0;
        let pMax = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            const nVal = data[nIdx + c];
            sum += nVal;
            if (nVal > pMax) pMax = nVal;
          }
        }
        const avg = sum / 8;

        // If current value is far higher than surrounding max and average (hot pixel spike)
        if (val > pMax * 1.8 && val > avg + 40) {
          data[idx + c] = Math.round(avg); // Replace with surrounding average
        }
      }
    }
  }
}

/**
 * Flattens astro light pollution gradients (Background Flattening)
 */
export function flattenGradients(imgData: ImageData): void {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;

  // Estimate background illumination at 4 corners of the image
  const marginX = Math.floor(width * 0.05);
  const marginY = Math.floor(height * 0.05);
  const cornerRadius = 15;

  const getBackgroundSample = (cx: number, cy: number): { r: number, g: number, b: number } => {
    let rSum = 0, gSum = 0, bSum = 0, ptCount = 0;
    for (let dy = -cornerRadius; dy <= cornerRadius; dy++) {
      for (let dx = -cornerRadius; dx <= cornerRadius; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          rSum += data[idx];
          gSum += data[idx+1];
          bSum += data[idx+2];
          ptCount++;
        }
      }
    }
    return { r: rSum / ptCount, g: gSum / ptCount, b: bSum / ptCount };
  };

  const topLeft = getBackgroundSample(marginX, marginY);
  const topRight = getBackgroundSample(width - marginX, marginY);
  const bottomLeft = getBackgroundSample(marginX, height - marginY);
  const bottomRight = getBackgroundSample(width - marginX, height - marginY);

  // Fit bilinear illumination model: I(x,y) = c0 + c1*x + c2*y + c3*x*y
  // For simplicity and perfect background smoothing, interpolate bilinearly:
  for (let y = 0; y < height; y++) {
    const fy = y / height;
    const gTopR = topLeft.r * (1 - fy) + bottomLeft.r * fy;
    const gTopG = topLeft.g * (1 - fy) + bottomLeft.g * fy;
    const gTopB = topLeft.b * (1 - fy) + bottomLeft.b * fy;

    const gBottomR = topRight.r * (1 - fy) + bottomRight.r * fy;
    const gBottomG = topRight.g * (1 - fy) + bottomRight.g * fy;
    const gBottomB = topRight.b * (1 - fy) + bottomRight.b * fy;

    for (let x = 0; x < width; x++) {
      const fx = x / width;
      const bgR = gTopR * (1 - fx) + gBottomR * fx;
      const bgG = gTopG * (1 - fx) + gBottomG * fx;
      const bgB = gTopB * (1 - fx) + gBottomB * fx;

      const idx = (y * width + x) * 4;

      // Find average of background corners to subtract gradient while maintaining core signal level
      const targetBgR = (topLeft.r + topRight.r + bottomLeft.r + bottomRight.r) / 4;
      const targetBgG = (topLeft.g + topRight.g + bottomLeft.g + bottomRight.g) / 4;
      const targetBgB = (topLeft.b + topRight.b + bottomLeft.b + bottomRight.b) / 4;

      // Flatten using additive correction (safe for dark frame gradients)
      data[idx] = Math.max(0, Math.min(255, data[idx] - bgR + targetBgR));
      data[idx+1] = Math.max(0, Math.min(255, data[idx+1] - bgG + targetBgG));
      data[idx+2] = Math.max(0, Math.min(255, data[idx+2] - bgB + targetBgB));
    }
  }
}

/**
 * Optimizes the stacked image with levels expansion (Auto Stretching)
 */
export function optimizeLevels(imgData: ImageData): void {
  const data = imgData.data;
  const len = data.length;

  // Multi-image average levels search
  let rMin = 255, rMax = 0;
  let gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0;

  // Sample pixels to find black point and white point safely without outlier influence
  const step = Math.max(1, Math.floor((len / 4) / 10000));
  for (let i = 0; i < len; i += 4 * step) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }

  // Set slight margin (trim outliers/hotpixels remaining)
  const clipMinR = rMin + (rMax - rMin) * 0.02;
  const clipMaxR = rMin + (rMax - rMin) * 0.98;
  const clipMinG = gMin + (gMax - gMin) * 0.02;
  const clipMaxG = gMin + (gMax - gMin) * 0.98;
  const clipMinB = bMin + (bMax - bMin) * 0.02;
  const clipMaxB = bMin + (bMax - bMin) * 0.98;

  // Stretch intensity levels (histogram optimization)
  for (let i = 0; i < len; i += 4) {
    data[i] = Math.max(0, Math.min(255, ((data[i] - clipMinR) / (clipMaxR - clipMinR)) * 255));
    data[i+1] = Math.max(0, Math.min(255, ((data[i+1] - clipMinG) / (clipMaxG - clipMinG)) * 255));
    data[i+2] = Math.max(0, Math.min(255, ((data[i+2] - clipMinB) / (clipMaxB - clipMinB)) * 255));
  }
}

/**
 * Main function that orchestrates image stacking from selected file handles
 */
export async function stackImageEntries(
  files: FileEntry[],
  onProgress?: (progress: number, message: string) => void
): Promise<{ blob: Blob; width: number; height: number; successfulCount: number; totalCount: number }> {
  const numImages = files.length;
  if (numImages === 0) throw new Error("スタッキングする画像が選択されていません。");

  onProgress?.(5, "画像を読み込んでいます...");

  // Load and deserialize files to offscreen Canvas elements
  const canvases: HTMLCanvasElement[] = [];

  for (let i = 0; i < numImages; i++) {
    onProgress?.(5 + Math.floor((i / numImages) * 25), `画像 ${i + 1}/${numImages} を展開中...`);
    const file = await files[i].handle.getFile();
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas context is not available.");

    if (['fits','fit'].includes(files[i].extension)) {
      const { parseFits, renderFitsToCanvas } = await import('./fitsUtils');
      const data = await parseFits(file);
      renderFitsToCanvas(data, canvas);
    } else if (['tiff','tif'].includes(files[i].extension)) {
      const { renderTiffToCanvas } = await import('./tiffUtils');
      await renderTiffToCanvas(file, canvas);
    } else {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
    }

    // Apply hot pixel removal on individual original frames before registration for robust centroid matching
    const iData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    removeHotPixels(iData);
    ctx.putImageData(iData, 0, 0);

    canvases.push(canvas);
  }

  const baseCanvas = canvases[0];
  const width = baseCanvas.width;
  const height = baseCanvas.height;

  onProgress?.(35, "星の位置合わせ（アライメント）用星検出中...");
  // Detect stars on the reference image
  const refStars = detectStars(baseCanvas);

  onProgress?.(50, "天体の位置合わせと合成を実行中...");

  // Create accumulation buffer
  const accumR = new Float32Array(width * height);
  const accumG = new Float32Array(width * height);
  const accumB = new Float32Array(width * height);
  const weightMap = new Uint16Array(width * height); // keep track of overlapping valid pixels

  // Multi-frame alignment and accumulation
  let successfulAlignedCount = 0;

  for (let i = 0; i < numImages; i++) {
    onProgress?.(50 + Math.floor((i / numImages) * 30), `フレーム ${i + 1}/${numImages} を位置合わせ中...`);
    const currentCanvas = canvases[i];

    let transform: Transform = { tx: 0, ty: 0, theta: 0, success: true }; // Reference image (i=0) is always aligned

    if (i > 0) {
      if (currentCanvas.width === width && currentCanvas.height === height) {
        const currentStars = detectStars(currentCanvas);
        transform = estimateTransform(refStars, currentStars);
        if (!transform.success) {
          console.warn(`[Stacking] Frame ${i + 1} (${files[i].name}) alignment failed. Skipping this frame to prevent blurry/ghost image output.`);
          continue; // EXCLUDE and skip this error/mismatched image
        }
      } else {
        console.warn(`[Stacking] Frame ${i + 1} dims mismatch (${currentCanvas.width}x${currentCanvas.height}). Skipping.`);
        continue;
      }
    }

    successfulAlignedCount++;

    // Render registered frame to an aligned canvas
    const alignedCanvas = document.createElement('canvas');
    alignedCanvas.width = width;
    alignedCanvas.height = height;
    const alignedCtx = alignedCanvas.getContext('2d', { willReadFrequently: true });
    if (!alignedCtx) continue;

    // Apply alignment transform (translation and rotation around center)
    alignedCtx.save();
    if (transform.tx !== 0 || transform.ty !== 0 || transform.theta !== 0) {
      // Rotation should pivot around center of image
      const cx = width / 2;
      const cy = height / 2;
      alignedCtx.translate(cx, cy);
      alignedCtx.rotate(transform.theta);
      alignedCtx.translate(-cx, -cy);
      alignedCtx.translate(transform.tx, transform.ty);
    }
    alignedCtx.drawImage(currentCanvas, 0, 0);
    alignedCtx.restore();

    // Accumulate aligned pixels
    const alignedData = alignedCtx.getImageData(0, 0, width, height).data;
    for (let p = 0; p < width * height; p++) {
      const idx = p * 4;
      const alpha = alignedData[idx + 3];

      if (alpha > 40) { // check if valid pixel overlapped
        accumR[p] += alignedData[idx];
        accumG[p] += alignedData[idx + 1];
        accumB[p] += alignedData[idx + 2];
        weightMap[p]++;
      }
    }
  }

  // Ensure we have at least 2 successfully aligned images for a valid stack
  if (successfulAlignedCount < 2) {
    throw new Error("位置合わせ（アライメント）に成功した画像が十分にありません。位置合わせエラーの画像や著しく異なる天体画像は自動除外されるため、スタッキングを実行できませんでした。画像を一貫した天体写真のみに絞り、再度お試しください。");
  }

  onProgress?.(85, `${numImages}枚中${successfulAlignedCount}枚の画像を合成＆加算平均化しています...`);

  // Generate stacked image data
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error("Failed to create final canvas context.");

  const finalImgData = finalCtx.createImageData(width, height);
  const finalData = finalImgData.data;

  // Average stacked weights
  for (let p = 0; p < width * height; p++) {
    const idx = p * 4;
    const count = weightMap[p];
    if (count > 0) {
      finalData[idx] = Math.round(accumR[p] / count);
      finalData[idx+1] = Math.round(accumG[p] / count);
      finalData[idx+2] = Math.round(accumB[p] / count);
      finalData[idx+3] = 255;
    } else {
      finalData[idx] = 0;
      finalData[idx+1] = 0;
      finalData[idx+2] = 0;
      finalData[idx+3] = 0;
    }
  }

  onProgress?.(92, "グラデーション低減と輝度フラット処理中...");
  // Apply Background Gradient Flattening
  flattenGradients(finalImgData);

  onProgress?.(96, "ヒストグラムのダイナミックレンジ最適化中...");
  // Apply final stretch level optimization
  optimizeLevels(finalImgData);

  finalCtx.putImageData(finalImgData, 0, 0);

  onProgress?.(99, "保存用ファイルの準備中...");
  const blob = await new Promise<Blob>((resolve) => {
    finalCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
  });

  return { blob, width, height, successfulCount: successfulAlignedCount, totalCount: numImages };
}
