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

interface Series {
  id: number;
  title: string;
  overview?: string;
  airDate?: string;
  year: number;
  tvdbId?: number;
  imdbId?: string;
  images?: Array<{
    coverType: string;
    remoteUrl: string;
  }>;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
}

const PERIOD_COLORS: { [key: string]: ColorResolvable } = {
  today: "#FF0000",
  thisWeek: "#FF8C00", 
  nextWeek: "#32CD32",
  thisMonth: "#1E90FF",
  nextMonth: "#9370DB"
};

const PERIODS = ["today", "thisWeek", "nextWeek", "thisMonth", "nextMonth"];

let sonarrClient: any = null;

function initializeSonarrClient(): boolean {
  try {
    if (sonarrClient) return true;
    
    if (!process.env.SONARR_URL || !process.env.SONARR_TOKEN) {
      console.warn("⚠️ Sonarr environment variables not configured - SeriesSchedule disabled");
      return false;
    }

    const SONARR_URL = validateEnvironmentVariable('SONARR_URL', process.env.SONARR_URL, false);
    const SONARR_TOKEN = validateEnvironmentVariable('SONARR_TOKEN', process.env.SONARR_TOKEN, false);

    if (!SONARR_URL || !SONARR_TOKEN) {
      console.warn("⚠️ Sonarr configuration validation failed - SeriesSchedule disabled");
      return false;
    }

    sonarrClient = createSecureApiClient({
      baseURL: `${SONARR_URL}/api/v3`,
      apiKey: SONARR_TOKEN,
      timeout: 30000,
      maxContentLength: 5242880, // 5MB
      retries: 2
    });

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Sonarr client for SeriesSchedule:", error);
    return false;
  }
}

export async function sendSeriesScheduleWithButtons(client: CustomClient) {
  // Skip if Sonarr environment variables are not configured
  if (!process.env.SONARR_URL || !process.env.SONARR_TOKEN) {
    console.log("ℹ️ Skipping SeriesSchedule - Sonarr environment variables not configured");
    return;
  }

  if (!initializeSonarrClient()) {
    return;
  }

  let periodIndex = 0; // Start with "today"

  // Fetch series for a given period
  const fetchSeriesForPeriod = async (index: number): Promise<Series[]> => {
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

      const { data: episodes } = await sonarrClient.get(`/calendar?start=${start}&end=${end}`);
      return episodes.slice(0, 10); // Limit to 10 episodes to prevent embed overflow
    } catch (error) {
      console.error(`❌ Error fetching series schedule for ${period}:`, error);
      return [];
    }
  };

  // Send the schedule embed and handle button navigation
  const sendSchedule = async (index: number, interaction?: Interaction) => {
    const series = await fetchSeriesForPeriod(index);
    const embed = createSeriesScheduleEmbed(series, index);

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

// Create the embed for the series schedule of a given period
function createSeriesScheduleEmbed(
  episodes: Series[],
  periodIndex: number
): EmbedBuilder {
  const period = PERIODS[periodIndex];
  const color: ColorResolvable = PERIOD_COLORS[period];
  
  let title = "";
  switch (period) {
    case "today":
      title = "📺 Episodes Airing Today";
      break;
    case "thisWeek":
      title = "📺 Episodes This Week";
      break;
    case "nextWeek":
      title = "📺 Episodes Next Week";
      break;
    case "thisMonth":
      title = "📺 Episodes This Month";
      break;
    case "nextMonth":
      title = "📺 Episodes Next Month";
      break;
  }

  let description = "";
  
  if (episodes.length === 0) {
    description = "No upcoming episode releases found for this period.";
  } else {
    description = episodes
      .map((episode) => {
        const imdbLink = episode.imdbId 
          ? `https://www.imdb.com/title/${episode.imdbId}`
          : null;
        const tvdbLink = episode.tvdbId 
          ? `https://thetvdb.com/series/${episode.tvdbId}`
          : null;
        
        const link = imdbLink || tvdbLink;
        const title = link 
          ? `**[${episode.title}](${link})**`
          : `**${episode.title}**`;
        
        const episodeInfo = episode.seasonNumber && episode.episodeNumber
          ? `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
          : "";
        
        const episodeTitle = episode.episodeTitle 
          ? ` - ${episode.episodeTitle}`
          : "";
        
        const airDate = episode.airDate 
          ? `📅 ${new Date(episode.airDate).toLocaleDateString()}`
          : "";
        
        return `${title} ${episodeInfo}${episodeTitle}\n${airDate}`;
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
    .setFooter({ text: `Period: ${capitalize(period)} | Powered by Sonarr` })
    .setTimestamp();
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export const name = "seriesSchedule";
export const execute = async (client: CustomClient) => {
  await sendSeriesScheduleWithButtons(client);
};