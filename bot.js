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

    return data
      .filter(m => {
        if (!m.active) return false;

        // ensure outcomes is an array
        if (!Array.isArray(m.outcomes)) return false;

        // ensure at least one valid price exists
        return m.outcomes.some(o => o && o.price != null);
      })
      .slice(0, 3);

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
    let yesPrice = "N/A";
    let noPrice = "N/A";

    if (m.outcomes && Array.isArray(m.outcomes)) {
      const yes = m.outcomes.find(o => o.name === "Yes");
      const no = m.outcomes.find(o => o.name === "No");

      yesPrice = yes?.price ?? "N/A";
      noPrice = no?.price ?? "N/A";
    }

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
