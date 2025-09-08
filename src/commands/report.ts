import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("🐛 Report a bug or request a feature on GitHub")
    .addSubcommand((sub) =>
      sub
        .setName("bug")
        .setDescription("🐛 Report a bug")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Brief description of the bug")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Detailed description of what happened")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((option) =>
          option
            .setName("steps")
            .setDescription("Steps to reproduce the bug")
            .setRequired(false)
            .setMaxLength(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("feature")
        .setDescription("✨ Request a new feature")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Brief description of the feature")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Detailed description of the requested feature")
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((option) =>
          option
            .setName("use_case")
            .setDescription("Why would this feature be useful?")
            .setRequired(false)
            .setMaxLength(300)
        )
    ),

  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction & { member: GuildMember }
  ) => {
    const subcommand = interaction.options.getSubcommand();
    const title = interaction.options.getString("title")!;
    const description = interaction.options.getString("description")!;

    if (subcommand === "bug") {
      const steps = interaction.options.getString("steps") || "Not provided";
      
      // Create GitHub issue URL with pre-filled template
      const issueBody = encodeURIComponent(
        `## 🐛 Bug Description
${description}

## 📝 Steps to Reproduce
${steps}

## 🔍 Expected Behavior
<!-- Describe what you expected to happen -->

## 💻 Environment
- **User ID**: ${interaction.user.id}
- **Guild ID**: ${interaction.guildId}
- **Timestamp**: ${new Date().toISOString()}
- **Bot Version**: Latest

## 📎 Additional Information
<!-- Add any additional context, screenshots, or logs here -->`
      );

      let githubUrl = `https://github.com/WaYyTempest/Requestarr/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(`🐛 ${title}`)}&body=${issueBody}`;
      
      // Truncate URL if it exceeds Discord's 512 character limit for button URLs
      if (githubUrl.length > 512) {
        const baseUrl = 'https://github.com/WaYyTempest/Requestarr/issues/new?labels=bug&template=bug_report.md';
        const titleParam = `&title=${encodeURIComponent(`🐛 ${title}`)}`;
        const remainingChars = 512 - baseUrl.length - titleParam.length - 6; // 6 for "&body="
        
        const truncatedBody = issueBody.substring(0, remainingChars - 20) + encodeURIComponent('...\n\n[Content truncated - please provide full details in the issue]');
        githubUrl = `${baseUrl}${titleParam}&body=${truncatedBody}`;
      }

      const embed = createEmbedTemplate(
        "🐛 Bug Report",
        `**Title:** ${title}\n**Description:** ${description.substring(0, 100)}${description.length > 100 ? "..." : ""}\n\nClick the button below to create the issue on GitHub with pre-filled information.`,
        interaction.user
      ).setColor("Red");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("🐛 Create Bug Report")
          .setStyle(ButtonStyle.Link)
          .setURL(githubUrl)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    }

    if (subcommand === "feature") {
      const useCase = interaction.options.getString("use_case") || "Not provided";
      
      // Create GitHub issue URL with pre-filled template
      const issueBody = encodeURIComponent(
        `## ✨ Feature Description
${description}

## 🎯 Use Case
${useCase}

## 💡 Proposed Solution
<!-- Describe how you think this feature should work -->

## 🔄 Alternatives Considered
<!-- Describe any alternative solutions you've considered -->

## 📋 Additional Context
- **Requested by**: ${interaction.user.tag} (${interaction.user.id})
- **Guild ID**: ${interaction.guildId}
- **Timestamp**: ${new Date().toISOString()}

<!-- Add any additional context, mockups, or examples here -->`
      );

      let githubUrl = `https://github.com/WaYyTempest/Requestarr/issues/new?labels=feature%20request&template=feature_request.md&title=${encodeURIComponent(`✨ ${title}`)}&body=${issueBody}`;
      
      // Truncate URL if it exceeds Discord's 512 character limit for button URLs
      if (githubUrl.length > 512) {
        const baseUrl = 'https://github.com/WaYyTempest/Requestarr/issues/new?labels=feature%20request&template=feature_request.md';
        const titleParam = `&title=${encodeURIComponent(`✨ ${title}`)}`;
        const remainingChars = 512 - baseUrl.length - titleParam.length - 6; // 6 for "&body="
        
        const truncatedBody = issueBody.substring(0, remainingChars - 20) + encodeURIComponent('...\n\n[Content truncated - please provide full details in the issue]');
        githubUrl = `${baseUrl}${titleParam}&body=${truncatedBody}`;
      }

      const embed = createEmbedTemplate(
        "✨ Feature Request",
        `**Title:** ${title}\n**Description:** ${description.substring(0, 100)}${description.length > 100 ? "..." : ""}\n\nClick the button below to create the feature request on GitHub with pre-filled information.`,
        interaction.user
      ).setColor("Green");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("✨ Create Feature Request")
          .setStyle(ButtonStyle.Link)
          .setURL(githubUrl)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    }
  },

  cooldown: 30, // 30 seconds cooldown to prevent spam
};