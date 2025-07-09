import { Client, EmbedBuilder, User, ColorResolvable } from "discord.js";

/**
 * Generates a minimalist and elegant embed.
 * @param title The title of the embed.
 * @param description The description of the embed (optional).
 * @param user The user to display in the footer (optional).
 * @param color The color of the embed (optional, default: Discord blue).
 * @returns A ready-to-use EmbedBuilder.
 */
export function createEmbedTemplate(
  title: string,
  description?: string,
  user?: User,
  color?: ColorResolvable
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color ?? 0x301934)
    .setTimestamp();

  if (description && description.trim().length > 0) {
    embed.setDescription(description.trim());
  }

  if (user) {
    embed.setFooter({
      text: user.tag,
      iconURL: user.displayAvatarURL(),
    });
  }

  return embed;
}
