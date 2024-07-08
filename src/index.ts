import { Client, Events, GatewayIntentBits, Interaction } from 'discord.js';
import { config } from 'dotenv';
import { handleInteraction } from './command_util/interaction_handlers.js';
import { connectToDatabase } from "./mongo_util/mongo_connection.js";
import { loadCommands } from "./command_util/command_loader.js";
import {ExtendedClient} from "./ExtendedClient.js";

config();

const client = new ExtendedClient({
    intents: [
        GatewayIntentBits.Guilds,

    ],
});

client.once(Events.ClientReady, async () => {
    console.log('Bot is ready!');
    await connectToDatabase();
    await loadCommands(client);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (interaction.isRepliable()) {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
