import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.TOKEN) {
  throw new Error("⚠️ Environment variable TOKEN is not defined.");
}

export const ENV = {
  TOKEN: process.env.TOKEN,
};
