// To resolve the MaxListenersExceededWarning, you can increase the maximum number of listeners or refactor the code to avoid adding too many listeners. In this case, increasing the limit might be a temporary solution:
require('events').EventEmitter.defaultMaxListeners = 20; // Increase the limit to 20 or higher

// Import required modules and plugins
const mineflayer = require('mineflayer');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

// Import custom plugins
const meleePlugin = require('./melee.js');
const archeryPlugin = require('./archery.js');
const armorPlugin = require('./armor.js');

// Check for necessary command-line arguments
if (process.argv.length < 5) process.exit();

// Extract bot configuration from command-line arguments
const [botName, hostName, hostPort] = process.argv.slice(2);

// Constants for handling text splitting and hunger limits
const LINE_BREAKS = /\r?\n/g;
const HUNGER_LIMIT = 5;

// Load lists of bosses and targets from text files
const bossList = fs.readFileSync("boss-list.txt", "utf8").split(LINE_BREAKS);
const targetList = fs.readFileSync("target-list.txt", "utf8").split(LINE_BREAKS);

let defaultMove;
let guardedPlayer;
let guarding = true;

// Function to calculate the duration of a path
function getPathDuration(path) {
	return path.cost; // TODO: calculate duration of path (in seconds)
}

// Create a new Mineflayer bot instance
const bot = mineflayer.createBot({
    username: botName,
    host: hostName,
    port: hostPort,
    viewDistance: "tiny",
});

// Event listeners for bot events
bot.on('kicked', console.log);
bot.on('error', console.log);

// Load plugins into the bot
bot.loadPlugin(pathfinder);
bot.loadPlugin(meleePlugin);
bot.loadPlugin(archeryPlugin);
bot.loadPlugin(armorPlugin);

console.log("Plugins loaded.");

// Utility function to get an entity by name
bot.getEntity = (name)=>{
	return bot.nearestEntity((entity)=>{
		return entity.displayName === name || entity.username === name;
	});
}

// Function to find the nearest threat based on distance and type
function findThreat() {
	return bot.nearestEntity((entity)=>{
		if (entity.kind !== "Hostile mobs" && !targetList.includes(entity.username)) return false;

		const distanceFromBot = entity.position.distanceTo(bot.entity.position);

		if (distanceFromBot < 8) return true;

		if (!guardedPlayer || !guardedPlayer.entity) return false;

		const distanceFromPlayer = entity.position.distanceTo(guardedPlayer.entity.position);

		if (distanceFromPlayer < 16) return true;
	});
}

// Function to find the nearest attacker within a specified distance
function findAttacker(position=bot.entity.position) {
	return bot.nearestEntity((entity)=>{
		if (bossList.includes(entity.username)) return false;

		const distance = entity.position.distanceTo(position);

		if (distance < 5) return true;
	});
}

// Function to send a greeting message to the chat
async function sendGreeting() {
    try {
        await bot.chat("I'm a robot.");
        console.log("Greeting message sent.");
    } catch (error) {
        console.error("Error sending greeting message:", error);
    }
}

// Function to attack an enemy using either melee or archery
async function attackEnemy(enemy) {
	const pos = bot.entity.position;
	const enemyGoal = new goals.GoalNear(pos.x, pos.y, pos.z, 4);
	const pathToBot = bot.pathfinder.getPathFromTo(defaultMove, enemy.position, enemyGoal);

	let path = pathToBot.next().value.result;

	while (path.status === 'partial') {
		path = pathToBot.next().value.result;
	}

	const timeToArrival = getPathDuration(path);
	const timeToDrawBow = 4;

	if (bot.archery.canShoot() && timeToArrival > timeToDrawBow) {
		await bot.archery.shoot(enemy);
	} else {
		let goal = new goals.GoalFollow(enemy, 6);

		await bot.pathfinder.goto(goal);

		await bot.melee.equip();
		await bot.melee.punch(enemy);
	}
}

// Main loop for guarding and moving the bot
async function loop() {
    if (!guarding) return;

    const enemy = findThreat();

    if (enemy) {
        await attackEnemy(enemy);
        return;
    }

    const randomDistance = Math.floor(Math.random() * (10 - 4 + 1)) + 4; // Random distance between 4 and 10
    let goal = new goals.GoalFollow(guardedPlayer.entity, randomDistance);
    await bot.pathfinder.goto(goal);
}

// Function to handle bot eating food when hungry
async function eatFood(log=sendMessage) {
	if (bot.food === 20) {
		log(`too full to eat`);
		return;
	}

	for (food of bot.registry.foodsArray) {
		const amount = bot.inventory.count(food.id);

		if (amount === 0) continue;

		log(`found ${amount} ${food.displayName}`);
		
		await bot.equip(food.id);

		await bot.consume();

		log(`ate 1 ${food.displayName}`);

		return;
	}

	log("out of food");
}

// Define bot commands and their handlers
bot.commands = {
	"continue": async ()=>{
		guarding = true;
	},

	"eat": async ({ log })=>{
		await eatFood(log);
	},

	"guard": async (username, { log })=>{
		const player = bot.players[username];

		if (!player) {
			log(`Player "${username}" does not exist.`);
			return;
		}

		guardedPlayer = player;
	},

	"ping": async ({ log })=>{
		log("pong");
	},

	"status": async ({ log })=>{
		log(`❤${bot.health} 🥕${bot.food}`);
	},

	"stop": async ({ log })=>{
		log("Stopping.");
		bot.pathfinder.setGoal(null);
		guarding = false;
	},
};

// Function to run a command based on user input
async function runCommand(tokens, user, log) {
	const commandFunction = bot.commands[tokens[0]];

	if (!commandFunction) {
		log("Unknown command.");
		return;
	}

    await commandFunction(...tokens.slice(1), {
    	user: user,
		log: log,
    });
}

// Function to send a message to the parent process
function sendMessage(text) {
	process.send({
		type: "message",
		text: text,
	});
}

// Handle messages from the parent process
process.on('message', (data)=>{
	if (data.type === "command") {
		runCommand(data.command, user="admin", log=sendMessage);
		return;
	}

	console.log(`${botName} recieved unknown message: `, data);
});

// Handle bot spawn event
bot.once('spawn', async () => {
    try {
        console.log('Bot has spawned.');

        // Function to send commands
        const sendCommand = (command) => {
            bot.chat(command);
            console.log(`Command sent: ${command}`);
        };

        // Randomize armor and weapon
        const swords = ['diamond_sword', 'netherite_sword'];
        const bows = ['bow']; // Assuming basic bow; enchanted bow can be given with enchantment commands
        const helmets = ['diamond_helmet', 'iron_helmet', 'golden_helmet', 'leather_helmet'];
        const chestplates = ['diamond_chestplate', 'iron_chestplate', 'golden_chestplate', 'leather_chestplate'];
        const leggings = ['diamond_leggings', 'iron_leggings', 'golden_leggings', 'leather_leggings'];
        const boots = ['diamond_boots', 'iron_boots', 'golden_boots', 'leather_boots'];

        const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

        // Randomly choose between Diamond Sword, Netherite Sword, or Enchanted Bow
        const weaponChoice = randomItem(['enchanted_bow', 'netherite_sword', 'diamond_sword']);
        if (weaponChoice === 'enchanted_bow') {
            // Give a bow with random enchantments
            sendCommand('/give @p bow{Enchantments:[{id:"minecraft:power",lvl:5},{id:"minecraft:infinity",lvl:1}]}');
        } else {
            sendCommand(`/give @p ${weaponChoice}`);
        }
		console.log(`Randomly gave ${weaponChoice} to bot.`);

        // Give the bot random armor
        sendCommand(`/give @p ${randomItem(helmets)}`);
        sendCommand(`/give @p ${randomItem(chestplates)}`);
        sendCommand(`/give @p ${randomItem(leggings)}`);
        sendCommand(`/give @p ${randomItem(boots)}`);
		console.log(`Randomly gave ${randomItem(helmets)} ${randomItem(chestplates)} ${randomItem(leggings)} ${randomItem(boots)} to bot.`);

        // Give the bot essential items
        sendCommand('/give @p bread 5');            // 5 pieces of bread
        sendCommand('/give @p apple 5');            // 5 apples
        sendCommand('/give @p cooked_beef 5');      // 5 pieces of cooked beef
        sendCommand('/give @p golden_carrot 5');    // 5 golden carrots
        sendCommand('/give @p steak 5');            // 5 pieces of steak
        sendCommand('/give @p porkchop 5');         // 5 pieces of porkchop
        sendCommand('/give @p chicken 5');          // 5 pieces of raw chicken
        sendCommand('/give @p cooked_chicken 5');   // 5 pieces of cooked chicken
        sendCommand('/give @p mutton 5');           // 5 pieces of mutton
        sendCommand('/give @p cooked_mutton 5');    // 5 pieces of cooked mutton
		console.log('Essential items given to bot.');

        // Additional useful items
        sendCommand('/give @p torches 5');           // 5 torches for lighting
        sendCommand('/give @p wood 5');              // 5 pieces of wood for crafting
        sendCommand('/give @p cobblestone 5');       // 5 pieces of cobblestone for building
        sendCommand('/give @p coal 5');              // 5 pieces of coal for smelting and lighting
        sendCommand('/give @p iron_ingot 5');        // 5 iron ingots for crafting tools
        sendCommand('/give @p gold_ingot 5');        // 5 gold ingots for crafting and trading
        sendCommand('/give @p redstone 5');          // 5 redstones for crafting and machines
        sendCommand('/give @p gunpowder 5');         // 5 gunpowder for crafting TNT and fireworks
        sendCommand('/give @p string 5');            // 5 string for crafting bows and wool
        sendCommand('/give @p ender_pearl 5');       // 5 ender pearls for teleportation
        sendCommand('/give @p blaze_powder 5');      // 5 blaze powders for brewing and eye of ender
        sendCommand('/give @p emerald 5');           // 5 emeralds for trading and crafting
		console.log('Additional useful items given to bot.');

        // Greeting message
        bot.chat("I'm a robot.");
        console.log('Greeting message sent.');

        await sendGreeting();

        // Set up default movement
        defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);
        console.log('Default movement setup.');

        // Find a boss
        console.log('Searching for a boss...');
        while (true) {
            let foundBoss = bot.nearestEntity((entity) => {
                return bossList.includes(entity.username);
            });

            if (foundBoss) {
                guardedPlayer = bot.players[foundBoss.username];
                console.log(`Boss found: ${foundBoss.username}`);
                break;
            }

            const enemy = findThreat();
            if (enemy) {
                console.log(`Threat found: ${enemy.username}`);
                await attackEnemy(enemy);
            }

            await bot.waitForTicks(5);
        }

        // Protect the boss
        console.log('Entering boss protection loop...');
        while (true) {
            await bot.waitForTicks(1);
            await loop();
        }
    } catch (error) {
        console.error('Error in spawn event handler:', error);
    }
});

bot.on("chat", async (username, message)=>{
	if (!bossList.includes(username)) return;

	const tokens = message.split(' ');

	await runCommand(tokens, user=username, log=bot.chat);
});

bot.on("whisper", async (username, message)=>{
	if (!bossList.includes(username)) return;

	const tokens = message.split(' ');

	await runCommand(tokens, user=username, log=(text)=>bot.whisper(username, text));
});

bot.on("health", async ()=>{
	if (bot.food > HUNGER_LIMIT) return;

	sendMessage(`hunger has reached ${bot.food}!`);

	await eatFood();
});

bot.on("entityGone", (entity)=>{
	const targetIndex = targetList.indexOf(entity.username);

	if (targetIndex === -1) return;
	
	targetList.splice(targetIndex, 1);
});

bot.on("entityHurt", (entity)=>{
	let attacked = false;

	if (entity === bot.entity) attacked = true;

	if (guardedPlayer && guardedPlayer.entity) {
		if (entity === guardedPlayer.entity) attacked = true;
	}

	if (attacked) {
		sendMessage(`${entity.username} was hurt!`);

		const attacker = findAttacker(bot.entity.position);

		if (attacker && !targetList.includes(attacker.username)) {
			targetList.push(attacker.username);
		}
	}
});
