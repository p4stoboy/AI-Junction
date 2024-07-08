import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { ImageConfigModel } from '../mongo_models/settings.js';
import { loadModelMappings, getFriendlyModelName } from '../command_util/model_mappings.js';

const modelMappings = await loadModelMappings();

export const data = new SlashCommandBuilder()
    .setName('model')
    .setDescription('Update the model in your active Imagine config')
    .addStringOption(option =>
        option.setName('name')
            .setDescription('New model name')
            .setRequired(true)
            .addChoices(...modelMappings.map(mapping => ({
                name: mapping.display_name,
                value: mapping.model
            }))));

export async function execute(interaction: ChatInputCommandInteraction) {
    const newModel = interaction.options.getString('name', true);
    const userId = interaction.user.id;
    const userSettings = await getActiveUserSettings(userId);

    if (!userSettings.activeImageConfigId) {
        await interaction.reply({ content: 'No active Imagine config found. Please set one using /imaginesettings.', ephemeral: true });
        return;
    }

    try {
        const updatedConfig = await ImageConfigModel.findByIdAndUpdate(
            userSettings.activeImageConfigId,
            { $set: { selectedModel: newModel } },
            { new: true }
        );

        if (updatedConfig) {
            const friendlyModelName = getFriendlyModelName(newModel);
            await interaction.reply({content: `Model in **${updatedConfig.configName}** has been updated to ${friendlyModelName}.`, ephemeral: true});
        } else {
            await interaction.reply({ content: 'Failed to update model. Please try again.', ephemeral: true });
        }
    } catch (error) {
        console.error('Error updating model:', error);
        await interaction.reply({ content: 'An error occurred while updating the model.', ephemeral: true });
    }
}
