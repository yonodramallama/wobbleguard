const mineflayer = require('mineflayer');
const readline = require("readline");

const hostName = "10.20.0.2";
const hostPort = 25565;

const bots = [];
const botsByName = {};

const autoSpawnBots = 1;
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
        const bot = mineflayer.createBot({
            host: hostName,
            port: hostPort,
            username: botName,
            version: false  // auto-detect version
        });

        bots.push(bot);
        botsByName[botName] = bot;

        bot.on('inject_allowed', () => {
            const mcData = require('minecraft-data')(bot.version);

            if (!mcData) {
                logWithTimestamp(`Unable to load Minecraft data for version ${bot.version}. The server might be incompatible or not responding.`);
                process.exit(1);  // Exit the bot process on error
            }

            logWithTimestamp(`Bot "${botName}" spawned successfully.`);
            // Additional bot logic can go here
        });

        bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            logWithTimestamp(`\x1b[32m@${botName}\x1b[0m: ${message}`);
        });

        bot.on('error', (err) => {
            logWithTimestamp(`Error in bot "${botName}": ${err.message}`);
        });

        bot.on('end', () => {
            logWithTimestamp(`Bot "${botName}" disconnected from server.`);
            // Clean up bot references
            const index = bots.indexOf(bot);
            if (index > -1) bots.splice(index, 1);
            delete botsByName[botName];
        });

    } catch (error) {
        logWithTimestamp(`Failed to spawn bot "${botName}": ${error.message}`);
    }
}

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

        bot.chat(tokens.slice(1).join(' ')); // Send the command as a chat message
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
        bots.forEach(bot => bot.end());
        process.exit();
    });

    spawnBots(autoSpawnBots);
    inputLoop();
}

main();
