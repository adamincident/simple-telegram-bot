const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
  ? Number(process.env.TELEGRAM_CHAT_ID)
  : null;
const POLYMARKET_WALLETS = (process.env.POLYMARKET_WALLETS || '')
  .split(',')
  .map((address) => address.trim())
  .filter(Boolean);

const POLLING_MS = 12000;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN');
}

if (POLYMARKET_WALLETS.length === 0) {
  throw new Error('Missing POLYMARKET_WALLETS');
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let chatId = TELEGRAM_CHAT_ID;

// 🔥 PAPER TRADING STORAGE
const positions = [];

// In-memory duplicate tracking
const seenTradesByWallet = new Map();
const debugLoggedWallets = new Set();

for (const wallet of POLYMARKET_WALLETS) {
  seenTradesByWallet.set(wallet, new Set());
}

bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `✅ Tracking ${POLYMARKET_WALLETS.length} wallet(s)\n📊 Paper trading enabled\nPolling every ${POLLING_MS / 1000}s`
  );
});

bot.on('message', (msg) => {
  if (!chatId) chatId = msg.chat.id;
});

// 📊 VIEW POSITIONS
bot.onText(/\/positions/, (msg) => {
  const id = msg.chat.id;

  if (positions.length === 0) {
    return bot.sendMessage(id, "No paper trades yet.");
  }

  const latest = positions.slice(-5).map(p => {
    return `🧠 ${p.title}\n${p.action} ${p.outcome}\nEntry: ${p.price}`;
  }).join("\n\n");

  bot.sendMessage(id, `📊 Last Trades:\n\n${latest}`);
});

// 📈 SIMPLE PNL
bot.onText(/\/pnl/, (msg) => {
  const id = msg.chat.id;

  if (positions.length === 0) {
    return bot.sendMessage(id, "No trades yet.");
  }

  const avg =
    positions.reduce((sum, p) => sum + Number(p.price || 0), 0) / positions.length;

  bot.sendMessage(id, `📈 Paper Stats\n\nTrades: ${positions.length}\nAvg Entry: ${avg.toFixed(3)}`);
});

function getTradeId(trade, wallet) {
  return (
    trade.id ||
    trade.activityId ||
    trade.txHash ||
    `${wallet}:${trade.timestamp}:${trade.title}:${trade.price}`
  );
}

function normalizeAction(trade) {
  const raw = String(trade.side || '').toUpperCase();
  if (raw.includes('BUY')) return 'BUY';
  if (raw.includes('SELL')) return 'SELL';
  return raw || 'UNKNOWN';
}

function normalizeTrade(trade, wallet) {
  return {
    wallet,
    title: trade.title || 'Unknown market',
    action: normalizeAction(trade),
    outcome: trade.outcome || 'Unknown',
    price: trade.price ?? 'N/A',
    tradeId: getTradeId(trade, wallet),
  };
}

async function fetchTrades(wallet) {
  const url = `https://data-api.polymarket.com/activity?user=${wallet}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`API ${res.status}`);

  const data = await res.json();

  if (!debugLoggedWallets.has(wallet)) {
    console.log(`First payload for ${wallet}:`, data?.[0]);
    debugLoggedWallets.add(wallet);
  }

  return Array.isArray(data) ? data : [];
}

async function checkWallet(wallet) {
  const trades = await fetchTrades(wallet);
  const seen = seenTradesByWallet.get(wallet);

  const fresh = [];

  for (const trade of [...trades].reverse()) {
    const normalized = normalizeTrade(trade, wallet);

    if (seen.has(normalized.tradeId)) continue;

    seen.add(normalized.tradeId);
    fresh.push(normalized);
  }

  return fresh;
}

// 🚀 MAIN EVENT
async function notifyTrade(trade) {
  if (!chatId) return;

  // 📊 SEND ALERT
  const message = `📊 Trade Detected\n\nWallet: ${trade.wallet}\nMarket: ${trade.title}\nAction: ${trade.action} ${trade.outcome}\nPrice: ${trade.price}`;

  await bot.sendMessage(chatId, message);

  // 🔥 ADD TO PAPER TRADING
  positions.push({
    wallet: trade.wallet,
    title: trade.title,
    action: trade.action,
    outcome: trade.outcome,
    price: Number(trade.price),
    timestamp: Date.now()
  });
}

async function pollOnce() {
  for (const wallet of POLYMARKET_WALLETS) {
    try {
      const newTrades = await checkWallet(wallet);

      for (const trade of newTrades) {
        await notifyTrade(trade);
      }
    } catch (err) {
      console.error(`Error for ${wallet}:`, err.message);
    }
  }
}

setInterval(pollOnce, POLLING_MS);
pollOnce();

console.log('Bot started.');
console.log('Wallets:', POLYMARKET_WALLETS.join(', '));
