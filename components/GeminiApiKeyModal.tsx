import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, X } from 'lucide-react';
import { getApiKey as getUnifiedApiKey, isValidApiKeyFormat } from '../services/geminiService';

interface GeminiApiKeyModalProps {
  onClose?: () => void;
  lang?: 'ja' | 'en';
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({ onClose, lang = 'ja' }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.1-flash-image');
  const [showKey, setShowKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReconfigMode, setIsReconfigMode] = useState(false);

  useEffect(() => {
    // Check URL query parameters
    const params = new URLSearchParams(window.location.search);
    const setApiKeyParam = params.get('set_api_key');
    
    const savedKey = localStorage.getItem('gemini_api_key');
    const activeKey = getUnifiedApiKey();
    const hasActiveKey = !!(activeKey && activeKey.trim());
    
    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) {
      setModel(savedModel);
    }
    
    if (savedKey) {
      setApiKey(savedKey);
    }
    
    if (setApiKeyParam === 'true') {
      setIsReconfigMode(true);
      setIsOpen(true);
    } else if (!hasActiveKey) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setErrorMsg('');
    const url = new URL(window.location.href);
    url.searchParams.delete('set_api_key');
    window.history.replaceState({}, '', url.toString());
    if (onClose) {
      onClose();
    }
  };

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setErrorMsg(lang === 'ja' ? 'APIキーを入力してください。' : 'Please enter an API key.');
      return;
    }
    
    // プレフィックスチェックおよび一貫したキー判定を行うため、共通の検証ヘルパーを使用します
    if (!isValidApiKeyFormat(trimmed)) {
      setErrorMsg(
        lang === 'ja'
          ? '無効なAPIキーフォーマットの可能性があります。AIzaSyから始まる正しいキーを入力してください。'
          : 'Invalid API key format. Should start with AIzaSy.'
      );
      return;
    }

    localStorage.setItem('gemini_api_key', trimmed);
    localStorage.setItem('gemini_model', model);
    setIsOpen(false);
    setErrorMsg('');
    
    const url = new URL(window.location.href);
    url.searchParams.delete('set_api_key');
    window.history.replaceState({}, '', url.toString());
    
    if (onClose) {
      onClose();
    }
    window.location.reload();
  };

  const handleGetApiKey = () => {
    window.open('https://aistudio.google.com/app/apikey', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1017]/95 p-6 shadow-2xl text-white animate-in zoom-in-95 duration-200">
        <button 
          onClick={handleClose} 
          className="absolute right-4 top-4 p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" 
          title={lang === 'ja' ? '閉じる' : 'Close'}
        >
          <X size={18} />
        </button>
        
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Key className="text-blue-500 animate-pulse" size={22} />
          {lang === 'ja' ? 'Gemini API キー設定' : 'Gemini API Key Settings'}
        </h2>
        
        <p className="text-xs text-gray-400 mb-6 leading-relaxed whitespace-pre-wrap">
          {isReconfigMode ? (
            lang === 'ja' 
              ? '登録されているGemini APIキーの変更を行います。新しいAPIキーを入力して『登録』ボタンを押してください。'
              : 'Modify the registered Gemini API key. Please input the new API key and click "Register".'
          ) : (
            lang === 'ja'
              ? `本アプリのAI機能（天体情報やおすすめ解説）を使用するには、お客様ご自身のAPIキーの登録が必要です。
すでにAPIキーを所有されている方は入力欄に半角英数キーで入力後”登録”ボタンを押してください。
APIキーを所有していない方は”API取得”ボタンを押し、指示に従いAPIキーを取得後、入力欄に半角英数キーで入力後”登録”ボタンを押してください。
キーはお使いのブラウザ内にのみ厳重に保護され、第三者や開発者のサーバーへ送信されることは一切ありません。`
              : `To use the AI features of this app (celestial info & astronomical commentary), registration of your own API key is required.
If you already possess an API key, enter it in the field and click "Register".
If not, click "Get API Key" to obtain one, then enter it and click "Register".
Your API key is securely protected solely in your browser, and will never be sent to any third-party or developer server.`
          )}
        </p>

        {errorMsg && (
          <div className="mb-4 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="relative mb-6">
          <input
            id="gemini-api-key-input"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm pr-12 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            id="gemini-api-key-toggle-show"
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="mb-6 space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
            {lang === 'ja' ? '天体画像処理 API モデル' : 'Astronomical Processing API Model'}
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
          >
            <option value="gemini-3.1-flash-image">Nano Banana 2 (gemini-3.1-flash-image - デフォルト)</option>
            <option value="gemini-3-pro-image-preview">Nano Banana Pro (gemini-3-pro-image-preview)</option>
            <option value="gemini-2.5-flash-image">Nano Banana (gemini-2.5-flash-image)</option>
          </select>
          <p className="text-[9px] text-gray-500 leading-relaxed text-gray-400">
            {lang === 'ja' 
              ? '※モデルが高負荷等でエラーを返した場合、自動的に他の候補を試行（フォールバック）します。'
              : '*Automated fallback behavior triggers if the selected model fails.'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            id="gemini-api-key-get-button"
            onClick={handleGetApiKey}
            className="flex-1 py-3 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-gray-300"
          >
            {lang === 'ja' ? 'API取得 (Google AI Studio)' : 'Get Key (Google AI Studio)'}
          </button>
          <button
            id="gemini-api-key-register-button"
            onClick={handleSave}
            className="flex-1 py-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 transition-all text-white"
          >
            {lang === 'ja' ? '登録' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
