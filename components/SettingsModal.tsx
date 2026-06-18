import React, { useState, useEffect } from 'react';
import { X, Save, Key, Info, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  translations: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, translations }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [showSaved, setShowSaved] = useState(false);
  const t = translations.preview;

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) setModel(savedModel);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', model);
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Settings className="text-blue-400" size={20} />
            <h2 className="font-bold text-white">{translations.appTitle} - {translations.preview.plateSolving}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Key size={14} />
              Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AI Studio API Key"
                className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              APIキーはブラウザのローカルストレージにのみ保存されます。
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1 ml-1"
              >
                キーを取得する <ExternalLink size={10} />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              優先 AI モデル / 503対策
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
            >
              <option value="gemini-3.5-flash">gemini-3.5-flash (推薦: 最新・高解像度)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (超高速・高安定性・503回避)</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro (大容量・高知能)</option>
            </select>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              選択したモデルが高負荷などでエラーを返した場合、自動的に他の候補を順に試して処理を完了する「フォールバック機能」が自動で働きます。
            </p>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3">
            <Info className="text-blue-400 shrink-0" size={18} />
            <div className="space-y-1">
              <p className="text-xs font-bold text-blue-100">ローカルサーバーでの利用</p>
              <p className="text-[10px] text-blue-300/80 leading-relaxed">
                ビルド後のコードでも、ここで設定したキーが優先的に使用されます。
                APIキーを設定しないと、AI分析や画像処理機能は動作しません。
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={showSaved}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              showSaved 
                ? 'bg-emerald-500 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
            }`}
          >
            {showSaved ? '保存完了!' : <><Save size={16} /> 保存する</>}
          </button>
        </div>
      </div>
    </div>
  );
};

import { Settings } from 'lucide-react';
