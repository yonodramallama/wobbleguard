# MC Bodyguard
Minecraft bots designed to keep you safe.

### Features
- Protect players from enemies
- Melee (swords, axes)
- Archery (bows)
- Multiple bots

# Usage
## Installation
You'll need to install the following:
- [NodeJS](https://nodejs.org/en/download)
- [mineflayer](https://github.com/PrismarineJS/mineflayer)
- [mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)

## Running
Once you have the code and its dependencies installed you'll need to do the following:
- Add your username on a new line in `boss-list.txt`
- Set the port number for your server in `index.js`
- Run `index.js` with NodeJS

## Controlling
The bots can be controlled by giving commands either through the CLI or in-game chat.

General Commands

    continue: Resume guarding.
    eat: Eat food if hungry.
    guard <username>: Start guarding the specified player.
    ping: Respond with "pong".
    status: Display current health and food level.
    stop: Stop guarding and clear the pathfinder goal.

Archery Commands

    shoot <targetName>: Shoot an arrow at the specified target if the bot has a bow and arrows.

Armor Commands

    equiparmor: Equip the best available armor from the inventory.

Other Notes

    bot.js: Manages the main bot functionalities, including attacking enemies, guarding players, and handling commands.
    archery.js: Handles archery functionalities like checking for arrows and bows, and shooting targets.
    armor.js: Manages equipping armor based on preferences.
    index.js: Manages spawning and monitoring multiple bots.

    