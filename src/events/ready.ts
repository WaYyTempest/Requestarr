import cron from "node-cron";
import { CustomClient } from "../requestarr/customclient";
import { sendTodayAnimeUpdate } from "../events/animeSchedule";
import { formatDate } from "../utils/dateFormatter";
import { generateASCII } from "../utils/generateASCII";
import { setStatus } from "../utils/status";

module.exports = {
  name: "ready",
  once: true,
  async execute(client: CustomClient) {
    await client.application?.commands.fetch();
    const commandCount = client.application?.commands.cache.size ?? 0;
    const formattedDate = formatDate(new Date());
    const serverCount = client.guilds.cache.size;
    const eventCount = client.eventNames().length;

    if (client.shard && client.shard.ids[0] === 0) {
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
    }

    await setStatus(client);
    setInterval(() => setStatus(client), 3600000);
    cron.schedule("0 1 * * *", async () => {
      await sendTodayAnimeUpdate(client);
    });
  },
};
