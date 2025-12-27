import React from 'react';
import { StickerSegment } from '../types';
import { Download, RefreshCw, X } from 'lucide-react';

interface GridPreviewProps {
  segments: StickerSegment[];
  onUpdateLabel: (id: number, newLabel: string) => void;
  onDownloadAll: () => void;
  onReset: () => void;
  isProcessing: boolean;
  texts: {
      title: string;
      subtitle: string;
      reset: string;
      download: string;
      labelPlaceholder: string;
  };
}

const GridPreview: React.FC<GridPreviewProps> = ({ 
  segments, 
  onUpdateLabel, 
  onDownloadAll, 
  onReset,
  isProcessing,
  texts 
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{texts.title}</h2>
          <p className="text-slate-500 text-sm">{texts.subtitle}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-red-600 transition-colors shadow-sm font-medium text-sm"
          >
            <X className="w-4 h-4" />
            {texts.reset}
          </button>
          <button
            onClick={onDownloadAll}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {texts.download}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        {segments.map((segment) => (
          <div 
            key={segment.id} 
            className="flex flex-col gap-2 group relative"
          >
            <div className="aspect-square w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group-hover:border-indigo-400 transition-colors flex items-center justify-center">
              <img 
                src={segment.dataUrl} 
                alt={`Sticker ${segment.id}`} 
                className="w-full h-full object-contain p-2"
              />
            </div>
            <div className="relative">
                <input
                    type="text"
                    value={segment.label}
                    onChange={(e) => onUpdateLabel(segment.id, e.target.value)}
                    className="w-full text-xs sm:text-sm font-medium text-center bg-slate-50 border-none rounded-md py-1.5 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                    placeholder={texts.labelPlaceholder}
                />
                {isProcessing && segment.label.startsWith("sticker_") && (
                   <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 rounded-md pointer-events-none">
                       <div className="w-4 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                   </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GridPreview;
