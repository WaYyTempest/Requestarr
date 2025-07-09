import { readdirSync, statSync } from "fs";
import path from "path";
import { CustomClient } from "../Requestarr/customclient";

export function readEvents(client: CustomClient, dir: string) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      readEvents(client, fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".ts")) {
      try {
        const event = require(fullPath);
        if (event.name && typeof event.execute === "function") {
          if (event.once) {
            client.once(event.name, (...args) =>
              event.execute(client, ...args)
            );
          } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
          }
        } else {
          console.error(
            `❌ Error in file ${file}: 'name' property or 'execute' function is missing.`
          );
        }
      } catch (error) {
        console.error(`⚠️ Failed to load event from file ${file}:`, error);
      }
    }
  }
}
