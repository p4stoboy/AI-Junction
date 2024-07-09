import { Message, Client } from 'discord.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { GptConfigModel } from '../mongo_models/settings.js';
import { gpreq } from '../ai_network/gpreq.js';

export async function handleReplyWithMention(message: Message, client: Client) {
    try {
        const repliedTo = await message.fetchReference();
        const initial = repliedTo.content;
        const second = message.content.replace(`<@${client.user!.id}>`, '').trim();

        const userId = message.author.id;
        const userSettings = await getActiveUserSettings(userId);

        if (!userSettings.activeGptConfigId) {
            await message.reply('No active GPT config found. Please set one using /gptsettings.');
            return;
        }

        const activeConfig = await GptConfigModel.findById(userSettings.activeGptConfigId);

        if (!activeConfig) {
            await message.reply('Active GPT config not found. Please set a new one using /gptsettings.');
            return;
        }

        const response = await gpreq([initial, second], activeConfig.systemPrompt, 100);

        if (response.choices.length === 0) {
            await message.reply('Something went wrong.');
            return;
        }

        const content = response.choices[0].message.content;
        await message.reply(content);
    } catch (error) {
        console.error('Error handling reply with mention:', error);
        await message.reply('An error occurred while processing your request.');
    }
}
