import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Request/customclient";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("🔍 Search for an anime or manga")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("anime")
        .setDescription("Search for an anime")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("The name of the anime")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("manga")
        .setDescription("Search for a manga")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("The name of the manga")
            .setRequired(true)
        )
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    const subCommand = interaction.options.getSubcommand();
    const query = interaction.options.getString("query");

    if (!query) {
      const embed = createEmbedTemplate(
        "⚠️ » Error",
        "Please provide a query.",
        interaction.user,
        client
      ).setColor("Red");
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    const endpoint = subCommand === "anime" ? "anime" : "manga";
    const url = `https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(
      query
    )}&limit=1`;

    try {
      const { data } = await axios.get(url);
      const item = data.data[0];

      if (!item) {
        const embed = createEmbedTemplate(
          "⚠️ » No Results",
          `No results found for "${query}".`,
          interaction.user,
          client
        ).setColor("Yellow");
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      const embed = createEmbedTemplate(
        item.title,
        `${
          subCommand === "anime"
            ? `Episodes: ${item.episodes}`
            : `Chapters: ${item.chapters}`
        }\n\n` +
          `Description: ${item.synopsis || "No description available."}\n` +
          `Score: ${item.score || "N/A"}\n` +
          `Genres: ${
            item.genres?.map((g: { name: string }) => g.name).join(", ") ||
            "N/A"
          }\n` +
          (subCommand === "anime"
            ? `Aired: ${item.aired?.string || "N/A"}\n` // Anime aired information
            : ""),
        interaction.user,
        client
      )
        .setURL(item.url)
        .setThumbnail(item.images?.jpg?.image_url)
        .setColor(subCommand === "anime" ? "#FF0000" : "#00FF00");

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error fetching data:", error);
      const embed = createEmbedTemplate(
        "❌ » Error",
        "There was an error fetching the data. Please try again later.",
        interaction.user,
        client
      ).setColor("Red");
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
