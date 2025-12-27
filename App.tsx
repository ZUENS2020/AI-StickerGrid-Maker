import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import DropZone from './components/DropZone';
import GridPreview from './components/GridPreview';
import { sliceImage } from './services/imageProcessing';
import { generateStickerLabels, generateStickerSheet } from './services/geminiService';
import { StickerSegment, ProcessingStatus, ApiConfig, Language } from './types';
import { translations } from './locales';
import { Sparkles, Grid3X3, Settings, Wand2, Upload as UploadIcon, Palette, User, Paintbrush, Plus, X, Save, FileWarning, Languages } from 'lucide-react';

const DEFAULT_GOOGLE_CONFIG: ApiConfig = {
    provider: 'google',
    apiKey: '',
    baseUrl: '',
    visionModel: 'gemini-2.5-flash-latest',
    generationModel: 'gemini-2.5-flash-image'
};

const DEFAULT_OPENAI_CONFIG: ApiConfig = {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o',
    generationModel: 'dall-e-3'
};

const App: React.FC = () => {
  const [segments, setSegments] = useState<StickerSegment[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'generate'>('upload');
  
  // Language State
  const [language, setLanguage] = useState<Language>('en');

  // Config State
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_GOOGLE_CONFIG);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Generation State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [subjectRef, setSubjectRef] = useState<File | null>(null);
  const [styleRef, setStyleRef] = useState<File | null>(null);
  
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  // Derived translations
  const t = translations[language];

  useEffect(() => {
      // 1. Detect browser language
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
          setLanguage('zh');
      }

      // 2. Load config from local storage
      const savedConfig = localStorage.getItem('sticker_grid_config');
      if (savedConfig) {
          try {
              const parsed = JSON.parse(savedConfig);
              if (parsed.apiKey) {
                  setConfig(parsed);
                  setIsConfigured(true);
              }
          } catch (e) {
              console.error("Failed to parse config", e);
          }
      } else {
        // Fallback for migration
        const oldKey = localStorage.getItem('gemini_api_key');
        if (oldKey) {
            const newConfig = { ...DEFAULT_GOOGLE_CONFIG, apiKey: oldKey };
            setConfig(newConfig);
            setIsConfigured(true);
            localStorage.setItem('sticker_grid_config', JSON.stringify(newConfig));
        }
      }
  }, []);

  const toggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      localStorage.setItem('sticker_grid_config', JSON.stringify(config));
      setIsConfigured(true);
      setShowSettings(false);
      setError(null);
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setStatus('slicing');
    setError(null);
    setSegments([]);

    try {
      // 1. Slice Image
      const slicedSegments = await sliceImage(file, 4, 4);
      setSegments(slicedSegments);
      
      setStatus('analyzing');

      // 2. AI Analysis
      generateStickerLabels(file, config)
        .then((labels) => {
          setSegments(prev => prev.map((seg, idx) => ({
            ...seg,
            label: labels[idx] || seg.label,
            isProcessing: false
          })));
          setStatus('complete');
        })
        .catch(err => {
          console.error("AI Analysis failed", err);
          const errorMessage = err?.message || "";
          
          if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("Key")) {
             setError(language === 'zh' ? "API 认证失败，请检查设置。" : "API Authentication failed. Please check your settings.");
             setStatus('error'); 
             return;
          }

          // Non-fatal error
          setStatus('complete');
          setSegments(prev => prev.map(s => ({ ...s, isProcessing: false })));
        });

    } catch (err: any) {
      console.error(err);
      setError(err.message || (language === 'zh' ? '处理图片时发生错误。' : 'An error occurred while processing the image.'));
      setStatus('error');
    }
  }, [config, language]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStatus('slicing'); 
    setError(null);
    setSegments([]);

    try {
        const imageBlob = await generateStickerSheet(prompt, config, subjectRef, styleRef);
        
        // Convert Blob to File
        const file = new File([imageBlob], "generated-stickers.png", { type: "image/png" });
        
        setIsGenerating(false);
        handleFileSelect(file);

    } catch (err: any) {
        setIsGenerating(false);
        console.error(err);
        setError(err.message || (language === 'zh' ? "生成图片失败。" : "Failed to generate image."));
        setStatus('error');
    }
  };

  const handleUpdateLabel = (id: number, newLabel: string) => {
    setSegments(prev => prev.map(seg => 
      seg.id === id ? { ...seg, label: newLabel } : seg
    ));
  };

  const handleDownload = async () => {
    if (segments.length === 0) return;

    const zip = new JSZip();
    segments.forEach((seg) => {
        const safeLabel = seg.label.replace(/[^a-z0-9-_\u4e00-\u9fa5]/gi, '_'); // Allow chinese chars in filename if user edits
        zip.file(`${safeLabel}.png`, seg.blob);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stickers-pack.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(language === 'zh' ? '创建压缩包失败。' : 'Failed to generate ZIP file.');
    }
  };

  const handleReset = () => {
    setSegments([]);
    setStatus('idle');
    setError(null);
    setIsGenerating(false);
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'subject' | 'style') => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (type === 'subject') setSubjectRef(file);
        else setStyleRef(file);
    }
    e.target.value = ''; 
  };

  // ----------------------------------------------------------------
  // Settings Component
  // ----------------------------------------------------------------
  const SettingsForm = () => (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 animate-in fade-in zoom-in duration-300 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                  <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t.settingsTitle}</h2>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.settingsProvider}</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        type="button"
                        onClick={() => setConfig({ ...config, provider: 'google', baseUrl: '' })}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${config.provider === 'google' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          Google Gemini
                      </button>
                      <button 
                        type="button"
                        onClick={() => setConfig({ ...config, provider: 'openai', baseUrl: DEFAULT_OPENAI_CONFIG.baseUrl })}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${config.provider === 'openai' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                          OpenAI / Compatible
                      </button>
                  </div>
              </div>

              {config.provider === 'openai' && (
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t.settingsBaseUrl}</label>
                      <input 
                          type="text" 
                          value={config.baseUrl}
                          onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                          placeholder="https://api.openai.com/v1"
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                  </div>
              )}

              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.settingsApiKey}</label>
                  <input 
                      type="password" 
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="sk-..."
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t.settingsVisionModel}</label>
                      <input 
                          type="text" 
                          value={config.visionModel}
                          onChange={(e) => setConfig({ ...config, visionModel: e.target.value })}
                          placeholder={config.provider === 'google' ? 'gemini-2.5-flash-latest' : 'gpt-4o'}
                          required
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t.settingsGenModel}</label>
                      <input 
                          type="text" 
                          value={config.generationModel}
                          onChange={(e) => setConfig({ ...config, generationModel: e.target.value })}
                          placeholder={config.provider === 'google' ? 'gemini-2.5-flash-image' : 'dall-e-3'}
                          required
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                  </div>
              </div>

              <div className="pt-2 flex gap-3">
                  <button 
                      type="submit" 
                      className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                      <Save className="w-4 h-4" /> {t.settingsSave}
                  </button>
                  {isConfigured && (
                      <button 
                          type="button" 
                          onClick={() => setShowSettings(false)}
                          className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                      >
                          {t.settingsCancel}
                      </button>
                  )}
              </div>
          </form>
      </div>
  );

  // ----------------------------------------------------------------
  // Render: Configuration Screen (if not configured)
  // ----------------------------------------------------------------

  if (!isConfigured) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
              <div className="absolute top-4 right-4">
                  <button 
                      onClick={toggleLanguage}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                      <Languages className="w-4 h-4" />
                      {language === 'en' ? '中文' : 'English'}
                  </button>
              </div>
              <SettingsForm />
          </div>
      );
  }

  // ----------------------------------------------------------------
  // Render: Main App
  // ----------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 relative">
      
      {/* Settings Modal Overlay */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <SettingsForm />
          </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md bg-white/80">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                <Grid3X3 className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">
              {t.titlePart1}<span className="text-indigo-600">{t.titlePart2}</span> AI
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
             <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs text-slate-600 uppercase tracking-wide font-semibold">
                    {config.provider === 'google' ? 'Gemini' : 'OpenAI'}
                </span>
                <button onClick={() => setShowSettings(true)} className="ml-1 p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-indigo-600 transition-colors" title={t.settings}>
                     <Settings className="w-3.5 h-3.5" />
                </button>
             </div>
             
             <button 
                onClick={toggleLanguage}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                title="Switch Language"
             >
                <Languages className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-12">
        
        {/* Intro / Tab Switcher (Only show when idle) */}
        {status === 'idle' && (
           <div className="max-w-2xl mx-auto text-center mb-10 animate-in fade-in zoom-in duration-500">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                {t.heroTitle1} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                    {t.heroTitle2}
                </span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 max-w-lg mx-auto leading-relaxed">
                {t.heroSubtitle}
              </p>
              
              <div className="inline-flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-8">
                <button
                    onClick={() => setMode('upload')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'upload' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <UploadIcon className="w-4 h-4" />
                    {t.modeUpload}
                </button>
                <button
                    onClick={() => setMode('generate')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'generate' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Wand2 className="w-4 h-4" />
                    {t.modeGenerate}
                </button>
              </div>

              <div className="bg-white rounded-2xl p-1 shadow-xl border border-slate-100">
                  {mode === 'upload' ? (
                      <DropZone 
                        onFileSelect={handleFileSelect} 
                        disabled={false} 
                        texts={{
                            title: t.dropTitle,
                            subtitle: t.dropSubtitle,
                            drag: t.dropDrag,
                            error: t.dropError
                        }}
                      />
                  ) : (
                      <div className="p-8 text-left">
                          <form onSubmit={handleGenerate}>
                            
                            {/* Reference Images - Only for Google Provider */}
                            {config.provider === 'google' && (
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    {/* Subject Reference */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" /> {t.refSubject}
                                        </span>
                                        <div 
                                            onClick={() => !subjectRef && subjectInputRef.current?.click()}
                                            className={`
                                                relative h-24 rounded-xl border-2 border-dashed transition-all flex items-center justify-center cursor-pointer overflow-hidden
                                                ${subjectRef ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-slate-100'}
                                            `}
                                        >
                                            <input 
                                                ref={subjectInputRef} 
                                                type="file" 
                                                onChange={(e) => handleRefUpload(e, 'subject')} 
                                                accept="image/*" 
                                                className="hidden" 
                                            />
                                            {subjectRef ? (
                                                <div className="w-full h-full relative group">
                                                    <img src={URL.createObjectURL(subjectRef)} alt="Subject" className="w-full h-full object-cover" />
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSubjectRef(null); }}
                                                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400">
                                                    <Plus className="w-5 h-5 mb-1" />
                                                    <span className="text-xs font-medium">{t.refSubjectPlaceholder}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Style Reference */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Paintbrush className="w-3.5 h-3.5" /> {t.refStyle}
                                        </span>
                                        <div 
                                            onClick={() => !styleRef && styleInputRef.current?.click()}
                                            className={`
                                                relative h-24 rounded-xl border-2 border-dashed transition-all flex items-center justify-center cursor-pointer overflow-hidden
                                                ${styleRef ? 'border-purple-200 bg-purple-50' : 'border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-slate-100'}
                                            `}
                                        >
                                            <input 
                                                ref={styleInputRef} 
                                                type="file" 
                                                onChange={(e) => handleRefUpload(e, 'style')} 
                                                accept="image/*" 
                                                className="hidden" 
                                            />
                                            {styleRef ? (
                                                <div className="w-full h-full relative group">
                                                    <img src={URL.createObjectURL(styleRef)} alt="Style" className="w-full h-full object-cover" />
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setStyleRef(null); }}
                                                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400">
                                                    <Plus className="w-5 h-5 mb-1" />
                                                    <span className="text-xs font-medium">{t.refStylePlaceholder}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                  {t.promptLabel}
                              </label>
                              <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={t.promptPlaceholder}
                                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none text-slate-800"
                                    required
                                />
                                <Palette className="absolute right-4 bottom-4 w-5 h-5 text-slate-400 pointer-events-none" />
                              </div>
                              <div className="mt-4 flex justify-between items-center">
                                  <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded">
                                      {config.provider === 'google' ? t.supportsRef : t.standardGen}
                                  </span>
                                  <button
                                      type="submit"
                                      disabled={!prompt.trim() || isGenerating}
                                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                                  >
                                      {isGenerating ? (
                                          <Sparkles className="w-4 h-4 animate-spin" />
                                      ) : (
                                          <Wand2 className="w-4 h-4" />
                                      )}
                                      {t.btnGenerate}
                                  </button>
                              </div>
                          </form>
                      </div>
                  )}
              </div>
           </div>
        )}

        {/* Loading State */}
        {(status === 'slicing' || (status === 'analyzing' && segments.length === 0)) && (
           <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
              <p className="text-lg font-medium text-slate-700">
                  {isGenerating ? t.statusGeneratingTitle : t.statusProcessingTitle}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                  {isGenerating ? t.statusGeneratingDesc : t.statusProcessingDesc}
              </p>
           </div>
        )}

        {/* Error State */}
        {status === 'error' && (
            <div className="max-w-lg mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <FileWarning className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-700">{t.errorTitle}</h3>
                <p className="text-red-600 mt-1 mb-6">{error}</p>
                <div className="flex justify-center gap-3">
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                    >
                        {t.btnTryAgain}
                    </button>
                    <button 
                        onClick={() => { setShowSettings(true); setStatus('idle'); setError(null); }}
                        className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors"
                    >
                        {t.btnCheckSettings}
                    </button>
                </div>
            </div>
        )}

        {/* Results Grid */}
        {segments.length > 0 && (status === 'analyzing' || status === 'complete') && (
           <GridPreview 
              segments={segments} 
              onUpdateLabel={handleUpdateLabel}
              onDownloadAll={handleDownload}
              onReset={handleReset}
              isProcessing={status === 'analyzing'}
              texts={{
                  title: t.previewTitle,
                  subtitle: t.previewSubtitle,
                  reset: t.btnReset,
                  download: t.btnDownload,
                  labelPlaceholder: t.labelPlaceholder
              }}
           />
        )}
      </main>
    </div>
  );
};

export default App;
