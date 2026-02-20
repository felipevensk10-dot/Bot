// index.js
const mineflayer = require('mineflayer')
const express = require('express')

const app = express()
app.get('/', (req, res) => res.send('Bot online ✅'))

const WEB_PORT = process.env.PORT || 3000
app.listen(WEB_PORT, () => console.log('Web running on port', WEB_PORT))

function parseMCVersion(v) {
  if (!v) return '1.21.1'
  const s = String(v).trim().toLowerCase()
  if (s === 'false' || s === 'auto' || s === 'detect') return '1.21.1'
  return v
}

function normalizeKickReason(reason) {
  try {
    if (!reason) return 'kicked'
    if (typeof reason === 'string') return reason
    // Paper costuma mandar JSON tipo { text: "...", extra: [...] }
    if (reason.text) return reason.text
    return JSON.stringify(reason)
  } catch {
    return 'kicked'
  }
}

const config = {
  host: process.env.MC_HOST || 'SquadSuper.aternos.me',
  port: Number(process.env.MC_PORT || 53867),

  // ✅ offline: nickname qualquer
  // ✅ microsoft: precisa conta Microsoft (Java)
  auth: (process.env.MC_AUTH || 'offline').toLowerCase(), // 'offline' | 'microsoft'

  username: process.env.MC_USER || 'Bot24horas',
  version: parseMCVersion(process.env.MC_VERSION),

  // Pequenas melhorias de estabilidade
  hideErrors: true,
  checkTimeoutInterval: 60_000,
}

let bot = null
let antiAfkInterval = null
let reconnectTimer = null

const RECONNECT_DELAY = 15_000 // 15s

function stopAntiAfk() {
  if (antiAfkInterval) clearInterval(antiAfkInterval)
  antiAfkInterval = null
}

function startAntiAfk() {
  stopAntiAfk()

  antiAfkInterval = setInterval(() => {
    if (!bot || !bot.entity) return

    const action = Math.floor(Math.random() * 3)

    if (action === 0) {
      bot.setControlState('jump', true)
      setTimeout(() => bot?.setControlState('jump', false), 200)
    } else if (action === 1) {
      const dir = Math.random() > 0.5 ? 'forward' : 'back'
      bot.setControlState(dir, true)
      setTimeout(() => bot?.setControlState(dir, false), 600)
    } else {
      bot.look(
        bot.entity.yaw + (Math.random() - 0.5) * 0.4,
        bot.entity.pitch,
        true
      )
    }
  }, 20_000)
}

function cleanupBot() {
  stopAntiAfk()
  if (bot) {
    try {
      bot.removeAllListeners()
      bot.end()
    } catch {}
  }
  bot = null
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return

  cleanupBot()

  const jitter = Math.floor(Math.random() * 3000) // 0–3s
  const wait = RECONNECT_DELAY + jitter

  console.log(`Caiu (${reason}). Reconectando em ${wait}ms...`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, wait)
}

function createBot() {
  if (reconnectTimer) return

  console.log(`Conectando em ${config.host}:${config.port} (v${config.version}, auth=${config.auth})...`)

  try {
    bot = mineflayer.createBot(config)
  } catch (e) {
    return scheduleReconnect(e?.message || 'createBot error')
  }

  bot.once('login', () => console.log(`Logado como ${bot.username}`))

  bot.once('spawn', () => {
    console.log('Spawnado! Anti-AFK ligado ✅')
    startAntiAfk()
  })

  // Logs úteis no Paper
  bot.on('message', (msg) => {
    // Evita flood: comente se quiser ver tudo
    // console.log('[CHAT]', msg.toString())
  })

  bot.once('end', () => scheduleReconnect('end'))
  bot.once('error', (e) => scheduleReconnect(e?.message || 'error'))
  bot.once('kicked', (reason) => scheduleReconnect(`kicked: ${normalizeKickReason(reason)}`))
}

createBot()
