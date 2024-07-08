import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { get_comfy_prompt } from '../ai_network/comfy_prompt.js';
import { fetchImage } from '../ai_network/comfy.js';
import { getFriendlyModelName, loadModelMappings } from '../command_util/model_mappings.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { ImageConfigModel } from '../mongo_models/settings.js';

const modelMappings = await loadModelMappings();

export const data = new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate an image based on a prompt')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('The prompt for image generation')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('positive_prompt')
            .setDescription('Override the positive prompt template')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('negative_prompt')
            .setDescription('Override the negative prompt')
            .setRequired(false))
    .addIntegerOption(option =>
        option.setName('steps')
            .setDescription('Override the number of steps (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false))
    .addNumberOption(option =>
        option.setName('cfg')
            .setDescription('Override the CFG scale (0-10)')
            .setMinValue(0)
            .setMaxValue(10)
            .setRequired(false))
    .addStringOption(option =>
        option.setName('model')
            .setDescription('Override the model')
            .setRequired(false)
            .addChoices(...modelMappings.map(mapping => ({
                name: mapping.display_name,
                value: mapping.model
            }))));


export async function execute(interaction: ChatInputCommandInteraction) {
    const promptText = interaction.options.getString('prompt', true);
    const userId = interaction.user.id;
    const userSettings = await getActiveUserSettings(userId);

    if (!userSettings.activeImageConfigId) {
        await interaction.reply({ content: 'No active Imagine config found. Please set one using /imaginesettings.', ephemeral: true });
        return;
    }

    const activeConfig = await ImageConfigModel.findById(userSettings.activeImageConfigId);

    if (!activeConfig) {
        console.error('Failed to find ImageConfig with ID:', userSettings.activeImageConfigId);
        await interaction.reply({ content: 'No Imagine configs found. Please create one using /imaginesettings.', ephemeral: true });
        return;
    }

    // Apply overrides
    const positivePrompt = interaction.options.getString('positive_prompt') || activeConfig.positivePrompt;
    const negativePrompt = interaction.options.getString('negative_prompt') || activeConfig.negativePrompt;
    const steps = interaction.options.getInteger('steps') || activeConfig.steps;
    const cfg = interaction.options.getNumber('cfg') || activeConfig.cfg;

    let selectedModel = activeConfig.selectedModel;
    const modelOverride = interaction.options.getString('model');
    if (modelOverride) {
        selectedModel = modelOverride;
    }

    try {
        await interaction.deferReply();
        const fullPrompt = positivePrompt.replace('{prompt}', promptText);
        const prompt = get_comfy_prompt(fullPrompt, {
            ...activeConfig,
            positivePrompt,
            negativePrompt,
            steps,
            cfg,
            selectedModel
        });
        const response = await fetchImage(prompt);

        const attachment = new AttachmentBuilder(response, { name: 'generated_image.png' });
        const friendlyModelName = getFriendlyModelName(selectedModel);
        await interaction.editReply({
            content: `\`cfg: ${cfg} / steps: ${steps} / model: ${friendlyModelName}\`\n*${fullPrompt}*\nNegative prompt: ${negativePrompt}`,
            files: [attachment]
        });
    } catch (error) {
        console.error('Error in imagine command:', error);
        await interaction.editReply('An error occurred while generating the image. Please try again later.');
    }
}
