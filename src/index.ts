import { Client, Collection } from "discord.js";
import path from "path";
import { intents } from "./client/intents.js";
import { partials } from "./client/partials.js";
import { ENV } from "./config/env.js";
import { readCommands } from "./Handler/commandHandler.js";
import { readEvents } from "./Handler/eventHandler";
import { Command, CustomClient } from "./Request/customclient.js";
import { logError } from "./utils/logger.js";

export const client = new Client({
  intents,
  partials,
}) as CustomClient;

async function main() {
  try {
    await client.login(ENV.TOKEN);

    client.commands = new Collection<string, Command>();
    client.cooldowns = new Collection<string, Collection<string, number>>();

    readCommands(client, path.join(__dirname, "commands"));
    readEvents(client, path.join(__dirname, "events"));
  } catch (error) {
    logError("Error during bot initialization", error);
    process.exit(1);
  }
}
main();

process.on("uncaughtException", (error) =>
  logError("Uncaught Exception", error)
);
process.on("unhandledRejection", (reason) =>
  logError("Unhandled Rejection", reason)
);
