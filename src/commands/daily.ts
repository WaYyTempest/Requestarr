import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

interface Anime {
  title: string;
  url: string;
  broadcast?: { time: string };
  episodes?: number;
  genres: Array<{ name: string }>;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("📅 Show today's anime releases"),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    try {
      // Get today's day name (e.g., 'monday')
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const today = days[new Date().getDay()];
      // Build the API URL for today's anime schedule
      const url = `https://api.jikan.moe/v4/schedules?filter=${today}`;

      // Fetch anime schedule from Jikan API
      const response = await axios.get(url);

      if (!Array.isArray(response.data.data)) {
        throw new Error("Expected data array");
      }

      const schedules: Anime[] = response.data.data;

      if (schedules.length === 0) {
        // No anime scheduled for today
        return interaction.reply({
          embeds: [
            createEmbedTemplate(
              "⚠️ » No Releases",
              `No anime is scheduled for today (${today.charAt(0).toUpperCase() + today.slice(1)}).`,
              interaction.user
            ).setColor("Yellow"),
          ],
          ephemeral: true,
        });
      }

      // Format the list of today's anime releases (limit to 10)
      const animeList = schedules
        .slice(0, 10)
        .map((anime: Anime) => {
          const { title, url, broadcast, episodes, genres } = anime;
          return `**[${title}](${url})**\n⌛ Time: ${
            broadcast?.time ? `${broadcast.time} JST` : "N/A"
          }\n📺 Episodes: ${episodes || "?"}\n🎭 Genres: ${genres
            .map((g) => g.name)
            .join(", ")}`;
        })
        .join("\n\n");

      return interaction.reply({
        embeds: [
          createEmbedTemplate(
            `📅 » Anime Releases for ${today.charAt(0).toUpperCase() + today.slice(1)}`,
            animeList,
            interaction.user
          ).setColor("Blue"),
        ],
      });
    } catch (error) {
      // Handle errors and reply with an error message
      console.error("Error fetching anime schedule:", error);
      return interaction.reply({
        embeds: [
          createEmbedTemplate(
            "❌ » Error",
            "Could not fetch today's anime releases. Please try again later.",
            interaction.user
          ).setColor("Red"),
        ],
        ephemeral: true,
      });
    }
  },
};
