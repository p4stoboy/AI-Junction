import { Client, Collection, ClientOptions } from 'discord.js';

export class ExtendedClient extends Client {
    commands: Collection<string, any>;

    constructor(options: ClientOptions) {
        super(options);
        this.commands = new Collection();
    }
}
