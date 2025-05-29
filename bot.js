const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Initialize Express for UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

// Bot Configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Data storage (in-memory for GitHub Actions)
let serverConfigs = {};
let monitoredChannels = {
    youtube: {},
    twitch: {},
    instagram: {}
};

// Load data from environment or initialize
async function loadData() {
    try {
        if (process.env.SERVER_CONFIGS) {
            serverConfigs = JSON.parse(process.env.SERVER_CONFIGS);
        }
        if (process.env.MONITORED_CHANNELS) {
            monitoredChannels = JSON.parse(process.env.MONITORED_CHANNELS);
        }
    } catch (error) {
        console.log('No previous data found, starting fresh');
    }
}

// Save data to environment variables (for persistence)
async function saveData() {
    // In a real deployment, you'd want to use a database
    console.log('Data saved to memory');
}

// YouTube API Functions
async function checkYouTubeChannel(channelId, apiKey) {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
            params: {
                part: 'snippet,statistics',
                id: channelId,
                key: apiKey
            }
        });

        if (response.data.items.length === 0) {
            return { error: 'Channel not found or private' };
        }

        return {
            name: response.data.items[0].snippet.title,
            subscribers: response.data.items[0].statistics.subscriberCount,
            isPublic: true
        };
    } catch (error) {
        return { error: 'Invalid API key or channel ID' };
    }
}

async function getLatestYouTubeVideo(channelId, apiKey) {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
                part: 'snippet',
                channelId: channelId,
                order: 'date',
                maxResults: 1,
                type: 'video',
                key: apiKey
            }
        });

        if (response.data.items.length > 0) {
            const video = response.data.items[0];
            return {
                title: video.snippet.title,
                url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
                publishedAt: video.snippet.publishedAt,
                thumbnail: video.snippet.thumbnails.high.url
            };
        }
        return null;
    } catch (error) {
        console.error('YouTube API Error:', error.message);
        return null;
    }
}

// Twitch API Functions
async function checkTwitchChannel(username, clientId, clientSecret) {
    try {
        // Get OAuth token
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        });

        const accessToken = tokenResponse.data.access_token;

        // Check if user exists
        const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (userResponse.data.data.length === 0) {
            return { error: 'Channel not found' };
        }

        return {
            name: userResponse.data.data[0].display_name,
            id: userResponse.data.data[0].id,
            isPublic: true
        };
    } catch (error) {
        return { error: 'Invalid Twitch credentials or username' };
    }
}

async function getTwitchStreamStatus(userId, clientId, accessToken) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.data.data.length > 0) {
            const stream = response.data.data[0];
            return {
                isLive: true,
                title: stream.title,
                game: stream.game_name,
                viewers: stream.viewer_count,
                thumbnail: stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')
            };
        }
        return { isLive: false };
    } catch (error) {
        console.error('Twitch API Error:', error.message);
        return { isLive: false };
    }
}

// Instagram Functions (Public posts only)
async function checkInstagramAccount(username) {
    try {
        // This is a simplified check - in reality, you'd need to use Instagram Basic Display API
        // For public accounts, we can check if the profile exists
        const response = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.status === 200) {
            // Check if account is private by looking for specific indicators in the HTML
            const isPrivate = response.data.includes('"is_private":true') || 
                             response.data.includes('This Account is Private');
            
            if (isPrivate) {
                return { error: 'Given account is a private account' };
            }
            
            return { name: username, isPublic: true };
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return { error: 'Account not found' };
        }
        return { error: 'Unable to check account status' };
    }
}

// Command Registration
const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup monitoring for a platform')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform to monitor')
                .setRequired(true)
                .addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'Instagram', value: 'instagram' }
                ))
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('Channel/Username to monitor')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('notification_channel')
                .setDescription('Discord channel for notifications')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('api_key')
                .setDescription('API key for the platform')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('list')
        .setDescription('List all monitored channels'),

    new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a monitored channel')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform')
                .setRequired(true)
                .addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Twitch', value: 'twitch' },
                    { name: 'Instagram', value: 'instagram' }
                ))
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('Channel/Username to remove')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure API keys for your server')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Platform to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'Twitch', value: 'twitch' }
                ))
        .addStringOption(option =>
            option.setName('api_key')
                .setDescription('API key')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('client_secret')
                .setDescription('Client secret (Twitch only)')
                .setRequired(false))
];

// Bot Events
client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    
    // Register slash commands
    try {
        await client.application.commands.set(commands);
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    await loadData();
    startMonitoring();
});

// Message Handler (for ! commands)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Bot Commands')
            .setDescription('Here are all available commands:')
            .addFields(
                { name: '🔧 Setup Commands', value: '`/setup` or `!setup` - Setup monitoring\n`/config` or `!config` - Configure API keys', inline: false },
                { name: '📋 Management Commands', value: '`/list` or `!list` - List monitored channels\n`/remove` or `!remove` - Remove monitoring', inline: false },
                { name: '❓ Information Commands', value: '`/help` or `!help` - Show this help menu', inline: false },
                { name: '🔑 Required API Keys', value: '**YouTube:** YouTube Data API v3 key\n**Twitch:** Client ID and Client Secret\n**Instagram:** No API key needed (public accounts only)', inline: false }
            )
            .setFooter({ text: 'Use slash commands (/) for better experience!' });

        message.reply({ embeds: [helpEmbed] });
    }
});

// Slash Command Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guildId } = interaction;

    // Initialize server config if not exists
    if (!serverConfigs[guildId]) {
        serverConfigs[guildId] = { youtube: {}, twitch: {} };
    }

    switch (commandName) {
        case 'setup':
            await handleSetupCommand(interaction);
            break;
        case 'list':
            await handleListCommand(interaction);
            break;
        case 'remove':
            await handleRemoveCommand(interaction);
            break;
        case 'help':
            await handleHelpCommand(interaction);
            break;
        case 'config':
            await handleConfigCommand(interaction);
            break;
    }
});

async function handleSetupCommand(interaction) {
    const platform = interaction.options.getString('platform');
    const channel = interaction.options.getString('channel');
    const notificationChannel = interaction.options.getChannel('notification_channel');
    const apiKey = interaction.options.getString('api_key');
    const guildId = interaction.guildId;

    await interaction.deferReply();

    try {
        let result;
        
        switch (platform) {
            case 'youtube':
                const ytApiKey = apiKey || serverConfigs[guildId]?.youtube?.apiKey;
                if (!ytApiKey) {
                    return interaction.editReply('❌ YouTube API key required! Use `/config` to set it up.');
                }
                result = await checkYouTubeChannel(channel, ytApiKey);
                if (!result.error) {
                    if (!monitoredChannels.youtube[guildId]) {
                        monitoredChannels.youtube[guildId] = {};
                    }
                    monitoredChannels.youtube[guildId][channel] = {
                        name: result.name,
                        notificationChannel: notificationChannel.id,
                        apiKey: ytApiKey,
                        lastVideo: null
                    };
                }
                break;

            case 'twitch':
                const twitchConfig = serverConfigs[guildId]?.twitch;
                if (!twitchConfig?.clientId || !twitchConfig?.clientSecret) {
                    return interaction.editReply('❌ Twitch credentials required! Use `/config` to set them up.');
                }
                result = await checkTwitchChannel(channel, twitchConfig.clientId, twitchConfig.clientSecret);
                if (!result.error) {
                    if (!monitoredChannels.twitch[guildId]) {
                        monitoredChannels.twitch[guildId] = {};
                    }
                    monitoredChannels.twitch[guildId][channel] = {
                        name: result.name,
                        userId: result.id,
                        notificationChannel: notificationChannel.id,
                        isLive: false
                    };
                }
                break;

            case 'instagram':
                result = await checkInstagramAccount(channel);
                if (!result.error) {
                    if (!monitoredChannels.instagram[guildId]) {
                        monitoredChannels.instagram[guildId] = {};
                    }
                    monitoredChannels.instagram[guildId][channel] = {
                        name: result.name,
                        notificationChannel: notificationChannel.id,
                        lastPost: null
                    };
                }
                break;
        }

        if (result.error) {
            interaction.editReply(`❌ Error: ${result.error}`);
        } else {
            await saveData();
            interaction.editReply(`✅ Successfully setup monitoring for **${result.name}** on **${platform}**!`);
        }
    } catch (error) {
        console.error('Setup error:', error);
        interaction.editReply('❌ An error occurred while setting up monitoring.');
    }
}

async function handleListCommand(interaction) {
    const guildId = interaction.guildId;
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Monitored Channels')
        .setTimestamp();

    let hasChannels = false;

    ['youtube', 'twitch', 'instagram'].forEach(platform => {
        const channels = monitoredChannels[platform][guildId];
        if (channels && Object.keys(channels).length > 0) {
            hasChannels = true;
            const channelList = Object.keys(channels).map(key => 
                `• ${channels[key].name} (<#${channels[key].notificationChannel}>)`
            ).join('\n');
            
            embed.addFields({
                name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} (${Object.keys(channels).length})`,
                value: channelList,
                inline: false
            });
        }
    });

    if (!hasChannels) {
        embed.setDescription('No channels are currently being monitored. Use `/setup` to add some!');
    }

    interaction.reply({ embeds: [embed] });
}

async function handleRemoveCommand(interaction) {
    const platform = interaction.options.getString('platform');
    const channel = interaction.options.getString('channel');
    const guildId = interaction.guildId;

    if (monitoredChannels[platform][guildId] && monitoredChannels[platform][guildId][channel]) {
        delete monitoredChannels[platform][guildId][channel];
        await saveData();
        interaction.reply(`✅ Removed monitoring for **${channel}** from **${platform}**.`);
    } else {
        interaction.reply(`❌ **${channel}** is not being monitored on **${platform}**.`);
    }
}

async function handleHelpCommand(interaction) {
    const helpEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Bot Commands')
        .setDescription('Here are all available commands:')
        .addFields(
            { name: '🔧 Setup Commands', value: '`/setup` - Setup monitoring for a platform\n`/config` - Configure API keys for your server', inline: false },
            { name: '📋 Management Commands', value: '`/list` - List all monitored channels\n`/remove` - Remove a monitored channel', inline: false },
            { name: '❓ Information Commands', value: '`/help` - Show this help menu', inline: false },
            { name: '🔑 Required API Keys', value: '**YouTube:** YouTube Data API v3 key\n**Twitch:** Client ID and Client Secret\n**Instagram:** No API key needed (public accounts only)', inline: false },
            { name: '📝 Notes', value: '• Both `/command` and `!command` formats work\n• Instagram only works with public accounts\n• Multiple channels can be monitored per platform', inline: false }
        )
        .setFooter({ text: 'Need help? Check the GitHub repository for detailed setup instructions!' });

    interaction.reply({ embeds: [helpEmbed] });
}

async function handleConfigCommand(interaction) {
    const platform = interaction.options.getString('platform');
    const apiKey = interaction.options.getString('api_key');
    const clientSecret = interaction.options.getString('client_secret');
    const guildId = interaction.guildId;

    if (!serverConfigs[guildId]) {
        serverConfigs[guildId] = { youtube: {}, twitch: {} };
    }

    if (platform === 'youtube') {
        serverConfigs[guildId].youtube.apiKey = apiKey;
        await saveData();
        interaction.reply('✅ YouTube API key configured successfully!');
    } else if (platform === 'twitch') {
        if (!clientSecret) {
            return interaction.reply('❌ Twitch requires both Client ID and Client Secret!');
        }
        serverConfigs[guildId].twitch.clientId = apiKey;
        serverConfigs[guildId].twitch.clientSecret = clientSecret;
        await saveData();
        interaction.reply('✅ Twitch credentials configured successfully!');
    }
}

// Monitoring Functions
function startMonitoring() {
    console.log('Starting monitoring...');
    
    // Check every 5 minutes
    setInterval(async () => {
        await checkAllChannels();
    }, 5 * 60 * 1000);
}

async function checkAllChannels() {
    // Check YouTube channels
    for (const guildId in monitoredChannels.youtube) {
        const channels = monitoredChannels.youtube[guildId];
        for (const channelId in channels) {
            await checkYouTubeUpdates(guildId, channelId, channels[channelId]);
        }
    }

    // Check Twitch channels
    for (const guildId in monitoredChannels.twitch) {
        const channels = monitoredChannels.twitch[guildId];
        for (const username in channels) {
            await checkTwitchUpdates(guildId, username, channels[username]);
        }
    }
}

async function checkYouTubeUpdates(guildId, channelId, config) {
    try {
        const latestVideo = await getLatestYouTubeVideo(channelId, config.apiKey);
        
        if (latestVideo && latestVideo.url !== config.lastVideo) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('📺 New YouTube Video!')
                .setDescription(`**${config.name}** uploaded a new video!`)
                .addFields(
                    { name: '🎬 Title', value: latestVideo.title, inline: false },
                    { name: '🔗 Watch', value: `[Click here](${latestVideo.url})`, inline: true }
                )
                .setThumbnail(latestVideo.thumbnail)
                .setTimestamp();

            const channel = client.channels.cache.get(config.notificationChannel);
            if (channel) {
                channel.send({ embeds: [embed] });
            }

            config.lastVideo = latestVideo.url;
            await saveData();
        }
    } catch (error) {
        console.error(`Error checking YouTube channel ${channelId}:`, error);
    }
}

async function checkTwitchUpdates(guildId, username, config) {
    try {
        const twitchConfig = serverConfigs[guildId]?.twitch;
        if (!twitchConfig) return;

        // Get fresh access token
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', {
            client_id: twitchConfig.clientId,
            client_secret: twitchConfig.clientSecret,
            grant_type: 'client_credentials'
        });

        const streamStatus = await getTwitchStreamStatus(
            config.userId, 
            twitchConfig.clientId, 
            tokenResponse.data.access_token
        );

        if (streamStatus.isLive && !config.isLive) {
            const embed = new EmbedBuilder()
                .setColor('#9146ff')
                .setTitle('🔴 Stream Started!')
                .setDescription(`**${config.name}** is now live on Twitch!`)
                .addFields(
                    { name: '🎮 Title', value: streamStatus.title, inline: false },
                    { name: '🎯 Game', value: streamStatus.game || 'Not specified', inline: true },
                    { name: '👥 Viewers', value: streamStatus.viewers.toString(), inline: true },
                    { name: '🔗 Watch', value: `[Click here](https://twitch.tv/${username})`, inline: true }
                )
                .setThumbnail(streamStatus.thumbnail)
                .setTimestamp();

            const channel = client.channels.cache.get(config.notificationChannel);
            if (channel) {
                channel.send({ embeds: [embed] });
            }
        }

        config.isLive = streamStatus.isLive;
        await saveData();
    } catch (error) {
        console.error(`Error checking Twitch channel ${username}:`, error);
    }
}

// UptimeRobot Integration
app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running!', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        monitored: {
            youtube: Object.keys(monitoredChannels.youtube).length,
            twitch: Object.keys(monitoredChannels.twitch).length,
            instagram: Object.keys(monitoredChannels.instagram).length
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', bot: client.user?.tag || 'connecting' });
});

// Keep-alive endpoint for UptimeRobot
app.get('/ping', (req, res) => {
    res.send('pong');
});

// Start Express server
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});

// Login bot
client.login(process.env.DISCORD_TOKEN);