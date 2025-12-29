// --- Helpers ---

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = (base64: string, type: string = 'image/png'): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
};

// --- Main Exported Functions ---

export const generateStickerLabels = async (imageFile: File, _settings: any): Promise<string[]> => {
    const base64Data = await fileToBase64(imageFile);

    const response = await fetch('/api/generate-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: imageFile.type
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate labels");
    }

    return response.json();
};

export const generateStickerSheet = async (
    prompt: string,
    subjectImage: File | null,
    styleImage: File | null,
    _settings: any
): Promise<Blob> => {

    const payload: any = { prompt };

    if (subjectImage) {
        payload.subjectBase64 = await fileToBase64(subjectImage);
        payload.subjectMimeType = subjectImage.type;
    }

    if (styleImage) {
        payload.styleBase64 = await fileToBase64(styleImage);
        payload.styleMimeType = styleImage.type;
    }

    const response = await fetch('/api/generate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate sticker sheet");
    }

    const data = await response.json();
    return base64ToBlob(data.imageBase64);
};

export const regenerateSticker = async (
    originalStickerBlob: Blob,
    modificationPrompt: string,
    _settings: any
): Promise<Blob> => {

    const base64Data = await blobToBase64(originalStickerBlob);

    const response = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            originalBase64: base64Data,
            prompt: modificationPrompt
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to regenerate sticker");
    }

    const data = await response.json();
    return base64ToBlob(data.imageBase64);
};

export const upscaleImage = async (
    imageBlob: Blob,
    targetSize: number,
    _settings: any
): Promise<Blob> => {
    const base64Data = await blobToBase64(imageBlob);

    const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            imageBase64: base64Data,
            targetSize: targetSize
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to upscale image");
    }

    const data = await response.json();
    return base64ToBlob(data.imageBase64);
};

// --- Config Helpers ---

export const getServerConfig = async () => {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error("Failed to fetch server config");
    return response.json();
};

export const saveServerConfig = async (config: any) => {
    const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error("Failed to save server config");
    return response.json();
};
