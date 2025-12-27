const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 5001;
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from the frontend build directory
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
}

// --- Configuration Management ---

const readConfig = () => {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { apiKey: '', baseUrl: '', modelName: '' };
    }
};

const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

app.get('/api/config', (req, res) => {
    const config = readConfig();
    // Mask the API key for security
    const maskedConfig = { ...config };
    if (maskedConfig.apiKey) {
        maskedConfig.apiKey = maskedConfig.apiKey.substring(0, 4) + '...' + maskedConfig.apiKey.slice(-4);
    }
    res.json(maskedConfig);
});

app.post('/api/config', (req, res) => {
    const newConfig = req.body;
    // If the incoming key is masked (meaning the user didn't change it), keep the old one
    const oldConfig = readConfig();
    if (newConfig.apiKey && newConfig.apiKey.includes('...')) {
        newConfig.apiKey = oldConfig.apiKey;
    }
    writeConfig(newConfig);
    res.json({ success: true });
});

// --- AI Proxy Endpoints ---

// Helper to get raw base64 from data URL or blob-like string
const cleanBase64 = (str) => str.includes(',') ? str.split(',')[1] : str;

app.post('/api/generate-labels', async (req, res) => {
    const { imageBase64, mimeType } = req.body;
    const config = readConfig();

    if (!config.apiKey) return res.status(400).json({ error: "API Key not configured on server" });

    const systemInstruction = `
        Analyze this image, which is a 4x4 grid of stickers (16 total).
        Provide a short, descriptive filename for each sticker in the grid.
        Read the grid from left to right, top to bottom.
        The format should be kebab-case (e.g., "anime-girl-happy", "chibi-wink-peace").
        Focus on the emotion, action, or key object. Keep it under 4 words.
        Do not include file extensions.
        Return ONLY a JSON array of strings.
    `;

    try {
        const ai = new GoogleGenAI(config.apiKey);
        const modelName = config.modelName || 'gemini-3-flash-preview';
        const model = ai.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: mimeType || 'image/png', data: cleanBase64(imageBase64) } },
                    { text: systemInstruction }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const text = result.response.text();
        res.json(JSON.parse(text));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/generate-sheet', async (req, res) => {
    const { prompt, subjectBase64, subjectMimeType, styleBase64, styleMimeType } = req.body;
    const config = readConfig();

    if (!config.apiKey) return res.status(400).json({ error: "API Key not configured on server" });

    let fullPrompt = `Create a high-quality 4x4 grid sticker sheet containing 16 distinct stickers based on this description: "${prompt}". 
    The output MUST be a perfect 4x4 grid layout with clear spacing between items on a solid white background. 
    Ensure the stickers are completely separate and do not overlap the grid lines. 
    Style: Vector illustration, vibrant colors, clear outlines.`;

    const parts = [];
    if (subjectBase64) {
        fullPrompt += `\n\nREFERENCE INSTRUCTION: Use the attached image labeled 'Subject Reference' as the primary source for the character/object design.`;
        parts.push({ text: "Subject Reference:" });
        parts.push({ inlineData: { mimeType: subjectMimeType || 'image/png', data: cleanBase64(subjectBase64) } });
    }
    if (styleBase64) {
        fullPrompt += `\n\nREFERENCE INSTRUCTION: Use the attached image labeled 'Style Reference' to determine the artistic style.`;
        parts.push({ text: "Style Reference:" });
        parts.push({ inlineData: { mimeType: styleMimeType || 'image/png', data: cleanBase64(styleBase64) } });
    }
    parts.push({ text: fullPrompt });

    try {
        const ai = new GoogleGenAI(config.apiKey);
        const modelName = config.modelName || 'gemini-3-pro-image-preview';
        const model = ai.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: {
                // @ts-ignore - Some SDK versions might not have these in types but they work
                imageConfig: {
                    imageSize: "4K",
                    aspectRatio: "1:1"
                }
            }
        });

        const part = result.response.candidates[0].content.parts.find(p => p.inlineData);
        if (!part) throw new Error("No image generated");

        res.json({ imageBase64: part.inlineData.data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/regenerate', async (req, res) => {
    const { originalBase64, prompt } = req.body;
    const config = readConfig();

    if (!config.apiKey) return res.status(400).json({ error: "API Key not configured on server" });

    const fullPrompt = `
        Modify this input sticker image based strictly on this instruction: "${prompt}".
        
        CRITICAL STYLE INSTRUCTIONS:
        1. Maintain the exact same art style (Vector illustration, vibrant colors, clear outlines) as the input image.
        2. Keep the character/object consistent, only apply the requested change.
        3. Output MUST be a single sticker element on a clean white background.
        4. Do NOT output a grid, just the single modified sticker.
    `;

    try {
        const ai = new GoogleGenAI(config.apiKey);
        const modelName = config.modelName?.includes('gemini-3') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const model = ai.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: "image/png", data: cleanBase64(originalBase64) } },
                    { text: fullPrompt }
                ]
            }],
            generationConfig: {
                // @ts-ignore
                imageConfig: { aspectRatio: "1:1" }
            }
        });

        const part = result.response.candidates[0].content.parts.find(p => p.inlineData);
        if (!part) throw new Error("No image generated");

        res.json({ imageBase64: part.inlineData.data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- Final catch-all for SPA routing ---

app.get('*', (req, res) => {
    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend not found. Please run "npm run build" in the root directory.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
