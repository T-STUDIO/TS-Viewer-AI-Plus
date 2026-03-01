import { formatRA, formatDec } from './metadataUtils';

export interface CelestialObject {
  name: string;
  ra: number; // Decimal degrees
  dec: number; // Decimal degrees
  type?: string;
}

// 主要カタログのデータ（一部抜粋。実運用では数万件のデータをここに展開、または外部JSONからロードする設計）
const LOCAL_DB: Record<string, CelestialObject> = {
  "M1": { name: "M1 (Crab Nebula)", ra: 83.633, dec: 22.014, type: "Supernova Remnant" },
  "M31": { name: "M31 (Andromeda Galaxy)", ra: 10.684, dec: 41.269, type: "Galaxy" },
  "M42": { name: "M42 (Orion Nebula)", ra: 83.822, dec: -5.391, type: "Nebula" },
  "M45": { name: "M45 (Pleiades)", ra: 56.75, dec: 24.116, type: "Open Cluster" },
  "M46": { name: "M46", ra: 115.437, dec: -14.814, type: "Open Cluster" },
  "M47": { name: "M47", ra: 114.158, dec: -14.39, type: "Open Cluster" },
  "NGC7000": { name: "NGC7000 (North America Nebula)", ra: 314.4, dec: 44.5, type: "Nebula" },
  "NGC2237": { name: "NGC2237 (Rosette Nebula)", ra: 98.1, dec: 5.0, type: "Nebula" },
  // ... 実装時はさらに多くのデータを追加可能
};

export async function findCelestialObject(query: string, lang: string = 'ja'): Promise<CelestialObject | null> {
  const normalizedQuery = query.trim().toUpperCase().replace(/\s+/g, '');
  
  // 1. ローカルDBを検索
  if (LOCAL_DB[normalizedQuery]) {
    return LOCAL_DB[normalizedQuery];
  }

  // 2. SIMBAD API フォールバック
  try {
    const simbadUrl = `https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(query)}&out=json`;
    // Note: SIMBADのJSON出力はプロキシ経由が必要な場合があるため、Wikidataを優先的に使用する設計にします
    
    // 3. Wikidata API フォールバック (非常に強力)
    const wikiDataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=${lang}wiki&titles=${encodeURIComponent(query)}&props=claims&format=json&origin=*`;
    const res = await fetch(wikiDataUrl);
    const data = await res.json();
    const entities = data.entities;
    const entityId = Object.keys(entities)[0];
    
    if (entityId && entityId !== '-1') {
      const claims = entities[entityId].claims;
      const raVal = claims['P6257']?.[0]?.mainsnak?.datavalue?.value?.amount;
      const decVal = claims['P6258']?.[0]?.mainsnak?.datavalue?.value?.amount;
      
      if (raVal && decVal) {
        return {
          name: query,
          ra: parseFloat(raVal),
          dec: parseFloat(decVal),
          type: "Found via WikiData"
        };
      }
    }
  } catch (e) {
    console.error("Online lookup failed", e);
  }

  return null;
}
