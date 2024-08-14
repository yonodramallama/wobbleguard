const { fork } = require('child_process');
const readline = require("readline");

const hostName = "10.20.0.2";
const hostPort = 25565;

const bots = [];
const botsByName = {};

const autoSpawnBots = 5;
const spawnDelay = 5000;

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

function logWithTimestamp(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function spawnBot(botName) {
    try {
        const bot = fork("bot.js", [botName, hostName, hostPort]);

        bots.push(bot);
        botsByName[botName] = bot;

        bot.on('message', (data) => {
            if (data.type === "message") {
                logWithTimestamp(`\x1b[32m@${botName}\x1b[0m: ${data.text}`);
            }
        });

        bot.on('error', (err) => {
            logWithTimestamp(`Error in bot "${botName}": ${err.message}`);
        });

        bot.on('exit', () => {
            logWithTimestamp(`Bot "${botName}" exited.`);
            // Clean up bot references
            const index = bots.indexOf(bot);
            if (index > -1) bots.splice(index, 1);
            delete botsByName[botName];
        
            // Respawn the bot
            spawnBot(botName);
        });

        bot.on('end', () => {
            logWithTimestamp("Bot disconnected. Reconnecting...");
            setTimeout(() => {
                bot.reconnect();
            }, 5000); // Retry connection after 5 seconds
        });
        
    } catch (error) {
        logWithTimestamp(`Failed to spawn bot "${botName}": ${error.message}`);
    }
}

async function monitorBots() {
    while (true) {
        for (const bot of bots) {
            if (bot.killed || bot.exited) {
                logWithTimestamp(`Bot "${bot.process.pid}" is not active. Restarting...`);
                bot.kill();
                spawnBot(bot.process.title);
            }
        }
        await sleep(10000); // Check every 10 seconds
    }
}

// Start the monitoring loop
monitorBots();

async function spawnBots(amount = 1) {
    for (let i = 0; i < amount; i++) {
        spawnBot(`guard_${bots.length}`);
        await sleep(spawnDelay);
    }
}

const COMMAND_FUNCTIONS = {
    "ping": () => {
        logWithTimestamp("pong");
    },

    "spawn": (amount) => {
        spawnBots(Number(amount));
    },
};

function runCommand(command) {
    const tokens = command.split(' ');

    if (tokens[0].startsWith('@')) {
        const botName = tokens[0].slice(1);
        const bot = botsByName[botName];

        if (!bot) {
            logWithTimestamp(`Couldn't find bot named "${botName}".`);
            return;
        }

        bot.send({
            type: "command",
            command: tokens.slice(1),
        });

        return;
    }

    const commandFunction = COMMAND_FUNCTIONS[tokens[0]];

    if (!commandFunction) {
        logWithTimestamp(`Unknown command: ${tokens[0]}`);
        return;
    }

    commandFunction(...tokens.slice(1));
}

function inputLoop(command) {
    if (command) runCommand(command);
    reader.question(">", inputLoop);
}

async function main() {
    process.on('SIGINT', () => {
        logWithTimestamp('Shutting down gracefully...');
        bots.forEach(bot => bot.send({ type: 'command', command: ['stop'] }));
        process.exit();
    });

    spawnBots(autoSpawnBots);
    inputLoop();
}

main();
