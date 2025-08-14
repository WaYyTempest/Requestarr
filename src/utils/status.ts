import { ActivityType } from "discord.js";
import { CustomClient } from "../Requestarr/customclient";

// Set the bot's Discord status and activity depending on the environment
export async function setStatus(client: CustomClient) {
  const isDevelopment = process.env.NODE_ENV === "development";
  
  // Get status from environment variables with fallbacks
  const developmentStatus = process.env.BOT_STATUS_DEV || "idle";
  const productionStatus = process.env.BOT_STATUS_PROD || "online";
  const status = isDevelopment ? developmentStatus : productionStatus;
  
  // Get activity names from environment variables with fallbacks
  const developmentActivity = process.env.BOT_ACTIVITY_DEV || "🔧 Under Development | Please Check Back Later";
  const productionActivity = process.env.BOT_ACTIVITY_PROD || "Self Hosted";
  
  // Get activity types from environment variables with fallbacks
  const developmentActivityType = getActivityType(process.env.BOT_ACTIVITY_TYPE_DEV) || ActivityType.Playing;
  const productionActivityType = getActivityType(process.env.BOT_ACTIVITY_TYPE_PROD) || ActivityType.Streaming;
  
  const activity = isDevelopment
    ? {
        name: developmentActivity,
        type: developmentActivityType,
      }
    : { 
        name: productionActivity, 
        type: productionActivityType 
      };

  await client.user?.setPresence({
    status: status as any,
    activities: [activity],
  });
}

// Helper function to convert string to ActivityType
function getActivityType(type: string | undefined): ActivityType | undefined {
  if (!type) return undefined;
  
  const typeMap: { [key: string]: ActivityType } = {
    'Playing': ActivityType.Playing,
    'Streaming': ActivityType.Streaming,
    'Listening': ActivityType.Listening,
    'Watching': ActivityType.Watching,
    'Competing': ActivityType.Competing,
  };
  
  return typeMap[type];
}
