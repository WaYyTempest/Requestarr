import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { CustomClient } from "../Requestarr/customclient";
import { createEmbedTemplate } from "../modules/embed";

// Recursive function to get all command files in the directory and its subdirectories
function getAllCommandFiles(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllCommandFiles(fullPath, fileList);
    } else if (
      (file.endsWith(".js") || file.endsWith(".ts")) &&
      !file.startsWith("help.")
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📖 Show all available commands and usage examples"),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction
  ) => {
    // Get all command files recursively
    const commandsPath = path.join(__dirname);
    const files = getAllCommandFiles(commandsPath);
    let description = "";
    const usageExamples: Record<string, string> = {
      sonarr: '/serie add "Tensei shitara Slime Datta Ken"',
      radarr: '/movie add "Inception"',
      mal: "/mal search username:MyAnimeListUser",
      daily: "/daily",
      module: "/module reload command:sonarr",
      lidarr: '/lidarr add "Daft Punk"',
      prowlarr: "/prowlarr indexers",
      readarr: '/readarr add "Brandon Sanderson"',
      whisparr: '/whisparr add "Inception"',
      jellystat: "/jellystat",
    };
    const emojis: Record<string, string> = {
      sonarr: "📺",
      radarr: "🎬",
      mal: "🔍",
      daily: "📅",
      module: "🛠️",
    };
    // Build the help description for each command
    for (const file of files) {
      let cmd;
      try {
        cmd = require(file);
      } catch (e) {
        continue;
      }
      const name =
        cmd.data?.name || path.basename(file).replace(/\.(js|ts)$/, "");
      const isActive = !client.disabledCommands?.has(name);
      const emoji = emojis[name] || "❔";
      description += `\n${isActive ? "✨" : "❌"}  ${emoji} \`${name}\` ${
        isActive ? "(active)" : "(inactive)"
      }`;
      if (usageExamples[name]) {
        description += `\n> Example: ${usageExamples[name]}`;
      }
    }
    // Create and send the help embed
    const embed = createEmbedTemplate(
      "``📖`` Help & Commands",
      description || "No commands found.",
      interaction.user
    ).setColor("Blue");
    return interaction.reply({ embeds: [embed] });
  },
};
