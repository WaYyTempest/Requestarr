import axios from "axios";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import dotenv from "dotenv";
import { createEmbedTemplate } from "../../modules/embed";
import { CustomClient } from "../../Requestarr/customclient";
import { logInfo } from "../../utils/logger";

dotenv.config();

const LIDARR_URL = `${process.env.LIDARR_URL}/api/v1`;
const LIDARR_TOKEN = process.env.LIDARR_TOKEN;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lidarr")
    .setDescription("Manage artists in Lidarr")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("➕ Add an artist to Lidarr")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Artist name or MusicBrainz ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("❌ Remove an artist from Lidarr")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Artist name")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("calendar").setDescription("📅 Show upcoming Lidarr releases")
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    if (
      process.env.PUBLIC_ARR !== "true" &&
      interaction.user.id !== process.env.OWNER
    ) {
      const embed = createEmbedTemplate(
        "Command Disabled",
        "This command is currently disabled for the public. To allow access, set PUBLIC_ARR=true in the environment.",
        interaction.user
      ).setColor("Orange");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    const query = interaction.options.getString("query");

    if (sub === "add") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide an artist name or MusicBrainz ID.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Search for the artist in Lidarr
        const searchUrl = `${LIDARR_URL}/artist/lookup?term=${encodeURIComponent(
          query
        )}`;
        const { data } = await axios.get(searchUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No artist found for "${query}" in Lidarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Get the root folder path from Lidarr
        const rootFoldersUrl = `${LIDARR_URL}/rootfolder`;
        const { data: rootFolders } = await axios.get(rootFoldersUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No root folder found in Lidarr. Please configure one in Lidarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Get a valid quality profile ID from Lidarr
        const qualityProfilesUrl = `${LIDARR_URL}/qualityProfile`;
        const { data: qualityProfiles } = await axios.get(qualityProfilesUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        const qualityProfileId = qualityProfiles[0]?.id;
        if (!qualityProfileId) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No quality profile found in Lidarr. Please configure one in Lidarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (data.length === 1) {
          const artist = data[0];
          // Check if the artist already exists in the library
          const artistsUrl = `${LIDARR_URL}/artist`;
          const { data: allArtists } = await axios.get(artistsUrl, {
            headers: { "X-Api-Key": LIDARR_TOKEN },
          });
          const alreadyExists = allArtists.some(
            (a: any) =>
              a.artistName.toLowerCase() === artist.artistName.toLowerCase() ||
              a.foreignArtistId === artist.foreignArtistId
          );
          if (alreadyExists) {
            const embed = createEmbedTemplate(
              "ℹ️ » Already Present",
              `The artist **${artist.artistName}** is already in the Lidarr library!`,
              interaction.user
            ).setColor("Yellow");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          // Add the artist to Lidarr
          const addUrl = `${LIDARR_URL}/artist`;
          const addPayload = {
            artistName: artist.artistName,
            qualityProfileId: qualityProfileId,
            foreignArtistId: artist.foreignArtistId,
            images: artist.images,
            rootFolderPath,
            monitored: true,
            addOptions: { searchForMissingAlbums: true },
          };
          try {
            await axios.post(addUrl, addPayload, {
              headers: { "X-Api-Key": LIDARR_TOKEN },
            });
            const embed = createEmbedTemplate(
              "✅ » Artist Added",
              `Successfully added **${artist.artistName}** to Lidarr!`,
              interaction.user
            ).setColor("Green");
            return interaction.reply({ embeds: [embed] });
          } catch (error: any) {
            console.error(
              "Error adding artist to Lidarr:",
              error?.response?.data || error
            );
            const embed = createEmbedTemplate(
              "❌ » Error",
              `Failed to add **${artist.artistName}** to Lidarr. Please try again later.`,
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }
        // Multiple results: show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
        const getEmbed = (page: number) => {
          const artist = data[page];
          const poster = artist.images?.find(
            (img: any) => img.coverType === "poster"
          )?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(artist.artistName)
            .setDescription(`**MusicBrainz ID:** ${artist.foreignArtistId}`)
            .setImage(poster || null)
            .setFooter({ text: `Result ${page + 1}/${totalPages}` })
            .setColor("Blue");
        };
        const getRow = (page: number) =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("grab")
              .setLabel("Grab")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId("next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page >= totalPages - 1)
          );
        await interaction.reply({
          embeds: [getEmbed(page)],
          components: [getRow(page)],
        });
        const collector = interaction.channel?.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 60000,
        });
        if (!collector) return;
        collector.on("collect", async (i) => {
          if (i.customId === "prev" && page > 0) page--;
          if (i.customId === "next" && page < totalPages - 1) page++;
          if (i.customId === "grab") {
            const artist = data[page];
            // Check if the artist already exists in the library
            const artistsUrl = `${LIDARR_URL}/artist`;
            const { data: allArtists } = await axios.get(artistsUrl, {
              headers: { "X-Api-Key": LIDARR_TOKEN },
            });
            const alreadyExists = allArtists.some(
              (a: any) =>
                a.artistName.toLowerCase() ===
                  artist.artistName.toLowerCase() ||
                a.foreignArtistId === artist.foreignArtistId
            );
            if (alreadyExists) {
              const embed = createEmbedTemplate(
                "ℹ️ » Already Present",
                `The artist **${artist.artistName}** is already in the Lidarr library!`,
                interaction.user
              ).setColor("Yellow");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              return;
            }
            // Add the artist to Lidarr
            const addUrl = `${LIDARR_URL}/artist`;
            const addPayload = {
              artistName: artist.artistName,
              qualityProfileId: qualityProfileId,
              foreignArtistId: artist.foreignArtistId,
              images: artist.images,
              rootFolderPath,
              monitored: true,
              addOptions: { searchForMissingAlbums: true },
            };
            try {
              await axios.post(addUrl, addPayload, {
                headers: { "X-Api-Key": LIDARR_TOKEN },
              });
              const embed = createEmbedTemplate(
                "✅ » Artist Added",
                `Successfully added **${artist.artistName}** to Lidarr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              logInfo(
                "LIDARR",
                `${interaction.user.id} -> ${artist.artistName} -> add`
              );
            } catch (error: any) {
              console.error(
                "Error adding artist to Lidarr:",
                error?.response?.data || error
              );
              const embed = createEmbedTemplate(
                "❌ » Error",
                `Failed to add **${artist.artistName}** to Lidarr. Please try again later.`,
                interaction.user
              ).setColor("Red");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
            }
            return;
          }
          await i.update({
            embeds: [getEmbed(page)],
            components: [getRow(page)],
          });
        });
        collector.on("end", async () => {
          try {
            await interaction.editReply({ components: [] });
          } catch {}
        });
        return;
      } catch (error: any) {
        console.error(
          "Error adding artist to Lidarr:",
          error?.response?.data || error
        );
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to add artist to Lidarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
    if (sub === "remove") {
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide an artist name.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all artists and find the one to remove
        const artistsUrl = `${LIDARR_URL}/artist`;
        const { data: allArtists } = await axios.get(artistsUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        const found = allArtists.find(
          (a: any) => a.artistName.toLowerCase() === query.toLowerCase()
        );
        if (!found) {
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No artist found for "${query}" in Lidarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the artist from Lidarr
        const deleteUrl = `${LIDARR_URL}/artist/${found.id}?deleteFiles=true&addImportListExclusion=false`;
        await axios.delete(deleteUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        const embed = createEmbedTemplate(
          "✅ » Artist Removed",
          `Artist **${found.artistName}** has been removed from Lidarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error: any) {
        console.error("Error removing artist from Lidarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to remove artist from Lidarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
    if (sub === "calendar") {
      try {
        const today = new Date();
        const start = today.toISOString().split("T")[0];
        const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const end = endDate.toISOString().split("T")[0];
        const calendarUrl = `${LIDARR_URL}/calendar?start=${start}&end=${end}`;
        const { data: releases } = await axios.get(calendarUrl, {
          headers: { "X-Api-Key": LIDARR_TOKEN },
        });
        if (!releases.length) {
          const embed = new EmbedBuilder()
            .setTitle("📅 Lidarr Calendar")
            .setDescription("No upcoming releases found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Paginate releases, 5 per page
        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(releases.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = releases.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice
            .map((rel: any) => {
              const title = rel.title || "?";
              return `**${title}**\n📅 Release: ${
                rel.releaseDate
                  ? new Date(rel.releaseDate).toLocaleDateString()
                  : "?"
              }\n🎤 Artist: ${rel.artist?.artistName || "?"}`;
            })
            .join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Lidarr Calendar — Page ${page + 1}/${totalPages}`)
            .setDescription(desc)
            .setColor("Blue");
        };
        const getRow = (page: number) =>
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId("next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page >= totalPages - 1)
          );
        await interaction.reply({
          embeds: [getEmbed(page)],
          components: totalPages > 1 ? [getRow(page)] : [],
        });
        if (totalPages > 1) {
          const collector =
            interaction.channel?.createMessageComponentCollector({
              filter: (i) => i.user.id === interaction.user.id,
              componentType: ComponentType.Button,
              time: 60000,
            });
          if (!collector) return;
          collector.on("collect", async (i) => {
            if (i.customId === "prev" && page > 0) page--;
            if (i.customId === "next" && page < totalPages - 1) page++;
            await i.update({
              embeds: [getEmbed(page)],
              components: [getRow(page)],
            });
          });
          collector.on("end", async () => {
            try {
              await interaction.editReply({ components: [] });
            } catch {}
          });
        }
      } catch (error: any) {
        console.error("Error fetching Lidarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to fetch Lidarr calendar. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
