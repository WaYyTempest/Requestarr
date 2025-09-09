import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { createEmbedTemplate } from "../modules/embed";
import { CustomClient } from "../Requestarr/customclient";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("🐛 Report issues or ✨ request features")
    .addSubcommand((sub) =>
      sub
        .setName("bug")
        .setDescription("🐛 Report a bug")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("🏷️ Bug title")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("📝 Describe the issue")
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption((option) =>
          option
            .setName("steps")
            .setDescription("🔄 Reproduction steps")
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("feature")
        .setDescription("✨ Request a feature")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("🏷️ Feature title")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("💡 Feature description")
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption((option) =>
          option
            .setName("benefits")
            .setDescription("✨ Why is this useful?")
            .setRequired(false)
            .setMaxLength(500)
        )
    ),
  execute: async (
    client: CustomClient,
    interaction: ChatInputCommandInteraction
  ) => {
    const subcommand = interaction.options.getSubcommand();
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");

    if (!title || !description) {
      const embed = createEmbedTemplate(
        "❌ Missing Information",
        "Title and description are required.",
        interaction.user
      ).setColor("Red");

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (subcommand === "bug") {
      const steps = interaction.options.getString("steps");

      if (!steps) {
        const embed = createEmbedTemplate(
          "❌ Missing Information",
          "Steps are required for bug reports.",
          interaction.user
        ).setColor("Red");

        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      // Create GitHub URL with pre-filled data
      const params = new URLSearchParams({
        template: 'bug_report.yaml',
        labels: 'bug',
        title: `🐛 [BUG] - ${title}`,
        description: encodeURIComponent(description),
        reprod: encodeURIComponent(steps)
      });
      
      const githubUrl = `https://github.com/WaYyTempest/Requestarr/issues/new?${params.toString()}`;

      const embed = createEmbedTemplate(
        "🐛 Bug Report Ready",
        `**🏷️ Title:** \`\`${title}\`\`\n**📝 Description:** \`\`${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\`\`\n**🔄 Steps:** \`\`${steps.substring(0, 100)}${steps.length > 100 ? '...' : ''}\`\`\n\n🚀 Click the button below to create a GitHub issue with pre-filled data.`,
        interaction.user
      ).setColor("#DC143C");

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
      const benefits = interaction.options.getString("benefits");

      // Create GitHub URL with pre-filled data
      const params = new URLSearchParams({
        template: 'feature_request.yaml',
        labels: 'enhancement',
        title: `💡 [FEAT] - ${title}`,
        feature: encodeURIComponent(description)
      });
      
      if (benefits) {
        params.set('benefits', encodeURIComponent(benefits));
      }
      
      const githubUrl = `https://github.com/WaYyTempest/Requestarr/issues/new?${params.toString()}`;

      const embed = createEmbedTemplate(
        "✨ Feature Request Ready",
        `**🏷️ Title:** \`\`${title}\`\`\n**💡 Description:** \`\`${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\`\`${benefits ? `\n**✨ Benefits:** \`\`${benefits.substring(0, 100)}${benefits.length > 100 ? '...' : ''}\`\`` : ''}\n\n🚀 Click the button below to create a GitHub issue with pre-filled data.`,
        interaction.user
      ).setColor("#32CD32");

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

    const embed = createEmbedTemplate(
      "❌ Unknown Subcommand",
      "🤔 Please use `/report bug` or `/report feature`.",
      interaction.user
    ).setColor("Red");

    return interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
  cooldown: 30,
};
