
import { formatRA, formatDec } from './metadataUtils';

export interface WikiInfo {
  description: string;
  imageUrl?: string;
  type?: string;
  ra?: string;
  dec?: string;
  magnitude?: string;
  url: string;
}

export async function fetchWikiInfo(query: string, lang: string): Promise<WikiInfo | null> {
  try {
    // 1. Search Wikipedia for basic info and Wikidata ID
    // We use the 'query' action to get page props
    const wikiApi = `https://${lang}.wikipedia.org/w/api.php`;
    const searchParams = new URLSearchParams({
      origin: '*',
      action: 'query',
      prop: 'pageprops|pageimages|extracts|info',
      inprop: 'url',
      titles: query,
      pithumbsize: '400',
      exintro: '1',
      explaintext: '1',
      redirects: '1',
      format: 'json'
    });

    const wikiRes = await fetch(`${wikiApi}?${searchParams.toString()}`);
    if (!wikiRes.ok) return null;
    
    const wikiData = await wikiRes.json();
    const pages = wikiData.query?.pages;
    if (!pages) return null;
    
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null; // Not found

    const page = pages[pageId];
    const qid = page.pageprops?.wikibase_item;

    const info: WikiInfo = {
      description: page.extract || '',
      imageUrl: page.thumbnail?.source,
      url: page.fullurl,
    };

    if (qid) {
      // 2. Fetch Structured Data from Wikidata
      const wdApi = `https://www.wikidata.org/w/api.php`;
      const wdParams = new URLSearchParams({
        origin: '*',
        action: 'wbgetentities',
        ids: qid,
        props: 'claims',
        format: 'json'
      });

      const wdRes = await fetch(`${wdApi}?${wdParams.toString()}`);
      if (wdRes.ok) {
          const wdData = await wdRes.json();
          const claims = wdData.entities?.[qid]?.claims;

          if (claims) {
            // Helper to get claim value
            const getVal = (propId: string) => {
                const c = claims[propId]?.[0];
                return c?.mainsnak?.datavalue?.value;
            };

            // RA (P6257) - stored as quantity in degrees
            const raVal = getVal('P6257');
            if (raVal && raVal.amount) {
               const deg = parseFloat(raVal.amount);
               if (!isNaN(deg)) info.ra = formatRA(deg);
            }

            // Dec (P6258) - stored as quantity in degrees
            const decVal = getVal('P6258');
            if (decVal && decVal.amount) {
               const deg = parseFloat(decVal.amount);
               if (!isNaN(deg)) info.dec = formatDec(deg);
            }
            
            // Fallback: Coordinate Location (P625)
            if (!info.ra && !info.dec) {
                const coord = getVal('P625');
                if (coord && coord.latitude !== undefined && coord.longitude !== undefined) {
                    let raDeg = coord.longitude;
                    if (raDeg < 0) raDeg += 360;
                    info.ra = formatRA(raDeg);
                    info.dec = formatDec(coord.latitude);
                }
            }

            // Magnitude (P1215)
            const magVal = getVal('P1215');
            if (magVal && magVal.amount) {
                const mag = parseFloat(magVal.amount);
                if (!isNaN(mag)) info.magnitude = mag.toString();
            }

            // Type (P31) - Instance of
            const typeClaim = claims['P31']?.[0];
            if (typeClaim?.mainsnak?.datavalue?.value?.id) {
                 const typeQid = typeClaim.mainsnak.datavalue.value.id;
                 
                 // 3. Fetch Type Label
                 const labelParams = new URLSearchParams({
                    origin: '*',
                    action: 'wbgetentities',
                    ids: typeQid,
                    props: 'labels',
                    languages: lang,
                    format: 'json'
                 });
                 
                 const labelRes = await fetch(`${wdApi}?${labelParams.toString()}`);
                 if (labelRes.ok) {
                     const labelData = await labelRes.json();
                     const label = labelData.entities?.[typeQid]?.labels?.[lang]?.value;
                     if (label) info.type = label;
                 }
            }
          }
      }
    }

    return info;

  } catch (e) {
    console.warn("Wiki fetch failed", e);
    return null;
  }
}
