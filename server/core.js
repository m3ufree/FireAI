function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const BASE_URL = env('FIREAI_BASE_URL', 'https://api.mistral.ai/v1').replace(/\/+$/, '');
const API_KEY = env('FIREAI_API_KEY');
const MODEL = env('FIREAI_MODEL', 'mistral-large-latest');
const ACCESS_TOKEN = env('FIREAI_ACCESS_TOKEN');

const SYSTEM_PROMPT = [
  'Ты — FireAI, очень умный и полезный ИИ-ассистент.',
  'Ты свободно знаешь все языки программирования и пишешь чистый, рабочий код.',
  'Ты умеешь создавать 3D-игры (three.js, WebGL) и 3D-модели (описания, скрипты генерации).',
  'Ты умеешь сочинять песни: текст, структуру куплетов/припевов, аккорды.',
  'Отвечай на языке пользователя. Код всегда оформляй в markdown-блоки с указанием языка.',
].join(' ');

function isDemo() {
  return !API_KEY;
}

async function* upstreamStream(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Провайдер вернул ${res.status}: ${text.slice(0, 300)}`);
  }

  let buffer = '';
  for await (const chunk of res.body) {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        const content = delta && delta.content;
        if (content) yield content;
      } catch (_) {
        /* неполные чанки пропускаем */
      }
    }
  }
}

async function* demoStream(answer) {
  const tokens = answer.match(/\s*\S+/g) || [answer];
  for (const token of tokens) {
    yield token;
    await new Promise((r) => setTimeout(r, 10));
  }
}

function toUpstreamMessages(messages) {
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamChat(res, messages) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  sseWrite(res, 'meta', { model: isDemo() ? 'fireai-demo' : MODEL, mode: isDemo() ? 'demo' : 'live' });

  try {
    if (isDemo()) {
      const { generate } = require('./demo-engine');
      for await (const token of demoStream(generate(messages))) sseWrite(res, 'delta', { content: token });
    } else {
      for await (const token of upstreamStream(toUpstreamMessages(messages))) {
        sseWrite(res, 'delta', { content: token });
      }
    }
    sseWrite(res, 'done', { finish: 'stop' });
  } catch (err) {
    sseWrite(res, 'error', { message: String((err && err.message) || err) });
  }
  res.end();
}

module.exports = { BASE_URL, ACCESS_TOKEN, MODEL, isDemo, streamChat };
