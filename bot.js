const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let CHAT_ID = null;

bot.on('message', (msg) => {
  CHAT_ID = msg.chat.id;
  bot.sendMessage(CHAT_ID, "Tracking REAL markets 👀");
});

// simple Polymarket fetch
async function fetchMarkets() {
  try {
    const res = await fetch("https://gamma-api.polymarket.com/markets");
    const data = await res.json();

    return data.slice(0, 3); // just take a few markets
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

// send updates every 15 seconds
setInterval(async () => {
  if (!CHAT_ID) return;

  const markets = await fetchMarkets();

  markets.forEach((m) => {
    const message = `
📊 Market Update

🧠 ${m.question}
💰 Yes Price: ${m.outcomePrices?.[0] || "?"}
💰 No Price: ${m.outcomePrices?.[1] || "?"}
    `;

    bot.sendMessage(CHAT_ID, message);
  });
}, 15000);

console.log("Bot started...");
