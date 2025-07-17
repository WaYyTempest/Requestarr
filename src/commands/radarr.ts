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
import { CustomClient } from "../Requestarr/customclient";
import { logInfo } from "../utils/logger";

dotenv.config();

const RADARR_URL = `${process.env.RADARR_URL}/api/v3`;
const RADARR_TOKEN = process.env.RADARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radarr")
    .setDescription("Manage movies in Radarr")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("➕ Add a movie to Radarr")
        .addStringOption(option =>
          option.setName("query").setDescription("Movie name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a movie from Radarr")
        .addStringOption(option =>
          option.setName("query").setDescription("Movie name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("calendar")
        .setDescription("📅 Show upcoming Radarr movies")
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
      // Handle adding a movie to Radarr
      if (!query) {
        // Reply if no query provided
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a movie name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // If the query is a number, treat it as a TMDb ID
        let searchTerm = query;
        if (/^\d+$/.test(query)) {
          searchTerm = `tmdb:${query}`;
        }
        // Search for the movie in Radarr
        const searchUrl = `${RADARR_URL}/movie/lookup?term=${encodeURIComponent(searchTerm)}`;
        const { data } = await axios.get(searchUrl, {
          headers: { "X-Api-Key": RADARR_TOKEN },
        });

        // If no results, reply to user
        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No movie found for "${query}" in Radarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get the root folder path from Radarr
        const rootFoldersUrl = `${RADARR_URL}/rootfolder`;
        const { data: rootFolders } = await axios.get(rootFoldersUrl, {
          headers: { "X-Api-Key": RADARR_TOKEN },
        });
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No root folder found in Radarr. Please configure one in Radarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (data.length === 1) {
          const movie = data[0];
          // Check if the movie already exists in the library
          const moviesUrl = `${RADARR_URL}/movie`;
          const { data: allMovies } = await axios.get(moviesUrl, {
            headers: { "X-Api-Key": RADARR_TOKEN },
          });
          const alreadyExists = allMovies.some((m: any) => m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug);
          if (alreadyExists) {
            // If the movie exists but is not monitored, enable monitoring
            const existingMovie = allMovies.find((m: any) => m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug);
            if (existingMovie && !existingMovie.monitored) {
              const updateUrl = `${RADARR_URL}/movie/${existingMovie.id}`;
              await axios.put(updateUrl, { ...existingMovie, monitored: true }, {
                headers: { "X-Api-Key": RADARR_TOKEN },
              });
              const embed = createEmbedTemplate(
                "✅ » Monitoring Enabled",
                `The movie **${movie.title}** is already in the Radarr library and is now set to monitored!`,
                interaction.user
              ).setColor("Green");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
              // Reply if already present and monitored
              const embed = createEmbedTemplate(
                "ℹ️ » Already Present",
                `The movie **${movie.title}** is already in the Radarr library!`,
                interaction.user
              ).setColor("Yellow");
              return interaction.reply({ embeds: [embed], ephemeral: true });
            }
          }
          // Add the movie to Radarr
          const addUrl = `${RADARR_URL}/movie`;
          const addPayload = {
            title: movie.title,
            qualityProfileId: 1,
            titleSlug: movie.titleSlug,
            images: movie.images,
            tmdbId: movie.tmdbId,
            year: movie.year,
            rootFolderPath,
            monitored: true,
            addOptions: { searchForMovie: true },
          };
          await axios.post(addUrl, addPayload, {
            headers: { "X-Api-Key": RADARR_TOKEN },
          });
          const embed = createEmbedTemplate(
            "✅ » Movie Added",
            `Successfully added **${movie.title}** to Radarr!`,
            interaction.user
          ).setColor("Green");
          return interaction.reply({ embeds: [embed] });
        }

        // If multiple results, show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
        const getEmbed = (page: number) => {
          const movie = data[page];
          const poster = movie.images?.find((img: any) => img.coverType === "poster")?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(movie.title)
            .setDescription(`**Year:** ${movie.year}\n**TMDB ID:** ${movie.tmdbId}`)
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
        // Create a collector for button navigation
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
            const movie = data[page];
            // Check if the movie already exists in the library
            const moviesUrl = `${RADARR_URL}/movie`;
            const { data: allMovies } = await axios.get(moviesUrl, {
              headers: { "X-Api-Key": RADARR_TOKEN },
            });
            const alreadyExists = allMovies.some((m: any) => m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug);
            if (alreadyExists) {
              const existingMovie = allMovies.find((m: any) => m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug);
              if (existingMovie && !existingMovie.monitored) {
                const updateUrl = `${RADARR_URL}/movie/${existingMovie.id}`;
                await axios.put(updateUrl, { ...existingMovie, monitored: true }, {
                  headers: { "X-Api-Key": RADARR_TOKEN },
                });
                const embed = createEmbedTemplate(
                  "✅ » Monitoring Enabled",
                  `The movie **${movie.title}** is already in the Radarr library and is now set to monitored!`,
                  interaction.user
                ).setColor("Green");
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
                logInfo("RADARR", `${interaction.user.id} -> ${movie.title} -> monitoring enabled`);
              } else {
                const embed = createEmbedTemplate(
                  "ℹ️ » Already Present",
                  `The movie **${movie.title}** is already in the Radarr library!`,
                  interaction.user
                ).setColor("Yellow");
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
              }
              return;
            }
            // Add the movie to Radarr
            const addUrl = `${RADARR_URL}/movie`;
            const addPayload = {
              title: movie.title,
              qualityProfileId: 1,
              titleSlug: String(movie.titleSlug),
              images: movie.images,
              tmdbId: movie.tmdbId,
              year: movie.year,
              rootFolderPath,
              monitored: true,
              addOptions: { searchForMovie: true },
            };
            try {
              await axios.post(addUrl, addPayload, {
                headers: { "X-Api-Key": RADARR_TOKEN },
              });
              const embed = createEmbedTemplate(
                "✅ » Movie Added",
                `Successfully added **${movie.title}** to Radarr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              logInfo("RADARR", `${interaction.user.id} -> ${movie.title} -> add`);
            } catch (error) {
              const embed = createEmbedTemplate(
                "❌ » Error",
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
      } catch (error) {
        // Log and reply on error
        console.error("Error adding movie to Radarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
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
          "⚠️ » Error",
          "Please provide a movie name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all movies and find the one to remove
        const moviesUrl = `${RADARR_URL}/movie`;
        const { data: allMovies } = await axios.get(moviesUrl, {
          headers: { "X-Api-Key": RADARR_TOKEN },
        });
        const found = allMovies.find((m: any) => m.title.toLowerCase() === query.toLowerCase());
        if (!found) {
          // Reply if not found
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No movie found for "${query}" in Radarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the movie from Radarr
        const deleteUrl = `${RADARR_URL}/movie/${found.id}?deleteFiles=true&addImportListExclusion=false`;
        await axios.delete(deleteUrl, {
          headers: { "X-Api-Key": RADARR_TOKEN },
        });
        const embed = createEmbedTemplate(
          "✅ » Movie Removed",
          `Movie **${found.title}** has been removed from Radarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error) {
        // Reply on error
        console.error("Error removing movie from Radarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
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
        const calendarUrl = `${RADARR_URL}/calendar?start=${start}&end=${end}`;
        const { data: movies } = await axios.get(calendarUrl, {
          headers: { "X-Api-Key": RADARR_TOKEN },
        });
        if (!movies.length) {
          // Reply if no movies found
          const embed = new EmbedBuilder()
            .setTitle("📅 Radarr Calendar")
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
          const desc = slice.map((movie: any) => {
            const movieTitle = movie.title || "?";
            return `**${movieTitle}**\n📅 In Cinemas: ${movie.inCinemas ? new Date(movie.inCinemas).toLocaleDateString() : "?"}\n🎬 Release: ${movie.digitalRelease ? new Date(movie.digitalRelease).toLocaleDateString() : "?"}`;
          }).join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Radarr Calendar — Page ${page + 1}/${totalPages}`)
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
          components: totalPages > 1 ? [getRow(page)] : [],
        });
        if (totalPages > 1) {
          // Create a collector for calendar navigation
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
        // Reply on error
        console.error("Error fetching Radarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription("Failed to fetch Radarr calendar. Please try again later.")
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
