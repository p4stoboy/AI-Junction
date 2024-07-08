import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { gpreq } from '../ai_network/gpreq.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { GptConfigModel } from '../mongo_models/settings.js';

export const data = new SlashCommandBuilder()
    .setName('gpt')
    .setDescription('Generate a response using GPT')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('The prompt for GPT')
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString('prompt');
    if (!prompt) {
        await interaction.reply({ content: 'You must provide a prompt.', ephemeral: true });
        return;
    }

    const userId = interaction.user.id;
    const userSettings = await getActiveUserSettings(userId);

    if (!userSettings.activeGptConfigId) {
        await interaction.reply({ content: 'No active GPT config found. Please set one using /gptsettings.', ephemeral: true });
        return;
    }

    const activeConfig = await GptConfigModel.findById(userSettings.activeGptConfigId);

    if (!activeConfig) {
        await interaction.reply({ content: 'Active GPT config not found. Please set a new one using /gptsettings.', ephemeral: true });
        return;
    }

    try {
        await interaction.deferReply();
        const response = await gpreq(prompt, activeConfig.systemPrompt);

        if (response.choices.length === 0) {
            await interaction.editReply('Something went wrong.');
            return;
        }

        const content = response.choices[0].message.content;
        // if (content.length + prompt.length > 2000) {
        //     await interaction.editReply('Response too long.');
        //     return;
        // }
        const res = `**${prompt}**\n*${content}`.slice(0, 1997);

        await interaction.editReply(`${res}**`);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while processing your request.');
    }
}
