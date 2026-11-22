const fs = require('fs');
const path = require('path');
const express = require('express');
const auth = require('./auth');

let sea = null;
try {
  const nodeSea = require('node:sea');
  if (nodeSea.isSea()) sea = nodeSea;
} catch (_) { /* не SEA-сборка */ }

const SEA_ASSETS = {
  '/': 'public/index.html',
  '/index.html': 'public/index.html',
  '/style.css': 'public/style.css',
  '/app.js': 'public/app.js',
};
const SEA_MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)$/, '$1');
    }
  }
})();
const { streamChat, isDemo, MODEL, ACCESS_TOKEN, BASE_URL } = require('./core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

if (sea) {
  app.get(Object.keys(SEA_ASSETS), (req, res) => {
    const key = SEA_ASSETS[req.path];
    const ext = path.extname(key);
    res.setHeader('Content-Type', SEA_MIME[ext] || 'application/octet-stream');
    res.end(Buffer.from(sea.getAsset(key)));
  });
} else {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

app.get('/api/status', (_req, res) => {
  res.json({
    name: 'FireAI',
    mode: isDemo() ? 'demo' : 'live',
    model: isDemo() ? 'fireai-demo' : MODEL,
    provider: BASE_URL,
    ownApi: {
      endpoint: '/v1/chat/completions',
      auth: ACCESS_TOKEN ? 'Authorization: Bearer <FIREAI_ACCESS_TOKEN>' : 'не требуется (локально)',
    },
  });
});

app.post('/api/register', (req, res) => {
  const { login, password } = req.body || {};
  const result = auth.register(login, password);
  if (result.error) { res.status(400).json({ error: result.error }); return; }
  res.json({ token: auth.sign(result.user), user: result.user });
});

app.post('/api/login', (req, res) => {
  const { login, password } = req.body || {};
  const result = auth.login(login, password);
  if (result.error) { res.status(401).json({ error: result.error }); return; }
  res.json({ token: auth.sign(result.user), user: result.user });
});

app.get('/api/me', (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Требуется вход' }); return; }
  res.json({ user });
});

app.post('/api/logout', (_req, res) => res.json({ ok: true }));

app.post('/api/chat', (req, res, next) => {
  const user = auth.userFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Требуется вход' }); return; }
  next();
});

app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const clean = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));

  if (clean.length === 0 || clean[clean.length - 1].role !== 'user') {
    res.status(400).json({ error: 'Нужен непустой массив messages, последнее сообщение — от пользователя.' });
    return;
  }
  await streamChat(res, clean);
});

const requireToken = (req, res, next) => {
  if (!ACCESS_TOKEN) return next();
  const header = req.headers.authorization || '';
  if (header === `Bearer ${ACCESS_TOKEN}`) return next();
  res.status(401).json({ error: { message: 'Неверный FIREAI_ACCESS_TOKEN', type: 'auth_error' } });
};

app.post('/v1/chat/completions', requireToken, async (req, res) => {
  const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];

  try {
    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.FIREAI_API_KEY ? { Authorization: `Bearer ${process.env.FIREAI_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: req.body.model || MODEL, messages, stream: false }),
    });
    const data = await upstream.json();

    if (isDemo()) {
      res.json({
        id: `fireai-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'fireai-demo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: require('./demo-engine').generate(messages) },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
      return;
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: String((err && err.message) || err), type: 'upstream_error' } });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🔥 FireAI запущен:     http://localhost:${PORT}`);
  console.log(`   Режим:              ${isDemo() ? 'демо (без API-ключа)' : `live через ${BASE_URL}`}`);
  console.log(`   Собственный API:    POST http://localhost:${PORT}/v1/chat/completions`);
});
