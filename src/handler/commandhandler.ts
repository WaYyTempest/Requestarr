import { promises as fs } from "fs";
import path from "path";
import { CustomClient } from "../Requestarr/customclient";

// Recursively reads command files from the given directory and registers them to the client
export async function readCommands(client: CustomClient, dir: string) {
  try {
    const files = await fs.readdir(dir);

    await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // If the file is a directory, recursively read its contents
          await readCommands(client, fullPath);
        } else if (file.endsWith(".js") || file.endsWith(".ts")) {
          try {
            // Dynamically import the command module
            const command = await import(fullPath);

            if (command.data && command.data.name) {
              // Register the command by its name
              client.commands.set(command.data.name, command);
            } else {
              // Warn if the command is missing required properties
              console.error(
                ` Error in file ${file}: 'data' property is missing or 'name' is not defined.`
              );
            }
          } catch (error) {
            // Handle errors during dynamic import
            console.error(
              ` Failed to load command from file ${file}:`,
              error
            );
          }
        }
      })
    );
  } catch (error) {
    // Handle errors when reading the directory
    console.error(` Failed to read directory ${dir}:`, error);
  }
}
