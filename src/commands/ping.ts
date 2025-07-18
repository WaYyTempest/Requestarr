import axios from "axios";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

const SONARR_URL = process.env.SONARR_URL;
const SONARR_TOKEN = process.env.SONARR_TOKEN;
const RADARR_URL = process.env.RADARR_URL;
const RADARR_TOKEN = process.env.RADARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Test the latency, Discord API, Sonarr & Radarr"),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction
  ) => {
    // Measure bot response time
    const sent = Date.now();
    await interaction.deferReply();
    const botLatency = Date.now() - interaction.createdTimestamp;

    // Discord WebSocket latency
    const apiLatency = client.ws.ping;

    // Sonarr response time
    let sonarrPing = null;
    let sonarrEmoji = "";
    if (SONARR_URL && SONARR_TOKEN) {
      const start = Date.now();
      try {
        await axios.get(`${SONARR_URL}/api/v3/system/status`, {
          headers: { "X-Api-Key": SONARR_TOKEN },
          timeout: 4000,
        });
        sonarrPing = Date.now() - start;
        sonarrEmoji = "🟢";
      } catch (e) {
        sonarrPing = null;
        sonarrEmoji = "🔴";
      }
    }

    // Radarr response time
    let radarrPing = null;
    let radarrEmoji = "";
    if (RADARR_URL && RADARR_TOKEN) {
      const start = Date.now();
      try {
        await axios.get(`${RADARR_URL}/api/v3/system/status`, {
          headers: { "X-Api-Key": RADARR_TOKEN },
          timeout: 4000,
        });
        radarrPing = Date.now() - start;
        radarrEmoji = "🟢";
      } catch (e) {
        radarrPing = null;
        radarrEmoji = "🔴";
      }
    }

    // Build the message
    let desc =
      `🤖 Bot: **${botLatency}ms**\n` +
      `✈️ Discord API: **${apiLatency}ms**\n` +
      `📺 Sonarr: ${sonarrEmoji} ${
        sonarrPing !== null ? `**${sonarrPing}ms**` : "**Error**"
      }\n` +
      `🎬 Radarr: ${radarrEmoji} ${
        radarrPing !== null ? `**${radarrPing}ms**` : "**Error**"
      }`;

    const embed = createEmbedTemplate(
      "``🏓`` Pong! Service Latency",
      desc,
      interaction.user,
      "Blue"
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
