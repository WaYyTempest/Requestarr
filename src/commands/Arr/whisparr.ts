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
import { logInfo } from "../../utils/logger";

dotenv.config();

const WHISPARR_URL = `${process.env.WHISPARR_URL}/api/v1`;
const WHISPARR_TOKEN = process.env.WHISPARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("whisparr")
    .setDescription("Manage movies in Whisparr")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("➕ Add a movie to Whisparr")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Movie name or TMDb ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a movie from Whisparr")
        .addStringOption((option) =>
          option.setName("query").setDescription("Movie name").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("calendar").setDescription("📅 Show upcoming Whisparr movies")
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
    const query = interaction.options.getString("query");

    if (sub === "add") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a movie name or TMDb ID.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Support TMDb ID as search term
        let searchTerm = query;
        if (/^\d+$/.test(query)) {
          searchTerm = `tmdb:${query}`;
        }
        // Search for the movie in Whisparr
        const searchUrl = `${WHISPARR_URL}/movie/lookup?term=${encodeURIComponent(
          searchTerm
        )}`;
        const { data } = await axios.get(searchUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No movie found for "${query}" in Whisparr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Get the root folder path from Whisparr
        const rootFoldersUrl = `${WHISPARR_URL}/rootfolder`;
        const { data: rootFolders } = await axios.get(rootFoldersUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No root folder found in Whisparr. Please configure one in Whisparr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Get a valid quality profile ID from Whisparr
        const qualityProfilesUrl = `${WHISPARR_URL}/qualityProfile`;
        const { data: qualityProfiles } = await axios.get(qualityProfilesUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        const qualityProfileId = qualityProfiles[0]?.id;
        if (!qualityProfileId) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No quality profile found in Whisparr. Please configure one in Whisparr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (data.length === 1) {
          const movie = data[0];
          // Check if the movie already exists in the library
          const moviesUrl = `${WHISPARR_URL}/movie`;
          const { data: allMovies } = await axios.get(moviesUrl, {
            headers: { "X-Api-Key": WHISPARR_TOKEN },
          });
          const alreadyExists = allMovies.some(
            (m: any) =>
              m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
          );
          if (alreadyExists) {
            const embed = createEmbedTemplate(
              "ℹ️ » Already Present",
              `The movie **${movie.title}** is already in the Whisparr library!`,
              interaction.user
            ).setColor("Yellow");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          // Add the movie to Whisparr
          const addUrl = `${WHISPARR_URL}/movie`;
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
            await axios.post(addUrl, addPayload, {
              headers: { "X-Api-Key": WHISPARR_TOKEN },
            });
            const embed = createEmbedTemplate(
              "✅ » Movie Added",
              `Successfully added **${movie.title}** to Whisparr!`,
              interaction.user
            ).setColor("Green");
            return interaction.reply({ embeds: [embed] });
          } catch (error: any) {
            console.error(
              "Error adding movie to Whisparr:",
              error?.response?.data || error
            );
            const embed = createEmbedTemplate(
              "❌ » Error",
              `Failed to add **${movie.title}** to Whisparr. Please try again later.`,
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }
        // Multiple results: show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
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
            const moviesUrl = `${WHISPARR_URL}/movie`;
            const { data: allMovies } = await axios.get(moviesUrl, {
              headers: { "X-Api-Key": WHISPARR_TOKEN },
            });
            const alreadyExists = allMovies.some(
              (m: any) =>
                m.tmdbId === movie.tmdbId || m.titleSlug === movie.titleSlug
            );
            if (alreadyExists) {
              const embed = createEmbedTemplate(
                "ℹ️ » Already Present",
                `The movie **${movie.title}** is already in the Whisparr library!`,
                interaction.user
              ).setColor("Yellow");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              return;
            }
            // Add the movie to Whisparr
            const addUrl = `${WHISPARR_URL}/movie`;
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
              await axios.post(addUrl, addPayload, {
                headers: { "X-Api-Key": WHISPARR_TOKEN },
              });
              const embed = createEmbedTemplate(
                "✅ » Movie Added",
                `Successfully added **${movie.title}** to Whisparr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              logInfo(
                "WHISPARR",
                `${interaction.user.id} -> ${movie.title} -> add`
              );
            } catch (error: any) {
              console.error(
                "Error adding movie to Whisparr:",
                error?.response?.data || error
              );
              const embed = createEmbedTemplate(
                "❌ » Error",
                `Failed to add **${movie.title}** to Whisparr. Please try again later.`,
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
        console.error(
          "Error adding movie to Whisparr:",
          error?.response?.data || error
        );
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to add movie to Whisparr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
    if (sub === "remove") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a movie name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all movies and find the one to remove
        const moviesUrl = `${WHISPARR_URL}/movie`;
        const { data: allMovies } = await axios.get(moviesUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        const found = allMovies.find(
          (m: any) => m.title.toLowerCase() === query.toLowerCase()
        );
        if (!found) {
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No movie found for "${query}" in Whisparr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the movie from Whisparr
        const deleteUrl = `${WHISPARR_URL}/movie/${found.id}?deleteFiles=true&addImportListExclusion=false`;
        await axios.delete(deleteUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        const embed = createEmbedTemplate(
          "✅ » Movie Removed",
          `Movie **${found.title}** has been removed from Whisparr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error: any) {
        console.error("Error removing movie from Whisparr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to remove movie from Whisparr. Please try again later.",
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
        const calendarUrl = `${WHISPARR_URL}/calendar?start=${start}&end=${end}`;
        const { data: movies } = await axios.get(calendarUrl, {
          headers: { "X-Api-Key": WHISPARR_TOKEN },
        });
        if (!movies.length) {
          const embed = new EmbedBuilder()
            .setTitle("📅 Whisparr Calendar")
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
            .setTitle(`📅 Whisparr Calendar — Page ${page + 1}/${totalPages}`)
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
        console.error("Error fetching Whisparr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to fetch Whisparr calendar. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
