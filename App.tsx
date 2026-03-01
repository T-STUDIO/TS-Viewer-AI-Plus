
import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, Folder, LayoutGrid, Search, Languages, Download, FileUp, Home, ChevronRight, UploadCloud, AlertTriangle, Settings, FolderSync
} from 'lucide-react';
import { 
  FileSystemDirectoryHandle, FileSystemFileHandle, FileSystemHandle,
  SupportedExtension, SUPPORTED_EXTENSIONS, FileEntry, DirectoryEntry, MIME_TYPES
} from './types';
import { PreviewModal } from './components/PreviewModal';
import { FileThumbnail } from './components/FileThumbnail';
import { translations, Language } from './services/i18n';

// --- Virtual File System for Fallback ---
class VirtualFileHandle implements FileSystemFileHandle {
  kind = 'file' as const;
  name: string;
  private file: File | Blob;
  constructor(file: File | Blob, name?: string) {
    this.name = name || (file instanceof File ? file.name : "file");
    this.file = file;
  }
  async getFile(): Promise<File> {
    return (this.file instanceof File) ? this.file : new File([this.file], this.name, { type: this.file.type });
  }
  async isSameEntry(other: FileSystemHandle): Promise<boolean> { return this === other; }
}

class VirtualDirectoryHandle implements FileSystemDirectoryHandle {
  kind = 'directory' as const;
  name: string;
  private entries: Map<string, FileSystemHandle> = new Map();
  constructor(name: string) { this.name = name; }
  addEntry(entry: FileSystemHandle) { this.entries.set(entry.name, entry); }
  getEntry(name: string) { return this.entries.get(name); }
  async *values(): AsyncIterableIterator<FileSystemHandle> { for (const entry of this.entries.values()) yield entry; }
  async isSameEntry(other: FileSystemHandle): Promise<boolean> { return this === other; }
}

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ja');
  const t = translations[lang];
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [entries, setEntries] = useState<(FileEntry | DirectoryEntry)[]>([]);
  const [path, setPath] = useState<{name: string, handle: FileSystemDirectoryHandle}[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [isNativeSupported, setIsNativeSupported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => { if (!('showDirectoryPicker' in window)) setIsNativeSupported(false); }, []);

  const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    let newEntries: (FileEntry | DirectoryEntry)[] = [];
    try {
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') newEntries.push({ id: entry.name, handle: entry as FileSystemDirectoryHandle, name: entry.name });
        else {
           const ext = entry.name.split('.').pop()?.toLowerCase() || '';
           if (SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)) {
             let type: 'image' | 'video' | 'pdf' | 'unsupported' = 'unsupported';
             if (MIME_TYPES[ext]?.startsWith('image/') || ['fits','fit','psd','ai','tiff','tif','bmp','heic'].includes(ext)) type = 'image';
             else if (MIME_TYPES[ext]?.startsWith('video/')) type = 'video';
             else if (ext === 'pdf') type = 'pdf';
             newEntries.push({ id: entry.name, handle: entry as FileSystemFileHandle, name: entry.name, extension: ext, type });
           }
        }
      }
      newEntries.sort((a, b) => {
         const aIsDir = a.handle.kind === 'directory';
         const bIsDir = b.handle.kind === 'directory';
         if (aIsDir && !bIsDir) return -1;
         if (!aIsDir && bIsDir) return 1;
         return a.name.localeCompare(b.name);
      });
      setEntries(newEntries);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleOpenDirectory = async () => {
    if (isNativeSupported && !isMobile) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        setDirHandle(handle); setPath([{name: handle.name, handle}]); scanDirectory(handle);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setIsNativeSupported(false); fileInputRef.current?.click();
      }
    } else { fileInputRef.current?.click(); }
  };

  const handleFallbackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    const rootHandle = new VirtualDirectoryHandle(isMobile ? "Files" : (files[0] as any).webkitRelativePath?.split('/')[0] || "Selected Files");
    Array.from(files).forEach((file: any) => {
      if (!file.webkitRelativePath) { rootHandle.addEntry(new VirtualFileHandle(file)); return; }
      const parts = file.webkitRelativePath.split('/');
      let currentDir = rootHandle;
      for (let i = 1; i < parts.length - 1; i++) {
        let nextDir = currentDir.getEntry(parts[i]);
        if (!nextDir || nextDir.kind !== 'directory') { nextDir = new VirtualDirectoryHandle(parts[i]); currentDir.addEntry(nextDir); }
        currentDir = nextDir as VirtualDirectoryHandle;
      }
      currentDir.addEntry(new VirtualFileHandle(file, parts[parts.length - 1]));
    });
    setDirHandle(rootHandle); setPath([{name: rootHandle.name, handle: rootHandle}]); scanDirectory(rootHandle);
  };

  const handleExportConfig = () => {
    const keys = ['custom_ai_prompts', 'astrometry_api_key', 'solver_local_ip', 'solver_local_port', 'solver_type'];
    const config: Record<string, any> = {};
    keys.forEach(k => { const v = localStorage.getItem(k); if(v) config[k] = v; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    a.download = 'ts-viewer-settings.json'; a.click();
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cfg = JSON.parse(ev.target?.result as string);
        Object.entries(cfg).forEach(([k, v]) => localStorage.setItem(k, String(v)));
        window.location.reload();
      } catch { alert("Invalid settings file"); }
    };
    reader.readAsText(file);
  };

  const filteredEntries = entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-gray-950 text-gray-200 overflow-hidden font-sans">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFallbackInputChange} {...(!isNativeSupported ? { webkitdirectory: "", directory: "" } : {})} multiple />
      <input type="file" ref={configInputRef} className="hidden" onChange={handleImportConfig} accept=".json" />

      {/* ●ヘッダー帯部分 */}
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/5 bg-gray-900/60 backdrop-blur-xl z-20 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/40"><LayoutGrid size={22} className="text-white" /></div>
           <div className="hidden sm:block">
              <h1 className="font-black text-sm tracking-widest text-white uppercase">{t.appTitle}</h1>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">AI-Powered Astronomical Viewer</p>
           </div>
        </div>
        
        {/* 検索項目 */}
        <div className="flex-1 max-w-md mx-4 sm:mx-6 flex items-center gap-3 bg-black/40 border border-white/5 rounded-2xl px-4 py-2 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
           <Search size={16} className="text-gray-500 shrink-0" />
           <input type="text" placeholder={t.filterFiles} value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none w-full text-xs font-medium placeholder:text-gray-700" />
        </div>

        {/* 各種設定ボタン (右側に配置) */}
        <div className="flex items-center gap-2">
           <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/5">
              <button onClick={handleExportConfig} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title={t.exportSettings}><Download size={18}/></button>
              <button onClick={() => configInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title={t.importSettings}><FileUp size={18}/></button>
           </div>
           <button onClick={() => setLang(l => l === 'en' ? 'ja' : 'en')} className="p-2.5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white border border-white/5 transition-all"><Languages size={20} /></button>
           {dirHandle && (
              <button onClick={handleOpenDirectory} className="p-2.5 hover:bg-white/10 rounded-xl text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"><FolderSync size={20} /></button>
           )}
        </div>
      </div>

      {!dirHandle ? (
        /* ●オープニング画面 */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-10">
                <div className="absolute inset-0 bg-blue-500 blur-[80px] opacity-20 rounded-full animate-pulse"></div>
                <div className="relative w-32 h-32 bg-gray-900 border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl rotate-6 transition-transform hover:rotate-0 duration-500"><LayoutGrid size={64} className="text-blue-500" /></div>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">{t.getStarted}</h2>
            <p className="text-gray-400 max-w-md mb-10 leading-relaxed font-medium text-sm whitespace-pre-wrap">{t.dragDropText}</p>
            
            <button onClick={handleOpenDirectory} className="px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/40 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-4">
              <FolderOpen size={28} />
              <span>{t.openLocalFolder}</span>
            </button>

            {isMobile && (
              <div className="mt-12 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-500 max-w-xs mx-auto">
                <AlertTriangle size={20} className="shrink-0" />
                <p className="text-[10px] font-bold text-left leading-snug uppercase tracking-tight">Mobile access: Please select multiple files or folder to scan.</p>
              </div>
            )}
        </div>
      ) : (
        /* ●サムネイル表示画面 */
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* パス表示 */}
           <div className="h-10 flex items-center px-6 gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-black/20 border-b border-white/5 shrink-0">
               <button onClick={() => { setPath(path.slice(0, 1)); scanDirectory(path[0].handle); }} className="hover:text-blue-400 transition-colors flex items-center gap-1.5"><Home size={12} /> HOME</button>
               {path.map((p, i) => (
                  <React.Fragment key={i}>
                    <ChevronRight size={12} className="text-gray-700" />
                    <button onClick={() => { const n = path.slice(0, i+1); setPath(n); scanDirectory(n[i].handle); }} className={`hover:text-white transition-colors ${i === path.length-1 ? 'text-blue-400' : ''}`}>{p.name}</button>
                  </React.Fragment>
               ))}
           </div>

           {/* ファイルグリッド */}
           <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
              {filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-700 opacity-40">
                    <Search size={64} className="mb-6" />
                    <p className="font-black uppercase tracking-[0.2em]">{t.noFiles}</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-5">
                      {filteredEntries.map(entry => {
                          const isDir = entry.handle.kind === 'directory';
                          return (
                              <div 
                                key={entry.id} 
                                className="group flex flex-col gap-3 cursor-pointer animate-in fade-in slide-in-from-bottom-2" 
                                onClick={() => isDir ? (setPath([...path, {name: entry.name, handle: entry.handle as FileSystemDirectoryHandle}]), scanDirectory(entry.handle as FileSystemDirectoryHandle)) : setPreviewFile(entry as FileEntry)}
                              >
                                 <div className="aspect-square bg-gray-900 border border-white/5 rounded-2xl overflow-hidden shadow-lg group-hover:border-blue-500/50 group-hover:shadow-blue-900/20 transition-all duration-300 flex items-center justify-center relative">
                                    {isDir ? <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500"><Folder size={48} /></div> : <FileThumbnail entry={entry as FileEntry} />}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                       <span className="text-[8px] font-black text-white uppercase tracking-tighter truncate w-full">{entry.name}</span>
                                    </div>
                                 </div>
                                 <div className="px-1 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors truncate">{entry.name}</p>
                                    {!isDir && <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mt-0.5">{(entry as FileEntry).extension}</p>}
                                 </div>
                              </div>
                          );
                      })}
                  </div>
              )}
           </div>
        </div>
      )}

      {/* ●プレビュー画面 (モーダル) */}
      {previewFile && <PreviewModal fileEntry={previewFile} isOpen={true} onClose={() => setPreviewFile(null)} onNavigate={() => {}} hasNext={false} hasPrev={false} lang={lang} />}
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
