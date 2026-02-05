const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online'));

const WEB_PORT = process.env.PORT || 3000;
app.listen(WEB_PORT, () => console.log('Web running on port', WEB_PORT));

function parseMCVersion(v) {
  // ✅ FIXO: 1.21.11 (false/auto/detect dá crash pra você)
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
let antiAfkInterval = null;
let reconnectTimer = null;
let spawnWatchdog = null;

// ✅ Reconexão fixa em 15 segundos (não cresce)
const RECONNECT_DELAY = 15_000;

// ✅ Se não spawnar em 30s, reinicia (evita ficar “conectado” mas inútil)
const SPAWN_TIMEOUT = 30_000;

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
  }, 20_000);
}

function clearSpawnWatchdog() {
  if (spawnWatchdog) clearTimeout(spawnWatchdog);
  spawnWatchdog = null;
}

function cleanupBot() {
  stopAntiAfk();
  clearSpawnWatchdog();

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

function createBot() {
  if (reconnectTimer) return;

  console.log(`Conectando em ${config.host}:${config.port} (v${config.version})...`);

  try {
    bot = mineflayer.createBot(config);
  } catch (e) {
    return scheduleReconnect(e?.message || 'createBot error');
  }

  // ✅ Watchdog: se não spawnar em 30s, força reinício
  clearSpawnWatchdog();
  spawnWatchdog = setTimeout(() => {
    console.log(`⚠️ Não spawnou em ${SPAWN_TIMEOUT}ms. Reiniciando conexão...`);
    try { bot?.end(); } catch {}
  }, SPAWN_TIMEOUT);

  bot.once('login', () => console.log(`Logado como ${bot.username}`));

  bot.once('spawn', () => {
    clearSpawnWatchdog();
    console.log('✅ Spawnado! Anti-AFK ligado.');

    // ✅ Mini ação imediata (ajuda a “contar” como atividade)
    bot.setControlState('jump', true);
    setTimeout(() => bot?.setControlState('jump', false), 250);

    startAntiAfk();
  });

  bot.once('end', () => scheduleReconnect('end'));

  bot.once('kicked', (reason) => {
    console.log('🚫 Kicked:', reason);
    scheduleReconnect('kicked');
  });

  bot.once('error', (e) => {
    const code = e?.code || '';
    const msg = e?.message || String(e);
    console.log('💥 Error:', code, msg);
    scheduleReconnect(code || msg || 'error');
  });
}

createBot();
