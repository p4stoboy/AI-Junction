import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { getActiveUserSettings } from '../mongo_util/user_settings.js';
import { ImageConfigModel } from '../mongo_models/settings.js';

export const data = new SlashCommandBuilder()
    .setName('cfg')
    .setDescription('Update the CFG value in your active Imagine config')
    .addNumberOption(option =>
        option.setName('value')
            .setDescription('New CFG value (0-10)')
            .setMinValue(0)
            .setMaxValue(10)
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const newCfg = interaction.options.getNumber('value', true);
    const userId = interaction.user.id;
    const userSettings = await getActiveUserSettings(userId);

    if (!userSettings.activeImageConfigId) {
        await interaction.reply({ content: 'No active Imagine config found. Please set one using /imaginesettings.', ephemeral: true });
        return;
    }

    try {
        const updatedConfig = await ImageConfigModel.findByIdAndUpdate(
            userSettings.activeImageConfigId,
            { $set: { cfg: newCfg } },
            { new: true }
        );

        if (updatedConfig) {
            await interaction.reply({content: `CFG value in **${updatedConfig.configName}** has been updated to ${newCfg}.`, ephemeral: true});
        } else {
            await interaction.reply({ content: 'Failed to update CFG value. Please try again.', ephemeral: true });
        }
    } catch (error) {
        console.error('Error updating CFG value:', error);
        await interaction.reply({ content: 'An error occurred while updating the CFG value.', ephemeral: true });
    }
}
