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
import axios from "axios";
import dotenv from "dotenv";
import { createEmbedTemplate } from "../../modules/embed";
import { CustomClient } from "../../Requestarr/customclient";
import { logInfo } from "../../utils/logger";
import { createSecureApiClient, validateEnvironmentVariable, sanitizeSearchQuery } from "../../utils/secure-api";

dotenv.config();

const READARR_URL = validateEnvironmentVariable('READARR_URL', process.env.READARR_URL);
const READARR_TOKEN = validateEnvironmentVariable('READARR_TOKEN', process.env.READARR_TOKEN);

const readarrClient = createSecureApiClient({
  baseURL: `${READARR_URL}/api/v1`,
  apiKey: READARR_TOKEN,
  timeout: 30000,
  maxContentLength: 5242880, // 5MB
  retries: 2
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName("readarr")
    .setDescription("Manage books in Readarr")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("➕ Add a book to Readarr")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Book title, author, ISBN, etc.")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("❌ Remove a book from Readarr")
        .addStringOption((option) =>
          option.setName("query").setDescription("Book title").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("calendar").setDescription("📅 Show upcoming Readarr books")
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    // Restrict command to owner if PUBLIC_ARR is not enabled
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
      // Add a book to Readarr
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a book title, author, or ISBN.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Search for the book in Readarr
        const searchUrl = `${READARR_URL}/book/lookup?term=${encodeURIComponent(
          query
        )}`;
        const { data } = await axios.get(searchUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });

        if (!data.length) {
          const embed = createEmbedTemplate(
            "⚠️ » No Results",
            `No book found for "${query}" in Readarr's database.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get the root folder path from Readarr
        const rootFoldersUrl = `${READARR_URL}/rootfolder`;
        const { data: rootFolders } = await axios.get(rootFoldersUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });
        const rootFolderPath = rootFolders[0]?.path;
        if (!rootFolderPath) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No root folder found in Readarr. Please configure one in Readarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get a valid quality profile ID from Readarr
        const qualityProfilesUrl = `${READARR_URL}/qualityProfile`;
        const { data: qualityProfiles } = await axios.get(qualityProfilesUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });
        const qualityProfileId = qualityProfiles[0]?.id;
        if (!qualityProfileId) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No quality profile found in Readarr. Please configure one in Readarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Get a valid metadata profile ID from Readarr
        const metadataProfilesUrl = `${READARR_URL}/metadataprofile`;
        const { data: metadataProfiles } = await axios.get(
          metadataProfilesUrl,
          {
            headers: { "X-Api-Key": READARR_TOKEN },
          }
        );
        const metadataProfileId = metadataProfiles[0]?.id;
        if (!metadataProfileId) {
          const embed = createEmbedTemplate(
            "❌ » Error",
            "No metadata profile found in Readarr. Please configure one in Readarr first.",
            interaction.user
          ).setColor("Red");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (data.length === 1) {
          const book = data[0];
          // Check if the book already exists in the library
          const booksUrl = `${READARR_URL}/book`;
          const { data: allBooks } = await axios.get(booksUrl, {
            headers: { "X-Api-Key": READARR_TOKEN },
          });
          const alreadyExists = allBooks.some(
            (b: any) =>
              b.foreignBookId === book.foreignBookId ||
              b.titleSlug === book.titleSlug
          );
          if (alreadyExists) {
            const embed = createEmbedTemplate(
              "ℹ️ » Already Present",
              `The book **${book.title}** is already in the Readarr library!`,
              interaction.user
            ).setColor("Yellow");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          // Add the book to Readarr
          const addUrl = `${READARR_URL}/book`;
          const addPayload = {
            monitored: true,
            author: {
              monitored: true,
              qualityProfileId: qualityProfileId,
              metadataProfileId: metadataProfileId,
              foreignAuthorId: book.author.foreignAuthorId,
              rootFolderPath,
              addOptions: { searchForMissingBooks: true, monitored: true },
            },
            editions: book.editions?.map((ed: any) => ({
              title: ed.title,
              titleSlug: ed.titleSlug,
              images: ed.images,
              foreignEditionId: ed.foreignEditionId,
              monitored: true,
              manualAdd: true,
            })),
            foreignBookId: book.foreignBookId,
            addOptions: { searchForNewBook: true },
            tags: [],
          };
          try {
            await axios.post(addUrl, addPayload, {
              headers: { "X-Api-Key": READARR_TOKEN },
            });
            const embed = createEmbedTemplate(
              "✅ » Book Added",
              `Successfully added **${book.title}** to Readarr!`,
              interaction.user
            ).setColor("Green");
            return interaction.reply({ embeds: [embed] });
          } catch (error: any) {
            console.error(
              "Error adding book to Readarr:",
              error?.response?.data || error
            );
            const embed = createEmbedTemplate(
              "❌ » Error",
              `Failed to add **${book.title}** to Readarr. Please try again later.`,
              interaction.user
            ).setColor("Red");
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }

        // Multiple results: show paginated embed with navigation buttons
        let page = 0;
        const totalPages = data.length;
        const getEmbed = (page: number) => {
          const book = data[page];
          const cover = book.images?.find(
            (img: any) => img.coverType === "cover"
          )?.remoteUrl;
          return new EmbedBuilder()
            .setTitle(book.title)
            .setDescription(
              `**Author:** ${book.author?.authorName}\n**Year:** ${
                book.editions?.[0]?.releaseDate?.split("-")[0] || "?"
              }\n**ForeignBookID:** ${book.foreignBookId}`
            )
            .setImage(cover || null)
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
            const book = data[page];
            // Check if the book already exists in the library
            const booksUrl = `${READARR_URL}/book`;
            const { data: allBooks } = await axios.get(booksUrl, {
              headers: { "X-Api-Key": READARR_TOKEN },
            });
            const alreadyExists = allBooks.some(
              (b: any) =>
                b.foreignBookId === book.foreignBookId ||
                b.titleSlug === book.titleSlug
            );
            if (alreadyExists) {
              const embed = createEmbedTemplate(
                "ℹ️ » Already Present",
                `The book **${book.title}** is already in the Readarr library!`,
                interaction.user
              ).setColor("Yellow");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              return;
            }
            // Add the book to Readarr
            const addUrl = `${READARR_URL}/book`;
            const addPayload = {
              monitored: true,
              author: {
                monitored: true,
                qualityProfileId: qualityProfileId,
                metadataProfileId: metadataProfileId,
                foreignAuthorId: book.author.foreignAuthorId,
                rootFolderPath,
                addOptions: { searchForMissingBooks: true, monitored: true },
              },
              editions: book.editions?.map((ed: any) => ({
                title: ed.title,
                titleSlug: ed.titleSlug,
                images: ed.images,
                foreignEditionId: ed.foreignEditionId,
                monitored: true,
                manualAdd: true,
              })),
              foreignBookId: book.foreignBookId,
              addOptions: { searchForNewBook: true },
              tags: [],
            };
            try {
              await axios.post(addUrl, addPayload, {
                headers: { "X-Api-Key": READARR_TOKEN },
              });
              const embed = createEmbedTemplate(
                "✅ » Book Added",
                `Successfully added **${book.title}** to Readarr!`,
                interaction.user
              ).setColor("Green");
              await i.update({ embeds: [embed], components: [] });
              collector.stop();
              logInfo(
                "READARR",
                `${interaction.user.id} -> ${book.title} -> add`
              );
            } catch (error: any) {
              console.error(
                "Error adding book to Readarr:",
                error?.response?.data || error
              );
              const embed = createEmbedTemplate(
                "❌ » Error",
                `Failed to add **${book.title}** to Readarr. Please try again later.`,
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
          "Error adding book to Readarr:",
          error?.response?.data || error
        );
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to add book to Readarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "remove") {
      // Remove a book from Readarr
      if (!query) {
        const embed = createEmbedTemplate(
          "⚠️ » Error",
          "Please provide a book title.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      try {
        // Fetch all books and find the one to remove
        const booksUrl = `${READARR_URL}/book`;
        const { data: allBooks } = await axios.get(booksUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });
        const found = allBooks.find(
          (b: any) => b.title.toLowerCase() === query.toLowerCase()
        );
        if (!found) {
          const embed = createEmbedTemplate(
            "⚠️ » Not Found",
            `No book found for "${query}" in Readarr.`,
            interaction.user
          ).setColor("Yellow");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Remove the book from Readarr
        const deleteUrl = `${READARR_URL}/book/${found.id}?deleteFiles=true&addImportListExclusion=false`;
        await axios.delete(deleteUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });
        const embed = createEmbedTemplate(
          "✅ » Book Removed",
          `Book **${found.title}** has been removed from Readarr.`,
          interaction.user
        ).setColor("Green");
        return interaction.reply({ embeds: [embed] });
      } catch (error: any) {
        console.error("Error removing book from Readarr:", error);
        const embed = createEmbedTemplate(
          "❌ » Error",
          "Failed to remove book from Readarr. Please try again later.",
          interaction.user
        ).setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (sub === "calendar") {
      // Display the Readarr calendar
      try {
        const today = new Date();
        const start = today.toISOString().split("T")[0];
        const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
        const end = endDate.toISOString().split("T")[0];
        const calendarUrl = `${READARR_URL}/calendar?start=${start}&end=${end}`;
        const { data: books } = await axios.get(calendarUrl, {
          headers: { "X-Api-Key": READARR_TOKEN },
        });
        if (!books.length) {
          const embed = new EmbedBuilder()
            .setTitle("📅 Readarr Calendar")
            .setDescription("No upcoming books found.")
            .setColor("Blue");
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        // Paginate books, 5 per page
        const pageSize = 5;
        let page = 0;
        const totalPages = Math.ceil(books.length / pageSize);
        const getEmbed = (page: number) => {
          const slice = books.slice(page * pageSize, (page + 1) * pageSize);
          const desc = slice
            .map((book: any) => {
              const bookTitle = book.title || "?";
              return `**${bookTitle}**\n📅 Release: ${
                book.releaseDate
                  ? new Date(book.releaseDate).toLocaleDateString()
                  : "?"
              }\n✍️ Author: ${book.author?.authorName || "?"}`;
            })
            .join("\n\n");
          return new EmbedBuilder()
            .setTitle(`📅 Readarr Calendar — Page ${page + 1}/${totalPages}`)
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
        console.error("Error fetching Readarr calendar:", error);
        const embed = new EmbedBuilder()
          .setTitle("❌ » Error")
          .setDescription(
            "Failed to fetch Readarr calendar. Please try again later."
          )
          .setColor("Red");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
