import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { Admin, Ban, AllowedChannel } from '../mongo_models/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const GLOBAL_ADMIN_ID = process.env.GLOBAL_ADMIN_ID;

export const data = new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands')
    .addSubcommand(subcommand =>
        subcommand
            .setName('addadmin')
            .setDescription('Add a new admin')
            .addUserOption(option => option.setName('user').setDescription('The user to make admin').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('removeadmin')
            .setDescription('Remove an admin')
            .addUserOption(option => option.setName('user').setDescription('The admin to remove').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('ban')
            .setDescription('Ban a user')
            .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('unban')
            .setDescription('Unban a user')
            .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('addchannel')
            .setDescription('Add an allowed channel')
            .addChannelOption(option => option.setName('channel').setDescription('The channel to allow').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('removechannel')
            .setDescription('Remove an allowed channel')
            .addChannelOption(option => option.setName('channel').setDescription('The channel to disallow').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const channel = interaction.options.getChannel('channel');

    // Check if the user is the global admin or an admin in the database
    const isGlobalAdmin = interaction.user.id === GLOBAL_ADMIN_ID;
    const isDbAdmin = await Admin.findOne({ userId: interaction.user.id });

    if (!isGlobalAdmin && !isDbAdmin) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    switch (subcommand) {
        case 'addadmin':
            if (user) {
                await Admin.findOneAndUpdate({ userId: user.id }, { userId: user.id }, { upsert: true });
                await interaction.reply(`${user.username} has been made an admin.`);
            }
            break;
        case 'removeadmin':
            if (user) {
                if (user.id === GLOBAL_ADMIN_ID) {
                    await interaction.reply({ content: 'Cannot remove the global admin.', ephemeral: true });
                } else {
                    await Admin.findOneAndDelete({ userId: user.id });
                    await interaction.reply(`${user.username} is no longer an admin.`);
                }
            }
            break;
        case 'ban':
            if (user) {
                if (user.id === GLOBAL_ADMIN_ID || await Admin.findOne({ userId: user.id })) {
                    await interaction.reply({ content: 'Cannot ban an admin.', ephemeral: true });
                } else {
                    await Ban.findOneAndUpdate({ userId: user.id }, { userId: user.id }, { upsert: true });
                    await interaction.reply(`${user.username} has been banned.`);
                }
            }
            break;
        case 'unban':
            if (user) {
                await Ban.findOneAndDelete({ userId: user.id });
                await interaction.reply(`${user.username} has been unbanned.`);
            }
            break;
        case 'addchannel':
            if (channel) {
                await AllowedChannel.findOneAndUpdate({ channelId: channel.id }, { channelId: channel.id }, { upsert: true });
                await interaction.reply(`Channel ${channel.name} has been added to allowed channels.`);
            }
            break;
        case 'removechannel':
            if (channel) {
                await AllowedChannel.findOneAndDelete({ channelId: channel.id });
                await interaction.reply(`Channel ${channel.name} has been removed from allowed channels.`);
            }
            break;
        default:
            await interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
    }
}
