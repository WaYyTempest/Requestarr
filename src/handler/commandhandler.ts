import { promises as fs } from "fs";
import path from "path";
import { CustomClient } from "../requestarr/customclient";

export async function readCommands(client: CustomClient, dir: string) {
  try {
    const files = await fs.readdir(dir);

    await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await readCommands(client, fullPath);
        } else if (file.endsWith(".js") || file.endsWith(".ts")) {
          try {
            const command = await import(fullPath);

            if (command.data && command.data.name) {
              client.commands.set(command.data.name, command);
            } else {
              console.error(
                `❌ Error in file ${file}: 'data' property is missing or 'name' is not defined.`
              );
            }
          } catch (error) {
            console.error(
              `⚠️ Failed to load command from file ${file}:`,
              error
            );
          }
        }
      })
    );
  } catch (error) {
    console.error(`⚠️ Failed to read directory ${dir}:`, error);
  }
}
