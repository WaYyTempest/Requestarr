import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Request/customclient";

interface Anime {
  title: string;
  url: string;
  broadcast?: { time: string };
  episodes?: number;
  genres: Array<{ name: string }>;
}

export default {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("📅 Show today's anime releases"),
  async execute(
    interaction: ChatInputCommandInteraction & { member: GuildMember },
    client: CustomClient
  ) {
    try {
      const today = new Date().toLocaleDateString("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const url = `https://api.jikan.moe/v4/schedules?filter=${today}`;

      const response = await axios.get(url);

      if (!Array.isArray(response.data.schedules)) {
        throw new Error("Expected schedules array");
      }

      const schedules: Anime[] = response.data.schedules;

      if (schedules.length === 0) {
        return interaction.reply({
          embeds: [
            createEmbedTemplate(
              "⚠️ » No Releases",
              "No anime is scheduled for today.",
              interaction.user,
              client
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
            "📅 » Today's Anime Releases",
            animeList,
            interaction.user,
            client
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
            interaction.user,
            client
          ).setColor("Red"),
        ],
        ephemeral: true,
      });
    }
  },
};
