import { Types } from 'mongoose';

export interface GptConfig {
    _id: Types.ObjectId;
    userId: string;
    configName: string;
    systemPrompt: string;
}

export interface ImageConfig {
    _id: Types.ObjectId;
    userId: string;
    configName: string;
    positivePrompt: string;
    negativePrompt: string;
    steps: number;
    cfg: number;
    selectedModel: string;
}

export interface UserSettings {
    _id: Types.ObjectId;
    userId: string;
    activeGptConfigId: Types.ObjectId | null;
    activeImageConfigId: Types.ObjectId | null;
}
