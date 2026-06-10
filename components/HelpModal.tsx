import React, { useState } from 'react';
import { X, HelpCircle, Layers, Cpu, Sparkles, FolderSync, Map, FileType, CheckCircle2 } from 'lucide-react';
import { helpContent } from '../services/helpData';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'ja';
}

type TabType = 'features' | 'controls' | 'formats';

export function HelpModal({ isOpen, onClose, lang }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('features');

  if (!isOpen) return null;

  const content = helpContent[lang] || helpContent.en;

  const getFeatureIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('スタッキング') || t.includes('stack')) return <Layers className="text-blue-400" size={20} />;
    if (t.includes('ai') || t.includes('gemini')) return <Sparkles className="text-purple-400" size={20} />;
    if (t.includes('選択') || t.includes('crop') || t.includes('roi')) return <Cpu className="text-emerald-400" size={20} />;
    if (t.includes('同期') || t.includes('sync')) return <FolderSync className="text-amber-400" size={20} />;
    if (t.includes('solving') || t.includes('位置')) return <Map className="text-rose-400" size={20} />;
    if (t.includes('アノテーション') || t.includes('annotation')) return <CheckCircle2 className="text-indigo-400" size={20} />;
    return <FileType className="text-sky-400" size={20} />;
  };

  return (
    <div className="fixed inset-0 bg-gray-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-300">
      <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* 背景発光エフェクト */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-purple-500/10 rounded-full blur-[90px] pointer-events-none" />

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-black/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/15 rounded-xl text-blue-400">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-md font-black text-white uppercase tracking-wider">{content.title}</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Applet Instructions & Features</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white border border-white/5 hover:border-white/15 transition-all"
            aria-label="Close Help"
          >
            <X size={16} />
          </button>
        </div>

        {/* タブ切り替えバー */}
        <div className="flex px-6 py-2 bg-black/5 border-b border-white/5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('features')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'features'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {lang === 'ja' ? '🚀 機能説明' : '🚀 Features'}
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'controls'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {lang === 'ja' ? '🎛️ 操作・ボタン説明' : '🎛️ Controls'}
          </button>
          <button
            onClick={() => setActiveTab('formats')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'formats'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {lang === 'ja' ? '💾 ファイル形式' : '💾 File Formats'}
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'features' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <h3 className="text-xs font-extrabold text-gray-400 tracking-wider uppercase mb-1">{content.featuresTitle}</h3>
              <div className="grid grid-cols-1 gap-4">
                {content.features.map((feat, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-start gap-4 hover:border-white/10 transition-colors">
                    <div className="mt-1 shrink-0 p-1.5 bg-white/5 rounded-lg border border-white/5">
                      {getFeatureIcon(feat.title)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{feat.title}</h4>
                      <p className="text-xs text-gray-400 leading-relaxed font-medium">{feat.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <h3 className="text-xs font-extrabold text-gray-400 tracking-wider uppercase mb-1">{content.controlsTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {content.controls.map((ctrl, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-colors flex flex-col">
                    <h4 className="text-xs font-extrabold text-blue-400 tracking-wide uppercase mb-1.5">{ctrl.name}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed font-semibold flex-1">{ctrl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'formats' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <h3 className="text-xs font-extrabold text-gray-400 tracking-wider uppercase">{content.formatsTitle}</h3>
              
              <div className="space-y-4">
                <div className="p-5 bg-white/5 border border-white/5 rounded-2xl">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    {lang === 'ja' ? '読み込み（インポート）可能な形式' : 'Importable Formats'}
                  </h4>
                  <ul className="space-y-2">
                    {content.formats.read.map((fmt, i) => (
                      <li key={i} className="text-xs text-gray-300 font-semibold list-disc list-inside leading-relaxed">{fmt}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 bg-white/5 border border-white/5 rounded-2xl">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    {lang === 'ja' ? '書き出し（保存・エクスポート）形式' : 'Exportable Formats'}
                  </h4>
                  <ul className="space-y-2">
                    {content.formats.write.map((fmt, i) => (
                      <li key={i} className="text-xs text-gray-300 font-semibold list-disc list-inside leading-relaxed">{fmt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 text-center shrink-0">
          <p className="text-[10px] font-black tracking-widest text-gray-600 uppercase">
            {lang === 'ja' ? '天体画像解析ビューア AI v1.2' : 'ASTRO IMAGE ANALYZER AI v1.2'}
          </p>
        </div>
      </div>
    </div>
  );
}
