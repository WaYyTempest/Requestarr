import { IntentsBitField } from "discord.js";

// List of Discord gateway intents required by the bot
export const intents = [
  IntentsBitField.Flags.Guilds,
  IntentsBitField.Flags.GuildMembers,
  IntentsBitField.Flags.GuildModeration,
  IntentsBitField.Flags.GuildEmojisAndStickers,
  IntentsBitField.Flags.GuildIntegrations,
  IntentsBitField.Flags.GuildWebhooks,
  IntentsBitField.Flags.GuildInvites,
  IntentsBitField.Flags.GuildVoiceStates,
  IntentsBitField.Flags.GuildPresences,
  IntentsBitField.Flags.GuildMessages,
  IntentsBitField.Flags.GuildMessageReactions,
  IntentsBitField.Flags.GuildMessageTyping,
  IntentsBitField.Flags.DirectMessages,
  IntentsBitField.Flags.DirectMessageReactions,
  IntentsBitField.Flags.DirectMessageTyping,
  IntentsBitField.Flags.MessageContent,
];
