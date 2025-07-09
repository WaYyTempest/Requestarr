import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.TOKEN) {
  throw new Error("⚠️ Environment variable TOKEN is not defined.");
}
if (!process.env.OWNER) {
  throw new Error("⚠️ Environment variable OWNER is not defined.");
}
if (!process.env.CLIENTID) {
  throw new Error("⚠️ Environment variable CLIENTID is not defined.");
}

export const ENV = {
  TOKEN: process.env.TOKEN,
  OWNER: process.env.OWNER,
  CLIENTID: process.env.CLIENTID,
};
