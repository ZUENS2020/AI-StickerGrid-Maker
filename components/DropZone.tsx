import React, { useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
  texts: {
      title: string;
      subtitle: string;
      drag: string;
      error: string;
  };
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelect, disabled, texts }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
    // Reset value so same file can be selected again
    e.target.value = '';
  };

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      alert(texts.error);
      return false;
    }
    return true;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden group border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300
        ${isDragOver 
          ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
          : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
      `}
    >
      {/* Invisible Overlay Input - Covers 100% of the area */}
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleChange}
        disabled={disabled}
        title=""
      />
      
      <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
        <div className={`
          p-4 rounded-full bg-white shadow-sm ring-1 ring-slate-200 
          transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md
        `}>
          {disabled ? (
             <Upload className="w-8 h-8 text-slate-400" />
          ) : (
            <ImageIcon className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {isDragOver ? texts.drag : texts.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            {texts.subtitle}
          </p>
        </div>
        
        <div className="flex gap-2 text-xs text-slate-400 uppercase tracking-wide font-medium">
          <span>PNG</span>
          <span>•</span>
          <span>JPG</span>
          <span>•</span>
          <span>WEBP</span>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
