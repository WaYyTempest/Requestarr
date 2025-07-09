import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import fs from "fs";
import path from "path";
import { CustomClient } from "../Request/customclient";
import { createEmbedTemplate } from "../modules/embed";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📖 Show all available commands and usage examples"),
  execute: async (client: CustomClient, interaction: ChatInputCommandInteraction) => {
    const commandsPath = path.join(__dirname);
    const files = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js") && file !== "help.js");
    let description = "";
    const usageExamples: Record<string, string> = {
      "sonarr": "/serie add \"Tensei shitara Slime Datta Ken\"",
      "radarr": "/movie add \"Inception\"",
      "mal": "/mal search username:MyAnimeListUser",
      "daily": "/daily",
      "module": "/module reload command:sonarr",
    };
    const emojis: Record<string, string> = {
      "sonarr": "📺",
      "radarr": "🎬",
      "mal": "🔍",
      "daily": "📅",
      "module": "🛠️",
    };
    for (const file of files) {
      const cmd = require(path.join(commandsPath, file));
      const name = cmd.data?.name || file.replace(/\.js$/, "");
      const isActive = !client.disabledCommands?.has(name);
      const emoji = emojis[name] || "❔";
      description += `\n${isActive ? "✨" : "❌"}  ${emoji} \`${name}\` ${isActive ? "(active)" : "(inactive)"}`;
      if (usageExamples[name]) {
        description += `\n> Example: ${usageExamples[name]}`;
      }
    }
    const embed = createEmbedTemplate(
      "📖 Help & Commands",
      description || "No commands found.",
      interaction.user
    ).setColor("Blue");
    return interaction.reply({ embeds: [embed] });
  }
};
