
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Loader2, SlidersHorizontal, List, Sparkles, ScanSearch, Eraser, MousePointer2, ChevronDown, Save, RotateCcw, Palette, MapPin, Check, Mic, MicOff, BookmarkPlus, Undo2, Map as MapIcon, ExternalLink, Eye, EyeOff, Info, Globe, Search as SearchIcon, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { FileEntry } from '../types';
import { editImage } from '../services/geminiService';
import { parseFits, renderFitsToCanvas, writeFits, generateFitsHeaderString } from '../services/fitsUtils';
import { renderTiffToCanvas, writeTiff } from '../services/tiffUtils';
import { translations, Language } from '../services/i18n';
import { getFitsMetadata, ExtractedMetadata, MetadataItem, getImageMetadata, getSimBadLink, getAladinLink, getMapLink, formatRA, formatDec, worldToPixel } from '../services/metadataUtils';
import { AstrometryService, AnnotationObject } from '../services/solverService';
import { calculateHistogram, drawHistogram, getLuminanceArray, applyLevels, getAutoLevels, HistogramData, createFeatheredMask } from '../services/imageProcessing';
import { fetchWikiInfo, WikiInfo } from '../services/wikiService';
import { findCelestialObject, CelestialObject } from '../services/objectDatabase';

interface PreviewModalProps {
  fileEntry: FileEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  hasNext: boolean;
  hasPrev: boolean;
  lang: Language;
}

type ActivePanel = 'none' | 'adjust' | 'ai' | 'solver' | 'metadata' | 'object-detail';

const isPointInPolygon = (point: {x:number, y:number}, polygon: {x:number, y:number}[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const PreviewModal: React.FC<PreviewModalProps> = ({ fileEntry, isOpen, onClose, lang }) => {
  const t = translations[lang].preview;
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.matchMedia("(orientation: portrait)").matches);
  const [isDirty, setIsDirty] = useState(false);
  
  const [solving, setSolving] = useState(false);
  const [solveMsg, setSolveMsg] = useState('');
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationObject | null>(null);
  const [wikiInfo, setWikiInfo] = useState<WikiInfo | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [allSelections, setAllSelections] = useState<{x:number,y:number}[][]>([]);
  const [currentLasso, setCurrentLasso] = useState<{x:number,y:number}[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeMask, setActiveMask] = useState<Uint8ClampedArray | null>(null);

  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [imageVersion, setImageVersion] = useState(0); 
  const [undoStack, setUndoStack] = useState<ImageData[]>([]); 
  const [intrinsicSize, setIntrinsicSize] = useState({ width: 1, height: 1 });
  
  const [blackPoint, setBlackPoint] = useState(0);
  const [whitePoint, setWhitePoint] = useState(255);
  const [gamma, setGamma] = useState(1.0);
  const [contrast, setContrast] = useState(0);
  const [redBalance, setRedBalance] = useState(1);
  const [greenBalance, setGreenBalance] = useState(1);
  const [blueBalance, setBlueBalance] = useState(1);
  const [sourceHistogram, setSourceHistogram] = useState<HistogramData | null>(null);

  const [solverType, setSolverType] = useState<'remote'|'local'>(() => (localStorage.getItem('solver_type') as any) || 'remote');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('astrometry_api_key') || '');
  const [localIp, setLocalIp] = useState(() => localStorage.getItem('solver_local_ip') || '127.0.0.1');
  const [localPort, setLocalPort] = useState(() => localStorage.getItem('solver_local_port') || '8080');
  const [localRadius, setLocalRadius] = useState(() => localStorage.getItem('solver_local_radius') || '15');
  const [localSnr, setLocalSnr] = useState(() => localStorage.getItem('solver_local_snr') || '5');
  const [localDownsample, setLocalDownsample] = useState(() => localStorage.getItem('solver_local_downsample') || '2');
  const [localCpuLimit, setLocalCpuLimit] = useState(() => localStorage.getItem('solver_local_cpulimit') || '60');
  const [localCustomArgs, setLocalCustomArgs] = useState(() => localStorage.getItem('solver_local_custom') || '--scale-units degwidth --scale-low 1 --scale-high 10 --guess-scale --no-plots --no-verify --no-remove-lines --uniformize 10');

  const [objSearchQuery, setObjSearchQuery] = useState('');
  const [objSearchLoading, setObjSearchLoading] = useState(false);
  const [searchedObject, setSearchedObject] = useState<(CelestialObject & { pixelx?: number, pixely?: number }) | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<string[]>(() => JSON.parse(localStorage.getItem('saved_ai_prompts') || '[]'));
  const recognitionRef = useRef<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histogramRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const prevKeyRef = useRef("");

  const injectJpegComment = async (blob: Blob, comment: string): Promise<Blob> => {
    const buffer = await blob.arrayBuffer();
    const view = new Uint8Array(buffer);
    if (view[0] !== 0xFF || view[1] !== 0xD8) return blob; 
    const commentBytes = new TextEncoder().encode(comment);
    const len = commentBytes.length + 2;
    const marker = [0xFF, 0xFE, (len >> 8) & 0xFF, len & 0xFF];
    return new Blob([view.slice(0, 2), new Uint8Array(marker), commentBytes, view.slice(2)], { type: 'image/jpeg' });
  };

  const handleClose = () => {
    if (isDirty) {
      const msg = lang === 'ja' ? '変更内容が破棄されます。プレビューを閉じてもよろしいですか？' : 'Unsaved changes will be discarded. Close anyway?';
      if (!window.confirm(msg)) return;
    }
    onClose();
  };

  const clearSelections = useCallback(() => {
    setAllSelections([]);
    setCurrentLasso([]);
    setActiveMask(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !sourceCanvasRef.current) return;
    const sCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      const lastState = undoStack[undoStack.length - 1];
      sCtx.putImageData(lastState, 0, 0);
      setUndoStack(prev => prev.slice(0, -1));
      
      const newIdata = sCtx.getImageData(0,0,sCtx.canvas.width,sCtx.canvas.height);
      setSourceHistogram(calculateHistogram(getLuminanceArray(newIdata, 4)));
      setImageVersion(v => v + 1);
      clearSelections();
      if (undoStack.length === 1) setIsDirty(false);
    }
  }, [undoStack, clearSelections]);

  const resetAdjustments = useCallback(() => {
    setBlackPoint(0); setWhitePoint(255); setGamma(1.0); setContrast(0);
    setRedBalance(1); setGreenBalance(1); setBlueBalance(1);
  }, []);

  const commitAdjustment = useCallback(() => {
    if (!canvasRef.current || !sourceCanvasRef.current) return;
    const sCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
        const currentState = sCtx.getImageData(0, 0, sCtx.canvas.width, sCtx.canvas.height);
        setUndoStack(prev => [...prev.slice(-19), currentState]);
        sCtx.drawImage(canvasRef.current, 0, 0);
        const finalData = sCtx.getImageData(0,0,sCtx.canvas.width,sCtx.canvas.height);
        setSourceHistogram(calculateHistogram(getLuminanceArray(finalData, 4)));
    }
    clearSelections();
    resetAdjustments(); 
    setImageVersion(v => v + 1); 
    setIsDirty(true);
  }, [clearSelections, resetAdjustments]);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode && allSelections.length > 0) commitAdjustment();
    setSelectionMode(!selectionMode);
  }, [selectionMode, allSelections, commitAdjustment]);

  const handleFitToScreen = useCallback((w: number, h: number) => {
     if (!containerRef.current || w <= 0 || h <= 0) return;
     const rect = containerRef.current.getBoundingClientRect();
     const scale = Math.min((rect.width - 40) / w, (rect.height - 40) / h);
     setZoom(scale > 0 ? scale : 1); 
     setPan({ x: 0, y: 0 });
  }, []);

  const loadFile = async (entry: FileEntry) => {
    try {
      const file = await entry.handle.getFile();
      const sCanvas = sourceCanvasRef.current; if (!sCanvas) return;
      const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
      const setup = (img: HTMLImageElement | HTMLCanvasElement) => {
          sCanvas.width = img.width; sCanvas.height = img.height;
          setIntrinsicSize({ width: img.width, height: img.height });
          sCtx?.clearRect(0, 0, img.width, img.height);
          sCtx?.drawImage(img, 0, 0);
          const idata = sCtx?.getImageData(0,0,img.width,img.height);
          if (idata) setSourceHistogram(calculateHistogram(getLuminanceArray(idata, 4)));
          setImageVersion(v => v + 1); setLoading(false);
          setTimeout(() => handleFitToScreen(img.width, img.height), 150);
      };
      if (['fits','fit'].includes(entry.extension)) {
          const data = await parseFits(file); setMetadata(getFitsMetadata(data.header));
          const temp = document.createElement('canvas'); renderFitsToCanvas(data, temp); setup(temp);
      } else if (['tiff','tif'].includes(entry.extension)) {
          const temp = document.createElement('canvas'); await renderTiffToCanvas(file, temp); setup(temp);
          getImageMetadata(file).then(setMetadata);
      } else {
          const img = new Image(); img.src = URL.createObjectURL(file);
          img.onload = () => { setup(img); URL.revokeObjectURL(img.src); };
          getImageMetadata(file).then(setMetadata);
      }
    } catch (err) { console.error(err); setLoading(false); }
  };

  const handleSave = async (format: string) => {
    if (!canvasRef.current) return;
    setLoading(true); setShowSaveMenu(false);
    try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const fileName = `export_${Date.now()}.${format}`;
        let blob: Blob | null = null;
        const wcsData = metadata?.wcs || {};
        
        const wcsString = generateFitsHeaderString(canvas.width, canvas.height, wcsData, true);

        if (format === 'fits') {
            const idata = ctx!.getImageData(0, 0, canvas.width, canvas.height).data;
            const planeSize = canvas.width * canvas.height;
            const floatData = new Float32Array(planeSize * 3);
            for(let i=0; i<planeSize; i++) {
                floatData[i] = idata[i*4];               // R plane
                floatData[i + planeSize] = idata[i*4+1];   // G plane
                floatData[i + 2 * planeSize] = idata[i*4+2]; // B plane
            }
            blob = writeFits(floatData, canvas.width, canvas.height, wcsData, 3);
        } else if (format === 'tiff') {
            const idata = ctx!.getImageData(0, 0, canvas.width, canvas.height);
            blob = writeTiff(idata, wcsString);
        } else if (format === 'jpeg') {
            const tempBlob = await new Promise<Blob>(r => canvas.toBlob(r!, 'image/jpeg', 0.95));
            blob = await injectJpegComment(tempBlob, wcsString);
        } else {
            blob = await new Promise(r => canvas.toBlob(r, `image/${format}`, 0.95));
        }

        if (blob) {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
            setIsDirty(false); 
        }
    } catch (e) { console.error(e); alert("Save failed"); } finally { setLoading(false); }
  };

  const handleSolve = async () => {
      if (!canvasRef.current) return;
      setSolving(true); setSolveMsg(t.solving);
      try {
          const solver = new AstrometryService(apiKey);
          const blob = await new Promise<Blob>(r => canvasRef.current!.toBlob(r!, 'image/jpeg', 0.9));
          const { wcs, annotations: resAnns } = solverType === 'local' 
            ? await solver.solveLocal(blob, localIp, localPort, {
                radius: parseFloat(localRadius), 
                snr: parseFloat(localSnr), 
                downsample: parseInt(localDownsample),
                cpulimit: parseInt(localCpuLimit),
                custom_args: localCustomArgs,
                ra: searchedObject?.ra,
                dec: searchedObject?.dec
            })
            : await (async () => {
                await solver.login(); const subId = await solver.upload(blob, 'solve.jpg');
                const jobId = await solver.waitForJob(subId, msg => setSolveMsg(msg));
                const w = await solver.getWcsHeader(jobId).catch(() => ({}));
                const anns = await solver.getAnnotations(jobId).catch(() => []);
                return { wcs: w, annotations: anns };
            })();
          
          if (resAnns) setAnnotations(resAnns);
          const wcsRes = getFitsMetadata(wcs);
          setMetadata(prev => {
              const prevItems = prev?.items || [];
              const wcsKeysUpper = new Set(Object.keys(wcs).map(k => k.toUpperCase()));
              const filteredOld = prevItems.filter(it => !wcsKeysUpper.has(it.key.toUpperCase()));
              const mergedItems = [...wcsRes.items, ...filteredOld];
              return { ...prev, ...wcsRes, items: mergedItems, wcs: { ...(prev?.wcs || {}), ...wcs } };
          });
          setSolveMsg(t.solved); setIsDirty(true); setActivePanel('metadata');
      } catch (e: any) { setSolveMsg(t.failed + ": " + e.message); } finally { setSolving(false); }
  };

  const handleSelectObject = async (ann: AnnotationObject) => {
    setSelectedAnnotation(ann);
    setActivePanel('object-detail');
    setWikiInfo(null); setWikiLoading(true);
    try {
        const info = await fetchWikiInfo(ann.names[0], lang);
        setWikiInfo(info);
    } catch (e) { console.error(e); } finally { setWikiLoading(false); }
  };

  const handleObjectSearch = async () => {
    if (!objSearchQuery.trim()) return;
    setObjSearchLoading(true);
    try {
        const obj = await findCelestialObject(objSearchQuery, lang);
        if (obj) {
            const pixel = metadata?.wcs ? worldToPixel(obj.ra, obj.dec, metadata.wcs) : null;
            if (pixel) {
                setSearchedObject({ ...obj, pixelx: pixel.x, pixely: pixel.y });
                setPan({ 
                    x: (intrinsicSize.width / 2 - pixel.x) * zoom, 
                    y: (intrinsicSize.height / 2 - pixel.y) * zoom 
                });
            } else {
                setSearchedObject(obj as any);
                if (metadata?.wcs) {
                    alert(t.objectNotFound);
                }
            }
        } else {
            alert(t.objectNotFound);
        }
    } catch (e) { console.error(e); } finally { setObjSearchLoading(false); }
  };

  const commitAiEdit = async (instruction: string) => {
    if (!canvasRef.current || !sourceCanvasRef.current) return;
    setAiProcessing(true);
    try {
        const sCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];
        const { image } = await editImage(base64, 'image/jpeg', instruction);
        if (image && sCtx) {
            const img = new Image(); img.src = `data:image/jpeg;base64,${image}`;
            img.onload = () => {
                setUndoStack(prev => [...prev.slice(-19), sCtx.getImageData(0, 0, sCtx.canvas.width, sCtx.canvas.height)]);
                sCtx.drawImage(img, 0, 0, sCtx.canvas.width, sCtx.canvas.height);
                setSourceHistogram(calculateHistogram(getLuminanceArray(sCtx.getImageData(0,0,sCtx.canvas.width,sCtx.canvas.height), 4)));
                setImageVersion(v => v + 1); clearSelections(); setIsDirty(true);
            };
        }
    } catch (e: any) { alert("AI Edit failed: " + e.message); } finally { setAiProcessing(false); }
  };

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) { alert(t.micNotSupported); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = lang === 'ja' ? 'ja-JP' : 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setAiPrompt(prev => prev + transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    }
  };

  const savePrompt = () => {
    if (!aiPrompt.trim()) return;
    const next = [aiPrompt, ...savedPrompts.filter(p => p !== aiPrompt)].slice(0, 10);
    setSavedPrompts(next);
    localStorage.setItem('saved_ai_prompts', JSON.stringify(next));
  };

  useEffect(() => {
    if (fileEntry && isOpen) {
      setLoading(true); setActivePanel('none'); clearSelections(); resetAdjustments(); setIsDirty(false); setUndoStack([]); setAnnotations([]); setSelectedAnnotation(null); setSearchedObject(null);
      setTimeout(() => loadFile(fileEntry), 100);
    }
  }, [fileEntry, isOpen]);

  useEffect(() => {
    if (!sourceCanvasRef.current || !canvasRef.current) return;
    const key = `${blackPoint}-${whitePoint}-${gamma}-${contrast}-${redBalance}-${greenBalance}-${blueBalance}-${imageVersion}-${!!activeMask}`;
    if (key === prevKeyRef.current || processingRef.current) return;
    processingRef.current = true;
    const sctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true }); 
    const dctx = canvasRef.current.getContext('2d');
    if (sctx && dctx) {
        const w = sourceCanvasRef.current.width; const h = sourceCanvasRef.current.height;
        canvasRef.current.width = w; canvasRef.current.height = h;
        const sData = sctx.getImageData(0,0,w,h); const dData = dctx.createImageData(w,h);
        applyLevels(sData, dData, blackPoint, whitePoint, redBalance, greenBalance, blueBalance, contrast, activeMask || undefined, gamma);
        dctx.putImageData(dData, 0, 0); prevKeyRef.current = key;
        if (activePanel === 'adjust' && histogramRef.current) drawHistogram(calculateHistogram(getLuminanceArray(dData, 8)), histogramRef.current);
    }
    processingRef.current = false;
  }, [blackPoint, whitePoint, gamma, contrast, redBalance, greenBalance, blueBalance, imageVersion, activePanel, activeMask]);

  useEffect(() => {
    if (allSelections.length > 0 || currentLasso.length > 2) {
      setActiveMask(createFeatheredMask(intrinsicSize.width, intrinsicSize.height, [...allSelections, currentLasso], 10));
    } else { setActiveMask(null); }
  }, [allSelections, currentLasso, intrinsicSize]);

  const getCoords = (e: any) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { 
      x: Math.round((cx - (rect.left + rect.width / 2 + pan.x)) / zoom + intrinsicSize.width / 2),
      y: Math.round((cy - (rect.top + rect.height / 2 + pan.y)) / zoom + intrinsicSize.height / 2)
    };
  };

  const groupedMetadata: Record<string, MetadataItem[]> = metadata?.items.reduce((acc, item) => {
      const g = item.group || 'General';
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
  }, {} as Record<string, MetadataItem[]>) || {};

  return (
    <div className="fixed inset-0 z-[999] flex flex-col bg-gray-950 text-white overflow-hidden animate-in fade-in duration-300 pointer-events-auto">
      <canvas ref={sourceCanvasRef} className="hidden" />
      <div className="relative h-14 flex items-center justify-between px-4 border-b border-white/5 bg-gray-900/90 backdrop-blur-2xl shrink-0 z-[150] shadow-xl">
         <div className="flex items-center gap-4">
             <button type="button" onClick={handleClose} className="p-2.5 hover:bg-white/20 rounded-full transition-all active:scale-90 bg-white/10 border border-white/5 flex items-center justify-center cursor-pointer pointer-events-auto"><X size={20}/></button>
             <div className="flex flex-col">
                <span className="font-black text-[10px] uppercase tracking-widest text-white/90 truncate max-w-[150px] sm:max-w-[300px]">{fileEntry?.name}</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase">{fileEntry?.extension} FORMAT</span>
             </div>
         </div>
         <div className="flex items-center gap-2">
            <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${undoStack.length > 0 ? 'bg-white/10 text-white hover:bg-white/20 cursor-pointer' : 'text-gray-700 opacity-20 cursor-not-allowed'}`} title={t.undo}><Undo2 size={18}/></button>
            <div className="w-px h-6 bg-white/5 mx-1"></div>
            <button type="button" onClick={() => setShowSaveMenu(!showSaveMenu)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"><Save size={14}/> {t.saveProcessedImage}</button>
            {showSaveMenu && (
                <div className="absolute right-4 top-14 flex flex-col bg-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[160] w-48">
                    {['fits','jpeg','heic','png','tiff'].map(f => <button key={f} onClick={() => handleSave(f)} className="px-5 py-3 text-left text-[9px] font-black hover:bg-blue-600 uppercase border-b border-white/5 last:border-0">{f}</button>)}
                </div>
            )}
         </div>
      </div>
      <div className={`flex-1 flex overflow-hidden ${isPortrait ? 'flex-col' : 'flex-row'}`}>
          <div 
            ref={containerRef} 
            onMouseDown={(e) => {
              if (selectionMode) { 
                setIsDrawing(true); 
                setCurrentLasso([getCoords(e)]); 
              } else {
                setIsPanning(true);
                setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }
            }}
            onMouseMove={(e) => {
              if (isDrawing && selectionMode) {
                setCurrentLasso(p => [...p, getCoords(e)]);
              } else if (isPanning && !selectionMode) {
                setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
              }
            }}
            onMouseUp={() => {
              if (isDrawing && selectionMode) {
                if (currentLasso.length > 2) { setAllSelections(p => [...p, currentLasso]); setIsDirty(true); }
                setCurrentLasso([]);
                setIsDrawing(false);
              }
              setIsPanning(false);
            }}
            onMouseLeave={() => { setIsPanning(false); setIsDrawing(false); }}
            onClick={(e) => { if (selectionMode) { const c = getCoords(e); if (allSelections.some(p => isPointInPolygon(c, p))) commitAdjustment(); } }} 
            className={`relative flex-1 bg-black flex items-center justify-center overflow-hidden touch-none ${selectionMode ? 'cursor-crosshair' : 'cursor-grab'} ${isPanning ? 'cursor-grabbing' : ''}`}
          >
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: intrinsicSize.width, height: intrinsicSize.height, marginLeft: -intrinsicSize.width / 2, marginTop: -intrinsicSize.height / 2, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: (isDrawing || isPanning) ? 'none' : 'transform 0.15s ease-out' }}>
                 <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                 <svg className="absolute inset-0 overflow-visible pointer-events-none" viewBox={`${-intrinsicSize.width/2} ${-intrinsicSize.height/2} ${intrinsicSize.width} ${intrinsicSize.height}`}>
                    {showAnnotations && annotations.map((ann, i) => (
                        <g key={i} className="cursor-pointer group pointer-events-auto" onClick={(e) => { e.stopPropagation(); handleSelectObject(ann); }}>
                            <circle cx={ann.pixelx - intrinsicSize.width/2} cy={ann.pixely - intrinsicSize.height/2} r={Math.max(10, 18/zoom)} fill="none" stroke={selectedAnnotation === ann ? "#60a5fa" : "#fbbf24"} strokeWidth={3/zoom} className="group-hover:stroke-blue-400 group-hover:r-[22/zoom] transition-all" />
                            <text x={ann.pixelx - intrinsicSize.width/2 + 15/zoom} y={ann.pixely - intrinsicSize.height/2 - 15/zoom} fill={selectedAnnotation === ann ? "#60a5fa" : "#fbbf24"} fontSize={Math.max(12, 16/zoom)} className="font-black drop-shadow-xl select-none group-hover:fill-white transition-all" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: 3/zoom }}>{ann.names[0]}</text>
                        </g>
                    ))}
                    {searchedObject && searchedObject.pixelx !== undefined && searchedObject.pixely !== undefined && (
                        <g className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelectObject({ ...searchedObject, names: [searchedObject.name] } as any); }}>
                            <path d={`M ${searchedObject.pixelx - intrinsicSize.width/2 - 20/zoom} ${searchedObject.pixely - intrinsicSize.height/2} L ${searchedObject.pixelx - intrinsicSize.width/2 + 20/zoom} ${searchedObject.pixely - intrinsicSize.height/2} M ${searchedObject.pixelx - intrinsicSize.width/2} ${searchedObject.pixely - intrinsicSize.height/2 - 20/zoom} L ${searchedObject.pixelx - intrinsicSize.width/2} ${searchedObject.pixely - intrinsicSize.height/2 + 20/zoom}`} stroke="#3b82f6" strokeWidth={4/zoom} />
                            <circle cx={searchedObject.pixelx - intrinsicSize.width/2} cy={searchedObject.pixely - intrinsicSize.height/2} r={30/zoom} fill="none" stroke="#3b82f6" strokeWidth={2/zoom} strokeDasharray="4,4" className="animate-[spin_10s_linear_infinite]" />
                            <text x={searchedObject.pixelx - intrinsicSize.width/2} y={searchedObject.pixely - intrinsicSize.height/2 + 50/zoom} fill="#3b82f6" fontSize={Math.max(14, 20/zoom)} className="font-black text-center" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: 3/zoom }}>{searchedObject.name}</text>
                        </g>
                    )}
                    <defs><mask id="m"><rect x="-50%" y="-50%" width="200%" height="200%" fill="white" />{allSelections.map((s,i) => <polygon key={i} points={s.map(p=>`${p.x - intrinsicSize.width/2},${p.y - intrinsicSize.height/2}`).join(' ')} fill="black" />)}</mask></defs>
                    {allSelections.length > 0 && <rect x="-50%" y="-50%" width="200%" height="200%" fill="rgba(0,0,0,0.5)" mask="url(#m)" className="pointer-events-none" />}
                    {allSelections.map((s,i) => <polygon key={i} points={s.map(p=>`${p.x - intrinsicSize.width/2},${p.y - intrinsicSize.height/2}`).join(' ')} fill="rgba(59,130,246,0.1)" stroke="white" strokeWidth={2/zoom} strokeDasharray="4,4" className="pointer-events-none" />)}
                    {currentLasso.length > 1 && <polyline points={currentLasso.map(p=>`${p.x - intrinsicSize.width/2},${p.y - intrinsicSize.height/2}`).join(' ')} fill="none" stroke="white" strokeWidth={2/zoom} strokeDasharray="4,4" className="pointer-events-none" />}
                 </svg>
              </div>

              {/* ズームOverlay (右下の丸ボタン群) */}
              <div className="absolute right-6 bottom-6 flex flex-col gap-3 z-[110]">
                  <button onClick={() => setZoom(z => z * 1.25)} className="p-4 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all shadow-2xl active:scale-90" title={t.zoomIn}><ZoomIn size={24}/></button>
                  <button onClick={() => handleFitToScreen(intrinsicSize.width, intrinsicSize.height)} className="p-4 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all shadow-2xl active:scale-90" title={t.fitToScreen}><Maximize size={24}/></button>
                  <button onClick={() => setZoom(z => z / 1.25)} className="p-4 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition-all shadow-2xl active:scale-90" title={t.zoomOut}><ZoomOut size={24}/></button>
              </div>
          </div>
          {activePanel !== 'none' && (
              <div className={`bg-gray-900 overflow-y-auto no-scrollbar shadow-2xl z-40 shrink-0 ${isPortrait ? 'w-full h-1/2 border-t border-white/5' : 'w-80 h-full border-l border-white/5'}`}>
                  <div className="p-6 space-y-8 animate-in slide-in-from-right duration-300">
                      <div className="flex justify-between items-center sticky top-0 bg-gray-900 py-2 border-b border-white/5 z-10">
                          <h3 className="font-black text-[10px] uppercase tracking-widest text-white/60">
                              {activePanel === 'adjust' ? t.adjustImage : 
                               activePanel === 'ai' ? t.aiTools : 
                               activePanel === 'solver' ? t.plateSolving : 
                               activePanel === 'object-detail' ? t.objectsFound : t.metadata}
                          </h3>
                          <button onClick={() => setActivePanel('none')} className="p-1 hover:bg-white/10 rounded-full"><ChevronDown size={20}/></button>
                      </div>
                      {activePanel === 'object-detail' && selectedAnnotation && (
                          <div className="space-y-6">
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <h4 className="text-xl font-black text-white">{selectedAnnotation.names[0]}</h4>
                                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-[8px] font-black uppercase rounded-lg border border-blue-500/20">{selectedAnnotation.type}</span>
                                  </div>
                                  {wikiLoading ? (
                                      <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-40">
                                          <Loader2 className="animate-spin" size={24} />
                                          <span className="text-[10px] font-black uppercase tracking-widest">Fetching from Wiki...</span>
                                      </div>
                                  ) : wikiInfo ? (
                                      <div className="space-y-4 animate-in fade-in duration-500">
                                          {wikiInfo.imageUrl && <img src={wikiInfo.imageUrl} className="w-full h-48 object-cover rounded-2xl shadow-2xl border border-white/5" alt={selectedAnnotation.names[0]} />}
                                          <p className="text-[11px] text-gray-400 leading-relaxed font-medium">{wikiInfo.description.substring(0, 300)}...</p>
                                          <div className="grid grid-cols-2 gap-2 bg-black/40 p-4 rounded-2xl border border-white/5 font-mono">
                                              <div className="flex flex-col"><span className="text-[8px] text-gray-600 font-black uppercase">RA</span><span className="text-[10px] text-blue-400">{selectedAnnotation.ra ? formatRA(selectedAnnotation.ra) : wikiInfo.ra || '--'}</span></div>
                                              <div className="flex flex-col"><span className="text-[8px] text-gray-600 font-black uppercase">Dec</span><span className="text-[10px] text-blue-400">{selectedAnnotation.dec ? formatDec(selectedAnnotation.dec) : wikiInfo.dec || '--'}</span></div>
                                          </div>
                                          <div className="flex flex-col gap-2">
                                              <a href={wikiInfo.url} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase border border-white/10 transition-all"><Globe size={14}/> {t.searchWiki}</a>
                                              <a href={getSimBadLink(selectedAnnotation.names[0])} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase transition-all"><ExternalLink size={14}/> {t.openSimbadLink}</a>
                                              <a href={getAladinLink({ objectName: selectedAnnotation.names[0], ra: selectedAnnotation.ra, dec: selectedAnnotation.dec })} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase transition-all"><MapIcon size={14}/> {t.openAladin}</a>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="text-center py-10 opacity-30 text-[10px] uppercase font-black">No info found for this object</div>
                                  )}
                              </div>
                              <button onClick={() => setActivePanel('solver')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase border border-white/5">Back to Objects List</button>
                          </div>
                      )}
                      {activePanel === 'adjust' && (
                          <div className="space-y-6">
                              <div className="bg-black/40 rounded-2xl p-2.5 border border-white/5"><canvas ref={histogramRef} width={280} height={100} className="w-full h-24" /></div>
                              <div className="flex flex-col gap-2.5">
                                  <div className="flex gap-2.5">
                                      <button onClick={() => { if(sourceHistogram) { const l = getAutoLevels(sourceHistogram); setBlackPoint(l.black); setWhitePoint(l.white); setIsDirty(true); } }} className="flex-1 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">{t.autoStretch}</button>
                                      <button onClick={resetAdjustments} className="p-3 bg-white/5 rounded-xl border border-white/10"><RotateCcw size={18}/></button>
                                  </div>
                                  <button onClick={commitAdjustment} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Check size={16}/> {t.commitAdjust}</button>
                              </div>
                              <div className="space-y-5">
                                  {[
                                    { l: t.blackPoint, v: blackPoint, s: setBlackPoint, min: 0, max: 255 },
                                    { l: t.whitePoint, v: whitePoint, s: setWhitePoint, min: 0, max: 255 },
                                    { l: t.gamma, v: gamma, s: setGamma, min: 0.1, max: 3, step: 0.01 },
                                    { l: t.contrast, v: contrast, s: setContrast, min: -100, max: 100 },
                                    { l: t.redBalance, v: redBalance, s: setRedBalance, min: 0, max: 3, step: 0.01 },
                                    { l: t.greenBalance, v: greenBalance, s: setGreenBalance, min: 0, max: 3, step: 0.01 },
                                    { l: t.blueBalance, v: blueBalance, s: setBlueBalance, min: 0, max: 3, step: 0.01 }
                                  ].map(c => (
                                      <div key={c.l} className="space-y-2">
                                          <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase"><span>{c.l}</span><span className="text-blue-400 font-mono">{c.v.toFixed(2)}</span></div>
                                          <input type="range" min={c.min} max={c.max} step={c.step||1} value={c.v} onChange={e => { c.s(parseFloat(e.target.value)); setIsDirty(true); }} className="w-full h-1 bg-white/5 accent-blue-500 rounded-full appearance-none cursor-pointer" />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      {activePanel === 'solver' && (
                          <div className="space-y-6">
                              <div className="space-y-3 p-4 bg-gray-950/40 rounded-2xl border border-white/5">
                                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">{t.objectSearch}</h4>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text" 
                                          placeholder="M46" 
                                          value={objSearchQuery} 
                                          onChange={e => setObjSearchQuery(e.target.value)} 
                                          onKeyDown={e => e.key === 'Enter' && handleObjectSearch()}
                                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] font-bold outline-none focus:border-blue-500/50"
                                      />
                                      <button 
                                          onClick={handleObjectSearch}
                                          disabled={objSearchLoading}
                                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-20"
                                      >
                                          {objSearchLoading ? <Loader2 className="animate-spin" size={14}/> : t.search}
                                      </button>
                                  </div>
                                  {searchedObject && !metadata?.wcs && (
                                      <div className="flex items-center gap-2 p-2 bg-blue-600/10 rounded-lg border border-blue-500/20 animate-in fade-in slide-in-from-top-1">
                                          <Check size={12} className="text-blue-400" />
                                          <span className="text-[9px] font-black text-blue-400 uppercase">解析ヒント設定済み: {searchedObject.name}</span>
                                      </div>
                                  )}
                                  {!metadata?.wcs && !searchedObject && <p className="text-[8px] text-gray-600 italic">Plate Solvingが必要です (検索でヒント設定可能)</p>}
                              </div>

                              <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                                  {['remote','local'].map(st => <button key={st} onClick={() => setSolverType(st as any)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${solverType===st?'bg-blue-600 text-white shadow-lg':'text-gray-500'}`}>{st === 'remote' ? 'リモート' : 'ローカル'}</button>)}
                              </div>
                              {annotations.length > 0 && (
                                  <div className="space-y-3">
                                      <button onClick={() => setShowAnnotations(!showAnnotations)} className={`w-full py-3 rounded-xl border border-white/10 text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${showAnnotations ? 'bg-yellow-600/20 text-yellow-400' : 'bg-white/5 text-gray-400'}`}>
                                          {showAnnotations ? <Eye size={14}/> : <EyeOff size={14}/>}
                                          {t.showAnnotations} ({annotations.length})
                                      </button>
                                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                                          {annotations.map((ann, i) => (
                                              <button key={i} onClick={() => handleSelectObject(ann)} className={`px-4 py-2 rounded-lg text-left text-[9px] font-black uppercase transition-all ${selectedAnnotation === ann ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-400'}`}>{ann.names[0]}</button>
                                          ))}
                                      </div>
                                  </div>
                              )}
                              <div className="space-y-4">
                                  {solverType === 'remote' ? (
                                      <div className="space-y-1">
                                          <label className="text-[7px] font-black text-gray-600 uppercase">{t.apiKey}</label>
                                          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none font-mono" />
                                      </div>
                                  ) : (
                                      <div className="space-y-4">
                                          <div className="grid grid-cols-2 gap-3">
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.ipAddress}</label><input type="text" value={localIp} onChange={e => setLocalIp(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.port}</label><input type="text" value={localPort} onChange={e => setLocalPort(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                          </div>
                                          <div className="grid grid-cols-1 gap-2">
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.radiusDeg}</label><input type="number" value={localRadius} onChange={e => setLocalRadius(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                          </div>
                                          <div className="text-[8px] font-black text-red-500 uppercase tracking-widest mt-2">SETTINGS</div>
                                          <div className="grid grid-cols-3 gap-2">
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.downsample}</label><input type="number" value={localDownsample} onChange={e => setLocalDownsample(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.snr}</label><input type="number" value={localSnr} onChange={e => setLocalSnr(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                              <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.timeout}</label><input type="number" value={localCpuLimit} onChange={e => setLocalCpuLimit(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none" /></div>
                                          </div>
                                          <div className="space-y-1"><label className="text-[7px] font-black text-gray-600 uppercase">{t.customArgs}</label><textarea value={localCustomArgs} onChange={e => setLocalCustomArgs(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] outline-none font-mono min-h-[60px]" /></div>
                                      </div>
                                  )}
                              </div>
                              <button onClick={() => { localStorage.setItem('astrometry_api_key', apiKey); localStorage.setItem('solver_type', solverType); localStorage.setItem('solver_local_ip', localIp); localStorage.setItem('solver_local_port', localPort); localStorage.setItem('solver_local_radius', localRadius); localStorage.setItem('solver_local_snr', localSnr); localStorage.setItem('solver_local_downsample', localDownsample); localStorage.setItem('solver_local_cpulimit', localCpuLimit); localStorage.setItem('solver_local_custom', localCustomArgs); alert(t.settingsSaved); }} className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10">設定を保存</button>
                              <button onClick={handleSolve} disabled={solving} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2">{solving ? <Loader2 className="animate-spin" size={18}/> : <ScanSearch size={18}/>} {t.solveBtn}</button>
                              {solveMsg && <div className="text-[10px] px-3 py-4 rounded-xl border bg-blue-500/5 border-blue-500/10 text-blue-400 italic font-mono break-all">{solveMsg}</div>}
                          </div>
                      )}
                      {activePanel === 'ai' && (
                          <div className="space-y-6">
                              <div className="space-y-4">
                                  <div className="relative">
                                    <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] font-medium min-h-[120px] outline-none pr-10 focus:border-purple-500/50 transition-all" placeholder={t.customProcessPlaceholder} />
                                    <div className="absolute right-2 top-2 flex flex-col gap-2 z-20">
                                        <button onClick={toggleMic} className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`} title={t.micStart}>{isListening ? <MicOff size={16}/> : <Mic size={16}/>}</button>
                                        <button onClick={savePrompt} className="p-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title={t.savePromptBtn}><BookmarkPlus size={16}/></button>
                                    </div>
                                  </div>
                                  <button onClick={() => commitAiEdit(aiPrompt)} disabled={aiProcessing || !aiPrompt.trim()} className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all">
                                      {aiProcessing ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} {t.customProcessBtn}
                                  </button>
                              </div>
                              {savedPrompts.length > 0 && (
                                  <div className="space-y-3">
                                      <h4 className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">{t.savedPrompts}</h4>
                                      <div className="flex flex-wrap gap-2">
                                          {savedPrompts.map((p, i) => <button key={i} onClick={() => setAiPrompt(p)} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-medium border border-white/5 truncate max-w-full text-left">{p}</button>)}
                                      </div>
                                  </div>
                              )}
                              <div className="grid grid-cols-1 gap-2.5 pt-4 border-t border-white/5">
                                  {[{ icon: Eraser, label: t.denoiseBtn, color: 'text-blue-400', p: 'Astro: Denoise background.' }, { icon: Palette, label: t.calibrateBtn, color: 'text-pink-400', p: 'Astro: Color calibration.' }, { icon: MapPin, label: t.removeGradientBtn, color: 'text-green-400', p: 'Astro: Background gradient removal.' }].map(b => (
                                      <button key={b.label} onClick={() => commitAiEdit(b.p)} className="w-full flex items-center gap-3.5 p-4 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase transition-all border border-white/5"><b.icon size={18} className={b.color}/> {b.label}</button>
                                  ))}
                              </div>
                          </div>
                      )}
                      {activePanel === 'metadata' && (
                          <div className="space-y-6">
                              {(metadata?.astro || metadata?.gps) && (
                                <div className="grid grid-cols-1 gap-2">
                                  {metadata.gps && <a href={getMapLink(metadata.gps)} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-green-600/20 border border-green-500/20 rounded-xl text-[9px] font-black uppercase text-green-400 hover:bg-green-600/30 transition-all"><MapIcon size={14}/> {t.showMap}</a>}
                                  {metadata.astro?.objectName && <a href={getSimBadLink(metadata.astro.objectName)} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-blue-600/20 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase text-blue-400 hover:bg-blue-600/30 transition-all"><ExternalLink size={14}/> {t.openSimbadLink}</a>}
                                  {metadata.astro?.ra && metadata.astro?.dec && <a href={getAladinLink(metadata.astro)} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-indigo-600/20 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase text-indigo-400 hover:bg-indigo-600/30 transition-all"><ExternalLink size={14}/> {t.openAladin}</a>}
                                </div>
                              )}
                              <div className="space-y-8">
                                  {Object.entries(groupedMetadata).sort(([g1], [g2]) => {
                                      const order = ['WCS / Astrometry', 'Location', 'Basic', 'Format', 'Exif'];
                                      const i1 = order.indexOf(g1);
                                      const i2 = order.indexOf(g2);
                                      return (i1 === -1 ? 99 : i1) - (i2 === -1 ? 99 : i2);
                                  }).map(([group, items]) => (
                                      <div key={group} className="space-y-2">
                                          <h4 className="text-[8px] font-black text-blue-500 uppercase tracking-widest px-2">{group}</h4>
                                          <div className="space-y-1">
                                              {items.map((item, i) => (
                                                  <div key={i} className="flex flex-col border-b border-white/5 py-3 px-2 hover:bg-white/5 rounded-xl transition-colors">
                                                      <span className="text-[7px] text-gray-600 font-black uppercase mb-1">{item.key}</span>
                                                      <span className="text-[10px] font-mono text-gray-300 break-all">{String(item.value)}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  ))}
                                  {(!metadata?.items || metadata.items.length === 0) && (
                                    <div className="text-center py-10 opacity-30 text-[10px] uppercase font-black">{t.noMetadata}</div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
      <div className="h-14 sm:h-18 flex items-center justify-center gap-4 px-6 bg-gray-950/95 border-t border-white/5 backdrop-blur-2xl z-[100] shrink-0">
          <button onClick={toggleSelectionMode} className={`p-3.5 rounded-2xl transition-all ${selectionMode ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-white/5'}`} title={t.selectionMode}><MousePointer2 size={24} /></button>
          <div className="w-px h-8 bg-white/5 mx-2"></div>
          <button onClick={() => setActivePanel(activePanel === 'adjust' ? 'none' : 'adjust')} className={`p-3.5 rounded-2xl transition-all ${activePanel === 'adjust' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-white/5'}`}><SlidersHorizontal size={24}/></button>
          <button onClick={() => setActivePanel(activePanel === 'ai' ? 'none' : 'ai')} className={`p-3.5 rounded-2xl transition-all ${activePanel === 'ai' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:bg-white/5'}`}><Sparkles size={24}/></button>
          <div className="relative group">
            <button onClick={() => setActivePanel(activePanel === 'solver' ? 'none' : 'solver')} className={`p-3.5 rounded-2xl transition-all ${activePanel === 'solver' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-white/5'}`}><ScanSearch size={24}/></button>
            {(annotations.length > 0 || searchedObject) && <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-black text-[9px] font-black rounded-full flex items-center justify-center border-2 border-gray-950">{annotations.length + (searchedObject ? 1 : 0)}</div>}
          </div>
          <button onClick={() => setActivePanel(activePanel === 'metadata' ? 'none' : 'metadata')} className={`p-3.5 rounded-2xl transition-all ${activePanel === 'metadata' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-500 hover:bg-white/5'}`}><List size={24}/></button>
          {(selectedAnnotation || searchedObject) && (
              <button onClick={() => setActivePanel('object-detail')} className="p-3.5 rounded-2xl transition-all bg-yellow-600 text-black shadow-xl animate-pulse"><Info size={24}/></button>
          )}
      </div>
    </div>
  );
};
