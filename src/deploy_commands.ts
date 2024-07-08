import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'ENABLE_GPT', 'ENABLE_COMFY'];
for (const varName of requiredEnvVars) {
    if (process.env[varName] === undefined) {
        console.error(`Error: ${varName} is not set in the environment variables.`);
        process.exit(1);
    }
}

const ENABLE_GPT = process.env.ENABLE_GPT!.toLowerCase() === 'true';
const ENABLE_COMFY = process.env.ENABLE_COMFY!.toLowerCase() === 'true';

const gptCommands = ['gpt.js', 'gptsettings.js'];
const comfyCommands = ['imagine.js', 'imaginesettings.js', 'cfg.js', 'steps.js', 'model.js', 'prompt.js'];

const disallowedCommands = [
    ...(!ENABLE_GPT ? gptCommands : []),
    ...(!ENABLE_COMFY ? comfyCommands : [])
];

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    if (!disallowedCommands.includes(file)) {
        const command = await import(`./commands/${file}`);
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${file}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        console.log(`GPT commands: ${ENABLE_GPT ? 'Enabled' : 'Disabled'}`);
        console.log(`ComfyUI commands: ${ENABLE_COMFY ? 'Enabled' : 'Disabled'}`);

        if (commands.length === 0) {
            console.log('No commands to deploy. Exiting.');
            return;
        }

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commands },
        ) as any[];

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        console.log('Deployed commands:');
        data.forEach(command => console.log(`- ${command.name}`));
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();
