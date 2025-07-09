import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import path from "path";
import { CustomClient } from "../requestarr/customclient";
import { createEmbedTemplate } from "../modules/embed";

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
        const embed = createEmbedTemplate(
          "❌ Reload Error",
          `❌ Error while reloading: \`${err}\``,
          interaction.user
        ).setColor("Red");
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "disable") {
      if (commandName === "module") {
        const embed = createEmbedTemplate(
          "⚠️ Action Forbidden",
          "⚠️ You cannot disable the `module` command.",
          interaction.user
        ).setColor("Orange");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      if (!client.disabledCommands) client.disabledCommands = new Set();
      client.disabledCommands.add(commandName!);
      const embed = createEmbedTemplate(
        "🚫 Command Disabled",
        `🚫 Command \`${commandName}\` has been disabled.`,
        interaction.user
      ).setColor("Orange");
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === "enable") {
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