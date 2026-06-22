/**
 * SIP (Simple Imaging Polynomial) Distortion Corrector for Screen Rendering.
 * 
 * Fits standard defines SIP forward distortion (A_p_q, B_p_q) from pixels to intermediate coordinates,
 * and SIP inverse distortion (AP_p_q, BP_p_q) from intermediate coordinates back to pixels.
 * 
 * In worldToPixel coordinate calculation, we project RA/Dec tangent plane coordinates back to (dx, dy)
 * relative to CRPIX. Under the Top-Down screen coordinates rendering system:
 * - dx_render = dx_physical
 * - dy_render = -dy_physical
 * 
 * This service calculates the precise distortion on the screen rendering coordinate system:
 * - corr_dx = dx + sum( AP_p_q * dx^p * (-dy)^q )
 * - corr_dy = dy - sum( BP_p_q * dx^p * (-dy)^q )
 */

export interface SipCorrectionResult {
  dx: number;
  dy: number;
}

export function applySipDistortion(
  dx: number,
  dy: number,
  wcs: Record<string, any> | null | undefined
): SipCorrectionResult {
  if (!wcs) {
    return { dx, dy };
  }

  // Find if SIP is active
  const ctype1 = String(wcs.CTYPE1 || "").toUpperCase();
  const ctype2 = String(wcs.CTYPE2 || "").toUpperCase();
  const isSip = ctype1.includes("-SIP") || ctype2.includes("-SIP") || 
                Object.keys(wcs).some(k => k.toUpperCase().startsWith("AP_") || k.toUpperCase().startsWith("BP_"));

  if (!isSip) {
    return { dx, dy };
  }

  let deltaX = 0;
  let deltaY = 0;

  const physicalDx = dx;
  const physicalDy = -dy; // Convert screen-Y offset back to physical bottom-up offset

  // Sum up SIP distortion coefficients dynamically from the WCS header object
  for (const [key, val] of Object.entries(wcs)) {
    if (typeof val !== "number" || isNaN(val)) continue;

    const keyUpper = key.toUpperCase();

    // Parse AP_p_q where p and q are integers (e.g. AP_0_2)
    if (keyUpper.startsWith("AP_")) {
      const parts = keyUpper.split("_");
      if (parts.length === 3) {
        const p = parseInt(parts[1], 10);
        const q = parseInt(parts[2], 10);
        if (!isNaN(p) && !isNaN(q)) {
          deltaX += val * Math.pow(physicalDx, p) * Math.pow(physicalDy, q);
        }
      }
    }

    // Parse BP_p_q where p and q are integers (e.g. BP_0_2)
    if (keyUpper.startsWith("BP_")) {
      const parts = keyUpper.split("_");
      if (parts.length === 3) {
        const p = parseInt(parts[1], 10);
        const q = parseInt(parts[2], 10);
        if (!isNaN(p) && !isNaN(q)) {
          deltaY += val * Math.pow(physicalDx, p) * Math.pow(physicalDy, q);
        }
      }
    }
  }

  return {
    dx: dx + deltaX,
    dy: dy - deltaY // Negate deltaY back to screen-Y offset System
  };
}
