🤖 VRGamerz Discord Bot
A custom-built Discord bot powered by Node.js and discord.js. Easily extendable and designed for moderation, utilities, fun commands, and more.

🚀 Features
🔧 Custom commands

👮‍♂️ Moderation tools

🎮 Fun commands (games, memes, etc.)

📜 Dynamic prefix system

🧠 Extensible command handler

📦 Requirements
Node.js (v18+ recommended)

Discord bot token (from the Discord Developer Portal)

🔧 Installation
Clone the repository
git clone https://github.com/VRGamerz9797/discord-bot.git
cd discord-bot

Install dependencies
npm install

Configure environment variables
Create a .env file in the root directory and add your bot token:
DISCORD_TOKEN=your_token_here

Start the bot
node index.js
Or with auto-restart on file changes:
npx nodemon index.js

🛠 Configuration
You can modify config.json or .env to manage:

Bot prefix

Status

Command directories

Permissions

🧱 Project Structure
discord-bot/
├── commands/ # All command files
├── events/ # Event handlers (ready, message, etc.)
├── utils/ # Helper functions
├── index.js # Entry point
├── config.json # Config file (prefix, etc.)
└── .env # Secrets (bot token)

🤝 Contributing
Fork this repo

Create a new branch (git checkout -b feature/my-feature)

Commit your changes (git commit -m 'Add cool feature')

Push to the branch (git push origin feature/my-feature)

Create a pull request!

📜 License
MIT License. Feel free to use, modify, and distribute with credit.

🙋‍♂️ Contact
Made with ❤️ by VRGamerz
For issues, open a GitHub Issue: https://github.com/VRGamerz9797/discord-bot/issues
