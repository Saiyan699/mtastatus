process.noDeprecation = true;

const Discord = require('discord.js');
const gamedig = require('gamedig');
const moment = require('moment');

const playerHistory = new Map();
const maxHistoryPoints = 24;

const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages
    ]
});

const config = {
    token: process.env.BOT_TOKEN || 'BOT TOKEN',
    channelId: process.env.CHANNEL_ID || 'ID CHANNEL DISCORD',
    servers: [
        {
            name: "PROJECT - MTA",
            ip: "78.46.65.243",
            port: 3815
        }
    ],
    updateInterval: 5 * 60 * 1000
};

client.once('ready', () => {
    console.log('Bot gecim elindult!');
    updateServerStatus();
});

async function checkServer(server) {
    try {
        let host = server.ip;
        let port = server.port;
        
        if (server.ip.includes(':')) {
            const [ipAddress, customPort] = server.ip.split(':');
            host = ipAddress;
            port = parseInt(customPort);
        }

        const serverInfo = await gamedig.query({
            type: 'mtasa',
            host: host,
            port: port
        });
        return {
            success: true,
            data: serverInfo
        };
    } catch (error) {
        return {
            success: false,
            error: error
        };
    }
}

async function generateChartUrl(serverName, history) {
    const labels = history.map(point => moment(point.timestamp).format('HH:mm'));
    const data = history.map(point => point.players);
    
    const chartData = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Players Online',
                data: data,
                fill: false,
                borderColor: '#7cc576'
            }]
        }
    };

    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartData))}`;
}

async function updateServerStatus() {
    try {
        const channel = client.channels.cache.get(config.channelId);
        if (!channel) return console.error('Nem találtam csatornát!');

        const messages = await channel.messages.fetch({ limit: 100 });
        
        for (const server of config.servers) {
            const result = await checkServer(server);
            
            if (!playerHistory.has(server.name)) {
                playerHistory.set(server.name, []);
            }
            
            const history = playerHistory.get(server.name);
            history.push({
                timestamp: new Date(),
                players: result.success ? result.data.players.length : 0
            });

            if (history.length > maxHistoryPoints) {
                history.shift();
            }

            const embed = new Discord.EmbedBuilder()
                .setColor(result.success ? '#7cc576' : '#7cc576')
                .setTitle(`${server.name} Status`)
                .setTimestamp();

            if (result.success) {
                const chartUrl = await generateChartUrl(server.name, history);
                
                embed.addFields(
                    { name: 'Players', value: `${result.data.players.length}/${result.data.maxplayers}`, inline: true },
                    { name: 'Server Name', value: result.data.name, inline: true }
                )
                .setImage(chartUrl);

                const existingMessage = messages.find(msg => 
                    msg.author.id === client.user.id && 
                    msg.embeds[0]?.title === `${server.name} Status`
                );

                if (existingMessage) {
                    await existingMessage.edit({ embeds: [embed] });
                } else {
                    await channel.send({ embeds: [embed] });
                }
            } else {
                embed.addFields(
                    { name: 'Status', value: 'Server Offline', inline: true }
                );

                const existingMessage = messages.find(msg => 
                    msg.author.id === client.user.id && 
                    msg.embeds[0]?.title === `${server.name} Status`
                );

                if (existingMessage) {
                    await existingMessage.edit({ embeds: [embed] });
                } else {
                    await channel.send({ embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('Error in updateServerStatus:', error);
    }

    setTimeout(updateServerStatus, config.updateInterval);
}

client.login(config.token);