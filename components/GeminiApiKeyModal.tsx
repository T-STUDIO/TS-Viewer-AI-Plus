import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Key } from 'lucide-react';

interface GeminiApiKeyModalProps {
  onClose?: () => void;
  lang?: 'ja' | 'en';
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({ onClose, lang = 'ja' }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReconfigMode, setIsReconfigMode] = useState(false);

  useEffect(() => {
    // Check URL query parameters
    const params = new URLSearchParams(window.location.search);
    const setApiKeyParam = params.get('set_api_key');
    
    const savedKey = localStorage.getItem('gemini_api_key');
    
    if (setApiKeyParam === 'true') {
      setIsReconfigMode(true);
      setIsOpen(true);
      if (savedKey) {
        setApiKey(savedKey);
      }
    } else if (!savedKey) {
      setIsOpen(true);
    }
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setErrorMsg(lang === 'ja' ? 'APIキーを入力してください。' : 'Please enter an API key.');
      return;
    }
    
    // プレフィックスチェックに捕まりすぎて、有効な異なる構造のキーを弾く不具合を回避します
    if (!trimmed.startsWith('AIzaSy') && trimmed.length < 20) {
      setErrorMsg(
        lang === 'ja'
          ? '無効なAPIキーフォーマットの可能性があります。AIzaSyから始まる正しいキーを入力してください。'
          : 'Invalid API key format. Should start with AIzaSy.'
      );
      return;
    }

    localStorage.setItem('gemini_api_key', trimmed);
    setIsOpen(false);
    setErrorMsg('');
    
    // Remove query parameter cleanly from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('set_api_key');
    window.history.replaceState({}, '', url.toString());
    
    // API設定の完全リセットと最速適用のため、保存時は常にリロードをトリガーします。
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
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1017]/95 p-6 shadow-2xl text-white">
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

        <div className="flex gap-3">
          {!isReconfigMode && (
            <button
              id="gemini-api-key-get-button"
              onClick={handleGetApiKey}
              className="flex-1 py-3 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-gray-300"
            >
              {lang === 'ja' ? 'API取得' : 'Get API Key'}
            </button>
          )}
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
