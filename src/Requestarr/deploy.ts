import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "dotenv";
import * as fs from "node:fs/promises";
import * as path from "node:path";

config();

const commandDir = path.join(__dirname, "../commands");
const globalCommands: Array<any> = [];

// Recursively load all command files from the commands directory
async function loadCommands(dir: string) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      await loadCommands(fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      await processCommandFile(fullPath, file);
    }
  }
}

// Process a command file and add it to the global commands list if valid
async function processCommandFile(filePath: string, fileName: string) {
  try {
    const command = require(filePath);
    if (command?.data instanceof SlashCommandBuilder) {
      const commandJSON = command.data.toJSON();
      assignCommandToGlobal(commandJSON);
    } else {
      console.error(`❌ Invalid command structure in file: ${fileName}`);
    }
  } catch (err) {
    console.error(`⚠️ Failed to load command from file: ${fileName}`, err);
  }
}

// Add a command to the global commands array if not already present
function assignCommandToGlobal(commandJSON: any) {
  const { name } = commandJSON;
  if (!globalCommands.some((cmd) => cmd.name === name)) {
    globalCommands.push(commandJSON);
  }
}

// Register all loaded commands with the Discord API
export async function registerCommands() {
  const clientId = process.env.CLIENTID;
  const token = process.env.TOKEN;

  if (!clientId || !token) {
    throw new Error("🚨 Please fill the .env file with CLIENTID and TOKEN.");
  }

  await loadCommands(commandDir);

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await registerGlobalCommands(rest, clientId);
  } catch (error) {
    console.error("❌ Error during command registration:", error);
  }
}

// Log messages only in non-production environments
function log(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(message);
  }
}

// Register global commands with Discord
async function registerGlobalCommands(rest: REST, clientId: string) {
  log(`🔄 Registering ${globalCommands.length} global commands...`);
  await rest.put(Routes.applicationCommands(clientId), {
    body: globalCommands,
  });
  log(`✅ Registered ${globalCommands.length} global commands.`);
}

// Start the registration process and handle fatal errors
registerCommands().catch((err) => console.error("❌ Fatal error:", err));
