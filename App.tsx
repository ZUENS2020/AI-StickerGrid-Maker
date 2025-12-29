import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import DropZone from './components/DropZone';
import GridPreview from './components/GridPreview';
import { sliceImage, getImageDimensions, resizeImage } from './services/imageProcessing';
import { StickerSegment, ProcessingStatus, Language, AppSettings, ResolutionPreset } from './types';
import { getServerConfig, saveServerConfig, generateStickerLabels, generateStickerSheet, regenerateSticker, upscaleImage } from './services/geminiService';
import { translations } from './locales';
import { Sparkles, Grid3X3, Wand2, Upload as UploadIcon, Palette, User, Paintbrush, Plus, X, FileWarning, Languages, Settings as SettingsIcon, ArrowRight, Save, Image as ImageIcon, Maximize } from 'lucide-react';

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

    // Resolution State
    const [selectedResolution, setSelectedResolution] = useState<ResolutionPreset | null>(null);
    const [currentDimensions, setCurrentDimensions] = useState<{ width: number; height: number } | null>(null);
    const [isAdjustingResolution, setIsAdjustingResolution] = useState(false);

    // Image Upload State
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

    // Resolution presets
    const resolutionPresets: ResolutionPreset[] = [256, 512, 1024, 2048];

    // Refs for hidden file inputs
    const subjectInputRef = useRef<HTMLInputElement>(null);
    const styleInputRef = useRef<HTMLInputElement>(null);
    const editImageInputRef = useRef<HTMLInputElement>(null);

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
        e.target.value = ''; // Reset input so same file can be selected again
    };

    const triggerFileSelect = (type: 'subject' | 'style') => {
        if (type === 'subject') {
            subjectInputRef.current?.click();
        } else {
            styleInputRef.current?.click();
        }
    };

    // --- Edit Logic ---
    const openEditModal = async (segment: StickerSegment) => {
        setEditingSegment(segment);
        setEditPrompt('');
        setIsRegenerating(false);
        setSelectedResolution(null);
        setIsAdjustingResolution(false);
        setUploadedImage(null);
        setUploadedImageUrl(null);

        // Get current image dimensions
        try {
            const dimensions = await getImageDimensions(segment.blob);
            setCurrentDimensions(dimensions);
        } catch (err) {
            console.error('Failed to get image dimensions', err);
            setCurrentDimensions(null);
        }
    };

    const closeEditModal = () => {
        setEditingSegment(null);
        setEditPrompt('');
        setSelectedResolution(null);
        setCurrentDimensions(null);
        setIsAdjustingResolution(false);
        setUploadedImage(null);
        if (uploadedImageUrl) {
            URL.revokeObjectURL(uploadedImageUrl);
            setUploadedImageUrl(null);
        }
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

    const handleApplyResolution = async () => {
        if (!editingSegment || !selectedResolution || !currentDimensions) return;

        setIsAdjustingResolution(true);
        setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: true } : s));

        try {
            let newBlob: Blob;
            const currentWidth = currentDimensions.width;

            if (selectedResolution > currentWidth) {
                // Use AI to upscale
                newBlob = await upscaleImage(editingSegment.blob, selectedResolution, settings);
            } else {
                // Use Canvas to downscale
                newBlob = await resizeImage(editingSegment.blob, selectedResolution);
            }

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
            setError(err.message || (language === 'zh' ? "分辨率调整失败。" : "Failed to adjust resolution."));
            setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: false } : s));
            setIsAdjustingResolution(false);
        }
    };

    const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError(language === 'zh' ? '请上传图片文件。' : 'Please upload an image file.');
                return;
            }
            setUploadedImage(file);

            // Revoke previous URL if exists
            if (uploadedImageUrl) {
                URL.revokeObjectURL(uploadedImageUrl);
            }

            // Create new URL for preview
            const newUrl = URL.createObjectURL(file);
            setUploadedImageUrl(newUrl);
        }
        // Reset input
        e.target.value = '';
    };

    const triggerEditImageUpload = () => {
        editImageInputRef.current?.click();
    };

    const handleApplyUploadedImage = async () => {
        if (!editingSegment || !uploadedImage) return;

        setIsAdjustingResolution(true);
        setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: true } : s));

        try {
            const newBlob = uploadedImage;
            const newDataUrl = uploadedImageUrl || editingSegment.dataUrl;

            setSegments(prev => prev.map(s => {
                if (s.id === editingSegment.id) {
                    return { ...s, blob: newBlob, dataUrl: newDataUrl, isProcessing: false };
                }
                return s;
            }));
            closeEditModal();
        } catch (err: any) {
            console.error(err);
            setError(err.message || (language === 'zh' ? "图片上传失败。" : "Failed to upload image."));
            setSegments(prev => prev.map(s => s.id === editingSegment.id ? { ...s, isProcessing: false } : s));
            setIsAdjustingResolution(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
            {/* --- Settings Modal --- */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <SettingsIcon className="w-5 h-5 text-indigo-600" /> {t.settingsTitle}
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
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
                        }} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-700">{t.apiKeyLabel}</label>
                                <input 
                                    name="apiKey" 
                                    type="password" 
                                    defaultValue={settings.apiKey} 
                                    placeholder="sk-..." 
                                    required 
                                    className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    {t.authNote || "Your key is stored securely in the server configuration."}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-500 uppercase tracking-wider">Image Model</label>
                                    <input name="modelName" type="text" defaultValue={settings.modelName} placeholder="gemini-2.0-flash-exp" className="w-full border border-slate-200 bg-slate-50 p-2 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-slate-500 uppercase tracking-wider">Text Model</label>
                                    <input name="textModel" type="text" defaultValue={settings.textModel} placeholder="gemini-2.0-flash-exp" className="w-full border border-slate-200 bg-slate-50 p-2 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                                {t.saveBtn}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- Edit Modal --- */}
            {editingSegment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 border border-slate-100">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{t.editTitle}</h3>
                                <p className="text-sm text-slate-500">{t.editSubtitle}</p>
                            </div>
                            <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Instruction Section */}
                        <div className="flex gap-6 mb-6">
                            <div className="w-32 h-32 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-center">
                                <img src={editingSegment.dataUrl} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">Instruction</label>
                                <textarea
                                    value={editPrompt}
                                    onChange={(e) => setEditPrompt(e.target.value)}
                                    placeholder={t.editPromptPlaceholder}
                                    className="w-full h-32 border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Resolution Section */}
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Maximize className="w-4 h-4" />
                                    {t.resolutionLabel}
                                </label>
                                {currentDimensions && (
                                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                                        {t.currentResolution.replace('{w}', String(currentDimensions.width)).replace('{h}', String(currentDimensions.height))}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {resolutionPresets.map((preset) => {
                                    const isSelected = selectedResolution === preset;
                                    const isUpscale = currentDimensions && preset > currentDimensions.width;
                                    return (
                                        <button
                                            key={preset}
                                            onClick={() => setSelectedResolution(preset)}
                                            className={`
                                                py-2 px-3 rounded-lg text-sm font-medium transition-all relative
                                                ${isSelected
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                                                }
                                            `}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-bold">{preset}x{preset}</span>
                                                {isUpscale && (
                                                    <span className="text-[10px] opacity-75">AI</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={closeEditModal} className="px-5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors">{t.btnCancel}</button>
                            {selectedResolution ? (
                                <button
                                    onClick={handleApplyResolution}
                                    disabled={isAdjustingResolution}
                                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                                >
                                    {isAdjustingResolution ? <Sparkles className="w-4 h-4 animate-spin" /> : <Maximize className="w-4 h-4" />}
                                    {isAdjustingResolution ? t.processingResolution : t.btnApplyResolution}
                                </button>
                            ) : (
                                <button
                                    onClick={handleRegenerateSticker}
                                    disabled={isRegenerating || !editPrompt.trim()}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100 flex items-center gap-2"
                                >
                                    {isRegenerating ? <Sparkles className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                    {isRegenerating ? 'Generating...' : t.btnRegenerate}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- Header --- */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                            <Grid3X3 className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-900">
                            {t.titlePart1}<span className="text-indigo-600">{t.titlePart2}</span> AI
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSettingsOpen(true)} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${hasConfigured ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-red-50 border-red-200 text-red-600 animate-pulse'}`}
                        >
                            <SettingsIcon className="w-3.5 h-3.5" />
                            {hasConfigured ? t.settingsBtn : t.configureMsg}
                        </button>
                        <button onClick={toggleLanguage} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                            <Languages className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* --- Main Content --- */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                {!hasConfigured ? (
                    <div className="text-center py-24 px-4">
                        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-lg shadow-indigo-100">
                            <SettingsIcon className="w-10 h-10 text-indigo-600" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.authTitle}</h2>
                        <p className="text-slate-500 max-w-md mx-auto mb-8 text-lg leading-relaxed">{t.authSubtitle}</p>
                        <button onClick={() => setIsSettingsOpen(true)} className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:-translate-y-0.5 flex items-center gap-2 mx-auto">
                            {t.authBtn} <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Only show upload/generate options if NOT processing/complete */}
                        {status === 'idle' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="text-center mb-12">
                                    <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                                        {t.heroTitle1} <br/>
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{t.heroTitle2}</span>
                                    </h1>
                                    <p className="text-slate-500 text-lg max-w-2xl mx-auto">{t.heroSubtitle}</p>
                                </div>

                                <div className="flex justify-center gap-2 mb-10 bg-white p-1.5 rounded-full shadow-sm border border-slate-200 w-fit mx-auto">
                                    <button
                                        onClick={() => setMode('upload')}
                                        className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${mode === 'upload' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <UploadIcon className="w-4 h-4" /> {t.modeUpload}
                                    </button>
                                    <button
                                        onClick={() => setMode('generate')}
                                        className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${mode === 'generate' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <Sparkles className="w-4 h-4" /> {t.modeGenerate}
                                    </button>
                                </div>

                                {mode === 'upload' ? (
                                    <div className="max-w-2xl mx-auto">
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
                                    </div>
                                ) : (
                                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-white">
                                        <form onSubmit={handleGenerate}>
                                            <div className="grid md:grid-cols-2 gap-6 mb-8">
                                                {/* Subject Reference */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                        <User className="w-3.5 h-3.5" /> {t.refSubject}
                                                    </div>
                                                    <input 
                                                        ref={subjectInputRef}
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        onChange={(e) => handleRefUpload(e, 'subject')} 
                                                    />
                                                    {!subjectRef ? (
                                                        <div 
                                                            onClick={() => triggerFileSelect('subject')}
                                                            className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
                                                        >
                                                            <div className="bg-slate-100 p-3 rounded-full mb-2 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-400 group-hover:text-indigo-600">{t.refSubjectPlaceholder}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="relative group h-32 rounded-2xl overflow-hidden border border-slate-200">
                                                            <img src={URL.createObjectURL(subjectRef)} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <button type="button" onClick={() => setSubjectRef(null)} className="p-2 bg-white/20 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors">
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Style Reference */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                        <Paintbrush className="w-3.5 h-3.5" /> {t.refStyle}
                                                    </div>
                                                    <input 
                                                        ref={styleInputRef}
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        onChange={(e) => handleRefUpload(e, 'style')} 
                                                    />
                                                    {!styleRef ? (
                                                        <div 
                                                            onClick={() => triggerFileSelect('style')}
                                                            className="h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all group"
                                                        >
                                                            <div className="bg-slate-100 p-3 rounded-full mb-2 group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <Plus className="w-5 h-5 text-slate-400 group-hover:text-purple-500" />
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-400 group-hover:text-purple-600">{t.refStylePlaceholder}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="relative group h-32 rounded-2xl overflow-hidden border border-slate-200">
                                                            <img src={URL.createObjectURL(styleRef)} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <button type="button" onClick={() => setStyleRef(null)} className="p-2 bg-white/20 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors">
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mb-6">
                                                <label className="block text-sm font-bold text-slate-700 mb-2">{t.promptLabel}</label>
                                                <div className="relative">
                                                    <textarea
                                                        value={prompt}
                                                        onChange={(e) => setPrompt(e.target.value)}
                                                        placeholder={t.promptPlaceholder}
                                                        className="w-full h-40 p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none transition-all text-lg"
                                                        required
                                                    />
                                                    <div className="absolute bottom-4 right-4 text-slate-400">
                                                        <Palette className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg">
                                                    <ImageIcon className="w-3.5 h-3.5" />
                                                    {t.supportsRef}
                                                </div>
                                                <button 
                                                    type="submit" 
                                                    disabled={!prompt.trim() || isGenerating}
                                                    className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-50 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                                >
                                                    {isGenerating ? <Sparkles className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                                    {t.btnGenerate}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Processing Status */}
                        {(status === 'slicing' || status === 'analyzing') && (
                            <div className="text-center py-24 animate-in fade-in zoom-in duration-500">
                                <div className="relative w-24 h-24 mx-auto mb-8">
                                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">{isGenerating ? t.statusGeneratingTitle : t.statusProcessingTitle}</h3>
                                <p className="text-slate-500 text-lg">{isGenerating ? t.statusGeneratingDesc : t.statusProcessingDesc}</p>
                            </div>
                        )}

                        {/* Error */}
                        {status === 'error' && (
                            <div className="max-w-md mx-auto bg-red-50 text-red-800 p-8 rounded-3xl text-center border border-red-100 shadow-xl shadow-red-50">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-red-500 text-3xl">
                                    <FileWarning />
                                </div>
                                <h3 className="font-bold text-xl mb-2">{t.errorTitle}</h3>
                                <p className="mb-6 opacity-80">{error}</p>
                                <button onClick={handleReset} className="bg-white border border-red-200 px-6 py-2.5 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-sm text-red-600">
                                    {t.btnTryAgain}
                                </button>
                            </div>
                        )}

                        {/* Results */}
                        {segments.length > 0 && status === 'complete' && (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
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
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default App;
