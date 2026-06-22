export interface MetadataItem {
    key: string;
    value: string | number;
    group?: string;
}

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface AstroInfo {
    objectName?: string;
    ra?: string | number;
    dec?: string | number;
    orientation?: number;
    pixscale?: number;
}

export interface ExtractedMetadata {
    items: MetadataItem[];
    gps?: Coordinates;
    astro?: AstroInfo;
    wcs?: Record<string, any>; 
}

declare global {
    interface Window {
        exifr: any; 
        UTIF: any;
    }
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function getImageMetadata(file: File | Blob): Promise<ExtractedMetadata> {
    const items: MetadataItem[] = [];
    
    if (file instanceof File) {
        items.push({ key: 'File Name', value: file.name, group: 'Basic' });
        items.push({ key: 'File Size', value: formatBytes(file.size), group: 'Basic' });
        items.push({ key: 'MIME Type', value: file.type || 'unknown', group: 'Basic' });
        items.push({ key: 'Last Modified', value: new Date(file.lastModified).toLocaleString(), group: 'Basic' });
    }

    if (!window.exifr) return { items };

    try {
        const gpsData = await window.exifr.gps(file).catch(() => null);
        const tags = await window.exifr.parse(file, {
            translateKeys: true, translateValues: true, gps: true, exif: true,
            tiff: true, xmp: true, ifd0: true, mergeOutput: true 
        });

        let gps: Coordinates | undefined;
        const astro: AstroInfo = {};

        const lat = gpsData?.latitude ?? tags?.latitude ?? tags?.GPSLatitude;
        const lng = gpsData?.longitude ?? tags?.longitude ?? tags?.GPSLongitude;

        if (typeof lat === 'number' && typeof lng === 'number') {
            gps = { lat, lng };
            items.push({ key: 'Latitude', value: lat.toFixed(6), group: 'Location' });
            items.push({ key: 'Longitude', value: lng.toFixed(6), group: 'Location' });
        }

        if (tags) {
            for (const [key, val] of Object.entries(tags)) {
                if (['MakerNote', 'UserComment', 'ExifOffset', 'GPSInfo', 'ThumbnailData', 'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude'].includes(key)) continue;
                if (val !== null && typeof val === 'object' && !(val instanceof Date)) continue;
                let valueStr = val instanceof Date ? val.toLocaleString() : String(val);
                items.push({ key, value: valueStr, group: 'Exif' });

                if (key === 'ImageDescription' && typeof val === 'string') {
                    const desc = val;
                    const objectMatch = desc.match(/OBJECT\s*=\s*'([^']+)'/i) || desc.match(/OBJECT\s*=\s*([^/\n]+)/i);
                    if (objectMatch) astro.objectName = objectMatch[1].trim();
                }
            }
        }
        return { items, gps, astro };
    } catch (e) {
        return { items };
    }
}

export function parseFitsHeader(raw: string): Record<string, string | number> {
    const header: Record<string, string | number> = {};
    if (!raw) return header;

    const extractRecord = (line: string) => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.substring(0, eqIdx).trim().toUpperCase();
        if (!key || key === 'COMMENT' || key === 'HISTORY') return;

        let valPart = line.substring(eqIdx + 1).split('/')[0].trim();
        let val = valPart.replace(/^'|'$/g, "").trim();
        
        const num = parseFloat(val);
        const isNumeric = !isNaN(num) && val !== "" && /^[+\-]?[0-9]*\.?[0-9]+([eE][+\-]?[0-9]+)?$/.test(val);
        header[key] = isNumeric ? num : val;
    };

    const hasNewlines = raw.includes('\n') || raw.includes('\r');
    if (hasNewlines) {
        const lines = raw.split(/[\r\n]+/);
        for (const line of lines) {
            const l = line.trim();
            if (l === 'END' || l.startsWith('END ')) break;
            if (l) extractRecord(l);
        }
    } else if (raw.trim().startsWith('SIMPLE')) {
        for (let i = 0; i + 80 <= raw.length; i += 80) {
            const card = raw.substring(i, i + 80);
            if (card.startsWith('END     ')) break;
            extractRecord(card);
        }
    } else {
        extractRecord(raw);
    }
    return header;
}

export function getFitsMetadata(header: Record<string, any> | string): ExtractedMetadata {
    const astro: AstroInfo = {};
    const wcs: Record<string, any> = {};
    const metaItems: MetadataItem[] = [];

    const headerObj = typeof header === 'string' ? parseFitsHeader(header) : header;

    const WCS_STRICT_PREFIXES = [
      'CRVAL', 'CRPIX', 'CTYPE', 'CD', 'PC', 'PV', 'CROTA', 'LONPOLE', 
      'LATPOLE', 'WCSNAME', 'EQUINOX', 'RADESYS', 'CDELT', 'CUNIT', 'CD1_', 'CD2_'
    ];
    const SUMMARY_KEYS = [
      'RA', 'DEC', 'RA_CENTER', 'DEC_CENTER', 'CENTER_RA', 'CENTER_DEC', 
      'PIXSCALE', 'ORIENTATION', 'RADIUS', 'FOV', 'OBJNAME', 'OBJECT'
    ];

    for (const [key, val] of Object.entries(headerObj)) {
        const valStr = String(val).trim();
        const keyUpper = key.toUpperCase();
        let group = 'Header';
        
        const isWcs = WCS_STRICT_PREFIXES.some(p => keyUpper.startsWith(p)) || SUMMARY_KEYS.includes(keyUpper);

        if (keyUpper.startsWith('NAXIS') || keyUpper === 'BITPIX') group = 'Format';
        else if (isWcs) group = 'WCS / Astrometry';
        
        metaItems.push({ key, value: valStr, group });
        if (['OBJECT', 'TARGET', 'OBJNAME'].includes(keyUpper)) astro.objectName = valStr.replace(/^'|'$/g, "");
        const isNum = typeof val === 'number';

        if (group === 'WCS / Astrometry') {
            wcs[key] = val;
            if (['CRVAL1', 'RA', 'RA_CENTER', 'CENTER_RA'].includes(keyUpper) && isNum) astro.ra = val;
            if (['CRVAL2', 'DEC', 'DEC_CENTER', 'CENTER_DEC'].includes(keyUpper) && isNum) astro.dec = val;
            if (['ORIENTATION', 'CROTA2'].includes(keyUpper) && isNum) astro.orientation = val;
            if (['PIXSCALE', 'SCALE'].includes(keyUpper) && isNum) astro.pixscale = val;
        }
    }
    return { items: metaItems, astro, wcs };
}

/**
 * Converts World Coordinates (RA/Dec) to Pixel Coordinates using basic TAN projection (WCS).
 */
export function worldToPixel(ra: number, dec: number, wcs: Record<string, any>): { x: number, y: number } | null {
    if (!wcs || !wcs.CRVAL1 || !wcs.CRVAL2 || !wcs.CRPIX1 || !wcs.CRPIX2) return null;

    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;

    const r0 = ra * deg2rad;
    const d0 = dec * deg2rad;
    const rc = (wcs.CRVAL1 || 0) * deg2rad;
    const dc = (wcs.CRVAL2 || 0) * deg2rad;

    // TAN projection equations
    const cos_d0 = Math.cos(d0);
    const sin_d0 = Math.sin(d0);
    const cos_dc = Math.cos(dc);
    const sin_dc = Math.sin(dc);
    const cos_dr = Math.cos(r0 - rc);
    const sin_dr = Math.sin(r0 - rc);

    const denom = sin_d0 * sin_dc + cos_d0 * cos_dc * cos_dr;
    if (denom <= 0) return null; // Behind the camera or extreme wide field

    const xi = (cos_d0 * sin_dr) / denom;
    const eta = (sin_d0 * cos_dc - cos_d0 * sin_dc * cos_dr) / denom;

    // Convert rad back to deg for CD matrix multiplication
    const xi_deg = xi * rad2deg;
    const eta_deg = eta * rad2deg;

    // CD matrix (Coordinate Description)
    let cd11 = wcs.CD1_1 || wcs.CDELT1 || 0;
    let cd12 = wcs.CD1_2 || 0;
    let cd21 = wcs.CD2_1 || 0;
    let cd22 = wcs.CD2_2 || wcs.CDELT2 || 0;

    // If CROTA2 exists, apply rotation
    if (wcs.CROTA2) {
      const rot = wcs.CROTA2 * deg2rad;
      const cdelt1 = wcs.CDELT1 || -0.0001;
      const cdelt2 = wcs.CDELT2 || 0.0001;
      cd11 = cdelt1 * Math.cos(rot);
      cd12 = -cdelt2 * Math.sin(rot);
      cd21 = cdelt1 * Math.sin(rot);
      cd22 = cdelt2 * Math.cos(rot);
    }

    const det = cd11 * cd22 - cd12 * cd21;
    if (Math.abs(det) < 1e-12) return null;

    const dx = (xi_deg * cd22 - eta_deg * cd12) / det;
    const dy = (eta_deg * cd11 - xi_deg * cd21) / det;

    return {
        x: dx + wcs.CRPIX1,
        y: dy + wcs.CRPIX2
    };
}

export function formatRA(deg: number): string {
    const totalHours = deg / 15;
    const h = Math.floor(totalHours);
    const m = Math.floor((totalHours - h) * 60);
    const s = ((totalHours - h) * 60 - m) * 60;
    return `${h}h ${m}m ${s.toFixed(2)}s`;
}

export function formatDec(deg: number): string {
    const sign = deg >= 0 ? '+' : '-';
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${sign}${d}° ${m}' ${s.toFixed(1)}"`;
}

export function getMapLink(gps: Coordinates): string { return `https://www.google.com/maps?q=${gps.lat},${gps.lng}`; }
export function getWikipediaLink(objectName: string): string { return `https://ja.wikipedia.org/wiki/${encodeURIComponent(objectName)}`; }
export function getSimBadLink(objectName?: string, ra?: string | number, dec?: string | number, radiusMin: number = 10): string {
    if (ra !== undefined && dec !== undefined) return `https://simbad.u-strasbg.fr/simbad/sim-coo?Coord=${encodeURIComponent(`${ra} ${dec}`)}&Radius=${radiusMin.toFixed(2)}m`;
    if (objectName) return `https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(objectName)}`;
    return "https://simbad.u-strasbg.fr/simbad/";
}
export function getAladinLink(info: AstroInfo, fitsUrl?: string, fovDeg?: number): string {
    const baseUrl = "https://aladin.cds.unistra.fr/AladinLite/";
    const params = new URLSearchParams();
    params.set('survey', 'P/DSS2/color');
    params.set('fov', fovDeg ? fovDeg.toFixed(3) : '1.0');
    if (info.ra !== undefined && info.dec !== undefined) params.set('target', `${info.ra} ${info.dec}`);
    else if (info.objectName) params.set('target', info.objectName);
    return `${baseUrl}?${params.toString()}`;
}
