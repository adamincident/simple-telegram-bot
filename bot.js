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
  throw new Error('Missing POLYMARKET_WALLETS (comma-separated wallet addresses)');
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
let chatId = TELEGRAM_CHAT_ID;

// In-memory duplicate tracking (wallet -> trade keys)
const seenTradesByWallet = new Map();
const debugLoggedWallets = new Set();

for (const wallet of POLYMARKET_WALLETS) {
  seenTradesByWallet.set(wallet, new Set());
}

bot.onText(/\/start/, (msg) => {
  chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `✅ Tracking ${POLYMARKET_WALLETS.length} wallet(s). Polling every ${POLLING_MS / 1000}s.`
  );
});

bot.on('message', (msg) => {
  if (!chatId) {
    chatId = msg.chat.id;
  }
});

function getTradeId(trade, fallbackWallet) {
  return (
    trade.id ||
    trade.activityId ||
    trade.txHash ||
    `${fallbackWallet}:${trade.timestamp || trade.createdAt || ''}:${trade.slug || trade.market || trade.title || ''}:${trade.side || trade.type || ''}:${trade.price || trade.size || trade.amount || ''}`
  );
}

function normalizeAction(trade) {
  const raw = String(trade.side || trade.action || trade.type || '').toUpperCase();

  if (raw.includes('BUY') || raw.includes('BID')) return 'BUY';
  if (raw.includes('SELL') || raw.includes('ASK')) return 'SELL';

  return raw || 'UNKNOWN';
}

function normalizeTrade(trade, wallet) {
  return {
    wallet,
    title: trade.title || trade.marketTitle || trade.question || trade.market || trade.slug || 'Unknown market',
    action: normalizeAction(trade),
    outcome: trade.outcome || trade.outcomeName || trade.tokenName || trade.asset || 'Unknown',
    price: trade.price ?? trade.executedPrice ?? trade.avgPrice ?? 'N/A',
    tradeId: getTradeId(trade, wallet),
  };
}

async function fetchTrades(wallet) {
  const url = `https://data-api.polymarket.com/activity?user=${wallet}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polymarket API ${response.status} for ${wallet}`);
  }

  const data = await response.json();

  if (!debugLoggedWallets.has(wallet)) {
    console.log(`First raw payload for ${wallet}:`, data?.[0] || data);
    debugLoggedWallets.add(wallet);
  }

  if (!Array.isArray(data)) {
    console.log(`Unexpected activity format for ${wallet}:`, data);
    return [];
  }

  return data;
}

async function checkWallet(wallet) {
  const trades = await fetchTrades(wallet);
  const seen = seenTradesByWallet.get(wallet);

  if (!seen) return [];

  const fresh = [];

  // API often returns newest first; reverse so alerts are oldest -> newest
  for (const trade of [...trades].reverse()) {
    const normalized = normalizeTrade(trade, wallet);

    if (seen.has(normalized.tradeId)) {
      continue;
    }

    seen.add(normalized.tradeId);
    fresh.push(normalized);
  }

  return fresh;
}

async function notifyTrade(trade) {
  if (!chatId) return;

  const message = `📊 Trade Detected\n\nWallet: ${trade.wallet}\nMarket: ${trade.title}\nAction: ${trade.action} ${trade.outcome}\nPrice: ${trade.price}`;

  await bot.sendMessage(chatId, message);
}

async function pollOnce() {
  for (const wallet of POLYMARKET_WALLETS) {
    try {
      const newTrades = await checkWallet(wallet);

      for (const trade of newTrades) {
        await notifyTrade(trade);
      }
    } catch (error) {
      console.error(`Polling error for ${wallet}:`, error.message);
    }
  }
}

setInterval(pollOnce, POLLING_MS);
pollOnce();

console.log('Bot started.');
console.log('Wallets:', POLYMARKET_WALLETS.join(', '));
console.log('Polling interval:', `${POLLING_MS}ms`);
if (!TELEGRAM_CHAT_ID) {
  console.log('Send /start to the bot once so it knows where to send alerts.');
}
