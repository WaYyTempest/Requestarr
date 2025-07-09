import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../requestarr/customclient";

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
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const today = days[new Date().getDay()];
      const url = `https://api.jikan.moe/v4/schedules?filter=${today}`;

      const response = await axios.get(url);

      if (!Array.isArray(response.data.data)) {
        throw new Error("Expected data array");
      }

      const schedules: Anime[] = response.data.data;

      if (schedules.length === 0) {
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
