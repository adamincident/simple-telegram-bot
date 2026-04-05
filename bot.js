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
    const res = await fetch("https://gamma-api.polymarket.com/markets?active=true");
    const data = await res.json();

    return data.slice(0, 3);
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
    const yesPrice = m.outcomePrices?.[0] ?? "N/A";
    const noPrice = m.outcomePrices?.[1] ?? "N/A";

    const message = `
📊 Market Update

🧠 ${m.question}
💰 Yes: ${yesPrice}
💰 No: ${noPrice}
    `;

    bot.sendMessage(CHAT_ID, message);
  });
}, 15000);

console.log("Bot started...");
