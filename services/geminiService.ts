/**
 * Gemini API サービス（TS-Connect ローカルサーバ対応版 / @google/genai 公式SDK最適化版）
 */
import { GoogleGenAI } from '@google/genai';

const getApiKey = () => {
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey) return savedKey;

  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;

  const env = (typeof process !== 'undefined' ? process.env : {});
  return env.API_KEY || env.GEMINI_API_KEY || "";
};

const initAI = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("APIキーが設定されていません。");

  return new GoogleGenAI({ apiKey });
};

// 1. 天体情報の要約機能
const generateWithFallback = async (
  ai: GoogleGenAI,
  contents: any,
  models: string[] = ['gemini-3.5-flash'],
  config: any = null
) => {
  let lastError: any = null;
  for (const modelName of models) {
    try {
      console.log(`[AI] Attempting call with model: ${modelName}`);
      const options: any = {
        model: modelName,
        contents,
      };
      if (config) {
        options.config = config;
      }
      const response = await ai.models.generateContent(options);
      return { response, modelName };
    } catch (err: any) {
      console.warn(`[AI] Model ${modelName} failed or over capacity (503/429/etc):`, err);
      lastError = err;
    }
  }
  throw lastError || new Error("すべての提供モデルで生成に失敗しました。一時的な制限か、APIキーが無効な可能性があります。");
};

export const getObjectSummary = async (objectName, language = 'ja') => {
  try {
    const ai = initAI();
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

    const { response, modelName } = await generateWithFallback(
      ai,
      prompt,
      ['gemini-3.5-flash']
    );
    console.log(`[AI] Object summary successful using model: ${modelName}`);
    return response.text;
  } catch (error: any) {
    console.error("Summary Error:", error);
    const errorMsg = error?.message || String(error);
    return `要約の取得に失敗しました。Error: ${errorMsg}\n(一時的に高負荷状態(503)、または利用枠（クォータ）制限に達している可能性があります。数分置いて再度お試しいただくか、別のAPIキーをご利用ください。試行されたモデル: gemini-3.5-flash)`;
  }
};

// 2. 画像の解析機能
export const analyzeImage = async (base64Data, mimeType, prompt = "この画像を説明してください") => {
  try {
    const ai = initAI();
    const { response, modelName } = await generateWithFallback(
      ai,
      [
        prompt,
        { inlineData: { data: base64Data, mimeType } }
      ],
      ['gemini-3.5-flash']
    );
    console.log(`[AI] Image analysis successful using model: ${modelName}`);
    return response.text;
  } catch (error: any) {
    console.error("Analyze Error:", error);
    const errorMsg = error?.message || String(error);
    return `解析エラー: ${errorMsg}\n(一時的なアクセス集中(503)等により、全てのモデルでエラーが返されました。しばらく時間を置いてから再度お試しください。試行モデル: gemini-3.5-flash)`;
  }
};

// 3. 画像の編集・生成機能
export const editImage = async (base64Data: string, mimeType: string, instruction: string) => {
  try {
    const ai = initAI();
    const prompt = `
You are an expert astronomical image processing assistant.
Analyze the provided astronomical image and apply the following processing instruction: "${instruction}".
Simulate advanced astronomical noise reduction, histogram stretch, calibration, or gradient removal as requested.
Provide the output as JSON conforming to the schema. The "image" field must contain the result image as a clean base64 string (JPEG format).
Do not output any additional notes, markdown blocks, or text.
`;

    // 試行するモデル構成
    const modelsWithSchema = [
      { name: 'gemini-3.5-flash', useSchema: true },
      { name: 'gemini-3.5-flash', useSchema: false }
    ];

    let lastError: any = null;

    // 現在キーの読み込みが成功していることを診断するログ
    const activeKey = getApiKey();
    console.log("[AI API Key Diagnostics] Key exists:", !!activeKey, "Length:", activeKey ? activeKey.length : 0);

    for (const configItem of modelsWithSchema) {
      try {
        console.log(`[AI] Attempting editImage with model: ${configItem.name} (useSchema: ${configItem.useSchema})`);
        
        let config: any = {};
        if (configItem.useSchema) {
          config = {
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
          };
        }

        const response = await ai.models.generateContent({
          model: configItem.name,
          contents: [
            prompt,
            { inlineData: { data: base64Data, mimeType } }
          ],
          config
        });

        const responseText = response.text ? response.text.trim() : '';

        try {
          const parsed = JSON.parse(responseText);
          if (parsed.image) {
            const cleanImg = parsed.image.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
            console.log(`[AI] editImage successful with model: ${configItem.name} (useSchema: ${configItem.useSchema}) via JSON parsing`);
            return { image: cleanImg, text: responseText };
          }
        } catch (e) {
          // フォールバック: JSON以外で出力された場合、正規表現でBase64を切り出す
          const match = responseText.match(/(?:data:image\/(?:jpeg|png|jpg);base64,)?([A-Za-z0-9+/=\s]{100,})/);
          if (match) {
            const cleanImg = match[1].replace(/\s/g, '');
            console.log(`[AI] editImage successful with model: ${configItem.name} (useSchema: ${configItem.useSchema}) via regex parsing`);
            return { image: cleanImg, text: responseText };
          }
        }
      } catch (err: any) {
        console.warn(`[AI] editImage failed with model ${configItem.name} (useSchema: ${configItem.useSchema}):`, err);
        lastError = err;
      }
    }

    const errorMsg = lastError?.message || String(lastError);
    const isSavedKeyOk = !!activeKey;
    throw new Error(`AI画像編集に失敗しました。
【診断情報】
・APIキー設定状態: ${isSavedKeyOk ? "有効に読み込まれています (文字数: " + activeKey.length + ")" : "未設定または読み込み失敗"}
・エラー詳細: ${errorMsg}
・解説: 503エラーが発生している場合、APIキー自体は正しくGoogle側へ届いていますが、一時的な同時アクセス集中によるサーバー高負荷、またはお使いのAPIキーの無料枠の上限（1分間あたりの制限など）に達している可能性があります。高負荷に強い最新のgemini-3.5-flash等のリトライを行いましたが、すべてで同様の制限が返されました。しばらくお時間を置くか、別の有効なAPIキーに変更してお試しください。`);
  } catch (error) {
    console.error("Edit Error:", error);
    throw error;
  }
};