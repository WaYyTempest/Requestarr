import { readdirSync, statSync } from "fs";
import path from "path";
import { CustomClient } from "../Requestarr/customclient";

// Recursively reads event files from the given directory and registers them to the client
export function readEvents(client: CustomClient, dir: string) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // If the file is a directory, recursively read its contents
      readEvents(client, fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      try {
        // Dynamically require the event module
        const event = require(fullPath);
        if (event.name && typeof event.execute === "function") {
          if (event.once) {
            // Register one-time event listener
            client.once(event.name, (...args) =>
              event.execute(client, ...args)
            );
          } else {
            // Register recurring event listener
            client.on(event.name, (...args) => event.execute(client, ...args));
          }
        } else {
          // Warn if the event is missing required properties
          console.error(
            `❌ Error in file ${file}: 'name' property or 'execute' function is missing.`
          );
        }
      } catch (error) {
        // Handle errors during dynamic require
        console.error(`⚠️ Failed to load event from file ${file}:`, error);
      }
    }
  }
}
