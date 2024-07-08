import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { handleSettingsCommand } from "../command_util/interaction_handlers.js";

export const data = new SlashCommandBuilder()
    .setName('gptsettings')
    .setDescription('Manage GPT settings');

export async function execute(interaction: ChatInputCommandInteraction) {
    await handleSettingsCommand(interaction);
}
