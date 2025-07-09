import { HTTPError } from "@discordjs/rest";
import { BaseInteraction } from "discord.js";
import { CustomClient } from "../Requestarr/customclient";

module.exports = {
  name: "interactionCreate",
  execute: async function (client: CustomClient, interaction: BaseInteraction) {
    try {
      if (
        !(
          interaction.isCommand() ||
          interaction.isButton() ||
          interaction.isModalSubmit()
        )
      ) {
        console.error("Interaction is no longer valid.");
        return;
      }

      //------- CHECK-PERMISSION -----//
      if (interaction.isCommand()) {
        const commandName = interaction.commandName;
        const command = client.commands.get(commandName);

        if (!command) return;

        if (client.disabledCommands && client.disabledCommands.has(commandName)) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('🚫 Command Disabled')
            .setDescription(`The command \`${commandName}\` is currently disabled.`)
            .setColor('Orange');
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
          const isDevelopment = process.env.NODE_ENV === "development";
          const isBotOwner = interaction.user.id === process.env.OWNER;

          if (isDevelopment && !isBotOwner) {
            return interaction.reply({
              content:
                "Command execution is disabled in development mode. Only the bot owner can execute commands.",
              ephemeral: true,
            });
          }
          await command.execute(client, interaction);
        } catch (error) {
          if (error instanceof HTTPError && error.status === 503) {
            console.error("Service Unavailable:", error.message);
            await interaction.reply({
              content:
                "The Discord service is temporarily unavailable. Please try again later.",
              ephemeral: true,
            });
          } else if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as any).code === 10062
          ) {
            console.error("Unknown interaction:", (error as any).message);
            return interaction.reply({
              content: "This interaction is no longer valid. Please try again.",
              ephemeral: true,
            });
          } else {
            console.error(error);
            await interaction.reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            });
          }
        }
      }
    } catch (error) {
      console.error(
        "An error occurred while processing the interaction:",
        error
      );
    }
  },
};
