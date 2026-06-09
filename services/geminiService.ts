/**
 * Gemini API サービス（TS-Connect ローカルサーバ対応版）
 */

const getApiKey = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) return savedKey;

  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;

  const env = (typeof process !== 'undefined' ? process.env : {});
  return env.API_KEY || env.GEMINI_API_KEY || "";
};

const initAI = async () => {
  // ローカルサーバでの解決エラーを防ぐため、CDNから読み込みます
  const moduleUrl = "https://esm.run/@google/generative-ai";
  const mod = await import(moduleUrl);
  const GoogleGenerativeAI = mod.GoogleGenerativeAI || mod.default?.GoogleGenerativeAI;

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("APIキーが設定されていません。");

  return new GoogleGenerativeAI(apiKey);
};

// 1. 天体情報の要約機能
export const getObjectSummary = async (objectName, language = 'ja') => {
  try {
    const genAI = await initAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
    const langInstruction = language === 'ja'
      ? 'IMPORTANT: You MUST output strictly in Japanese (日本語). Ensure the response is natural and easy to read for Japanese speakers.'
      : 'Response Language: English';

    const prompt = `
      Role: You are an expert astronomer and observatory assistant.
      Task: Provide a detailed description of the celestial object "${objectName}".
      Source Material: Refer to data from Wikipedia (天体情報) and standard Astronomical Catalogs (Messier, NGC, IC).

      ${langInstruction}
      
      Please structure the response as follows:
      1. **Overview**: Basic description, constellation, distance from Earth.
      2. **Physical Characteristics**: Type, size, mass, age, composition.
      3. **Observation**: Visual magnitude, apparent size, best season to view.
      4. **History**: Discovery information, origin of name.
      
      Ensure the tone is educational and accurate.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Summary Error:", error);
    return "要約の取得に失敗しました。";
  }
};

// 2. 画像の解析機能
export const analyzeImage = async (base64Data, mimeType, prompt = "この画像を説明してください") => {
  try {
    const genAI = await initAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Analyze Error:", error);
    return `解析エラー: ${error instanceof Error ? error.message : "不明なエラー"}`;
  }
};

// 3. 画像の編集・生成機能
export const editImage = async (base64Data: string, mimeType: string, instruction: string) => {
  try {
    const genAI = await initAI();
    // 画像編集タスクに最も適した最新の gemini-3.5-flash を指定
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            image: {
              type: 'STRING',
              description: 'The processed astronomical image in JPEG format encoded as a base64 string, completely clean without prefix.'
            }
          },
          required: ['image']
        }
      }
    });

    const prompt = `
You are an expert astronomical image processing assistant.
Analyze the provided astronomical image and apply the following processing instruction: "${instruction}".
Simulate advanced astronomical noise reduction, histogram stretch, calibration, or gradient removal as requested.
Provide the output as JSON conforming to the schema. The "image" field must contain the result image as a clean base64 string (JPEG format).
Do not output any additional notes, markdown blocks, or text.
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);

    const response = await result.response;
    const responseText = response.text().trim();
    
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.image) {
        const cleanImg = parsed.image.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
        return { image: cleanImg, text: responseText };
      }
    } catch (e) {
      // フォールバック: JSON以外で出力された場合、正規表現でBase64を切り出す
      const match = responseText.match(/(?:data:image\/(?:jpeg|png|jpg);base64,)?([A-Za-z0-9+/=\s]{100,})/);
      if (match) {
        const cleanImg = match[1].replace(/\s/g, '');
        return { image: cleanImg, text: responseText };
      }
    }
    
    throw new Error("画像のBase64データを抽出できませんでした。");
  } catch (error) {
    console.error("Edit Error:", error);
    throw error;
  }
};