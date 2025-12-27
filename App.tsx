import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import DropZone from './components/DropZone';
import GridPreview from './components/GridPreview';
import { sliceImage } from './services/imageProcessing';
import { StickerSegment, ProcessingStatus, Language, AppSettings } from './types';
import { getServerConfig, saveServerConfig, generateStickerLabels, generateStickerSheet, regenerateSticker } from './services/geminiService';
import { translations } from './locales';
import { Sparkles, Grid3X3, Wand2, Upload as UploadIcon, Palette, User, Paintbrush, Plus, X, FileWarning, Languages, Settings as SettingsIcon, ArrowRight, Save, Image as ImageIcon } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
    apiKey: '',
    modelName: '',
    textModel: ''
};

const App: React.FC = () => {
    // State
    const [segments, setSegments] = useState<StickerSegment[]>([]);
    const [status, setStatus] = useState<ProcessingStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'upload' | 'generate'>('upload');
    const [language, setLanguage] = useState<Language>('en');

    // Settings State
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [hasConfigured, setHasConfigured] = useState(false);

    // Generation State
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [subjectRef, setSubjectRef] = useState<File | null>(null);
    const [styleRef, setStyleRef] = useState<File | null>(null);

    // Edit State
    const [editingSegment, setEditingSegment] = useState<StickerSegment | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Derived translations
    const t = translations[language];

    // Load Settings on Mount
    useEffect(() => {
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('zh')) {
            setLanguage('zh');
        }

        getServerConfig()
            .then(savedSettings => {
                if (savedSettings) {
                    setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
                    if (savedSettings.apiKey) setHasConfigured(true);
                }
            })
            .catch(e => {
                console.error("Failed to load settings from server", e);
            });
    }, []);

    const saveSettings = async (newSettings: AppSettings) => {
        try {
            await saveServerConfig(newSettings);
            setSettings(newSettings);
            setHasConfigured(!!newSettings.apiKey);
            setIsSettingsOpen(false);
        } catch (e) {
            console.error("Failed to save settings to server", e);
            setError(language === 'zh' ? "保存设置到服务器失败。" : "Failed to save settings to server.");
        }
    };

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'zh' : 'en');
    };

    const handleFileSelect = useCallback(async (file: File) => {
        if (!settings.apiKey) {
            setIsSettingsOpen(true);
            return;
        }

        setStatus('slicing');
        setError(null);
        setSegments([]);

        try {
            const slicedSegments = await sliceImage(file, 4, 4);
            setSegments(slicedSegments);

            setStatus('analyzing');

            generateStickerLabels(file, settings)
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
                    if (errorMessage.includes("401") || errorMessage.includes("403")) {
                        setError(language === 'zh' ? "API 密钥无效，请检查设置。" : "Invalid API Key. Please check settings.");
                        setStatus('error');
                        setHasConfigured(false);
                        setIsSettingsOpen(true);
                        return;
                    }
                    setStatus('complete');
                    setSegments(prev => prev.map(s => ({ ...s, isProcessing: false })));
                });

        } catch (err: any) {
            console.error(err);
            setError(err.message || (language === 'zh' ? '处理图片时发生错误。' : 'An error occurred while processing the image.'));
            setStatus('error');
        }
    }, [language, settings]);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        if (!settings.apiKey) {
            setIsSettingsOpen(true);
            return;
        }

        setIsGenerating(true);
        setStatus('slicing');
        setError(null);
        setSegments([]);

        try {
            const imageBlob = await generateStickerSheet(prompt, subjectRef, styleRef, settings);
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
            const safeLabel = seg.label.replace(/[^a-z0-9-_\u4e00-\u9fa5]/gi, '_');
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

    // --- Edit Logic ---
    const openEditModal = (segment: StickerSegment) => {
        setEditingSegment(segment);
        setEditPrompt('');
        setIsRegenerating(false);
    };

    const closeEditModal = () => {
        setEditingSegment(null);
        setEditPrompt('');
    };

    const handleRegenerateSticker = async () => {
        if (!editingSegment || !editPrompt.trim()) return;
        setIsRegenerating(true);
        setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: true } : s));
        try {
            const newBlob = await regenerateSticker(editingSegment.blob, editPrompt, settings);
            const newDataUrl = URL.createObjectURL(newBlob);
            setSegments(prev => prev.map(s => {
                if (s.id === editingSegment.id) {
                    return { ...s, blob: newBlob, dataUrl: newDataUrl, isProcessing: false };
                }
                return s;
            }));
            closeEditModal();
        } catch (err: any) {
            console.error(err);
            setError(err.message || (language === 'zh' ? "重绘失败。" : "Regeneration failed."));
            setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: false } : s));
            setIsRegenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
            {/* --- Settings Modal --- */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <SettingsIcon className="w-5 h-5" /> {t.settingsTitle}
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-black">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            saveSettings({
                                apiKey: formData.get('apiKey') as string,
                                modelName: formData.get('modelName') as string,
                                textModel: formData.get('textModel') as string,
                            } as AppSettings);
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">{t.apiKeyLabel}</label>
                                <input name="apiKey" type="password" defaultValue={settings.apiKey} placeholder="sk-..." required className="w-full border p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Image Model</label>
                                <input name="modelName" type="text" defaultValue={settings.modelName} placeholder="gemini-2.0-flash-exp" className="w-full border p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Text Model</label>
                                <input name="textModel" type="text" defaultValue={settings.textModel} placeholder="gemini-2.0-flash-exp" className="w-full border p-2 rounded" />
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700">
                                {t.saveBtn}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Edit Modal --- */}
            {editingSegment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{t.editTitle}</h3>
                            <button onClick={closeEditModal}><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex gap-4 mb-4">
                            <img src={editingSegment.dataUrl} className="w-24 h-24 object-contain bg-slate-100 border rounded" />
                            <textarea
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                placeholder={t.editPromptPlaceholder}
                                className="flex-1 border p-2 rounded h-24 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={closeEditModal} className="px-4 py-2 border rounded hover:bg-slate-100">{t.btnCancel}</button>
                            <button onClick={handleRegenerateSticker} disabled={isRegenerating || !editPrompt.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                                {isRegenerating ? 'Generating...' : t.btnRegenerate}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Header --- */}
            <header className="bg-white border-b sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 text-xl font-bold">
                    <Grid3X3 className="w-6 h-6 text-indigo-600" />
                    <span>{t.titlePart1}<span className="text-indigo-600">{t.titlePart2}</span> AI</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSettingsOpen(true)} className={`p-2 rounded-full border ${hasConfigured ? 'bg-white' : 'bg-red-50 border-red-200 text-red-500'}`}>
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                    <button onClick={toggleLanguage} className="p-2 hover:bg-slate-100 rounded-full">
                        <Languages className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* --- Main Content --- */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                {!hasConfigured ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold mb-4">{t.authTitle}</h2>
                        <button onClick={() => setIsSettingsOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700">
                            {t.authBtn}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Only show upload/generate options if NOT processing/complete */}
                        {status === 'idle' && (
                            <div className="mb-8">
                                <div className="flex justify-center gap-4 mb-8">
                                    <button
                                        onClick={() => setMode('upload')}
                                        className={`px-6 py-2 rounded-full font-bold transition-all ${mode === 'upload' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border'}`}
                                    >
                                        {t.modeUpload}
                                    </button>
                                    <button
                                        onClick={() => setMode('generate')}
                                        className={`px-6 py-2 rounded-full font-bold transition-all ${mode === 'generate' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border'}`}
                                    >
                                        {t.modeGenerate}
                                    </button>
                                </div>

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
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <form onSubmit={handleGenerate}>
                                            <div className="grid md:grid-cols-2 gap-6 mb-6">
                                                {/* Subject Reference - SIMPLIFIED LAYOUT */}
                                                <div className="border rounded-lg p-4 bg-slate-50">
                                                    <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-slate-700">
                                                        <User className="w-4 h-4" /> {t.refSubject}
                                                    </div>
                                                    
                                                    {!subjectRef ? (
                                                        // Native input is visible but styled
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => handleRefUpload(e, 'subject')}
                                                            className="block w-full text-sm text-slate-500
                                                                file:mr-4 file:py-2 file:px-4
                                                                file:rounded-full file:border-0
                                                                file:text-sm file:font-semibold
                                                                file:bg-indigo-50 file:text-indigo-700
                                                                hover:file:bg-indigo-100
                                                                cursor-pointer"
                                                        />
                                                    ) : (
                                                        <div className="relative group w-24 h-24">
                                                            <img src={URL.createObjectURL(subjectRef)} className="w-full h-full object-cover rounded-lg border" />
                                                            <button 
                                                                type="button"
                                                                onClick={() => setSubjectRef(null)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Style Reference - SIMPLIFIED LAYOUT */}
                                                <div className="border rounded-lg p-4 bg-slate-50">
                                                    <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-slate-700">
                                                        <Paintbrush className="w-4 h-4" /> {t.refStyle}
                                                    </div>

                                                    {!styleRef ? (
                                                         <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => handleRefUpload(e, 'style')}
                                                            className="block w-full text-sm text-slate-500
                                                                file:mr-4 file:py-2 file:px-4
                                                                file:rounded-full file:border-0
                                                                file:text-sm file:font-semibold
                                                                file:bg-purple-50 file:text-purple-700
                                                                hover:file:bg-purple-100
                                                                cursor-pointer"
                                                        />
                                                    ) : (
                                                        <div className="relative group w-24 h-24">
                                                            <img src={URL.createObjectURL(styleRef)} className="w-full h-full object-cover rounded-lg border" />
                                                            <button 
                                                                type="button"
                                                                onClick={() => setStyleRef(null)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <label className="block font-semibold mb-2">{t.promptLabel}</label>
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                placeholder={t.promptPlaceholder}
                                                className="w-full h-32 p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                required
                                            />
                                            
                                            <button 
                                                type="submit" 
                                                disabled={!prompt.trim() || isGenerating}
                                                className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 ml-auto"
                                            >
                                                {isGenerating ? <Sparkles className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                                {t.btnGenerate}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Processing Status */}
                        {(status === 'slicing' || status === 'analyzing') && (
                            <div className="text-center py-20">
                                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <h3 className="text-xl font-bold">{isGenerating ? t.statusGeneratingTitle : t.statusProcessingTitle}</h3>
                                <p className="text-slate-500">{isGenerating ? t.statusGeneratingDesc : t.statusProcessingDesc}</p>
                            </div>
                        )}

                        {/* Error */}
                        {status === 'error' && (
                            <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center border border-red-200">
                                <FileWarning className="w-12 h-12 mx-auto mb-2" />
                                <h3 className="font-bold text-lg">{t.errorTitle}</h3>
                                <p className="mb-4">{error}</p>
                                <button onClick={handleReset} className="bg-white border border-red-200 px-4 py-2 rounded font-semibold">
                                    {t.btnTryAgain}
                                </button>
                            </div>
                        )}

                        {/* Results */}
                        {segments.length > 0 && status === 'complete' && (
                            <GridPreview
                                segments={segments}
                                onUpdateLabel={handleUpdateLabel}
                                onDownloadAll={handleDownload}
                                onReset={handleReset}
                                onEditSticker={openEditModal}
                                isProcessing={false}
                                texts={{
                                    title: t.previewTitle,
                                    subtitle: t.previewSubtitle,
                                    reset: t.btnReset,
                                    download: t.btnDownload,
                                    labelPlaceholder: t.labelPlaceholder
                                }}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default App;
