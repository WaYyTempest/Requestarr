import axios from "axios";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";
interface Anime {
  mal_id: number;
  title: string;
  air_date?: string;
  synopsis?: string;
  image_url?: string;
}

interface AnimeScheduleResponse {
  data: Anime[];
}

interface FavoriteAnime {
  title: string;
  mal_id: number;
}

interface UserStatistics {
  anime: {
    days_watched: number;
    mean_score: number;
    total_entries: number;
    completed: number;
  };
  manga: {
    days_read: number;
    mean_score: number;
    total_entries: number;
    completed: number;
  };
}

interface FavoritesResponse {
  data: {
    anime: Anime[];
  };
}

interface StatisticsResponse {
  data: UserStatistics;
}

interface UserResponse {
  data: {
    id: number;
    name: string;
    image_url: string;
  };
}

const ITEMS_PER_PAGE = 5;

const createEmbed = (
  animes: Anime[],
  page: number,
  totalPages: number,
  user: any
) => {
  const description = animes
    .map(
      (anime) =>
        `**[${anime.title}](https://myanimelist.net/anime/${anime.mal_id})**\n${
          anime.synopsis
            ? anime.synopsis.substring(0, 100) + "..."
            : "No synopsis available."
        }\n`
    )
    .join("\n");

  return createEmbedTemplate(
    `Anime List - Page ${page + 1}/${totalPages}`,
    description,
    user
  ).setColor("DarkPurple");
};

const createButtons = (page: number, totalPages: number) => {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
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
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mal")
    .setDescription("🔍 Search MyAnimeList user stats and anime")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("🔍 Search MAL user stats and favorites (ex: /mal search username:MyAnimeListUser)")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("MyAnimeList username")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("seasonal_anime")
        .setDescription("📅 Show seasonal anime (ex: /mal seasonal_anime season:Spring year:2024)")
        .addStringOption((option) =>
          option
            .setName("season")
            .setDescription("Season")
            .setRequired(true)
            .addChoices(
              { name: "Winter", value: "winter" },
              { name: "Spring", value: "spring" },
              { name: "Summer", value: "summer" },
              { name: "Fall", value: "fall" }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName("year")
            .setDescription("Year (e.g. 2024)")
            .setRequired(true)
        )
    ),
  guildonly: true,
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction
  ) => {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === "search") {
        const username = interaction.options.getString("username");
        if (!username) {
          return interaction.reply({
            content: "⚠️ Please provide a MyAnimeList username.",
            ephemeral: true,
          });
        }

        const { data: userData } = await axios.get<UserResponse>(
          `https://api.jikan.moe/v4/users/${username}`
        );

        if (!userData?.data) {
          return interaction.reply({
            content: `⚠️ User "${username}" not found.`,
            ephemeral: true,
          });
        }

        const { data: statsData } = await axios.get<StatisticsResponse>(
          `https://api.jikan.moe/v4/users/${username}/statistics`
        );

        if (!statsData?.data) {
          return interaction.reply({
            content: `⚠️ Statistics not found for "${username}".`,
            ephemeral: true,
          });
        }

        const { data: favoritesData } = await axios.get<FavoritesResponse>(
          `https://api.jikan.moe/v4/users/${username}/favorites`
        );

        if (!favoritesData?.data?.anime?.length) {
          return interaction.reply({
            content: `⚠️ No favorite anime found for "${username}".`,
            ephemeral: true,
          });
        }

        const stats = statsData.data;
        const favs = favoritesData.data.anime
          .slice(0, 10)
          .map(
            (anime) =>
              `[${anime.title}](https://myanimelist.net/anime/${anime.mal_id})`
          )
          .join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`${username} — MyAnimeList Statistics`)
          .setURL(`https://myanimelist.net/profile/${username}`)
          .setColor("DarkPurple")
          .setThumbnail(userData.data.image_url)
          .addFields(
            {
              name: "Anime Statistics",
              value:
                `**Days Watched:** ${stats.anime.days_watched}\n` +
                `**Average Score:** ${stats.anime.mean_score}\n` +
                `**Total Entries:** ${stats.anime.total_entries}\n` +
                `**Completed:** ${stats.anime.completed}`,
              inline: true,
            },
            {
              name: "Manga Statistics",
              value:
                `**Days Read:** ${stats.manga.days_read}\n` +
                `**Average Score:** ${stats.manga.mean_score}\n` +
                `**Total Entries:** ${stats.manga.total_entries}\n` +
                `**Completed:** ${stats.manga.completed}`,
              inline: true,
            },
            {
              name: "Favorite Anime",
              value: favs || "No favorite anime",
              inline: false,
            }
          );

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === "seasonal_anime") {
        const season = interaction.options.getString("season");
        const year = interaction.options.getInteger("year");

        if (!season || !year) {
          const embed = createEmbedTemplate(
            "⚠️ » Error",
            "Please provide a valid season and year.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
          const { data } = await axios.get<AnimeScheduleResponse>(
            `https://api.jikan.moe/v4/seasons/${year}/${season}`
          );

          if (!data?.data?.length) {
            const embed = createEmbedTemplate(
              "⚠️ » No Anime",
              "No anime found for the selected season and year.",
              interaction.user
            ).setColor("Yellow");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }

          const animes = data.data;
          const totalPages = Math.ceil(animes.length / ITEMS_PER_PAGE);
          let page = 0;

          const embed = createEmbed(
            animes.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
            page,
            totalPages,
            interaction.user
          );
          const buttons = createButtons(page, totalPages);

          const message = await interaction.reply({
            embeds: [embed],
            components: [buttons],
            fetchReply: true,
          });

          const collector = message.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
          });

          collector.on("collect", async (i) => {
            page = i.customId === "prev" ? page - 1 : page + 1;

            const newEmbed = createEmbed(
              animes.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
              page,
              totalPages,
              interaction.user
            );
            const newButtons = createButtons(page, totalPages);

            await i.update({ embeds: [newEmbed], components: [newButtons] });
          });

          collector.on("end", () => {
            message.edit({ components: [] });
          });
        } catch (error) {
          console.error("Error fetching seasonal anime:", error);
          const embed = createEmbedTemplate(
            "❌ » Error",
            "Error fetching seasonal anime. Please try again later.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }
    } catch (error) {
      console.error("Error in MAL command:", error);
      const embed = createEmbedTemplate(
        "❌ » Error",
        "An error occurred while executing the command, please try again later.",
        interaction.user
      ).setColor("Red");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
