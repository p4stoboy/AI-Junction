import {
    Interaction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    MessageComponentInteraction
} from 'discord.js';
import { ImageConfigModel, GptConfigModel, UserSettingsModel } from '../mongo_models/settings.js';
import { loadModelMappings } from "./model_mappings.js";
import { v4 as uuidv4 } from 'uuid';
import { isBanned, isAllowedChannel } from './admin_utils.js';
import mongoose from "mongoose";
import { GptConfig, ImageConfig } from "../types";
import { ExtendedClient } from "../ExtendedClient.js";

interface WorkflowState {
    userId: string;
    workflowId: string;
    type: 'gpt' | 'imagine';
    modelId?: string;
    configId?: string;
    initialInteraction: ButtonInteraction;
}

const workflowStates = new Map<string, WorkflowState>();


async function handleInteraction(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
        if (!await checkInteractionPermissions(interaction)) return;
        await handleCommand(interaction);
    } else if (interaction.isButton()) {
        await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
        await handleStringSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
    }
}

async function checkInteractionPermissions(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (await isBanned(interaction.user.id)) {
        await interaction.reply({ content: 'You are banned from using this bot.', ephemeral: true });
        return false;
    }
    if (!await isAllowedChannel(interaction.channelId)) {
        await interaction.reply({ content: 'This bot cannot be used in this channel.', ephemeral: true });
        return false;
    }
    return true;
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
    if (interaction.commandName === 'gptsettings' || interaction.commandName === 'imaginesettings') {
        await handleSettingsCommand(interaction);
    } else {
        const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
        }
    }
}

async function handleButton(interaction: ButtonInteraction) {
    const [action, type] = interaction.customId.split('-');

    if (action === 'new' && (type === 'gpt' || type === 'imagine')) {
        await handleNewConfig(interaction, type as 'gpt' | 'imagine');
    } else if (action === 'set') {
        await handleSetActiveConfig(interaction, type as 'gpt' | 'imagine');
    } else if (action === 'edit') {
        await handleEditConfig(interaction, type as 'gpt' | 'imagine');
    } else if (action === 'delete') {
        await handleDeleteConfig(interaction, type as 'gpt' | 'imagine');
    }
}

async function handleStringSelectMenu(interaction: StringSelectMenuInteraction) {
    if (interaction.customId.startsWith('imagine-new-config-model-select:')) {
        await handleImagineNewConfigModelSelect(interaction);
    } else if (interaction.customId === 'gpt-config-select' || interaction.customId === 'imagine-config-select') {
        await handleConfigSelect(interaction);
    }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId.startsWith('gpt-new-config-modal:') ||
        interaction.customId.startsWith('imagine-new-config-modal:')) {
        await handleConfigSave(interaction);
    }
}

async function generateSettingsMenu(type: 'gpt' | 'imagine', userId: string, actionMessage?: string, activeName?: string) {
    const Model = type === 'gpt' ? GptConfigModel : ImageConfigModel;
    const configs = await (Model as any).find({ userId: userId }).lean();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${type}-config-select`)
        .setPlaceholder('Select a config');

    configs.forEach((config: GptConfig | ImageConfig) => {
        selectMenu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(config.configName)
                .setValue(config._id.toString())
        );
    });

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

    const newButton = new ButtonBuilder()
        .setCustomId(`new-${type}`)
        .setLabel('New Config')
        .setStyle(ButtonStyle.Primary);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(newButton);

    const rows = configs.length === 0 ? [buttonRow] : [selectRow, buttonRow];

    const typeDisplay = (type === 'gpt' ? 'LLM' : 'Image').toUpperCase();
    let content = `>\n**__${typeDisplay} SETTINGS__**\n\n`;

    if (activeName) {
        content += `Active config: **${activeName}**\n\n`;
    }

    if (actionMessage) {
        content += `\n\n${actionMessage}`;
    }

    return { content, components: rows };
}

async function handleSettingsCommand(interaction: ChatInputCommandInteraction) {
    const type = interaction.commandName === 'gptsettings' ? 'gpt' : 'imagine';
    const menu = await generateSettingsMenu(type, interaction.user.id);
    await interaction.reply({ ...menu, ephemeral: true });
}

async function handleNewConfig(interaction: ButtonInteraction, type: 'gpt' | 'imagine') {
    const workflowId = createWorkflowState(interaction.user.id, type, interaction);

    if (type === 'imagine') {
        await showModelSelectionMenu(interaction, workflowId);
    } else {
        await showConfigCreationModal(interaction, type, workflowId);
    }
}

async function showModelSelectionMenu(interaction: ButtonInteraction, workflowId: string) {
    const modelMappings = await loadModelMappings();
    const modelSelect = new StringSelectMenuBuilder()
        .setCustomId(`imagine-new-config-model-select:${workflowId}`)
        .setPlaceholder('Select a model')
        .addOptions(modelMappings.map(mapping =>
            new StringSelectMenuOptionBuilder()
                .setLabel(mapping.display_name)
                .setValue(mapping.model)
        ));

    const modelRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(modelSelect);

    await interaction.update({
        content: 'Please select a model:',
        components: [modelRow],
    });
}

async function showConfigCreationModal(interaction: ButtonInteraction, type: 'gpt' | 'imagine', workflowId: string) {
    const modal = createConfigModal(type, workflowId);
    await interaction.showModal(modal);
}

async function handleImagineNewConfigModelSelect(interaction: StringSelectMenuInteraction) {
    const state = await getWorkflowState(interaction);
    if (!state) return;

    state.modelId = interaction.values[0];
    workflowStates.set(state.workflowId, state);

    const modal = createConfigModal('imagine', state.workflowId);
    await interaction.showModal(modal);
}

async function handleConfigSelect(interaction: StringSelectMenuInteraction) {
    const selectedConfigId = interaction.values[0];
    const type = interaction.customId.startsWith('gpt') ? 'gpt' : 'imagine';
    const Model = type === 'gpt' ? GptConfigModel : ImageConfigModel;

    const config = await (Model as any).findById(selectedConfigId).lean();

    if (!config) {
        const menu = await generateSettingsMenu(type, interaction.user.id, 'Config not found. Please try again.');
        await interaction.update(menu);
        return;
    }

    const setActiveButton = new ButtonBuilder()
        .setCustomId(`set-${type}-${selectedConfigId}`)
        .setLabel('Set Active')
        .setStyle(ButtonStyle.Primary);

    const editButton = new ButtonBuilder()
        .setCustomId(`edit-${type}-${selectedConfigId}`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Secondary);

    const deleteButton = new ButtonBuilder()
        .setCustomId(`delete-${type}-${selectedConfigId}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(setActiveButton, editButton, deleteButton);

    await interaction.update({
        content: `**${config.configName}**`,
        components: [actionRow]
    });
}

async function handleSetActiveConfig(interaction: ButtonInteraction, type: 'gpt' | 'imagine') {
    const configId = interaction.customId.split('-')[2];
    const field = type === 'gpt' ? 'activeGptConfigId' : 'activeImageConfigId';
    await UserSettingsModel.findOneAndUpdate(
        { userId: interaction.user.id },
        { [field]: new mongoose.Types.ObjectId(configId) },
        { upsert: true }
    );
    const Model = type === 'gpt' ? GptConfigModel : ImageConfigModel;
    const config = await (Model as any).findById(configId).lean();
    const actionMessage = `${type} config **${config.configName}** set as active.`;

    const menu = await generateSettingsMenu(type, interaction.user.id, actionMessage);
    await interaction.update(menu);
}

async function handleEditConfig(interaction: ButtonInteraction, type: 'gpt' | 'imagine') {
    const configId = interaction.customId.split('-')[2];
    const Model = type === 'gpt' ? GptConfigModel : ImageConfigModel;

    const config = await (Model as any).findById(configId).lean();

    if (!config) {
        const menu = await generateSettingsMenu(type, interaction.user.id, 'Config not found. Please try again.');
        await interaction.update(menu);
        return;
    }

    const workflowId = createWorkflowState(interaction.user.id, type, interaction, config.selectedModel, configId);
    const modal = createConfigModal(type, workflowId, config);
    await interaction.showModal(modal);
}

async function handleDeleteConfig(interaction: ButtonInteraction, type: 'gpt' | 'imagine') {
    const configId = interaction.customId.split('-')[2];
    const Model = type === 'gpt' ? GptConfigModel : ImageConfigModel;

    const deletedConfig = await (Model as any).findByIdAndDelete(configId).lean();

    let actionMessage;
    if (deletedConfig) {
        actionMessage = `${type} config **${deletedConfig.configName}** has been deleted.`;
    } else {
        actionMessage = 'Config not found or already deleted.';
    }

    const menu = await generateSettingsMenu(type, interaction.user.id, actionMessage);
    await interaction.update(menu);
}

async function handleConfigSave(interaction: ModalSubmitInteraction) {
    const state = await getWorkflowState(interaction);
    if (!state) return;

    const existing_id = state.configId;

    const configName = interaction.fields.getTextInputValue('config-name');
    const baseConfig = {
        userId: interaction.user.id,
        configName
    };

    let config;
    if (state.type === 'imagine') {
        const positivePrompt = interaction.fields.getTextInputValue('positive-prompt');
        const negativePrompt = interaction.fields.getTextInputValue('negative-prompt');
        const steps = parseInt(interaction.fields.getTextInputValue('steps'));
        const cfg = parseFloat(interaction.fields.getTextInputValue('cfg'));

        if (isNaN(steps) || steps < 1 || steps > 50 || isNaN(cfg) || cfg < 0 || cfg > 20) {
            await interaction.reply({ content: 'Invalid steps or CFG value. Please try again.', ephemeral: true });
            return;
        }

        if (existing_id) {
            config = await ImageConfigModel.findByIdAndUpdate(existing_id, {
                ...baseConfig,
                positivePrompt,
                negativePrompt,
                steps,
                cfg,
                selectedModel: state.modelId
            }, { new: true });
        } else {
            config = await ImageConfigModel.create({
                ...baseConfig,
                positivePrompt,
                negativePrompt,
                steps,
                cfg,
                selectedModel: state.modelId
            });
        }
    } else {
        const systemPrompt = interaction.fields.getTextInputValue('system-prompt');
        if (existing_id) {
            config = await GptConfigModel.findByIdAndUpdate(existing_id, {
                ...baseConfig,
                systemPrompt
            }, { new: true });
        } else {
            config = await GptConfigModel.create({
                ...baseConfig,
                systemPrompt
            });
        }
    }

    const actionMessage = config
        ? `${state.type} config **${configName}** saved successfully.`
        : `Failed to save ${state.type} config. Please try again.`;

    // Generate the new menu
    const menu = await generateSettingsMenu(state.type, interaction.user.id, actionMessage);

    // Update the initial interaction with the new menu
    await state.initialInteraction.editReply(menu);

    // Acknowledge the modal submission without sending a visible response
    await interaction.deferUpdate();

    workflowStates.delete(state.workflowId);
}

function createWorkflowState(userId: string, type: 'gpt' | 'imagine', initialInteraction: ButtonInteraction, modelId?: string, configId?: string): string {
    const workflowId = uuidv4();
    // Delete any existing workflow states for this user and type
    for (const [key, state] of workflowStates.entries()) {
        if (state.userId === userId && state.type === type) {
            workflowStates.delete(key);
        }
    }
    workflowStates.set(workflowId, { userId, workflowId, type, modelId, configId, initialInteraction });
    return workflowId;
}

async function getWorkflowState(interaction: StringSelectMenuInteraction | ModalSubmitInteraction): Promise<WorkflowState | null> {
    const workflowId = interaction.customId.split(':')[1];
    const state = workflowStates.get(workflowId);
    if (!state || state.userId !== interaction.user.id) {
        const menu = await generateSettingsMenu('gpt', interaction.user.id, 'An error occurred. Please start over.');
        await state?.initialInteraction.update(menu);
        return null;
    }
    return state;
}

function createConfigModal(type: 'gpt' | 'imagine', workflowId: string, existingConfig?: any): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(`${type}-new-config-modal:${workflowId}`)
        .setTitle(`Create new ${type} config`.toUpperCase());

    const configNameInput = new TextInputBuilder()
        .setCustomId('config-name')
        .setLabel('Config Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    if (existingConfig) {
        configNameInput.setValue(existingConfig.configName);
    }

    if (type === 'imagine') {
        const positivePromptInput = new TextInputBuilder()
            .setCustomId('positive-prompt')
            .setLabel('Positive Prompt')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const negativePromptInput = new TextInputBuilder()
            .setCustomId('negative-prompt')
            .setLabel('Negative Prompt')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        const stepsInput = new TextInputBuilder()
            .setCustomId('steps')
            .setLabel('Steps (1-50)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const cfgInput = new TextInputBuilder()
            .setCustomId('cfg')
            .setLabel('CFG (0-20)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        if (existingConfig) {
            positivePromptInput.setValue(existingConfig.positivePrompt);
            negativePromptInput.setValue(existingConfig.negativePrompt);
            stepsInput.setValue(existingConfig.steps.toString());
            cfgInput.setValue(existingConfig.cfg.toString());
        } else {
            positivePromptInput.setValue('This is your image prompt.\nUse {prompt} to insert the user input.\neg. "Image of {prompt}, black and white, sketchy, abstract, by Picasso"');
            negativePromptInput.setValue('This is the prompt for the AI to ignore.\neg. "bad hands, AI artifacts"');
            stepsInput.setValue('20');
            cfgInput.setValue('1');
        }

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(configNameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(positivePromptInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(negativePromptInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(stepsInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(cfgInput)
        );
    } else {
        const systemPromptInput = new TextInputBuilder()
            .setCustomId('system-prompt')
            .setLabel('System Prompt')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        if (existingConfig) {
            systemPromptInput.setValue(existingConfig.systemPrompt);
        } else {
            systemPromptInput.setValue('You are a helpful assistant.');
        }

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(configNameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(systemPromptInput)
        );
    }

    return modal;
}

// Utility function to clean up expired workflow states
function cleanupWorkflowStates() {
    const now = Date.now();
    for (const [key, state] of workflowStates.entries()) {
        if (now - state.initialInteraction.createdTimestamp > 15 * 60 * 1000) { // 15 minutes
            workflowStates.delete(key);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupWorkflowStates, 5 * 60 * 1000);

export {
    handleInteraction,
    handleSettingsCommand,
    handleNewConfig,
    handleSetActiveConfig,
    handleEditConfig,
    handleDeleteConfig,
    handleConfigSelect,
    handleImagineNewConfigModelSelect,
    handleConfigSave
};
