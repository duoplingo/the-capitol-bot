// index.js
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, REST, Routes, Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.GuildMember, Partials.User]
});

// ENV
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;               // optional if you want to register commands guild-scoped
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const SEAL_URL = process.env.SEAL_URL || null;
const TREATY_URL = process.env.TREATY_URL || null;
const DISTRICT_URL = process.env.DISTRICT_URL || null;
const INSTANT_FUNCTION_URL = process.env.INSTANT_FUNCTION_URL || '';

// Slash commands (two small utilities)
const commands = [
  new SlashCommandBuilder()
    .setName('welcome-test')
    .setDescription('Send the Capitol welcome embed in this channel.'),
  new SlashCommandBuilder()
    .setName('capitol')
    .setDescription('Open a Registry thread with the Capitol.')
    .addStringOption(o => o.setName('message')
      .setDescription('What do you want to say to the Capitol?')
      .setRequired(true))
].map(c => c.toJSON());

async function registerCommands() {
  if (!TOKEN) throw new Error('Missing DISCORD_TOKEN');
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await registerCommands();
    console.log('Slash commands registered.');
  } catch (e) {
    console.error('Slash command registration failed:', e.message);
  }
});

// Helper: build welcome embed
function buildWelcomeEmbed(targetUserId) {
  const embed = new EmbedBuilder()
    .setTitle('Capitol Registry: Entry Notice, 0 ADD')
    .setDescription([
      `Welcome, <@${targetUserId}>.`,
      `To enter the Society, acknowledge this notice. You will receive access once processed.`,
      TREATY_URL ? `• Treaty of Treason: ${TREATY_URL}` : null,
      DISTRICT_URL ? `• District Orientation: ${DISTRICT_URL}` : null
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'Issued under authority of the Capitol' });
  if (SEAL_URL) embed.setThumbnail(SEAL_URL);
  return embed;
}

// On member joins: drop the embed with a button
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const ch = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!ch) return;
    const embed = buildWelcomeEmbed(member.id);
    const btn = new ButtonBuilder()
      .setCustomId(`admit:${member.id}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Proceed');
    const row = new ActionRowBuilder().addComponents(btn);
    await ch.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
  } catch (e) {
    console.error('Welcome error:', e.message);
  }
});

// Button → assign role (optional).
// If you auto-assign a role, add CITIZEN_ROLE_ID to your secrets and uncomment lines below.
const CITIZEN_ROLE_ID = process.env.CITIZEN_ROLE_ID || null;

client.on(Events.InteractionCreate, async (i) => {
  if (i.isChatInputCommand()) {
    if (i.commandName === 'welcome-test') {
      const embed = buildWelcomeEmbed(i.user.id);
      const btn = new ButtonBuilder()
        .setCustomId(`admit:${i.user.id}`)
        .setStyle(ButtonStyle.Primary)
        .setLabel('Proceed');
      const row = new ActionRowBuilder().addComponents(btn);
      return i.reply({ embeds: [embed], components: [row] });
    }

    if (i.commandName === 'capitol') {
      await i.deferReply({ ephemeral: true });
      const prompt = i.options.getString('message', true);
      if (!INSTANT_FUNCTION_URL) {
        return i.editReply('No Instant function configured.');
      }
      try {
        const resp = await fetch(INSTANT_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: i.user.id, guild: i.guildId, message: prompt })
        }).then(r => r.json());
        return i.editReply(resp?.text || 'No response.');
      } catch {
        return i.editReply('Instant function error.');
      }
    }
  }

  if (i.isButton()) {
    const [key, userId] = i.customId.split(':');
    if (key !== 'admit') return;
    if (i.user.id !== userId) {
      return i.reply({ content: 'This entry notice is not assigned to you.', ephemeral: true });
    }
    if (!CITIZEN_ROLE_ID) {
      return i.reply({ content: 'No role configured. Contact staff.', ephemeral: true });
    }
    try {
      const role = i.guild.roles.cache.get(CITIZEN_ROLE_ID);
      if (!role) return i.reply({ content: 'Role not found. Contact staff.', ephemeral: true });
      const member = await i.guild.members.fetch(userId);
      await member.roles.add(role, 'Registry acknowledgment');
      await i.update({ components: [] });
      await i.followUp({ content: 'Access granted. Proceed to #introductions.', ephemeral: true });
    } catch (e) {
      console.error('Admit error:', e.message);
      if (i.deferred || i.replied) {
        await i.followUp({ content: 'Something went wrong. Staff has been notified.', ephemeral: true });
      } else {
        await i.reply({ content: 'Something went wrong. Staff has been notified.', ephemeral: true });
      }
    }
  }
});

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in environment.');
  process.exit(1);
}
client.login(TOKEN);