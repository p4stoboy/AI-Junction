import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelMappingsPath = path.join(__dirname, '..', '..', 'model_mappings.json');

interface ModelMapping {
    model: string;
    display_name: string;
}

interface ModelMappingsFile {
    maps: ModelMapping[];
    default_model: string;
}

let cachedMappings: ModelMapping[] | null = null;
let defaultModel: string | null = null;

export function loadModelMappings(): ModelMapping[] {
    if (cachedMappings) {
        return cachedMappings;
    }

    try {
        const fileContent = fs.readFileSync(modelMappingsPath, 'utf-8');
        const mappingsFile: ModelMappingsFile = JSON.parse(fileContent);

        cachedMappings = mappingsFile.maps;
        defaultModel = mappingsFile.default_model;

        console.log('Model mappings loaded successfully.');
        return cachedMappings;
    } catch (error) {
        console.error('Error loading model mappings:', error);
        // Return an empty array if there's an error loading the file
        return [];
    }
}

export function getFriendlyModelName(comfyName: string): string {
    if (!cachedMappings) {
        console.warn('Model mappings not loaded. Call loadModelMappings first.');
        return comfyName;
    }

    const mapping = cachedMappings.find(m => m.model === comfyName);
    return mapping ? mapping.display_name : comfyName;
}

export function getDefaultModel(): string {
    if (!defaultModel) {
        console.warn('Default model not loaded. Call loadModelMappings first.');
        console.warn('Returning an empty string as the default model. Image generation may not function properly.');
        return "";
    }
    return defaultModel;
}

export async function getModelChoices(): Promise<{ name: string; value: string }[]> {
    const mappings = await loadModelMappings();
    return mappings.map(mapping => ({
        name: mapping.display_name,
        value: mapping.model
    }));
}
