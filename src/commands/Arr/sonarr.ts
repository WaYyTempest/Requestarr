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
import { logInfo } from "../../utils/logger";
import { createSecureApiClient, validateEnvironmentVariable, sanitizeSearchQuery, validateTmdbId } from "../../utils/secure-api";

dotenv.config();

const SONARR_URL = validateEnvironmentVariable('SONARR_URL', process.env.SONARR_URL);
const SONARR_TOKEN = validateEnvironmentVariable('SONARR_TOKEN', process.env.SONARR_TOKEN);

const sonarrClient = createSecureApiClient({
  baseURL: `${SONARR_URL}/api/v3`,
  apiKey: SONARR_TOKEN,
  timeout: 30000,
  maxContentLength: 5242880, // 5MB
  retries: 2
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sonarr")
    .setDescription("Manage series in Sonarr")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("➕ Add a series to Sonarr (supports TMDb ID)")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Series name or TMDb ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a series from Sonarr (supports TMDb ID)")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Series name or TMDb ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("calendar").setDescription("📅 Show upcoming Sonarr episodes")
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    // Restrict command to owner if PUBLIC_ARR is not enabled
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
    const query = interaction.options.getString("query");

    if (sub === "add") {
      // Add a series to Sonarr
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a series name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        const sanitizedQuery = sanitizeSearchQuery(query);
        
        // Support TMDb ID as search term
        let searchTerm = sanitizedQuery;
        if (/^\d+$/.test(sanitizedQuery)) {
          if (!validateTmdbId(sanitizedQuery)) {
            const embed = createEmbedTemplate(
              "⚠️ » Invalid ID",
              "The provided TMDb ID is invalid.",
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          searchTerm = `tmdb:${sanitizedQuery}`;
        }
        
        // Search for the series in Sonarr
        const { data } = await sonarrClient.get(`/series/lookup?term=${encodeURIComponent(searchTerm)}`);

        // No results found
        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No series found for "${query}" in Sonarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get the root folder path from Sonarr
        const { data: rootFolders } = await sonarrClient.get('/rootfolder');
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
          // Check if the series already exists in the library
          const { data: allSeries } = await sonarrClient.get('/series');
          const alreadyExists = allSeries.some(
            (s: any) =>
              s.tvdbId === serie.tvdbId ||
              s.titleSlug === serie.titleSlug ||
              (s.tmdbId && serie.tmdbId && s.tmdbId === serie.tmdbId)
          );
          if (alreadyExists) {
            // If the series exists but is not monitored, enable monitoring
            const existingSerie = allSeries.find(
              (s: any) =>
                s.tvdbId === serie.tvdbId ||
                s.titleSlug === serie.titleSlug ||
                (s.tmdbId && serie.tmdbId && s.tmdbId === serie.tmdbId)
            );
            if (existingSerie && !existingSerie.monitored) {
              // Monitor all seasons except specials (seasonNumber === 0)
              const seasons = (existingSerie.seasons || []).map(
                (season: any) => ({
                  ...season,
                  monitored: season.seasonNumber !== 0,
                })
              );
              await sonarrClient.put(
                `/series/${existingSerie.id}`,
                { ...existingSerie, monitored: true, seasons }
              );
              const embed = createEmbedTemplate(
                "✅ » Monitoring Enabled",
                `The series **${serie.title}** is already in the Sonarr library and is now set to monitored!`,
                interaction.user
              ).setColor("Green");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
              // Already present and monitored
              const embed = createEmbedTemplate(
                "ℹ️ » Already Present",
                `The series **${serie.title}** is already in the Sonarr library!`,
                interaction.user
              ).setColor("Yellow");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            }
          }
          // Add the series to Sonarr
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
          await sonarrClient.post('/series', addPayload);
          logInfo("SONARR", `${interaction.user.id} -> ${serie.title} -> add`);
          const embed = createEmbedTemplate(
            "✅ » Series Added",
            `Successfully added **${serie.title}** to Sonarr!`,
            interaction.user
          ).setColor("Green");
          return interaction.reply({ embeds: [embed] });
        }

        // Multiple results: show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
        // Helper to build the embed for a given page
        const getEmbed = (page: number) => {
          const serie = data[page];
          const poster = serie.images?.find(
            (img: any) => img.coverType === "poster"
          )?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(serie.title)
            .setDescription(
              `**Year:** ${serie.year}\n**TVDB ID:** ${serie.tvdbId}`
            )
            .setImage(poster || null)
            .setFooter({ text: `Result ${page + 1}/${totalPages}` })
            .setColor("Blue");
        };
        // Helper to build the navigation row for a given page
        const getRow = (page: number) =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
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
          components: [getRow(page)],
        });
        // Collector for button navigation
        const collector = interaction.channel?.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 60000,
        });
        if (!collector) return;
        collector.on("collect", async (i) => {
          if (i.customId === "prev" && page > 0) page--;
          if (i.customId === "next" && page < totalPages - 1) page++;
          if (i.customId === "grab") {
            const serie = data[page];
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
              await sonarrClient.post('/series', addPayload);
              logInfo(
                "SONARR",
                `${interaction.user.id} -> ${serie.title} -> add`
              );
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
            components: [getRow(page)],
          });
        });
        collector.on("end", async () => {
          try {
            await interaction.editReply({ components: [] });
          } catch {}
        });
        return;
      } catch (error) {
        // Log and reply on error
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
      // Handle removing a series from Sonarr
      if (!query) {
        // Reply if no query provided
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a series name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all series and find the one to remove
        const { data: allSeries } = await sonarrClient.get('/series');
        const found = allSeries.find(
          (s: any) => s.title.toLowerCase() === query.toLowerCase()
        );
        if (!found) {
          // Reply if not found
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No series found for "${query}" in Sonarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the series from Sonarr
        await sonarrClient.delete(`/series/${found.id}?deleteFiles=true&addImportListExclusion=false`);
        logInfo("SONARR", `${interaction.user.id} -> ${found.title} -> remove`);
        const embed = createEmbedTemplate(
          "✅ » Series Removed",
          `Series **${found.title}** has been removed from Sonarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        // Reply on error
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
      // Handle displaying the Sonarr calendar
      try {
        // Get the next 14 days of episodes
        const today = new Date();
        const start = today.toISOString().split("T")[0];
        const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const end = endDate.toISOString().split("T")[0];
        const { data: episodes } = await sonarrClient.get(`/calendar?start=${start}&end=${end}`);
        if (!episodes.length) {
          // Reply if no episodes found
          const embed = new EmbedBuilder()
            .setTitle("📅 Sonarr Calendar")
            .setDescription("No upcoming episodes found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed] });
        }
        // Paginate episodes, 5 per page
        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(episodes.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = episodes.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice
            .map((ep: any) => {
              const seriesTitle = ep.series?.title || ep.title || "?";
              return `**${seriesTitle}**\nS${ep.seasonNumber}E${
                ep.episodeNumber
              } — ${ep.title}\n📅 Airs: ${
                ep.airDateUtc ? new Date(ep.airDateUtc).toLocaleString() : "?"
              }`;
            })
            .join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Sonarr Calendar — Page ${page + 1}/${totalPages}`)
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
          // Create a collector for calendar navigation
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
      } catch (error) {
        // Reply on error
        console.error("Error fetching Sonarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to fetch Sonarr calendar. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
