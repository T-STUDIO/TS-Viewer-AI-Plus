
import React, { useEffect, useState, useRef } from 'react';
import { FileImage, FileVideo, FileText, Loader2 } from 'lucide-react';
import { FileEntry } from '../types';
import { parseFits, renderFitsToCanvas } from '../services/fitsUtils';
import { renderTiffToCanvas } from '../services/tiffUtils';

export const FileThumbnail: React.FC<{ entry: FileEntry }> = ({ entry }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        generateThumb();
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    if (containerRef.current) observer.observe(containerRef.current);

    const generateThumb = async () => {
      try {
        setLoading(true);
        const file = await entry.handle.getFile();
        if (!active) return;

        const resize = (source: CanvasImageSource): string => {
            const canvas = document.createElement('canvas');
            const max = 200;
            let w = (source as any).videoWidth || (source as any).width;
            let h = (source as any).videoHeight || (source as any).height;
            const s = Math.min(max/w, max/h);
            canvas.width = w*s; canvas.height = h*s;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(source, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.7);
        };

        if (entry.type === 'video') {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file); video.muted = true; video.currentTime = 0.5;
            video.onseeked = () => { if(active) setThumbUrl(resize(video)); URL.revokeObjectURL(video.src); setLoading(false); };
            video.onerror = () => { setLoading(false); };
        } else if (['fits','fit'].includes(entry.extension)) {
            const data = await parseFits(file);
            const canvas = document.createElement('canvas'); renderFitsToCanvas(data, canvas);
            if(active) setThumbUrl(resize(canvas));
            setLoading(false);
        } else if (['tiff','tif'].includes(entry.extension)) {
            if (!(window as any).UTIF) {
                console.warn("UTIF not ready for thumbnail");
                setLoading(false);
                return;
            }
            const canvas = document.createElement('canvas'); await renderTiffToCanvas(file, canvas);
            if(active) setThumbUrl(resize(canvas));
            setLoading(false);
        } else if (entry.extension === 'psd') {
            if (!(window as any).agPsd) {
                console.warn("agPsd not ready for thumbnail");
                setLoading(false);
                return;
            }
            const buf = await file.arrayBuffer(); const psd = (window as any).agPsd.readPsd(buf);
            const canvas = document.createElement('canvas'); canvas.width = psd.width; canvas.height = psd.height;
            (window as any).agPsd.drawPsd(canvas.getContext('2d')!, psd);
            if(active) setThumbUrl(resize(canvas));
            setLoading(false);
        } else if (entry.type === 'image') {
            const img = new Image(); img.src = URL.createObjectURL(file);
            img.onload = () => { if(active) setThumbUrl(resize(img)); URL.revokeObjectURL(img.src); setLoading(false); };
            img.onerror = () => { setLoading(false); };
        } else {
            setLoading(false);
        }
      } catch (e) {
        console.warn("Thumbnail generation failed for:", entry.name, e);
        setLoading(false);
      }
    };
    return () => { active = false; };
  }, [entry]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center relative">
       {thumbUrl ? (
          <img src={thumbUrl} className="w-full h-full object-cover animate-in fade-in duration-500" alt="" loading="lazy" />
       ) : (
          <div className="flex flex-col items-center gap-2 opacity-30">
             {loading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <FileImage size={32} />}
             <span className="text-[8px] font-black uppercase tracking-widest">{entry.extension}</span>
          </div>
       )}
    </div>
  );
};
