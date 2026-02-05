const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online'));

const WEB_PORT = process.env.PORT || 3000;
app.listen(WEB_PORT, () => console.log('Web running on port', WEB_PORT));

const config = {
  host: process.env.MC_HOST || 'SquadSuper.aternos.me',
  port: Number(process.env.MC_PORT || 53867),
  username: process.env.MC_USER || 'Bot24horas',
  version: '1.21.11'
};

let bot = null;
let reconnectTimer = null;
let antiAfkInterval = null;

const RECONNECT_DELAY = 15000; // ✅ só isso que você queria

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);

  antiAfkInterval = setInterval(() => {
    if (!bot?.entity) return;

    bot.setControlState('jump', true);
    setTimeout(() => bot?.setControlState('jump', false), 200);
  }, 10000);
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return;

  console.log(`Caiu (${reason}). Reconectando em 15s...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, RECONNECT_DELAY);
}

function createBot() {
  console.log(`Conectando em ${config.host}:${config.port}...`);

  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('Spawnado!');
    startAntiAfk();
  });

  bot.on('end', () => scheduleReconnect('end'));
  bot.on('error', (e) => scheduleReconnect(e?.message));
  bot.on('kicked', () => scheduleReconnect('kicked')); // ✅ reconecta SEMPRE
}

createBot();
