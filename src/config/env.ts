import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.OWNER || !process.env.TOKEN) {
  throw new Error("⚠️ Environment variables OWNER or TOKEN are not defined.");
}

export const ENV = {
  OWNER: process.env.OWNER,
  TOKEN: process.env.TOKEN,
};
