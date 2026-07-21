import { worldToPixel } from './metadataUtils';

export interface ConstellationStar {
  name: string;
  ra: number;  // in degrees
  dec: number; // in degrees
}

export interface ConstellationLine {
  star1: string;
  star2: string;
}

export interface ConstellationData {
  id: string;
  nameJa: string;
  nameEn: string;
  stars: Record<string, ConstellationStar>;
  connections: ConstellationLine[];
}

export const CONSTELLATIONS: ConstellationData[] = [
  {
    id: 'orion',
    nameJa: 'オリオン座',
    nameEn: 'Orion',
    stars: {
      betelgeuse: { name: 'Betelgeuse', ra: 88.79, dec: 7.41 },
      rigel: { name: 'Rigel', ra: 78.63, dec: -8.20 },
      bellatrix: { name: 'Bellatrix', ra: 81.28, dec: 6.35 },
      alnilam: { name: 'Alnilam', ra: 84.05, dec: -1.20 },
      alnitak: { name: 'Alnitak', ra: 84.69, dec: -1.94 },
      mintaka: { name: 'Mintaka', ra: 83.00, dec: -0.30 },
      saiph: { name: 'Saiph', ra: 86.94, dec: -9.67 },
      meissa: { name: 'Meissa', ra: 83.86, dec: 9.93 }
    },
    connections: [
      { star1: 'rigel', star2: 'saiph' },
      { star1: 'saiph', star2: 'alnitak' },
      { star1: 'alnitak', star2: 'alnilam' },
      { star1: 'alnilam', star2: 'mintaka' },
      { star1: 'mintaka', star2: 'rigel' },
      { star1: 'betelgeuse', star2: 'bellatrix' },
      { star1: 'bellatrix', star2: 'mintaka' },
      { star1: 'betelgeuse', star2: 'alnitak' },
      { star1: 'betelgeuse', star2: 'meissa' },
      { star1: 'bellatrix', star2: 'meissa' }
    ]
  },
  {
    id: 'cassiopeia',
    nameJa: 'カシオペヤ座',
    nameEn: 'Cassiopeia',
    stars: {
      segin: { name: 'Segin', ra: 28.53, dec: 63.67 },
      ruchbah: { name: 'Ruchbah', ra: 20.31, dec: 60.23 },
      tsih: { name: 'Tsih', ra: 14.18, dec: 60.72 },
      schedar: { name: 'Schedar', ra: 10.13, dec: 56.54 },
      caph: { name: 'Caph', ra: 1.30, dec: 59.15 }
    },
    connections: [
      { star1: 'segin', star2: 'ruchbah' },
      { star1: 'ruchbah', star2: 'tsih' },
      { star1: 'tsih', star2: 'schedar' },
      { star1: 'schedar', star2: 'caph' }
    ]
  },
  {
    id: 'ursa_major',
    nameJa: 'おおぐま座 (北斗七星)',
    nameEn: 'Ursa Major (Big Dipper)',
    stars: {
      dubhe: { name: 'Dubhe', ra: 165.93, dec: 61.75 },
      merak: { name: 'Merak', ra: 165.46, dec: 56.38 },
      phecda: { name: 'Phecda', ra: 178.46, dec: 53.69 },
      megrez: { name: 'Megrez', ra: 183.86, dec: 57.03 },
      alioth: { name: 'Alioth', ra: 193.31, dec: 55.96 },
      mizar: { name: 'Mizar', ra: 200.98, dec: 54.92 },
      alkaid: { name: 'Alkaid', ra: 206.88, dec: 49.31 }
    },
    connections: [
      { star1: 'dubhe', star2: 'merak' },
      { star1: 'merak', star2: 'phecda' },
      { star1: 'phecda', star2: 'megrez' },
      { star1: 'megrez', star2: 'dubhe' },
      { star1: 'megrez', star2: 'alioth' },
      { star1: 'alioth', star2: 'mizar' },
      { star1: 'mizar', star2: 'alkaid' }
    ]
  },
  {
    id: 'southern_cross',
    nameJa: 'みなみじゅうじ座',
    nameEn: 'Southern Cross',
    stars: {
      acrux: { name: 'Acrux', ra: 186.65, dec: -63.10 },
      mimosa: { name: 'Mimosa', ra: 191.93, dec: -59.68 },
      gacrux: { name: 'Gacrux', ra: 187.79, dec: -57.11 },
      deltacru: { name: 'Delta Cru', ra: 183.14, dec: -58.75 }
    },
    connections: [
      { star1: 'acrux', star2: 'gacrux' },
      { star1: 'mimosa', star2: 'deltacru' }
    ]
  },
  {
    id: 'cygnus',
    nameJa: 'はくちょう座',
    nameEn: 'Cygnus',
    stars: {
      deneb: { name: 'Deneb', ra: 310.36, dec: 45.28 },
      sadr: { name: 'Sadr', ra: 305.88, dec: 40.26 },
      albireo: { name: 'Albireo', ra: 292.68, dec: 27.96 },
      gienah: { name: 'Gienah', ra: 313.37, dec: 33.97 },
      deltacyg: { name: 'Delta Cyg', ra: 294.13, dec: 45.13 }
    },
    connections: [
      { star1: 'deneb', star2: 'sadr' },
      { star1: 'sadr', star2: 'albireo' },
      { star1: 'sadr', star2: 'gienah' },
      { star1: 'sadr', star2: 'deltacyg' }
    ]
  },
  {
    id: 'lyra',
    nameJa: 'こと座',
    nameEn: 'Lyra',
    stars: {
      vega: { name: 'Vega', ra: 279.23, dec: 38.78 },
      sheliak: { name: 'Sheliak', ra: 282.52, dec: 33.36 },
      sulafat: { name: 'Sulafat', ra: 283.40, dec: 32.68 },
      deltalyr: { name: 'Delta Lyr', ra: 283.67, dec: 36.97 },
      epsilonlyr: { name: 'Epsilon Lyr', ra: 281.20, dec: 39.67 }
    },
    connections: [
      { star1: 'vega', star2: 'epsilonlyr' },
      { star1: 'vega', star2: 'deltalyr' },
      { star1: 'deltalyr', star2: 'sheliak' },
      { star1: 'sheliak', star2: 'sulafat' },
      { star1: 'sulafat', star2: 'deltalyr' },
      { star1: 'sheliak', star2: 'vega' }
    ]
  },
  {
    id: 'leo',
    nameJa: 'しし座',
    nameEn: 'Leo',
    stars: {
      regulus: { name: 'Regulus', ra: 152.09, dec: 11.96 },
      denebola: { name: 'Denebola', ra: 177.26, dec: 14.57 },
      algieba: { name: 'Algieba', ra: 154.99, dec: 19.84 },
      zosma: { name: 'Zosma', ra: 167.88, dec: 20.52 },
      chertan: { name: 'Chertan', ra: 168.12, dec: 15.43 },
      algenubi: { name: 'Algenubi', ra: 146.46, dec: 23.77 },
      adhafera: { name: 'Adhafera', ra: 152.61, dec: 23.42 }
    },
    connections: [
      { star1: 'regulus', star2: 'chertan' },
      { star1: 'chertan', star2: 'zosma' },
      { star1: 'zosma', star2: 'denebola' },
      { star1: 'denebola', star2: 'chertan' },
      { star1: 'regulus', star2: 'algieba' },
      { star1: 'algieba', star2: 'adhafera' },
      { star1: 'adhafera', star2: 'algenubi' }
    ]
  },
  {
    id: 'scorpius',
    nameJa: 'さそり座',
    nameEn: 'Scorpius',
    stars: {
      antares: { name: 'Antares', ra: 247.35, dec: -26.43 },
      shaula: { name: 'Shaula', ra: 263.40, dec: -37.10 },
      graffias: { name: 'Graffias', ra: 241.35, dec: -19.80 },
      dschubba: { name: 'Dschubba', ra: 240.08, dec: -22.62 },
      fang: { name: 'Fang', ra: 241.30, dec: -26.11 },
      alniyat: { name: 'Alniyat', ra: 245.30, dec: -25.59 },
      wei: { name: 'Wei', ra: 252.55, dec: -34.29 },
      sargas: { name: 'Sargas', ra: 261.27, dec: -43.00 }
    },
    connections: [
      { star1: 'graffias', star2: 'dschubba' },
      { star1: 'dschubba', star2: 'fang' },
      { star1: 'dschubba', star2: 'alniyat' },
      { star1: 'alniyat', star2: 'antares' },
      { star1: 'antares', star2: 'wei' },
      { star1: 'wei', star2: 'sargas' },
      { star1: 'sargas', star2: 'shaula' }
    ]
  }
];

export interface ProjectedConstellation {
  id: string;
  name: string;
  center?: { x: number; y: number };
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  starDots: { x: number; y: number; name: string }[];
}

export function getProjectedConstellations(
  wcs: Record<string, any>,
  lang: 'ja' | 'en'
): ProjectedConstellation[] {
  if (!wcs || !wcs.CRVAL1 || !wcs.CRVAL2) return [];

  const projected: ProjectedConstellation[] = [];

  for (const constel of CONSTELLATIONS) {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const starDots: { x: number; y: number; name: string }[] = [];
    
    // Project all stars of this constellation first
    const starCoords: Record<string, { x: number; y: number }> = {};

    for (const [key, star] of Object.entries(constel.stars)) {
      const pix = worldToPixel(star.ra, star.dec, wcs);
      if (pix) {
        starCoords[key] = pix;
        starDots.push({ x: pix.x, y: pix.y, name: star.name });
      }
    }

    // Map connections to lines
    for (const conn of constel.connections) {
      const p1 = starCoords[conn.star1];
      const p2 = starCoords[conn.star2];
      if (p1 && p2) {
        lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }

    // Only include if any lines or points are visible in this WCS FOV
    if (lines.length > 0) {
      // Calculate a simple geometric average center of the constellation
      let sumX = 0, sumY = 0, count = 0;
      for (const key of Object.keys(starCoords)) {
        sumX += starCoords[key].x;
        sumY += starCoords[key].y;
        count++;
      }
      const center = count > 0 ? { x: sumX / count, y: sumY / count } : undefined;

      projected.push({
        id: constel.id,
        name: lang === 'ja' ? constel.nameJa : constel.nameEn,
        center,
        lines,
        starDots
      });
    }
  }

  return projected;
}
