// index.js
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const {
  Client, GatewayIntentBits, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  SlashCommandBuilder, REST, Routes
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember, Partials.User]
});

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const SEAL_URL = process.env.SEAL_URL;
const TREATY_URL = process.env.TREATY_URL;
const DISTRICT_URL = process.env.DISTRICT_URL;
const INSTANT_FUNCTION_URL = process.env.INSTANT_FUNCTION_URL || '';

const commands = [
  new SlashCommandBuilder().setName('welcome-test').setDescription('Send the Capitol welcome embed here.'),
  new SlashCommandBuilder().setName('capitol').setDescription('Open a Registry thread with the Capitol.').addStringOption(o =>
    o.setName('message').setDescription('Prompt').setRequired(true)
  )
].map(c => c.toJSON());

client.once('ready', async () => {
  const rest = new REST({version: '10'}).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {body: commands});
  console.log(`Online as ${client.user.tag}`);
});

client.on('guildMemberAdd', async (member) => {
  const ch = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setAuthor({name: 'THE CAPITOL', iconURL: SEAL_URL})
    .setTitle('Department of Registry — Year 0 ADD')
    .setDescription(`Welcome to **Velthrone Society**, Citizen <@${member.id}>.\n\nPlease complete onboarding and select your District.`)
    .addFields([{name: 'GETTING STARTED', value: [
      '• #announcements — Official notices',
      '• #introductions — Present yourself',
      '• #treaty-of-treason — Server laws',
      '• #games-history — Hunger Games archive',
      '• #general-square — Public discourse'
    ].join('\n')}])
    .setThumbnail(SEAL_URL)
    .setFooter({text: 'Issued under authority of the Capitol'})
    .setColor(0xD5C7A1);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Read the Treaty').setURL(TREATY_URL),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Choose District').setURL(DISTRICT_URL)
  );

  await ch.send({embeds: [embed], components: [row]});
});

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === 'welcome-test') {
    const embed = new EmbedBuilder()
      .setAuthor({name: 'THE CAPITOL', iconURL: SEAL_URL})
      .setTitle('Department of Registry — Year 0 ADD')
      .setDescription('Test broadcast. Registry channel link established.')
      .setColor(0xD5C7A1);
    return i.reply({embeds: [embed]});
  }

  if (i.commandName === 'capitol') {
    const prompt = i.options.getString('message');
    await i.deferReply();
    if (!INSTANT_FUNCTION_URL) return i.editReply('Instant function not set.');
    try {
      const resp = await fetch(INSTANT_FUNCTION_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user: i.user.id, guild: i.guildId, message: prompt})
      }).then(r => r.json());
      return i.editReply(resp?.text || 'No response.');
    } catch {
      return i.editReply('Instant function error.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
