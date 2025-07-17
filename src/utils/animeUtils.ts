import { ColorResolvable } from "discord.js";
import { DateTime } from "luxon";

// Maximum length allowed for Discord embed descriptions
export const MAX_DESCRIPTION_LENGTH = 4096;

// List of days of the week (Monday-based)
export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Color mapping for each day of the week
export const DAY_COLORS: { [key: string]: ColorResolvable } = {
  monday: "Orange",
  tuesday: "Yellow",
  wednesday: "Green",
  thursday: "Blue",
  friday: "Purple",
  saturday: "Gold",
  sunday: "Red",
};

// Truncate a string to fit within Discord's embed description limit
export const truncateDescription = (description: string): string => {
  return description.length > MAX_DESCRIPTION_LENGTH
    ? description.substring(0, MAX_DESCRIPTION_LENGTH - 3) + "..."
    : description;
};

/**
 * @returns {number}
 */
export const getMondayBasedDayIndex = (): number => {
  const day = DateTime.now().setZone("Europe/Paris").weekday;
  return day === 7 ? 6 : day - 1;
};
