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
  '/api.html': 'public/api.html',
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
const { streamChat, isDemo, answerStream, MODEL, ACCESS_TOKEN, BASE_URL } = require('./core');

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
      auth: 'Authorization: Bearer sk-fireai-… (ключ со страницы /api.html) или FIREAI_ACCESS_TOKEN',
      docs: '/api.html',
      models: '/v1/models',
      streaming: true,
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

app.get('/api/keys', (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Требуется вход' }); return; }
  res.json({ keys: auth.listApiKeys(user) });
});

app.post('/api/keys', (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Требуется вход' }); return; }
  const created = auth.createApiKey(user);
  if (!created) { res.status(500).json({ error: 'Не удалось создать ключ' }); return; }
  res.json(created);
});

app.delete('/api/keys/:id', (req, res) => {
  const user = auth.userFromRequest(req);
  if (!user) { res.status(401).json({ error: 'Требуется вход' }); return; }
  const ok = auth.revokeApiKey(user, req.params.id);
  res.json(ok ? { ok: true } : { error: 'Ключ не найден' });
});

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

const v1User = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (ACCESS_TOKEN && token === ACCESS_TOKEN) return 'admin';
  return auth.check(token) || auth.userFromApiKey(token);
};

app.get('/v1/models', (req, res) => {
  if (!v1User(req)) {
    res.status(401).json({ error: { message: 'Требуется API-ключ', type: 'auth_error' } });
    return;
  }
  const model = isDemo() ? 'fireai-demo' : MODEL;
  res.json({ object: 'list', data: [{ id: model, object: 'model', owned_by: 'fireai' }] });
});

app.post('/v1/chat/completions', async (req, res) => {
  const user = v1User(req);
  if (!user) {
    res.status(401).json({ error: { message: 'Требуется API-ключ (Bearer sk-fireai-…)', type: 'auth_error' } });
    return;
  }
  if (!Array.isArray(req.body && req.body.messages)) {
    res.status(400).json({ error: { message: 'Нужен массив messages', type: 'invalid_request_error' } });
    return;
  }
  const messages = req.body.messages;
  const model = isDemo() ? 'fireai-demo' : MODEL;
  const created = Math.floor(Date.now() / 1000);

  try {
    if (req.body.stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const chunk = (delta, finish) =>
        res.write(
          'data: ' +
            JSON.stringify({
              id: 'chatcmpl-' + created,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [{ index: 0, delta, finish_reason: finish }],
            }) +
            '\n\n',
        );
      chunk({ role: 'assistant' }, null);
      let full = '';
      for await (const token of answerStream(messages)) {
        full += token;
        chunk({ content: token }, null);
      }
      if (!full) chunk({ content: ' ' }, null);
      chunk({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      let full = '';
      for await (const token of answerStream(messages)) full += token;
      res.json({
        id: 'chatcmpl-' + created,
        object: 'chat.completion',
        created,
        model,
        choices: [{ index: 0, message: { role: 'assistant', content: full || ' ' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: { message: String((err && err.message) || err), type: 'upstream_error' } });
    } else {
      res.end();
    }
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🔥 FireAI запущен:     http://localhost:${PORT}`);
  console.log(`   Режим:              ${isDemo() ? 'демо (без API-ключа)' : `live через ${BASE_URL}`}`);
  console.log(`   Собственный API:    POST http://localhost:${PORT}/v1/chat/completions`);
});
