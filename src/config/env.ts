import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure required environment variables are defined
if (!process.env.TOKEN) {
  throw new Error("⚠️ Environment variable TOKEN is not defined.");
}
if (!process.env.OWNER) {
  throw new Error("⚠️ Environment variable OWNER is not defined.");
}
if (!process.env.CLIENTID) {
  throw new Error("⚠️ Environment variable CLIENTID is not defined.");
}

// Export validated environment variables for use in the app
export const ENV = {
  TOKEN: process.env.TOKEN,
  OWNER: process.env.OWNER,
  CLIENTID: process.env.CLIENTID,
};
