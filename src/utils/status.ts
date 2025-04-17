import { ActivityType } from "discord.js";
import { CustomClient } from "../Request/customclient";

export async function setStatus(client: CustomClient) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const status = isDevelopment ? "idle" : "online";
  const activity = isDevelopment
    ? {
        name: "🔧 Under Development | Please Check Back Later",
        type: ActivityType.Playing,
      }
    : { name: `/help`, type: ActivityType.Listening };

  await client.user?.setPresence({
    status,
    activities: [activity],
  });
}
