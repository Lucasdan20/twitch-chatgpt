import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';
import { MemoryManager } from './memory_manager.js';

// ------------------------------
// 🔧 CONFIGURAÇÃO BASE
// ------------------------------

job.start();
console.log(process.env);

const app = express();
const expressWsInstance = expressWs(app);
app.set('view engine', 'ejs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GPT_MODE = process.env.GPT_MODE || 'CHAT';
const HISTORY_LENGTH = process.env.HISTORY_LENGTH || 5;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';
const TWITCH_USER = process.env.TWITCH_USER || 'oSetinhasBot';
const TWITCH_AUTH = process.env.TWITCH_AUTH || '';
const COMMAND_NAME = process.env.COMMAND_NAME || '!gpt';
const CHANNELS = process.env.CHANNELS || 'coelhodebaunilha,biack_frost';
const SEND_USERNAME = process.env.SEND_USERNAME || 'true';
const ENABLE_TTS = process.env.ENABLE_TTS || 'false';
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS || 'false';
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10) || 10;

if (!OPENAI_API_KEY) {
  console.error('No OPENAI_API_KEY found. Please set it as an environment variable.');
}

// ------------------------------
// ⚙️ FUNÇÕES DE SUPORTE
// ------------------------------

function normChannel(raw) {
  return raw.replace(/^#/, '').trim().toLowerCase();
}

function loadContextFor(channelName) {
  const contextsDir = path.join(__dirname, 'contexts');
  const perChannelPath = path.join(contextsDir, `${channelName}.txt`);
  const defaultPath = path.join(contextsDir, 'file_context.txt');

  if (fs.existsSync(perChannelPath)) {
    console.log(`📄 Loaded context for channel: ${channelName}`);
    return fs.readFileSync(perChannelPath, 'utf8');
  } else {
    console.log(`📄 Loaded default context for channel: ${channelName}`);
    return fs.readFileSync(defaultPath, 'utf8');
  }
}

// ------------------------------
// 🤖 CONFIGURAÇÃO DO BOT
// ------------------------------

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let lastResponseTime = 0;

console.log('Channels:', channels);

const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Instâncias de OpenAI e Memória por canal
const opsByChannel = new Map();
const memoryByChannel = new Map();

channels.forEach(c => {
  const name = normChannel(c);
  const context = loadContextFor(name);
  const ops = new OpenAIOperations(context, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);
  opsByChannel.set(name, ops);
  memoryByChannel.set(name, new MemoryManager(name));
});

// ------------------------------
// 🌐 EVENTOS DO BOT
// ------------------------------

bot.onConnected((addr, port) => {
  console.log(`* Connected to ${addr}:${port}`);
  channels.forEach(channel => {
    console.log(`* Joining ${channel}`);
    console.log(`* Saying hello in ${channel}`);
  });
});

bot.onDisconnected(reason => {
  console.log(`Disconnected: ${reason}`);
});

bot.connect(
  () => console.log('Bot connected!'),
  error => console.error("Bot couldn't connect!", error)
);

// ------------------------------
// 💬 MENSAGENS DO CHAT (memória viva + filtro de bots)
// ------------------------------

bot.onMessage(async (channel, user, message, self) => {
  if (self) return;

  const chName = normChannel(channel);
  const memory = memoryByChannel.get(chName);
  const openaiOps = opsByChannel.get(chName) || opsByChannel.values().next().value;

  if (!memory) {
    console.error(`Nenhuma memória encontrada para o canal ${chName}`);
    return;
  }

  // 🧩 Ignora bots automáticos (exceto LivePix)
  const botUsernames = ['streamelements', 'streamlabs', 'nightbot', 'moobot', 'soundalerts', 'fossabot'];
  const isBotMessage = botUsernames.some(bot => user.username?.toLowerCase().includes(bot));
  if (isBotMessage && !user.username.toLowerCase().includes('livepix')) {
    console.log(`🤖 Ignorando mensagem automática de ${user.username}`);
    return;
  }

  // 💬 Salva toda mensagem no banco (mesmo sem comando)
  console.log(`💬 [${chName}] (${user.username}): ${message}`);
  memory.saveUser(user.username, "", [
    { role: "user", content: message }
  ]);

  // 🔎 Se não for comando (!gpt etc), só registra e sai
  const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
  if (!command) return;

  // 🔄 Cooldown
  const currentTime = Date.now();
  const elapsedTime = (currentTime - lastResponseTime) / 1000;
  if (elapsedTime < COOLDOWN_DURATION) {
    bot.say(channel, `Cooldown ativo. Espere ${COOLDOWN_DURATION - elapsedTime.toFixed(1)}s antes de mandar outra mensagem.`);
    return;
  }
  lastResponseTime = currentTime;

  // 🧠 Recupera memória do usuário
  const userMem = memory.getUser(user.username);
  let text = message.slice(command.length).trim();
  if (SEND_USERNAME === 'true') {
    text = `Mensagem do usuário ${user.username}: ${text}`;
  }

  const memoryPrompt = `
Você é a Jurema neste canal (${chName}).
Resumo do usuário: ${userMem.summary || "sem dados anteriores"}.
Últimas mensagens trocadas:
${userMem.history.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n")}
`;

  const fullPrompt = `${memoryPrompt}\nUsuário: ${text}`;
  const response = await openaiOps.make_openai_call(fullPrompt);

  // 🧾 Atualiza histórico e salva resposta no banco
  userMem.history.push({ role: "user", content: text });
  userMem.history.push({ role: "assistant", content: response });
  memory.saveUser(user.username, userMem.summary, userMem.history);

  console.log(`💾 [${chName}] Resposta gerada: ${response.substring(0, 120)}...`);

  // 📤 Envia pro chat
  if (response.length > maxLength) {
    const messages = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
    messages.forEach((msg, index) => setTimeout(() => bot.say(channel, msg), 1000 * index));
  } else {
    bot.say(channel, response);
  }
});

// ------------------------------
// 🌐 EXPRESS SERVER
// ------------------------------

app.ws('/check-for-updates', (ws, req) => {
  ws.on('message', message => {});
});

app.use(express.json({ extended: true, limit: '1mb' }));
app.use('/public', express.static('public'));

app.all('/', (req, res) => {
  console.log('Received a request!');
  res.render('pages/index');
});

app.get('/gpt/:text', async (req, res) => {
  const text = req.params.text;
  let answer = '';
  try {
    const defaultOps = opsByChannel.values().next().value;
    answer = await defaultOps.make_openai_call(text);
    res.send(answer);
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).send('An error occurred while generating the response.');
  }
});

const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});

const wss = expressWsInstance.getWss();
wss.on('connection', ws => {
  ws.on('message', message => {});
});

function notifyFileChange() {
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify({ updated: true }));
    }
  });
}
