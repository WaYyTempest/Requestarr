import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import path from "path";
import { CustomClient } from "../Requestarr/customclient";
import { createEmbedTemplate } from "../modules/embed";
import Redis from "ioredis";

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("module")
    .setDescription("🛠️ Dynamically manage bot commands")
    .addSubcommand(sub =>
      sub
        .setName("reload")
        .setDescription("🔄 Reload a command")
        .addStringOption(opt =>
          opt.setName("command").setDescription("📝 Command name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription("✅ Enable a command")
        .addStringOption(opt =>
          opt.setName("command").setDescription("📝 Command name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("🚫 Disable a command")
        .addStringOption(opt =>
          opt.setName("command").setDescription("📝 Command name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("show")
        .setDescription("📋 Show the status of all commands")
    ),
  execute: async (client: CustomClient, interaction: ChatInputCommandInteraction) => {
    const ownerId = process.env.OWNER;
    if (interaction.user.id !== ownerId) {
      // Only the bot owner can use this command
      const embed = createEmbedTemplate(
        "⛔ Access Denied",
        "Only the bot owner can use this command.",
        interaction.user
      ).setColor("Red");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    let commandName: string | undefined = undefined;
    if (sub !== "show") {
      commandName = interaction.options.getString("command", true);
    }

    if (sub === "show") {
      // Show the status (active/inactive) of all commands
      const fs = require("fs");
      const path = require("path");
      const commandsPath = path.join(__dirname, "../commands");
      const files = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith(".js") && file !== "module.js");
      let description = "";
      for (const file of files) {
        const cmd = require(path.join(commandsPath, file));
        const name = cmd.data?.name || file.replace(/\.js$/, "");
        const isActive = !client.disabledCommands?.has(name);
        description += `\n\n${isActive ? "✨" : "❌"}  \`${name}\` ${isActive ? "(active)" : "(inactive)"}`;
      }
      const embed = createEmbedTemplate(
        "📋 Command Status",
        description || "No commands found.",
        interaction.user
      ).setColor("Blue");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "reload") {
      try {
        // Dynamically reload a command module
        const commandPath = path.join(__dirname, commandName! + ".js");
        delete require.cache[require.resolve(commandPath)];
        const newCommand = require(commandPath);
        client.commands.set(newCommand.data.name, newCommand);
        const embed = createEmbedTemplate(
          "🔄 Command Reloaded",
          `🔄 Command \`${commandName}\` has been reloaded!`,
          interaction.user
        ).setColor("Green");
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        // Handle errors during reload
        const embed = createEmbedTemplate(
          "❌ Reload Error",
          `❌ Error while reloading: \`${err}\``,
          interaction.user
        ).setColor("Red");
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "disable") {
      // Prevent disabling the module command itself
      if (commandName === "module") {
        const embed = createEmbedTemplate(
          "⚠️ Action Forbidden",
          "⚠️ You cannot disable the `module` command.",
          interaction.user
        ).setColor("Orange");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      // Disable a command (update Redis and local set)
      if (!client.disabledCommands) client.disabledCommands = new Set();
      await redis.sadd("disabled_commands", commandName!);
      client.disabledCommands.add(commandName!);
      const embed = createEmbedTemplate(
        "🚫 Command Disabled",
        `🚫 Command \`${commandName}\` has been disabled.`,
        interaction.user
      ).setColor("Orange");
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === "enable") {
      // Enable a command (update Redis and local set)
      await redis.srem("disabled_commands", commandName!);
      client.disabledCommands.delete(commandName!);
      const embed = createEmbedTemplate(
        "✅ Command Enabled",
        `✅ Command \`${commandName}\` has been enabled.`,
        interaction.user
      ).setColor("Green");
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};