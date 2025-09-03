import dotenv from "dotenv";
import cron from "node-cron";
import packageInfo from "../../package.json";
import { CustomClient } from "../Requestarr/customclient";
import { sendAnimeScheduleWithButtons } from "../events/animeSchedule";
import { formatDate } from "../utils/dateFormatter";
import { generateASCII } from "../utils/generateASCII";
import { setStatus } from "../utils/status";
dotenv.config();
const scheduleExpression = process.env.SCHEDULE_NOTIF ?? "0 8 * * *";

module.exports = {
  name: "ready",
  once: true,
  async execute(client: CustomClient) {
    // Fetch all application commands and print startup info
    await client.application?.commands.fetch();
    const commandCount = client.application?.commands.cache.size ?? 0;
    const formattedDate = formatDate(new Date());
    const serverCount = client.guilds.cache.size;
    const eventCount = client.eventNames().length;
    console.clear();
    const asciiArt = generateASCII("Requestarr");
    // Helper function to center text in the box
    const centerText = (text: string, width: number = 67): string => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2));
      return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
    };

    const details = `
╭─────────────────────────────────────────────────────────────────────╮
│${centerText('System Status')}│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│${centerText(`🟢  Bot Ready    ${client.user?.tag}`)}│
│${centerText(`📅  Timestamp    ${formattedDate}`)}│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│${centerText('Statistics')}│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│${centerText(`📚  Commands     ${commandCount}`)}│
│${centerText(`🎭  Events       ${eventCount}`)}│
│${centerText(`🌐  Servers      ${serverCount}`)}│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│${centerText('Environment')}│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│${centerText(`🔧  Mode         ${process.env.NODE_ENV || 'development'}`)}│
│${centerText(`💾  Redis        ${process.env.NODE_ENV === 'production' ? 'Enabled' : 'Disabled'}`)}│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│${centerText(`❤️   Developed by ${packageInfo.author}`)}│
│                                                                     │
╰─────────────────────────────────────────────────────────────────────╯
`;
    console.log(`${asciiArt}\n${details}`);

    // Set the bot's status and update it every hour
    await setStatus(client);
    setInterval(() => setStatus(client), 3600000);
    // Schedule daily anime notification if enabled
    cron.schedule(scheduleExpression, async () => {
      if (process.env.NOTIF_ANIME !== "false") {
        await sendAnimeScheduleWithButtons(client);
      }
    });
  },
};
