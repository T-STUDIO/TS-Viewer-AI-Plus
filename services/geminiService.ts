/**
 * Gemini API \u30b5\u30fc\u30d3\u30b9\uff08TS-Connect \u30ed\u30fc\u30ab\u30eb\u30b5\u30fc\u30d0\u5bfe\u5fdc\u7248\uff09
 */

const getApiKey = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) return savedKey;

  const metaEnv = (import.meta).env;
  if (metaEnv && metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;

  const env = (typeof process !== 'undefined' ? process.env : {});
  return env.API_KEY || env.GEMINI_API_KEY || "";
};

const initAI = async () => {
  // \u30ed\u30fc\u30ab\u30eb\u30b5\u30fc\u30d0\u3067\u306e\u89e3\u6c7a\u30a8\u30e9\u30fc\u3092\u9632\u3050\u305f\u3081\u3001CDN\u304b\u3089\u8aad\u307f\u8fbc\u307f\u307e\u3059
  const moduleUrl = "https://esm.run/@google/generative-ai";
  const mod = await import(moduleUrl);
  const GoogleGenerativeAI = mod.GoogleGenerativeAI || mod.default?.GoogleGenerativeAI;

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API\u30ad\u30fc\u304c\u8a2d\u5b9a\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002");

  return new GoogleGenerativeAI(apiKey);
};

// 1. \u5929\u4f53\u60c5\u5831\u306e\u8981\u7d04\u6a5f\u80fd
export const getObjectSummary = async (objectName) => {
  try {
    const genAI = await initAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });
    const prompt = `\u5929\u4f53\u300c${objectName}\u300d\u306b\u3064\u3044\u3066\u3001\u5c02\u9580\u30c7\u30fc\u30bf\u30d9\u30fc\u30b9\u306b\u57fa\u3065\u3044\u305f\u60c5\u5831\u3092\u65e5\u672c\u8a9e\u3067200\u6587\u5b57\u7a0b\u5ea6\u3067\u8981\u7d04\u3057\u3066\u304f\u3060\u3055\u3044\u30021.\u7a2e\u985e\u30012.\u7279\u5fb4\u30013.\u8c46\u77e5\u8b58\u306e\u69cb\u6210\u3067\u304a\u9858\u3044\u3057\u307e\u3059\u3002`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Summary Error:", error);
    return "\u8981\u7d04\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002";
  }
};

// 2. \u753b\u50cf\u306e\u89e3\u6790\u6a5f\u80fd
export const analyzeImage = async (base64Data, mimeType, prompt = "\u3053\u306e\u753b\u50cf\u3092\u8aac\u660e\u3057\u3066\u304f\u3060\u3055\u3044") => {
  try {
    const genAI = await initAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Analyze Error:", error);
    return `\u89e3\u6790\u30a8\u30e9\u30fc: ${error.message}`;
  }
};

// 3. \u753b\u50cf\u306e\u7de8\u96c6\u30fb\u751f\u6210\u6a5f\u80fd
export const editImage = async (base64Data, mimeType, instruction) => {
  try {
    const genAI = await initAI();
    // \u753b\u50cf\u7de8\u96c6\u30bf\u30b9\u30af\u306b\u9069\u3057\u305f\u30e2\u30c7\u30eb\u3092\u6307\u5b9a
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const result = await model.generateContent([
      instruction,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const response = await result.response;
    
    // \u6ce8\u610f: \u6a19\u6e96SDK\u3067\u306f\u76f4\u63a5\u300c\u753b\u50cf\u30d5\u30a1\u30a4\u30eb\u300d\u3092\u8fd4\u3059\u6319\u52d5\u304cAI Studio\u3068\u7570\u306a\u308b\u5834\u5408\u304c\u3042\u308a\u307e\u3059
    // \u3053\u3053\u3067\u306f\u307e\u305a\u30c6\u30ad\u30b9\u30c8\u56de\u7b54\u3092\u8fd4\u3057\u307e\u3059
    return { image: null, text: response.text() };
  } catch (error) {
    console.error("Edit Error:", error);
    throw error;
  }
};
