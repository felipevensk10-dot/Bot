const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online'));

const WEB_PORT = process.env.PORT || 3000;
app.listen(WEB_PORT, () => console.log('Web running on port', WEB_PORT));

function parseMCVersion(v) {
  if (!v) return '1.21.11';
  const s = String(v).trim().toLowerCase();
  if (s === 'false' || s === 'auto' || s === 'detect') return '1.21.11';
  return v;
}

const config = {
  host: process.env.MC_HOST || 'SquadSuper.aternos.me',
  port: Number(process.env.MC_PORT || 53867),
  username: process.env.MC_USER || 'Bot24horas',
  version: parseMCVersion(process.env.MC_VERSION),
};

let bot = null;
let reconnectTimer = null;
let spawnWatchdog = null;

const RECONNECT_DELAY = 15_000;
const SPAWN_TIMEOUT = 120_000; // Aternos pode demorar

function clearTimers() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (spawnWatchdog) clearTimeout(spawnWatchdog);
  spawnWatchdog = null;
}

function cleanupBot() {
  clearTimers();
  if (bot) {
    try {
      bot.removeAllListeners();
      bot.end();
    } catch {}
  }
  bot = null;
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return;

  cleanupBot();
  console.log(`Caiu (${reason}). Reconectando em ${RECONNECT_DELAY}ms...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, RECONNECT_DELAY);
}

function shouldPauseOnKick(reasonText) {
  const t = (reasonText || '').toLowerCase();
  // Motivos comuns que indicam bloqueio/idle/ToS → melhor NÃO ficar insistindo
  return (
    t.includes('idle') ||
    t.includes('terms') ||
    t.includes('tos') ||
    t.includes('banned') ||
    t.includes('ban') ||
    t.includes('violate')
  );
}

function createBot() {
  console.log(`Conectando em ${config.host}:${config.port} (v${config.version})...`);

  try {
    bot = mineflayer.createBot(config);
  } catch (e) {
    return scheduleReconnect(e?.message || 'createBot error');
  }

  spawnWatchdog = setTimeout(() => {
    console.log(`⚠️ Não spawnou em ${SPAWN_TIMEOUT}ms. Reiniciando conexão...`);
    try { bot?.end(); } catch {}
  }, SPAWN_TIMEOUT);

  bot.once('login', () => console.log(`Logado como ${bot.username}`));

  bot.once('spawn', () => {
    if (spawnWatchdog) clearTimeout(spawnWatchdog);
    spawnWatchdog = null;
    console.log('✅ Spawnado!');
  });

  bot.once('end', () => scheduleReconnect('end'));

  bot.once('error', (e) => {
    const code = e?.code || '';
    const msg = e?.message || String(e);
    console.log('💥 Error:', code, msg);
    scheduleReconnect(code || msg || 'error');
  });

  bot.once('kicked', (reason) => {
    const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.log('🚫 Kicked:', reasonText);

    if (shouldPauseOnKick(reasonText)) {
      console.log('⛔ Kick indica bloqueio/idle/ToS. Pausando reconexões para evitar loop.');
      cleanupBot();
      return;
    }

    scheduleReconnect('kicked');
  });
}

createBot();
