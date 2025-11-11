import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';
import expressWs from 'express-ws';
import { job } from './keep_alive.js';
import { OpenAIOperations } from './openai_operations.js';
import { TwitchBot } from './twitch_bot.js';

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
const MODEL_NAME = process.env.MODEL_NAME || 'gpt-3.5-turbo';
const TWITCH_USER = process.env.TWITCH_USER || 'oSetinhasBot';
const TWITCH_AUTH = process.env.TWITCH_AUTH || 'oauth:vgvx55j6qzz1lkt3cwggxki1lv53c2';
const COMMAND_NAME = process.env.COMMAND_NAME || '!gpt';
const CHANNELS = process.env.CHANNELS || 'oSetinhas,jones88';
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
  const defaultPath = path.join(__dirname, 'file_context.txt');

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

// cria uma instância do OpenAI pra cada canal
const opsByChannel = new Map();
channels.forEach(c => {
  const name = normChannel(c);
  const context = loadContextFor(name);
  const ops = new OpenAIOperations(context, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);
  opsByChannel.set(name, ops);
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
// 💬 MENSAGENS DO CHAT
// ------------------------------

bot.onMessage(async (channel, user, message, self) => {
  if (self) return;

  const currentTime = Date.now();
  const elapsedTime = (currentTime - lastResponseTime) / 1000;

  const chName = normChannel(channel);
  const openaiOps = opsByChannel.get(chName) || opsByChannel.values().next().value;

  if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
    if (elapsedTime < COOLDOWN_DURATION) {
      bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
      return;
    }
    lastResponseTime = currentTime;
    const response = await openaiOps.make_openai_call(message);
    bot.say(channel, response);
  }

  const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
  if (command) {
    if (elapsedTime < COOLDOWN_DURATION) {
      bot.say(channel, `Cooldown active. Please wait ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} seconds before sending another message.`);
      return;
    }
    lastResponseTime = currentTime;

    let text = message.slice(command.length).trim();
    if (SEND_USERNAME === 'true') {
      text = `Message from user ${user.username}: ${text}`;
    }

    const response = await openaiOps.make_openai_call(text);
    if (response.length > maxLength) {
      const messages = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
      messages.forEach((msg, index) => {
        setTimeout(() => bot.say(channel, msg), 1000 * index);
      });
    } else {
      bot.say(channel, response);
    }

    if (ENABLE_TTS === 'true') {
      try {
        const ttsAudioUrl = await bot.sayTTS(channel, response, user['userstate']);
        notifyFileChange(ttsAudioUrl);
      } catch (error) {
        console.error('TTS Error:', error);
      }
    }
  }
});

// ------------------------------
// 🌐 EXPRESS SERVER
// ------------------------------

app.ws('/check-for-updates', (ws, req) => {
  ws.on('message', message => {});
});

const messages = [{ role: 'system', content: 'You are a helpful Twitch Chatbot.' }];
console.log('GPT_MODE:', GPT_MODE);
console.log('History length:', HISTORY_LENGTH);
console.log('Model Name:', MODEL_NAME);

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
    if (GPT_MODE === 'CHAT') {
      answer = await defaultOps.make_openai_call(text);
    } else if (GPT_MODE === 'PROMPT') {
      const prompt = `${fileContext}\n\nUser: ${text}\nAgent:`;
      answer = await defaultOps.make_openai_call_completion(prompt);
    } else {
      throw new Error('GPT_MODE is not set to CHAT or PROMPT.');
    }
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
