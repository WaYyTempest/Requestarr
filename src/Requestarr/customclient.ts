import { SlashCommandBuilder } from "@discordjs/builders";
import {
  Client,
  ClientOptions,
  Collection,
  CommandInteraction,
} from "discord.js";

// Type definition for a command object
export type Command = {
  data: SlashCommandBuilder;
  execute: (client: CustomClient, interaction: CommandInteraction) => void;
  cooldown: number;
};

// Custom Discord client class with additional properties for commands, cooldowns, etc.
export class CustomClient extends Client {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
  leaderboardMessageId?: string;
  api: Record<string, any>;
  disabledCommands: Set<string>;

  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection();
    this.cooldowns = new Collection();
    this.leaderboardMessageId = undefined;
    this.api = {};
    this.disabledCommands = new Set();
  }
}
