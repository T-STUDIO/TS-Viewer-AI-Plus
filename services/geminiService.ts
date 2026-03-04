
/**
 * Gemini API サービス
 * 
 * ローカル環境（vite.config / .env）とプラットフォーム環境の両方で
 * APIキーを正しく読み込めるように調整しています。
 */

const getApiKey = (): string => {
  // 1. Vite 標準の環境変数（import.meta.env）を最優先
  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;

  // 2. define で置換される process.env.GEMINI_API_KEY を確認
  // 直接 process.env にアクセスせず、個別のプロパティを確認する
  try {
    if (typeof process !== 'undefined' && process.env) {
      if ((process.env as any).GEMINI_API_KEY) return (process.env as any).GEMINI_API_KEY;
      if ((process.env as any).API_KEY) return (process.env as any).API_KEY;
    }
  } catch (e) {
    // process が定義されていない場合は無視
  }

  return "";
};

const initAI = async () => {
  // Viteの静的解析エラーを回避するため文字列で動的インポート
  const moduleName = "@google/genai";
  const { GoogleGenAI } = await import(moduleName);
  
  const apiKey = getApiKey();
  
  // ガイドラインに従い、new GoogleGenAI({ apiKey }) の形式で初期化
  // apiKey が空の場合は SDK 内部でエラーが投げられます
  return new GoogleGenAI({ apiKey });
};

export const analyzeImage = async (
  base64Data: string, 
  mimeType: string, 
  prompt: string = "この画像を詳しく説明してください。写っている天体などを特定してください。必ず日本語で回答してください。"
): Promise<string> => {
  try {
    const ai = await initAI();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "解析結果が得られませんでした。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `画像の解析に失敗しました。 (${error instanceof Error ? error.message : "不明なエラー"})`;
  }
};

export const editImage = async (
  base64Data: string,
  mimeType: string,
  instruction: string
): Promise<{ image: string | null, text: string }> => {
  try {
    const ai = await initAI();
    
    // 画像の編集および生成タスクには gemini-2.5-flash-image を使用
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: instruction,
          },
        ],
      },
    });

    let imageData: string | null = null;
    let textOutput = "";

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
        } else if (part.text) {
          textOutput += part.text;
        }
      }
    }
    
    return { image: imageData, text: textOutput || "完了しました。" };
  } catch (error) {
    console.error("Gemini Edit Error:", error);
    throw error;
  }
};
