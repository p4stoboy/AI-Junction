import { GptConfigModel, ImageConfigModel, UserSettingsModel } from '../mongo_models/settings.js';
import { UserSettings, GptConfig, ImageConfig } from '../types/index.js';
import { getDefaultModel} from "../command_util/model_mappings";


export const DEFAULT_GPT_CONFIG: Omit<GptConfig, 'userId' | '_id'> = {
    configName: 'Default',
    systemPrompt: 'You are a helpful assistant.',
};

export const DEFAULT_IMAGE_CONFIG: Omit<ImageConfig, 'userId' | '_id'> = {
    configName: 'Default',
    positivePrompt: '{prompt}',
    negativePrompt: 'bad hands, ai artifacts',
    steps: 20,
    cfg: 2.1,
    selectedModel: getDefaultModel(),
};

export async function ensureUserConfigs(userId: string): Promise<UserSettings> {
    let userSettings = await UserSettingsModel.findOne({ userId });

    if (!userSettings) {
        const defaultGptConfig = await GptConfigModel.findOneAndUpdate(
            { userId, configName: 'Default' },
            { ...DEFAULT_GPT_CONFIG, userId },
            { upsert: true, new: true }
        );

        const defaultImageConfig = await ImageConfigModel.findOneAndUpdate(
            { userId, configName: 'Default' },
            { ...DEFAULT_IMAGE_CONFIG, userId },
            { upsert: true, new: true }
        );

        userSettings = await UserSettingsModel.create({
            userId,
            activeGptConfigId: defaultGptConfig._id,
            activeImageConfigId: defaultImageConfig._id,
        });
    }

    return userSettings;
}


export async function getActiveUserSettings(userId: string): Promise<UserSettings> {
    return await ensureUserConfigs(userId);
}
