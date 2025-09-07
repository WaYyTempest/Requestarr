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

const RADARR_URL = validateEnvironmentVariable('RADARR_URL', process.env.RADARR_URL);
const RADARR_TOKEN = validateEnvironmentVariable('RADARR_TOKEN', process.env.RADARR_TOKEN);

const radarrClient = createSecureApiClient({
  baseURL: `${RADARR_URL}/api/v3`,
  apiKey: RADARR_TOKEN,
  timeout: 30000,
  maxContentLength: 5242880, // 5MB
  retries: 2
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radarr")
    .setDescription("Manage movies in Radarr")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("➕ Add a movie to Radarr")
        .addStringOption((option) =>
          option.setName("query").setDescription("Movie name").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a movie from Radarr")
        .addStringOption((option) =>
          option.setName("query").setDescription("Movie name").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("calendar").setDescription("📅 Show upcoming Radarr movies")
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
      // Add a movie to Radarr
      if (!query) {
        const embed = createEmbedTemplate(
          "``⚠️`` » Error",
          "Please provide a movie name.",
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
              "``⚠️`` » Invalid ID",
              "The provided TMDb ID is invalid.",
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          searchTerm = `tmdb:${sanitizedQuery}`;
        }
        
        // Search for the movie in Radarr
        const { data } = await radarrClient.get(`/movie/lookup?term=${encodeURIComponent(searchTerm)}`);

        // No results found
        if (!data.length) {
          const embed = createEmbedTemplate(
            "``⚠️`` » No Results",
            `No movie found for "${query}" in Radarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get the root folder path from Radarr
        const { data: rootFolders } = await radarrClient.get('/rootfolder');
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "``❌`` » Error",
            "No root folder found in Radarr. Please configure one in Radarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get a valid quality profile ID from Radarr
        const { data: qualityProfiles } = await radarrClient.get('/qualityProfile');
        const qualityProfileId = qualityProfiles[0]?.id;
        if (!qualityProfileId) {
          const embed = createEmbedTemplate(
            "``❌`` » Error",
            "No quality profile found in Radarr. Please configure one in Radarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (data.length === 1) {
          const movie = data[0];
          // Check if the movie already exists in the library
          const { data: allMovies } = await radarrClient.get('/movie');
          const alreadyExists = allMovies.some(
            (m: any) =>
              m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
          );
          if (alreadyExists) {
            // If the movie exists but is not monitored, enable monitoring
            const existingMovie = allMovies.find(
              (m: any) =>
                m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
            );
            if (existingMovie && !existingMovie.monitored) {
              await radarrClient.put(
                `/movie/${existingMovie.id}`,
                { ...existingMovie, monitored: true }
              );
              const embed = createEmbedTemplate(
                "``✅`` » Monitoring Enabled",
                `The movie **${movie.title}** is already in the Radarr library and is now set to monitored!`,
                interaction.user
              ).setColor("Green");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
              // Already present and monitored
              const embed = createEmbedTemplate(
                "``ℹ️`` » Already Present",
                `The movie **${movie.title}** is already in the Radarr library!`,
                interaction.user
              ).setColor("Yellow");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            }
          }
          // Add the movie to Radarr
          const addPayload = {
            title: movie.title,
            qualityProfileId: qualityProfileId,
            titleSlug: movie.titleSlug,
            images: movie.images,
            tmdbId: movie.tmdbId,
            year: movie.year,
            rootFolderPath,
            monitored: true,
            addOptions: { searchForMovie: true },
          };
          try {
            await radarrClient.post('/movie', addPayload);
            const embed = createEmbedTemplate(
              "``✅`` » Movie Added",
              `Successfully added **${movie.title}** to Radarr!`,
              interaction.user
            ).setColor("Green");
            return interaction.reply({ embeds: [embed] });
          } catch (error: any) {
            // Log the detailed error from Radarr
            console.error(
              "Error adding movie to Radarr:",
              error?.response?.data || error
            );
            const embed = createEmbedTemplate(
              "``❌`` » Error",
              `Failed to add **${movie.title}** to Radarr. Please try again later.`,
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }

        // Multiple results: show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
        // Helper to build the embed for a given page
        const getEmbed = (page: number) => {
          const movie = data[page];
          const poster = movie.images?.find(
            (img: any) => img.coverType === "poster"
          )?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(movie.title)
            .setDescription(
              `**Year:** ${movie.year}\n**TMDB ID:** ${movie.tmdbId}`
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
            const movie = data[page];
            // Check if the movie already exists in the library
            const { data: allMovies } = await radarrClient.get('/movie');
            const alreadyExists = allMovies.some(
              (m: any) =>
                m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
            );
            if (alreadyExists) {
              const existingMovie = allMovies.find(
                (m: any) =>
                  m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
              );
              if (existingMovie && !existingMovie.monitored) {
                await radarrClient.put(
                  `/movie/${existingMovie.id}`,
                  { ...existingMovie, monitored: true }
                );
                const embed = createEmbedTemplate(
                  "``✅`` » Monitoring Enabled",
                  `The movie **${movie.title}** is already in the Radarr library and is now set to monitored!`,
                  interaction.user
                ).setColor("Green");
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
                logInfo(
                  "RADARR",
                  `${interaction.user.id} -> ${movie.title} -> monitoring enabled`
                );
              } else {
                const embed = createEmbedTemplate(
                  "``ℹ️`` » Already Present",
                  `The movie **${movie.title}** is already in the Radarr library!`,
                  interaction.user
                ).setColor("Yellow");
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
              }
              return;
            }
            // Add the movie to Radarr
            const addPayload = {
              title: movie.title,
              qualityProfileId: qualityProfileId,
              titleSlug: String(movie.titleSlug),
              images: movie.images,
              tmdbId: movie.tmdbId,
              year: movie.year,
              rootFolderPath,
              monitored: true,
              addOptions: { searchForMovie: true },
            };
            try {
              await radarrClient.post('/movie', addPayload);
              const embed = createEmbedTemplate(
                "``✅`` » Movie Added",
                `Successfully added **${movie.title}** to Radarr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              logInfo(
                "RADARR",
                `${interaction.user.id} -> ${movie.title} -> add`
              );
            } catch (error: any) {
              // Log the detailed error from Radarr
              console.error(
                "Error adding movie to Radarr:",
                error?.response?.data || error
              );
              const embed = createEmbedTemplate(
                "``❌`` » Error",
                `Failed to add **${movie.title}** to Radarr. Please try again later.`,
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
      } catch (error: any) {
        // Log and reply on error
        console.error(
          "Error adding movie to Radarr:",
          error?.response?.data || error
        );
        const embed = createEmbedTemplate(
          "``❌`` » Error",
          "Failed to add movie to Radarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "remove") {
      // Handle removing a movie from Radarr
      if (!query) {
        // Reply if no query provided
        const embed = createEmbedTemplate(
          "``⚠️`` » Error",
          "Please provide a movie name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all movies and find the one to remove
        const { data: allMovies } = await radarrClient.get('/movie');
        const found = allMovies.find(
          (m: any) => m.title.toLowerCase() === query.toLowerCase()
        );
        if (!found) {
          // Reply if not found
          const embed = createEmbedTemplate(
            "``⚠️`` » Not Found",
            `No movie found for "${query}" in Radarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the movie from Radarr
        await radarrClient.delete(`/movie/${found.id}?deleteFiles=true&addImportListExclusion=false`);
        const embed = createEmbedTemplate(
          "``✅`` » Movie Removed",
          `Movie **${found.title}** has been removed from Radarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error: any) {
        // Reply on error
        console.error("Error removing movie from Radarr:", error);
        const embed = createEmbedTemplate(
          "``❌`` » Error",
          "Failed to remove movie from Radarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "calendar") {
      // Handle displaying the Radarr calendar
      try {
        // Get the next 14 days of movies
        const today = new Date();
        const start = today.toISOString().split("T")[0];
        const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const end = endDate.toISOString().split("T")[0];
        const { data: movies } = await radarrClient.get(`/calendar?start=${start}&end=${end}`);
        if (!movies.length) {
          // Reply if no movies found
          const embed = new EmbedBuilder()
            .setTitle("``📅`` Radarr Calendar")
            .setDescription("No upcoming movies found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Paginate movies, 5 per page
        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(movies.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = movies.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice
            .map((movie: any) => {
              const movieTitle = movie.title || "?";
              return `**${movieTitle}**\n📅 In Cinemas: ${
                movie.inCinemas
                  ? new Date(movie.inCinemas).toLocaleDateString()
                  : "?"
              }\n🎬 Release: ${
                movie.digitalRelease
                  ? new Date(movie.digitalRelease).toLocaleDateString()
                  : "?"
              }`;
            })
            .join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Radarr Calendar — Page ${page + 1}/${totalPages}`)
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
      } catch (error: any) {
        // Reply on error
        console.error("Error fetching Radarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("``❌`` » Error")
          .setDescription(
            "Failed to fetch Radarr calendar. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
