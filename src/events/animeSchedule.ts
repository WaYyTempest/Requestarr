import axios from "axios";
import { ColorResolvable, EmbedBuilder } from "discord.js";
import { CustomClient } from "../Request/customclient";
import {
  DAYS_OF_WEEK,
  DAY_COLORS,
  getMondayBasedDayIndex,
  truncateDescription,
} from "../utils/animeUtils";

interface Anime {
  mal_id: number;
  title: string;
  synopsis?: string;
}

export async function getTodayAnime(): Promise<Anime[]> {
  const today = DAYS_OF_WEEK[getMondayBasedDayIndex()];
  try {
    const { data } = await axios.get(
      `https://api.jikan.moe/v4/schedules?filter=${today}`
    );
    return data.data;
  } catch (error) {
    console.error(`❌ Error fetching anime schedule: ${error}`);
    return [];
  }
}

export async function sendTodayAnimeUpdate(client: CustomClient) {
  const animes = await getTodayAnime();
  if (animes.length === 0) return;

  const embed = createDailyEmbed(animes);
  const ownerId = process.env.OWNER;

  if (ownerId) {
    const user = await client.users.fetch(ownerId);
    if (user) {
      await user.send({ embeds: [embed] });
    }
  }
}

function createDailyEmbed(animes: Anime[]) {
  const todayIndex = getMondayBasedDayIndex();
  const today = DAYS_OF_WEEK[todayIndex];
  const color: ColorResolvable = DAY_COLORS[today];
  const description = animes
    .map(
      (anime) =>
        `**[${anime.title}](https://myanimelist.net/anime/${anime.mal_id})**`
    )
    .join("\n");

  return new EmbedBuilder()
    .setTitle("Today's Anime Releases")
    .setColor(color)
    .setDescription(truncateDescription(description))
    .setFooter({ text: `Day of week : ${today}` });
}
