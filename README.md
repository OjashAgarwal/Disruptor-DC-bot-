# 🤖 Disruptor Discord Bot

A custom-built Discord bot powered by Node.js and `discord.js`. Easily extendable and designed for moderation, utilities, fun commands, and more.

## 🚀 Features

- 🔧 Custom commands  
- 👮 Moderation tools  
- 🎮 Fun commands (games, memes, etc.)  
- 📜 Dynamic prefix system  
- 🧠 Extensible command handler  

## 📦 Requirements

- Node.js (v18+ recommended)  
- Discord bot token (from the [Discord Developer Portal](https://discord.com/developers/applications))  

## 🔧 Installation

### 1. Clone the repository
git clone https://github.com/OjashAgarwal/Disruptor-DC-bot-.git  
cd Disruptor-DC-bot-  

### 2. Install dependencies
npm install  

### 3. Configure environment variables
Create a `.env` file in the root directory and add your bot token:  

DISCORD_TOKEN=your_token_here  

### 4. Start the bot
node index.js  

Or with auto-restart on file changes:  
npx nodemon index.js  

## 🛠 Configuration

Modify `config.json` or `.env` to manage:  
- Bot prefix  
- Status  
- Command directories  
- Permissions  

## 🧱 Project Structure

Disruptor-DC-bot-/  
├── commands/       # All command files  
├── events/         # Event handlers (ready, message, etc.)  
├── utils/          # Helper functions  
├── index.js        # Entry point  
├── config.json     # Config file (prefix, etc.)  
└── .env            # Secrets (bot token)  

## 🤝 Contributing

1. Fork this repo  
2. Create a new branch (`git checkout -b feature/my-feature`)  
3. Commit your changes (`git commit -m 'Add cool feature'`)  
4. Push to the branch (`git push origin feature/my-feature`)  
5. Create a pull request!  

## 📜 License

MIT License. Feel free to use, modify, and distribute with credit.  

## 🙋 Contact

Made with ❤️ by [Ojash Agarwal](https://github.com/OjashAgarwal)  
For issues, open a [GitHub Issue](https://github.com/OjashAgarwal/Disruptor-DC-bot-/issues)  
