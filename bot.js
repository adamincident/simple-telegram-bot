const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// store your chat id
let CHAT_ID = null;

bot.on('message', (msg) => {
  CHAT_ID = msg.chat.id;

  bot.sendMessage(CHAT_ID, "Tracking started 👀");
});

// fake trade generator every 10 seconds
setInterval(() => {
  if (!CHAT_ID) return;

  const price = (Math.random() * 0.5 + 0.5).toFixed(2);

  const message = `
📊 Trade Detected

Wallet: 0xABC123...
Action: BUY YES
Price: ${price}
Market: Example Market
  `;

  bot.sendMessage(CHAT_ID, message);
}, 10000);

console.log("Bot started...");
