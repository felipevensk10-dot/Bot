const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online'));

// ✅ Railway usa PORT dinâmica
const WEB_PORT = process.env.PORT || 3000;
app.listen(WEB_PORT, () => console.log('Web running on port', WEB_PORT));

const config = {
  host: process.env.MC_HOST || 'SquadSuper.aternos.me',
  port: Number(process.env.MC_PORT || 53867),
  username: process.env.MC_USER || 'Bot24horas',
  version: process.env.MC_VERSION || false,
};

let bot = null;
let antiAfkInterval = null;
let reconnectTimer = null;

// backoff (pra não tomar "Connection throttled")
let attempts = 0;
const BASE_DELAY = 10_000; // 10s
const MAX_DELAY = 180_000; // 3min

function stopAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);
  antiAfkInterval = null;
}

function startAntiAfk() {
  stopAntiAfk();

  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    const action = Math.floor(Math.random() * 3);

    if (action === 0) {
      bot.setControlState('jump', true);
      setTimeout(() => bot?.setControlState('jump', false), 200);
    } else if (action === 1) {
      const dir = Math.random() > 0.5 ? 'forward' : 'back';
      bot.setControlState(dir, true);
      setTimeout(() => bot?.setControlState(dir, false), 600);
    } else {
      bot.look(
        bot.entity.yaw + (Math.random() - 0.5) * 0.4,
        bot.entity.pitch,
        true
      );
    }
  }, 20_000); // ✅ mais leve (20s)
}

function cleanupBot() {
  stopAntiAfk();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch {}
  }
  bot = null;
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return; // ✅ não duplica reconect

  cleanupBot();

  attempts++;
  const backoff = Math.min(MAX_DELAY, BASE_DELAY * attempts);
  const jitter = Math.floor(Math.random() * 3000);
  const wait = backoff + jitter;

  console.log(`Caiu (${reason}). Reconectando em ${wait}ms...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, wait);
}

function createBot() {
  if (reconnectTimer) return;

  console.log(`Conectando em ${config.host}:${config.port}...`);

  bot = mineflayer.createBot(config);

  bot.once('login', () => {
    console.log(`Logado como ${bot.username}`);
  });

  bot.once('spawn', () => {
    console.log('Spawnado! Anti-AFK ligado.');
    attempts = 0; // ✅ reset backoff quando estabiliza
    startAntiAfk();
  });

  bot.once('end', () => scheduleReconnect('end'));
  bot.once('error', (e) => scheduleReconnect(e?.message || 'error'));
  bot.once('kicked', () => scheduleReconnect('kicked'));
}

createBot();
