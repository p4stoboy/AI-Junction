import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { ImageConfigModel } from '../mongo_models/settings.js';

export const data = new SlashCommandBuilder()
    .setName('steps')
    .setDescription('Update the steps value in your active Imagine config')
    .addIntegerOption(option =>
        option.setName('value')
            .setDescription('New steps value (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const newSteps = interaction.options.getInteger('value', true);
    const userId = interaction.user.id;
    const userSettings = await getActiveUserSettings(userId);

    if (!userSettings.activeImageConfigId) {
        await interaction.reply({ content: 'No active Imagine config found. Please set one using /imaginesettings.', ephemeral: true });
        return;
    }

    try {
        const updatedConfig = await ImageConfigModel.findByIdAndUpdate(
            userSettings.activeImageConfigId,
            { $set: { steps: newSteps } },
            { new: true }
        );

        if (updatedConfig) {
            await interaction.reply({content: `Steps value in **${updatedConfig.configName}** has been updated to ${newSteps}.`, ephemeral: true});
        } else {
            await interaction.reply({ content: 'Failed to update steps value. Please try again.', ephemeral: true });
        }
    } catch (error) {
        console.error('Error updating steps value:', error);
        await interaction.reply({ content: 'An error occurred while updating the steps value.', ephemeral: true });
    }
}
