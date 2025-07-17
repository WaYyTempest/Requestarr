import { Client, Collection, EmbedBuilder } from "discord.js";
import Redis from "ioredis";
import path from "path";
import { intents } from "./client/intents";
import { partials } from "./client/partials";
import { ENV } from "./config/env";
import { readCommands } from "./handler/commandhandler";
import { readEvents } from "./handler/eventhandler";
import { Command, CustomClient } from "./Requestarr/customclient";
import { registerCommands } from "./Requestarr/deploy";
import { logError, logInfo } from "./utils/logger";

const isDev = process.env.NODE_ENV === "development";
const userMP = process.env.OWNER;

// Initialize Redis only in production mode
let redis: Redis | null = null;
if (!isDev) {
  redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis();
}

// Create the Discord client with custom properties (CustomClient)
export const client = new Client({
  intents,
  partials,
}) as CustomClient;

// Main async function to initialize the bot
async function main() {
  try {
    // Login to Discord
    await client.login(ENV.TOKEN);

    // Initialize command and cooldown collections
    client.commands = new Collection<string, Command>();
    client.cooldowns = new Collection<string, Collection<string, number>>();
    if (isDev) {
      client.disabledCommands = new Set();
    } else {
      // Load disabled commands from Redis in production
      client.disabledCommands = new Set(
        await redis!.smembers("disabled_commands")
      );
    }

    // Dynamically load commands and events
    readCommands(client, path.join(__dirname, "commands"));
    readEvents(client, path.join(__dirname, "events"));
    // Register slash commands with Discord API
    await registerCommands();
  } catch (error) {
    logError("Error during bot initialization", error);
    process.exit(1);
  }
}
main();

// Global error handler for uncaught exceptions
process.on("uncaughtException", async (error) => {
  logError("Uncaught Exception", error);
  if (!userMP || process.env.TraceError !== "true") return;
  try {
    const user = await client.users.fetch(userMP);
    if (user) {
      const now = new Date();
      const dateStr = `${now.getDate()}/${
        now.getMonth() + 1
      }/${now.getFullYear()} at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      const embedBotCrashed = new EmbedBuilder()
        .setTitle("__Internal Error Detected__")
        .setDescription(
          `<@${userMP}> A crash has been detected! Please investigate.`
        )
        .addFields(
          { name: "Date and Time", value: dateStr, inline: false },
          {
            name: "Error Message",
            value: `\
\
\
${error.message}\
\
\
`,
            inline: false,
          },
          {
            name: "Stack Trace",
            value: `\
\
\
${error.stack ? error.stack : "No stack trace available"}\
\
\
`,
            inline: false,
          },
          {
            name: "Error Source",
            value: `\
\
\
${error.stack ? error.stack.split("\n")[0] : "No source available"}\
\
\
`,
            inline: false,
          },
          { name: "Error Name", value: error.name || "Unknown", inline: true }
        )
        .setColor("DarkRed")
        .setTimestamp()
        .setFooter({
          text: `${client.user?.username} | Error Reporting System`,
          iconURL: client.user?.avatarURL() || undefined,
        });
      user
        .send({ embeds: [embedBotCrashed] })
        .then(() => logInfo("DM", `DM sent to ${user.username}`))
        .catch((err: any) =>
          logError(`Error sending DM to ${user.username}`, err)
        );
    } else {
      logError("User Fetch", `User with ID ${userMP} not found.`);
    }
  } catch (err: any) {
    logError("User Fetch", `Error fetching user with ID ${userMP}`, err);
  }
});

// Global error handler for unhandled promise rejections
process.on("unhandledRejection", async (reason: any) => {
  logError("Unhandled Rejection", reason);
  if (!userMP || process.env.TraceError !== "true") return;
  try {
    const user = await client.users.fetch(userMP);
    if (user) {
      const now = new Date();
      const dateStr = `${now.getDate()}/${
        now.getMonth() + 1
      }/${now.getFullYear()} at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
      const embedBotCrashed = new EmbedBuilder()
        .setTitle("__Unhandled Promise Rejection__")
        .setDescription(
          `<@${userMP}> A crash has been detected! Please investigate.`
        )
        .addFields(
          { name: "Date and Time", value: dateStr, inline: false },
          {
            name: "Error",
            value: `\
\
\
${reason instanceof Error ? reason.message : String(reason)}\
\
\
`,
            inline: false,
          },
          {
            name: "Stack Trace",
            value: `\
\
\
${
  reason instanceof Error && reason.stack
    ? reason.stack
    : "No stack trace available"
}\
\
\
`,
            inline: false,
          },
          {
            name: "Error Source",
            value: `\
\
\
${
  reason instanceof Error && reason.stack
    ? reason.stack.split("\n")[0]
    : "No source available"
}\
\
\
`,
            inline: false,
          }
        )
        .setColor("DarkRed")
        .setTimestamp()
        .setFooter({
          text: `${client.user?.username} | Error Reporting System`,
          iconURL: client.user?.avatarURL() || undefined,
        });
      user
        .send({ embeds: [embedBotCrashed] })
        .then(() => logInfo("DM", `DM sent to ${user.username}`))
        .catch((err: any) =>
          logError(`Error sending DM to ${user.username}`, err)
        );
    } else {
      logError("User Fetch", `User with ID ${userMP} not found.`);
    }
  } catch (err: any) {
    logError("User Fetch", `Error fetching user with ID ${userMP}`, err);
  }
});
