import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  EmbedBuilder,
  Interaction,
} from "discord.js";
import { CustomClient } from "../Requestarr/customclient";
import { createSecureApiClient, validateEnvironmentVariable } from "../utils/secure-api";
import dotenv from "dotenv";

dotenv.config();

interface Movie {
  id: number;
  title: string;
  overview?: string;
  inCinemas?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  year: number;
  tmdbId?: number;
  images?: Array<{
    coverType: string;
    remoteUrl: string;
  }>;
}

const PERIOD_COLORS: { [key: string]: ColorResolvable } = {
  today: "#FF0000",
  thisWeek: "#FF8C00", 
  nextWeek: "#32CD32",
  thisMonth: "#1E90FF",
  nextMonth: "#9370DB"
};

const PERIODS = ["today", "thisWeek", "nextWeek", "thisMonth", "nextMonth"];

let radarrClient: any = null;

function initializeRadarrClient(): boolean {
  try {
    if (radarrClient) return true;
    
    if (!process.env.RADARR_URL || !process.env.RADARR_TOKEN) {
      console.warn("⚠️ Radarr environment variables not configured - MovieSchedule disabled");
      return false;
    }

    const RADARR_URL = validateEnvironmentVariable('RADARR_URL', process.env.RADARR_URL, false);
    const RADARR_TOKEN = validateEnvironmentVariable('RADARR_TOKEN', process.env.RADARR_TOKEN, false);

    if (!RADARR_URL || !RADARR_TOKEN) {
      console.warn("⚠️ Radarr configuration validation failed - MovieSchedule disabled");
      return false;
    }

    radarrClient = createSecureApiClient({
      baseURL: `${RADARR_URL}/api/v3`,
      apiKey: RADARR_TOKEN,
      timeout: 30000,
      maxContentLength: 5242880, // 5MB
      retries: 2
    });

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Radarr client for MovieSchedule:", error);
    return false;
  }
}

export async function sendMovieScheduleWithButtons(client: CustomClient) {
  // Skip if Radarr environment variables are not configured
  if (!process.env.RADARR_URL || !process.env.RADARR_TOKEN) {
    console.log("ℹ️ Skipping MovieSchedule - Radarr environment variables not configured");
    return;
  }

  if (!initializeRadarrClient()) {
    return;
  }

  let periodIndex = 0; // Start with "today"

  // Fetch movies for a given period
  const fetchMoviesForPeriod = async (index: number): Promise<Movie[]> => {
    const period = PERIODS[index];
    
    try {
      const today = new Date();
      let start: string, end: string;

      switch (period) {
        case "today":
          start = today.toISOString().split("T")[0];
          end = start;
          break;
        case "thisWeek":
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          start = startOfWeek.toISOString().split("T")[0];
          end = endOfWeek.toISOString().split("T")[0];
          break;
        case "nextWeek":
          const nextWeekStart = new Date(today);
          nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
          const nextWeekEnd = new Date(nextWeekStart);
          nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
          start = nextWeekStart.toISOString().split("T")[0];
          end = nextWeekEnd.toISOString().split("T")[0];
          break;
        case "thisMonth":
          const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          start = thisMonthStart.toISOString().split("T")[0];
          end = thisMonthEnd.toISOString().split("T")[0];
          break;
        case "nextMonth":
          const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
          start = nextMonthStart.toISOString().split("T")[0];
          end = nextMonthEnd.toISOString().split("T")[0];
          break;
        default:
          start = today.toISOString().split("T")[0];
          end = start;
      }

      const { data: movies } = await radarrClient.get(`/calendar?start=${start}&end=${end}`);
      return movies.slice(0, 10); // Limit to 10 movies to prevent embed overflow
    } catch (error) {
      console.error(`❌ Error fetching movie schedule for ${period}:`, error);
      return [];
    }
  };

  // Send the schedule embed and handle button navigation
  const sendSchedule = async (index: number, interaction?: Interaction) => {
    const movies = await fetchMoviesForPeriod(index);
    const embed = createMovieScheduleEmbed(movies, index);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_period")
        .setLabel("⏮️ Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setCustomId("next_period")
        .setLabel("⏭️ Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(index === PERIODS.length - 1)
    );

    if (interaction && interaction.isButton()) {
      // Update the message if triggered by a button interaction
      await interaction.update({ embeds: [embed], components: [row] });
    } else {
      const ownerId = process.env.OWNER;
      if (!ownerId) return;

      const user = await client.users.fetch(ownerId);
      if (!user) return;

      // Send the initial schedule to the owner via DM
      const message = await user.send({ embeds: [embed], components: [row] });

      // Collector to handle button navigation
      const collector = message.createMessageComponentCollector({
        time: 1000 * 60 * 5, // 5 minutes
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== ownerId) {
          await i.reply({
            content: "You are not authorized to interact with this.",
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "prev_period" && periodIndex > 0) {
          periodIndex--;
        } else if (i.customId === "next_period" && periodIndex < PERIODS.length - 1) {
          periodIndex++;
        }

        // Update the schedule for the new period
        await sendSchedule(periodIndex, i);
      });

      collector.on("end", async () => {
        try {
          // Remove buttons when collector ends
          await message.edit({ components: [] });
        } catch (e) {}
      });
    }
  };

  await sendSchedule(periodIndex);
}

// Create the embed for the movie schedule of a given period
function createMovieScheduleEmbed(
  movies: Movie[],
  periodIndex: number
): EmbedBuilder {
  const period = PERIODS[periodIndex];
  const color: ColorResolvable = PERIOD_COLORS[period];
  
  let title = "";
  switch (period) {
    case "today":
      title = "🎬 Movies Releasing Today";
      break;
    case "thisWeek":
      title = "🎬 Movies This Week";
      break;
    case "nextWeek":
      title = "🎬 Movies Next Week";
      break;
    case "thisMonth":
      title = "🎬 Movies This Month";
      break;
    case "nextMonth":
      title = "🎬 Movies Next Month";
      break;
  }

  let description = "";
  
  if (movies.length === 0) {
    description = "No upcoming movie releases found for this period.";
  } else {
    description = movies
      .map((movie) => {
        const tmdbLink = movie.tmdbId 
          ? `https://www.themoviedb.org/movie/${movie.tmdbId}`
          : null;
        const title = tmdbLink 
          ? `**[${movie.title}](${tmdbLink})**`
          : `**${movie.title}**`;
        
        const releaseInfo = [];
        if (movie.inCinemas) {
          releaseInfo.push(`🎭 Cinema: ${new Date(movie.inCinemas).toLocaleDateString()}`);
        }
        if (movie.digitalRelease) {
          releaseInfo.push(`💻 Digital: ${new Date(movie.digitalRelease).toLocaleDateString()}`);
        }
        if (movie.physicalRelease) {
          releaseInfo.push(`💿 Physical: ${new Date(movie.physicalRelease).toLocaleDateString()}`);
        }
        
        const info = releaseInfo.length > 0 ? `\n${releaseInfo.join(", ")}` : "";
        return `${title} (${movie.year})${info}`;
      })
      .join("\n\n");
  }

  // Truncate description if too long for Discord embed limit
  if (description.length > 4000) {
    description = description.substring(0, 3900) + "\n\n... and more";
  }

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setFooter({ text: `Period: ${capitalize(period)} | Powered by Radarr` })
    .setTimestamp();
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export const name = "movieSchedule";
export const execute = async (client: CustomClient) => {
  await sendMovieScheduleWithButtons(client);
};