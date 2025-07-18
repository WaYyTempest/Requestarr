import {
  ChatInputCommandInteraction,
  DMChannel,
  GuildMember,
  PermissionsBitField,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("🪄 » Clear a specified number of messages")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("🔢 Number of messages to clear")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option.setName("user").setDescription("👤 User whose messages to delete")
    ),

  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction
  ) => {
    // Get the amount and optional user from the command options
    const amount = interaction.options.getInteger("amount");
    const user = interaction.options.getUser("user");

    // Validate the amount
    if (typeof amount !== "number" || isNaN(amount)) {
      const embed = createEmbedTemplate(
        "Invalid Input",
        "Please specify a valid number.",
        interaction.user,
        "Red"
      );
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // Check if the amount is within Discord's allowed range
    if (!amount || amount < 1 || amount > 100) {
      const embed = createEmbedTemplate(
        "Invalid Amount",
        "Please specify a number between 1 and 100.",
        interaction.user,
        "Red"
      );
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // Get the channel and member context
    const channel = interaction.channel;
    const member = interaction.member as GuildMember;
    const isOwner = interaction.user.id === process.env.OWNER;

    // Handle clearing messages in DMs
    if (channel instanceof DMChannel) {
      if (!isOwner) {
        // Only the bot owner can use this command in DMs
        const embed = createEmbedTemplate(
          "Unauthorized",
          "🚫 You are not authorized to use this command in DMs.",
          interaction.user,
          "Red"
        );
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } else {
        try {
          // Fetch and filter messages sent by the bot
          const messages = await channel.messages.fetch({ limit: amount });
          const filteredMessages = messages.filter(
            (msg) => client.user && msg.author.id === client.user.id
          );

          // Delete each message
          for (const msg of filteredMessages.values()) {
            await msg.delete();
          }

          // Confirmation embed
          const embed = createEmbedTemplate(
            "Messages Cleared",
            `Successfully cleared ${filteredMessages.size} messages.`,
            interaction.user,
            "Green"
          );
          return interaction.reply({
            embeds: [embed],
            ephemeral: true,
          });
        } catch (error) {
          // Error handling for DM deletion
          console.error("Error clearing messages:", error);
          const embed = createEmbedTemplate(
            "Error",
            "There was an error trying to clear messages in this channel.",
            interaction.user,
            "Red"
          );
          return interaction.reply({
            embeds: [embed],
            ephemeral: true,
          });
        }
      }
    }

    // Handle clearing messages in text channels
    if (channel instanceof TextChannel) {
      // Check permissions: only owner or users with ManageMessages can clear
      if (
        !isOwner &&
        !member.permissions.has(PermissionsBitField.Flags.ManageMessages)
      ) {
        const embed = createEmbedTemplate(
          "Permission Denied",
          "You do not have permission to manage messages.",
          interaction.user,
          "Red"
        );
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      try {
        // Fetch messages and filter by user if specified
        const messages = await channel.messages.fetch({ limit: amount });
        const filteredMessages = user
          ? messages.filter((msg) => msg.author.id === user.id)
          : messages;

        // Bulk delete the filtered messages
        await channel.bulkDelete(filteredMessages, true);

        // Confirmation embed
        const embed = createEmbedTemplate(
          "Messages Cleared",
          `Successfully cleared ${filteredMessages.size} messages.`,
          interaction.user,
          "Green"
        );
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (error) {
        // Error handling for text channel deletion
        console.error("Error clearing messages:", error);
        const embed = createEmbedTemplate(
          "Error",
          "There was an error trying to clear messages in this channel.",
          interaction.user,
          "Red"
        );
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }
    }
  },
};
