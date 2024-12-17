import { Client, Collection } from "discord.js";
import path from "path";
import { intents } from "./client/intents.ts";
import { partials } from "./client/partials.ts";
import { ENV } from "./config/env.ts";
import { readCommands } from "./Handler/commandHandler.ts";
import { readEvents } from "./Handler/eventHandler";
import { Command, CustomClient } from "./Request/customclient.ts";
import { logError } from "./utils/logger.ts";

export const client = new Client({
  intents,
  partials,
}) as CustomClient;

async function main() {
  try {
    await client.login(ENV.TOKEN);

    client.commands = new Collection<string, Command>();
    client.cooldowns = new Collection<string, Collection<string, number>>();

    readCommands(client, ENV.OWNER, path.join(__dirname, "commands"));
    readEvents(client, ENV.OWNER, path.join(__dirname, "events"));
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
