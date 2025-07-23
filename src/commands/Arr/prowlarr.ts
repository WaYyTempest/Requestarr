import axios from "axios";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { createEmbedTemplate } from "../../modules/embed";
import { CustomClient } from "../../Requestarr/customclient";

dotenv.config();

const PROWLARR_URL = `${process.env.PROWLARR_URL}/api/v1`;
const PROWLARR_TOKEN = process.env.PROWLARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prowlarr")
    .setDescription("Manage indexers in Prowlarr")
    .addSubcommand((sub) =>
      sub.setName("indexers").setDescription("📋 List all indexers in Prowlarr")
    )
    .addSubcommand((sub) =>
      sub.setName("testall").setDescription("🧪 Test all indexers in Prowlarr")
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    if (
      process.env.PUBLIC_ARR !== "true" &&
      interaction.user.id !== process.env.OWNER
    ) {
      const embed = createEmbedTemplate(
        "Command Disabled",
        "This command is currently disabled for the public. To allow access, set PUBLIC_ARR=true in the environment.",
        interaction.user
      ).setColor("Orange");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    if (sub === "indexers") {
      try {
        const indexersUrl = `${PROWLARR_URL}/indexer`;
        const { data: indexers } = await axios.get(indexersUrl, {
          headers: { "X-Api-Key": PROWLARR_TOKEN },
        });
        if (!indexers.length) {
          const embed = new EmbedBuilder()
            .setTitle("📋 Prowlarr Indexers")
            .setDescription("No indexers found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Paginate indexers, 10 per page
        const pageSize = 10;
        let page = 0;
        const totalPages = Math.ceil(indexers.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = indexers.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice
            .map(
              (idx: any) =>
                `**${idx.name}**\nType: ${idx.implementation}\nURL: ${
                  idx.fields?.find((f: any) => f.name === "url")?.value || "?"
                }`
            )
            .join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📋 Prowlarr Indexers — Page ${page + 1}/${totalPages}`)
            .setDescription(desc)
            .setColor("Blue");
        };
        const getRow = (page: number) =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId("next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page >= totalPages - 1)
          );
        await interaction.reply({
          embeds: [getEmbed(page)],
          components: totalPages > 1 ? [getRow(page)] : [],
        });
        if (totalPages > 1) {
          const collector =
            interaction.channel?.createMessageComponentCollector({
              filter: (i) => i.user.id === interaction.user.id,
              componentType: ComponentType.Button,
              time: 60000,
            });
          if (!collector) return;
          collector.on("collect", async (i) => {
            if (i.customId === "prev" && page > 0) page--;
            if (i.customId === "next" && page < totalPages - 1) page++;
            await i.update({
              embeds: [getEmbed(page)],
              components: [getRow(page)],
            });
          });
          collector.on("end", async () => {
            try {
              await interaction.editReply({ components: [] });
            } catch {}
          });
        }
      } catch (error: any) {
        console.error("Error fetching Prowlarr indexers:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to fetch Prowlarr indexers. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
    if (sub === "testall") {
      await interaction.deferReply({ ephemeral: true });
      try {
        // Test all indexers via /indexerproxy/testall (no body, only header)
        const testUrl = `${PROWLARR_URL}/indexerproxy/testall`;
        const { data: result } = await axios.post(testUrl, undefined, {
          headers: { "X-Api-Key": PROWLARR_TOKEN },
        });
        const embed = new EmbedBuilder()
          .setTitle("🧪 Test All Indexers")
          .setDescription(
            result && typeof result === "object"
              ? `Test completed.\n${Object.entries(result)
                  .map(([name, status]) => `**${name}**: ${status}`)
                  .join("\n")}`
              : "Test completed. Check Prowlarr for details."
          )
          .setColor("Green");
        return interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to test all indexers. Please try again later."
          )
          .setColor("Red");
        return interaction.editReply({ embeds: [embed] });
      }
    }
  },
};
