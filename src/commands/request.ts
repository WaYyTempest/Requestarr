import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Request/customclient";

dotenv.config();

const SONARR_URL = `http://${process.env.SONARR_IP}:${process.env.SONARR_PORT}/api/v3`;
const SONARR_TOKEN = process.env.SONARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addanime")
    .setDescription("➕ Add an anime to Sonarr")
    .addStringOption((option) =>
      option.setName("query").setDescription("Anime name").setRequired(true)
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    const query = interaction.options.getString("query");

    if (!query) {
      const embed = createEmbedTemplate(
        "⚠️ » Error",
        "Please provide an anime name.",
        interaction.user,
        client
      ).setColor("Red");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
      const searchUrl = `${SONARR_URL}/series/lookup?term=${encodeURIComponent(
        query
      )}`;
      const { data } = await axios.get(searchUrl, {
        headers: { "X-Api-Key": SONARR_TOKEN },
      });

      if (!data.length) {
        const embed = createEmbedTemplate(
          "⚠️ » No Results",
          `No anime found for "${query}" in Sonarr's database.`,
          interaction.user,
          client
        ).setColor("Yellow");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const anime = data[0];
      const addUrl = `${SONARR_URL}/series`;
      const addPayload = {
        title: anime.title,
        tvdbId: anime.tvdbId,
        qualityProfileId: 1, // Adjust this based on your Sonarr settings
        rootFolderPath: "/tv", // Adjust to your Sonarr path
        monitored: true,
        seasons: anime.seasons,
        addOptions: { searchForMissingEpisodes: true },
      };

      await axios.post(addUrl, addPayload, {
        headers: { "X-Api-Key": SONARR_TOKEN },
      });

      const embed = createEmbedTemplate(
        "✅ » Anime Added",
        `Successfully added **${anime.title}** to Sonarr!`,
        interaction.user,
        client
      ).setColor("Green");

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error adding anime to Sonarr:", error);
      const embed = createEmbedTemplate(
        "❌ » Error",
        "Failed to add anime to Sonarr. Please try again later.",
        interaction.user,
        client
      ).setColor("Red");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
