import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import DropZone from './components/DropZone';
import GridPreview from './components/GridPreview';
import { sliceImage } from './services/imageProcessing';
import { StickerSegment, ProcessingStatus, Language, AppSettings } from './types';
import { getServerConfig, saveServerConfig, generateStickerLabels, generateStickerSheet, regenerateSticker } from './services/geminiService';
import { translations } from './locales';
import { Sparkles, Grid3X3, Wand2, Upload as UploadIcon, Palette, User, Paintbrush, Plus, X, FileWarning, Languages, Settings as SettingsIcon, ArrowRight, Save } from 'lucide-react';

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

    const subjectInputRef = useRef<HTMLInputElement>(null);
    const styleInputRef = useRef<HTMLInputElement>(null);

    // Derived translations
    const t = translations[language];

    // Load Settings on Mount
    useEffect(() => {
        // 1. Detect browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('zh')) {
            setLanguage('zh');
        }

        // 2. Load Settings from Server
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
            // 1. Slice Image
            const slicedSegments = await sliceImage(file, 4, 4);
            setSegments(slicedSegments);

            setStatus('analyzing');

            // 2. AI Analysis
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

                    // Non-fatal error
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

        setSegments(prev => prev.map(s =>
            s.id === editingSegment.id ? { ...s, isProcessing: true } : s
        ));

        try {
            const newBlob = await regenerateSticker(editingSegment.blob, editPrompt, settings);
            const newDataUrl = URL.createObjectURL(newBlob);

            setSegments(prev => prev.map(s => {
                if (s.id === editingSegment.id) {
                    return {
                        ...s,
                        blob: newBlob,
                        dataUrl: newDataUrl,
                        isProcessing: false,
                    };
                }
                return s;
            }));
            closeEditModal();

        } catch (err: any) {
            console.error(err);
            setError(err.message || (language === 'zh' ? "重绘失败。" : "Regeneration failed."));
            setSegments(prev => prev.map(s =>
                s.id === editingSegment.id ? { ...s, isProcessing: false } : s
            ));
            setIsRegenerating(false);
        }
    };


    // ----------------------------------------------------------------
    // Render: Main App
    // ----------------------------------------------------------------

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 relative">

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <SettingsIcon className="w-5 h-5" />
                                {t.settingsTitle}
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
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
                        }} className="p-6 space-y-4">

                            {/* API Key */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.apiKeyLabel}</label>
                                <input
                                    name="apiKey"
                                    type="password"
                                    defaultValue={settings.apiKey}
                                    placeholder="sk-..."
                                    required
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                />
                            </div>


                            {/* Image Model */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Image Model (Optional)</label>
                                <input
                                    name="modelName"
                                    type="text"
                                    defaultValue={settings.modelName}
                                    placeholder="e.g. gemini-3-pro-image-preview"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                />
                            </div>

                            {/* Language Model */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Language Model (Optional)</label>
                                <input
                                    name="textModel"
                                    type="text"
                                    defaultValue={settings.textModel}
                                    placeholder="e.g. gemini-2.0-flash-exp"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                />
                            </div>

                            <div className="pt-2">
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {t.saveBtn}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingSegment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{t.editTitle}</h3>
                                <p className="text-sm text-slate-500">{t.editSubtitle}</p>
                            </div>
                            <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex items-center gap-6 mb-6">
                                <div className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 p-2 flex-shrink-0">
                                    <img src={editingSegment.dataUrl} alt="Original" className="w-full h-full object-contain" />
                                </div>
                                <ArrowRight className="w-6 h-6 text-slate-300" />
                                <div className="flex-1 bg-slate-50 rounded-lg border border-dashed border-slate-300 h-24 flex items-center justify-center text-slate-400 text-sm">
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    {isRegenerating ? "..." : "?"}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-slate-700 block">
                                    {t.editPromptPlaceholder}
                                </label>
                                <textarea
                                    value={editPrompt}
                                    onChange={(e) => setEditPrompt(e.target.value)}
                                    placeholder={t.editPromptPlaceholder}
                                    className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none text-slate-800 text-sm"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={closeEditModal}
                                disabled={isRegenerating}
                                className="px-4 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-colors text-sm font-medium"
                            >
                                {t.btnCancel}
                            </button>
                            <button
                                onClick={handleRegenerateSticker}
                                disabled={!editPrompt.trim() || isRegenerating}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRegenerating ? <Sparkles className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                {t.btnRegenerate}
                            </button>
                        </div>
                    </div>
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
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-500">

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${hasConfigured ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse'}`}
                        >
                            <SettingsIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">{t.settingsBtn}</span>
                        </button>

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

                {/* Not Configured Overlay */}
                {!hasConfigured && (
                    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center animate-in zoom-in duration-300 mt-10">
                        <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <SettingsIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.authTitle}</h2>
                        <p className="text-slate-600 mb-8">{t.authSubtitle}</p>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            <SettingsIcon className="w-5 h-5" />
                            {t.authBtn}
                        </button>
                        <p className="text-xs text-slate-400 mt-4">{t.authNote}</p>
                    </div>
                )}

                {/* Main Content (Only visible if hasConfigured) */}
                {hasConfigured && (
                    <>
                        {/* Intro / Tab Switcher (Only show when idle) */}
                        {status === 'idle' && (
                            <div className="max-w-2xl mx-auto text-center mb-10 animate-in fade-in zoom-in duration-500">
                                <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                                    {t.heroTitle1} <br />
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
                                                        {t.supportsRef}
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
                                        onClick={() => setIsSettingsOpen(true)}
                                        className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                                    >
                                        {t.settingsBtn}
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
                                onEditSticker={openEditModal}
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
                    </>
                )}
            </main>
        </div>
    );
};

export default App;
