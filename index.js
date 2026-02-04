const mineflayer = require('mineflayer');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot online'));
app.listen(3000, () => console.log('Server running on port 3000'));

const config = {
  host: 'SquadSuper.aternos.me',
  port: 53867,
  username: 'Bot24Horas',
  version: false
};

let bot;
let antiAfkInterval;

function startAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval);

  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return;

    const action = Math.floor(Math.random() * 3);

    if (action === 0) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    } else if (action === 1) {
      const dir = Math.random() > 0.5 ? 'forward' : 'back';
      bot.setControlState(dir, true);
      setTimeout(() => bot.setControlState(dir, false), 900);
    } else {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() * 0.6) - 0.3;
      bot.look(yaw, pitch, true);
    }
  }, 15000);
}

function createBot() {
  console.log(`Conectando em ${config.host}:${config.port}...`);
  bot = mineflayer.createBot(config);

  bot.on('login', () => console.log(`Logado como ${bot.username}`));
  bot.on('spawn', () => {
    console.log('Spawnado! Anti-AFK ligado.');
    startAntiAfk();
  });

  const reconnect = (reason) => {
    console.log(`Caiu: ${reason || 'desconhecido'}`);
    if (antiAfkInterval) clearInterval(antiAfkInterval);

    const delay = Math.floor(Math.random() * 10000) + 5000;
    console.log(`Reconectando em ${delay}ms...`);
    setTimeout(createBot, delay);
  };

  bot.on('end', () => reconnect('end'));
  bot.on('error', (e) => reconnect(e?.message || 'error'));
  bot.on('kicked', (r) => reconnect(`kicked: ${r}`));
}

createBot();
