import axios from "axios";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const JELLYSTAT_URL = process.env.JELLYSTAT_URL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("jellystat")
    .setDescription("Show global Jellystat user stats"),
  execute: async (client: any, interaction: ChatInputCommandInteraction) => {
    try {
      // Call the Jellystat API endpoint for global user stats
      const { data } = await axios.get(
        `${JELLYSTAT_URL}/stats/getGlobalUserStats`
      );
      if (!data || !Array.isArray(data) || data.length === 0) {
        return interaction.reply({
          content: "Aucune statistique trouvée.",
          ephemeral: true,
        });
      }
      // Build a Discord embed with the stats
      const embed = new EmbedBuilder()
        .setTitle("📊 Jellystat - Global User Stats")
        .setColor("Blue")
        .setDescription(
          data
            .map(
              (user: any, idx: number) =>
                `**${idx + 1}. ${user.UserName}**\n` +
                `- Total Plays: ${user.TotalPlays}\n` +
                `- Total Playback Time: ${user.TotalPlaybackTime} min\n` +
                `- Last Activity: ${
                  user.LastActivity ? user.LastActivity : "-"
                }`
            )
            .join("\n\n")
        );
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      return interaction.reply({
        content: "Erreur lors de la récupération des stats Jellystat.",
        ephemeral: true,
      });
    }
  },
};
