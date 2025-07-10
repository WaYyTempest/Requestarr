import dotenv from "dotenv";
import cron from "node-cron";
import { CustomClient } from "../Requestarr/customclient";
import { sendAnimeScheduleWithButtons } from "../events/animeSchedule";
import { formatDate } from "../utils/dateFormatter";
import { generateASCII } from "../utils/generateASCII";
import { setStatus } from "../utils/status";
dotenv.config();

module.exports = {
  name: "ready",
  once: true,
  async execute(client: CustomClient) {
    await client.application?.commands.fetch();
    const commandCount = client.application?.commands.cache.size ?? 0;
    const formattedDate = formatDate(new Date());
    const serverCount = client.guilds.cache.size;
    const eventCount = client.eventNames().length;
    console.clear();
    const asciiArt = generateASCII("Requestarr");
    const details = `
[${formattedDate}] 🚀 ${client.user?.tag} is up and ready to serve

[${formattedDate}] 📚 ${commandCount} commands successfully loaded

[${formattedDate}] 🎭 ${eventCount} events successfully loaded

[${formattedDate}] 🌐 Connected to ${serverCount} servers

[${formattedDate}] ❤️ Developed by WaYy Tempest
`;
    console.log(`${asciiArt}\n${details}`);

    await setStatus(client);
    setInterval(() => setStatus(client), 3600000);
    cron.schedule("0 1 * * *", async () => {
      if (process.env.NOTIF_ANIME !== "false") {
        await sendAnimeScheduleWithButtons(client);
      }
    });
  },
};
