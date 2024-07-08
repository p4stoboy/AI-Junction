import mongoose from 'mongoose';
import { GptConfig, ImageConfig, UserSettings } from '../types/index.js';

const gptConfigSchema = new mongoose.Schema<GptConfig>({
    userId: { type: String, required: true },
    configName: { type: String, required: true },
    systemPrompt: { type: String, required: true },
});

const imageConfigSchema = new mongoose.Schema<ImageConfig>({
    userId: { type: String, required: true },
    configName: { type: String, required: true },
    positivePrompt: { type: String, required: true },
    negativePrompt: { type: String, required: true },
    steps: { type: Number, required: true, min: 1, max: 30 },
    cfg: { type: Number, required: true, min: 1, max: 30 },
    selectedModel: { type: String, required: true },
});

const userSettingsSchema = new mongoose.Schema<UserSettings>({
    userId: { type: String, required: true, unique: true },
    activeGptConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'GptConfig', default: null },
    activeImageConfigId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageConfig', default: null },
});

export const GptConfigModel = mongoose.model<GptConfig>('GptConfig', gptConfigSchema);
export const ImageConfigModel = mongoose.model<ImageConfig>('ImageConfig', imageConfigSchema);
export const UserSettingsModel = mongoose.model<UserSettings>('UserSettings', userSettingsSchema);

