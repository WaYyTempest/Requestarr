import axios from "axios";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  EmbedBuilder,
  Interaction,
} from "discord.js";
import { CustomClient } from "../Requestarr/customclient";
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

export async function sendAnimeScheduleWithButtons(client: CustomClient) {
  let dayIndex = getMondayBasedDayIndex();

  // Fetch anime schedule for a given day index
  const fetchAnimeForDay = async (index: number): Promise<Anime[]> => {
    const day = DAYS_OF_WEEK[index];
    try {
      const { data } = await axios.get(
        `https://api.jikan.moe/v4/schedules?filter=${day}&kids=false&unapproved`
      );
      return data.data;
    } catch (error) {
      console.error(`❌ Error fetching anime schedule: ${error}`);
      return [];
    }
  };

  // Send the schedule embed and handle button navigation
  const sendSchedule = async (index: number, interaction?: Interaction) => {
    const animes = await fetchAnimeForDay(index);
    const embed = createAnimeScheduleEmbed(animes, index);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_day")
        .setLabel("⏮️ Previous")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("next_day")
        .setLabel("⏭️ Next")
        .setStyle(ButtonStyle.Primary)
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
        time: 1000 * 60 * 5,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== ownerId) {
          await i.reply({
            content: "You are not authorized to interact with this.",
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "prev_day") {
          dayIndex = (dayIndex + 6) % 7;
        } else if (i.customId === "next_day") {
          dayIndex = (dayIndex + 1) % 7;
        }

        // Update the schedule for the new day
        await sendSchedule(dayIndex, i);
      });

      collector.on("end", async () => {
        try {
          // Remove buttons when collector ends
          await message.edit({ components: [] });
        } catch (e) {}
      });
    }
  };

  await sendSchedule(dayIndex);
}

// Create the embed for the anime schedule of a given day
function createAnimeScheduleEmbed(
  animes: Anime[],
  dayIndex: number
): EmbedBuilder {
  const day = DAYS_OF_WEEK[dayIndex];
  const color: ColorResolvable = DAY_COLORS[day];
  const description = animes
    .map(
      (anime) =>
        `**[${anime.title}](https://myanimelist.net/anime/${anime.mal_id})**`
    )
    .join("\n");

  return new EmbedBuilder()
    .setTitle(`Anime Releases – ${capitalize(day)}`)
    .setColor(color)
    .setDescription(truncateDescription(description))
    .setFooter({ text: `Day of week: ${day}` });
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export const name = "animeSchedule";
export const execute = async (client: CustomClient) => {
  await sendAnimeScheduleWithButtons(client);
};
