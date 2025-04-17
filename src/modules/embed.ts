import { Client, EmbedBuilder, User } from "discord.js";

/**
 * Crée un embed de base avec les paramètres fournis.
 * @param title Le titre de l'embed.
 * @param description La description de l'embed.
 * @param interaction L'utilisateur qui a initié l'interaction.
 * @param client Le client Discord pour obtenir le numéro de la shard.
 * @returns Un objet EmbedBuilder configuré.
 */
export function createEmbedTemplate(
  title: string,
  description: string,
  interaction?: User,
  client?: Client
): EmbedBuilder {
  const shardId = client?.shard?.ids[0] ?? "N/A";
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setTimestamp()
    .setFooter({
      text: `Requested by ${interaction?.tag} | Shard: ${shardId}`,
      iconURL: interaction?.displayAvatarURL(),
    });

  if (description && description.length > 0) {
    embed.setDescription(description);
  }

  return embed;
}
