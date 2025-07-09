import axios from "axios";
import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";
import dotenv from "dotenv";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../requestarr/customclient";
import { logInfo, logError } from "../utils/logger";

dotenv.config();

const SONARR_URL = `${process.env.SONARR_URL}/api/v3`;
const SONARR_TOKEN = process.env.SONARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sonarr")
    .setDescription("Manage series in Sonarr")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("➕ Add a series to Sonarr")
        .addStringOption(option =>
          option.setName("query").setDescription("Series name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a series from Sonarr")
        .addStringOption(option =>
          option.setName("query").setDescription("Series name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("calendar")
        .setDescription("📅 Show upcoming Sonarr episodes")
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    if (process.env.PUBLIC_ARR !== 'true' && interaction.user.id !== process.env.OWNER) {
      const embed = createEmbedTemplate(
        'Command Disabled',
        'This command is currently disabled for the public. To allow access, set PUBLIC_ARR=true in the environment.',
        interaction.user
      ).setColor('Orange');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    const query = interaction.options.getString("query");

    if (sub === "add") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a series name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        const searchUrl = `${SONARR_URL}/series/lookup?term=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
          headers: { "X-Api-Key": SONARR_TOKEN },
        });

        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No series found for "${query}" in Sonarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const rootFoldersUrl = `${SONARR_URL}/rootfolder`;
        const { data: rootFolders } = await axios.get(rootFoldersUrl, {
          headers: { "X-Api-Key": SONARR_TOKEN },
        });
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No root folder found in Sonarr. Please configure one in Sonarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (data.length === 1) {
          const serie = data[0];
          const addUrl = `${SONARR_URL}/series`;
          const addPayload = {
            title: serie.title,
            qualityProfileId: 1,
            tvdbId: serie.tvdbId,
            titleSlug: String(serie.titleSlug),
            images: serie.images,
            year: serie.year,
            rootFolderPath,
            monitored: true,
            addOptions: { searchForMissingEpisodes: true },
          };
          await axios.post(addUrl, addPayload, {
            headers: { "X-Api-Key": SONARR_TOKEN },
          });
          logInfo("SONARR", `${interaction.user.id} -> ${serie.title} -> add`);
          const embed = createEmbedTemplate(
            "✅ » Series Added",
            `Successfully added **${serie.title}** to Sonarr!`,
            interaction.user
          ).setColor("Green");
          return interaction.reply({ embeds: [embed] });
        }

        let page = 0;
        const totalPages = data.length;
        const getEmbed = (page: number) => {
          const serie = data[page];
          const poster = serie.images?.find((img: any) => img.coverType === "poster")?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(serie.title)
            .setDescription(`**Year:** ${serie.year}\n**TVDB ID:** ${serie.tvdbId}`)
            .setImage(poster || null)
            .setFooter({ text: `Result ${page + 1}/${totalPages}` })
            .setColor("Blue");
        };
        const getRow = (page: number) => new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("grab")
            .setLabel("Grab")
            .setStyle(ButtonStyle.Success),
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
          components: [getRow(page)]
        });
        const collector = interaction.channel?.createMessageComponentCollector({
          filter: i => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 60000,
        });
        if (!collector) return;
        collector.on("collect", async i => {
          if (i.customId === "prev" && page > 0) page--;
          if (i.customId === "next" && page < totalPages - 1) page++;
          if (i.customId === "grab") {
            const serie = data[page];
            const addUrl = `${SONARR_URL}/series`;
            const addPayload = {
              title: serie.title,
              qualityProfileId: 1,
              tvdbId: serie.tvdbId,
              titleSlug: String(serie.titleSlug),
              images: serie.images,
              year: serie.year,
              rootFolderPath,
              monitored: true,
              addOptions: { searchForMissingEpisodes: true },
            };
            try {
              await axios.post(addUrl, addPayload, {
                headers: { "X-Api-Key": SONARR_TOKEN },
              });
              logInfo("SONARR", `${interaction.user.id} -> ${serie.title} -> add`);
              const embed = createEmbedTemplate(
                "✅ » Series Added",
                `Successfully added **${serie.title}** to Sonarr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
            } catch (error) {
              const embed = createEmbedTemplate(
                "❌ » Error",
                `Failed to add **${serie.title}** to Sonarr. Please try again later.`,
                interaction.user
              ).setColor("Red");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
            }
            return;
          }
          await i.update({
            embeds: [getEmbed(page)],
            components: [getRow(page)]
          });
        });
        collector.on("end", async () => {
          try {
            await interaction.editReply({ components: [] });
          } catch {}
        });
        return;
      } catch (error) {
        console.error("Error adding series to Sonarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to add series to Sonarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "remove") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a series name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        const seriesUrl = `${SONARR_URL}/series`;
        const { data: allSeries } = await axios.get(seriesUrl, {
          headers: { "X-Api-Key": SONARR_TOKEN },
        });
        const found = allSeries.find((s: any) => s.title.toLowerCase() === query.toLowerCase());
        if (!found) {
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No series found for "${query}" in Sonarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        const deleteUrl = `${SONARR_URL}/series/${found.id}?deleteFiles=true&addImportListExclusion=false`;
        await axios.delete(deleteUrl, {
          headers: { "X-Api-Key": SONARR_TOKEN },
        });
        logInfo("SONARR", `${interaction.user.id} -> ${found.title} -> remove`);
        const embed = createEmbedTemplate(
          "✅ » Series Removed",
          `Series **${found.title}** has been removed from Sonarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error("Error removing series from Sonarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to remove series from Sonarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "calendar") {
      try {
        const today = new Date();
        const start = today.toISOString().split("T")[0];
        const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const end = endDate.toISOString().split("T")[0];
        const calendarUrl = `${SONARR_URL}/calendar?start=${start}&end=${end}`;
        const { data: episodes } = await axios.get(calendarUrl, {
          headers: { "X-Api-Key": SONARR_TOKEN },
        });
        if (!episodes.length) {
          const embed = new EmbedBuilder()
            .setTitle("📅 Sonarr Calendar")
            .setDescription("No upcoming episodes found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed]});
        }
        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(episodes.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = episodes.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice.map((ep: any) => {
            const seriesTitle = ep.series?.title || ep.title || "?";
            return `**${seriesTitle}**\nS${ep.seasonNumber}E${ep.episodeNumber} — ${ep.title}\n📅 Airs: ${ep.airDateUtc ? new Date(ep.airDateUtc).toLocaleString() : "?"}`;
          }).join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Sonarr Calendar — Page ${page + 1}/${totalPages}`)
            .setDescription(desc)
            .setColor("Blue");
        };
        const getRow = (page: number) => new ActionRowBuilder<ButtonBuilder>().addComponents(
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
          components: totalPages > 1 ? [getRow(page)] : []
        });
        if (totalPages > 1) {
          const collector = interaction.channel?.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            componentType: ComponentType.Button,
            time: 60000,
          });
          if (!collector) return;
          collector.on("collect", async i => {
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
      } catch (error) {
        console.error("Error fetching Sonarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription("Failed to fetch Sonarr calendar. Please try again later.")
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
