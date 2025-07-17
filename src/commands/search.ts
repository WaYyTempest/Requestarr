import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

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
    // Get the subcommand (anime or manga) and the search query
    const subCommand = interaction.options.getSubcommand();
    const query = interaction.options.getString("query");

    if (!query) {
      // Reply if no query provided
      const embed = createEmbedTemplate(
        "⚠️ » Error",
        "Please provide a query.",
        interaction.user
      ).setColor("Red");
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // Build the Jikan API endpoint based on the subcommand
    const endpoint = subCommand === "anime" ? "anime" : "manga";
    const url = `https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(
      query
    )}&limit=1`;

    try {
      // Fetch the first result from the Jikan API
      const { data } = await axios.get(url);
      const item = data.data[0];

      if (!item) {
        // No results found
        const embed = createEmbedTemplate(
          "⚠️ » No Results",
          `No results found for "${query}".`,
          interaction.user
        ).setColor("Yellow");
        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      // Format and send the result as an embed
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
            ? `Aired: ${item.aired?.string || "N/A"}\n`
            : ""),
        interaction.user
      )
        .setURL(item.url)
        .setThumbnail(item.images?.jpg?.image_url)
        .setColor(subCommand === "anime" ? "#FF0000" : "#00FF00");

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      // Handle errors from the API request
      console.error("Error fetching data:", error);
      const embed = createEmbedTemplate(
        "❌ » Error",
        "There was an error fetching the data. Please try again later.",
        interaction.user
      ).setColor("Red");
      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
