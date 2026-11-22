/* FireAI mobile — офлайн-движок + опциональный сервер. */
(() => {
  const el = (id) => document.getElementById(id);
  const storage = (() => {
    try {
      const t = "__fireai_test";
      storage.setItem(t, t);
      storage.removeItem(t);
      return localStorage;
    } catch (_) {
      const mem = new Map();
      return {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k),
      };
    }
  })();
  const $messages = el('messages');
  const $welcome = el('welcome');
  const $scroller = el('scroller');
  const $input = el('input');
  const $send = el('send');
  const $chatList = el('chatList');
  const $modeBadge = el('modeBadge');
  const $sidebar = document.querySelector('.sidebar');
  const $serverUrl = el('serverUrl');

  let SERVER = storage.getItem('fireai.server') || '';
  $serverUrl.value = SERVER;

  el('saveServer').onclick = () => {
    SERVER = $serverUrl.value.trim().replace(/\/+$/, '');
    storage.setItem('fireai.server', SERVER);
    storage.removeItem('fireai.token');
    storage.removeItem('fireai.user');
    ME = '';
    renderBadge();
    el('apiDocsLink').style.display = SERVER ? 'block' : 'none';
    el('apiDocsLink').href = SERVER + '/api.html';
    renderUser();
    ensureServerAuth();
    $sidebar.classList.add('collapsed');
  };
  el('toggleSidebar').onclick = () => $sidebar.classList.toggle('collapsed');

  function authHeaders() {
    const t = storage.getItem('fireai.token');
    return t ? { Authorization: 'Bearer ' + t } : {};
  }
  const $auth = el('authOverlay');
  function showAuth(err) {
    el('authError').textContent = err || '';
    $auth.classList.add('open');
  }
  function hideAuth() { $auth.classList.remove('open'); }
  function renderUser() {
    const b = el('userBadge'), l = el('logoutBtn');
    if (ME && SERVER) { b.style.display = 'block'; b.textContent = '👤 ' + ME; l.style.display = 'block'; }
    else { b.style.display = 'none'; l.style.display = 'none'; }
  }
  async function tryAuthServer(registerMode) {
    const login = el('authLogin').value.trim();
    const password = el('authPassword').value;
    if (!login || !password) return showAuth('Введите логин и пароль');
    try {
      const r = await fetch(SERVER + '/api/' + (registerMode ? 'register' : 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return showAuth(d.error || 'Ошибка входа');
      storage.setItem('fireai.token', d.token);
      storage.setItem('fireai.user', d.user);
      ME = d.user;
      hideAuth();
      renderUser();
      chats = load();
      currentId = storage.getItem(kk(LS_CURRENT));
      if (chats.length === 0) newChat();
      else { renderSidebar(); renderMessages(); }
    } catch (_) {
      showAuth('Сервер недоступен');
    }
  }
  el('authLoginBtn').onclick = () => tryAuthServer(false);
  el('authRegisterBtn').onclick = () => tryAuthServer(true);
  el('authSkip').onclick = () => { hideAuth(); };
  el('logoutBtn').onclick = () => {
    storage.removeItem('fireai.token');
    storage.removeItem('fireai.user');
    ME = '';
    SERVER = '';
    $serverUrl.value = '';
    storage.setItem('fireai.server', '');
    storage.removeItem(kk(LS_CURRENT));
    renderBadge();
    renderUser();
    chats = load();
    if (chats.length === 0) newChat();
    else { renderSidebar(); renderMessages(); }
  };
  async function ensureServerAuth() {
    if (!SERVER) { hideAuth(); return; }
    const t = storage.getItem('fireai.token');
    try {
      const r = await fetch(SERVER + '/api/me', { headers: authHeaders() });
      if (r.ok) {
        ME = (await r.json()).user;
        renderUser();
        hideAuth();
      } else {
        storage.removeItem('fireai.token');
        ME = '';
        renderUser();
        showAuth('Для работы с сервером нужен вход');
      }
    } catch (_) {
      hideAuth();
    }
  }

  function renderBadge() {
    if (!SERVER) {
      $modeBadge.textContent = 'офлайн · демо';
      $modeBadge.className = 'mode-badge demo';
    } else {
      $modeBadge.textContent = 'live · сервер';
      $modeBadge.className = 'mode-badge live';
    }
  }

  const LS_CHATS = 'fireai.chats';
  const LS_CURRENT = 'fireai.current';
  const kk = (b) => (SERVER ? `${b}.${ME || 'guest'}.v1` : `${b}.${ME || 'guest'}.v1`);

  let ME = '';
  let chats = load();
  let currentId = storage.getItem(kk(LS_CURRENT));

  function load() {
    try {
      const p = JSON.parse(storage.getItem(kk(LS_CHATS)));
      return Array.isArray(p) ? p : [];
    } catch (_) {
      return [];
    }
  }
  const save = () => {
    storage.setItem(LS_CHATS, JSON.stringify(chats));
    storage.setItem(LS_CURRENT, currentId || '');
  };
  const currentChat = () => chats.find((c) => c.id === currentId) || null;

  function newChat() {
    const chat = { id: 'c' + Date.now(), title: 'Новый чат', messages: [] };
    chats.unshift(chat);
    currentId = chat.id;
    save();
    renderSidebar();
    renderMessages();
    $input.focus();
  }

  function renderSidebar() {
    $chatList.innerHTML = '';
    for (const chat of chats) {
      const item = document.createElement('div');
      item.className = 'chat-item' + (chat.id === currentId ? ' active' : '');
      item.innerHTML = '<span>💬</span>';
      item.appendChild(document.createTextNode(chat.title));
      item.onclick = () => {
        currentId = chat.id;
        save();
        renderSidebar();
        renderMessages();
      };
      $chatList.appendChild(item);
    }
  }

  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function renderMarkdown(text) {
    const parts = text.split(/```/);
    let html = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        const nl = parts[i].indexOf('\n');
        const lang = nl === -1 ? '' : parts[i].slice(0, nl).trim();
        const code = nl === -1 ? parts[i] : parts[i].slice(nl + 1);
        html += codeblockHtml(lang, code);
      } else {
        let t = escapeHtml(parts[i])
          .replace(/^### (.*)$/gm, '<h3>$1</h3>')
          .replace(/^## (.*)$/gm, '<h2>$1</h2>')
          .replace(/^# (.*)$/gm, '<h1>$1</h1>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`\n]+)`/g, '<code>$1</code>')
          .replace(/^\s*[-•] (.*)$/gm, '<li>$1</li>')
          .replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
        t = t.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
        html += t
          .split(/\n{2,}/)
          .map((b) => (b.trim() && !/^<(h\d|ul|div|li)/.test(b.trim()) ? `<p>${b.trim()}</p>` : b))
          .join('\n');
      }
    }
    return html;
  }


  function codeblockHtml(lang, code) {
    const langKey = (lang || '').trim().toLowerCase();
    const isHtml = langKey === 'html' || langKey === 'htm';
    const tooLong = code.length > 1200;
    const shown = tooLong ? code.slice(0, 1200) : code;
    const preview = escapeHtml(shown) + (tooLong ? '\n… код длинный — нажмите «Показать весь код»' : '');
    const runBtn = isHtml ? '<button class="run-btn">▶ Запустить</button>' : '';
    const moreBtn = tooLong ? '<button class="more-btn">Показать весь код</button>' : '';
    const full = encodeURIComponent(code.replace(/\n$/, ''));
    return '<div class="codeblock"' +
      ' data-full="' + full + '">' +
      '<div class="codeblock-head"><span>' + escapeHtml(lang || 'код') + '</span>' +
      '<span class="head-actions">' + runBtn + moreBtn +
      '<button class="copy-btn">Копировать</button></span></div>' +
      '<pre>' + preview + '</pre></div>';
  }

  function bindCodeActions(root) {
    root.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.onclick = () => {
        const cb = btn.closest('.codeblock');
        const code = cb.getAttribute('data-full') ? decodeURIComponent(cb.getAttribute('data-full')) : cb.querySelector('pre').textContent;
        try { navigator.clipboard && navigator.clipboard.writeText(code); } catch (_) {}
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = 'Копировать'), 1200);
      };
    });
    root.querySelectorAll('.more-btn').forEach((btn) => {
      btn.onclick = () => {
        const cb = btn.closest('.codeblock');
        cb.querySelector('pre').textContent = decodeURIComponent(cb.getAttribute('data-full'));
        btn.remove();
      };
    });
    root.querySelectorAll('.run-btn').forEach((btn) => {
      btn.onclick = () => {
        const cb = btn.closest('.codeblock');
        let ov = document.querySelector('.run-overlay');
        if (!ov) {
          ov = document.createElement('div');
          ov.className = 'run-overlay';
          ov.innerHTML = '<div class="run-bar"><button class="run-close">✕ Закрыть</button></div><iframe class="run-frame" sandbox="allow-scripts"></iframe>';
          document.body.appendChild(ov);
          ov.querySelector('.run-close').onclick = () => ov.remove();
        }
        const frame = ov.querySelector('iframe');
        frame.srcdoc = decodeURIComponent(cb.getAttribute('data-full'));
        ov.classList.add('open');
      };
    });
  }

  const bindCopy = bindCodeActions;

  function renderMessages() {
    const chat = currentChat();
    $messages.innerHTML = '';
    const has = chat && chat.messages.length > 0;
    $welcome.style.display = has ? 'none' : '';
    if (!has) return;
    for (const m of chat.messages) {
      if (m.role === 'user') addBubble('user', m.content);
      else {
        const node = addBubble('ai', '');
        node.bubble.innerHTML = renderMarkdown(m.content);
        bindCopy(node.bubble);
      }
    }
    scrollDown();
  }

  function addBubble(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? '🧑' : '🔥';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    wrap.append(avatar, bubble);
    $messages.appendChild(wrap);
    return { wrap, bubble };
  }

  const scrollDown = () => (window.scrollTo(0, document.body.scrollHeight));

  let busy = false;

  async function send(prompt) {
    if (busy || !prompt.trim()) return;
    if (!currentChat()) newChat();
    const chat = currentChat();
    chat.messages.push({ role: 'user', content: prompt });
    if (chat.title === 'Новый чат') chat.title = prompt.slice(0, 30);
    save();
    renderSidebar();

    $welcome.style.display = 'none';
    addBubble('user', prompt);
    scrollDown();

    busy = true;
    $send.disabled = true;
    const node = addBubble('ai', '');
    node.bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';

    let full = '';
    try {
      if (SERVER) {
        const res = await fetch(SERVER + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ messages: chat.messages }),
        });
        if (res.status === 401) {
          showAuth('Войдите в аккаунт на сервере');
          throw new Error('Нужно войти в аккаунт');
        }
        if (!res.ok || !res.body) throw new Error('Сервер ответил ' + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          for (;;) {
            const i = buf.indexOf('\n\n');
            if (i < 0) break;
            const ev = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const dl = ev.split('\n').find((l) => l.startsWith('data:'));
            if (!dl) continue;
            const p = JSON.parse(dl.slice(5));
            if (ev.includes('event: error')) throw new Error(p.message || 'Ошибка');
            if (p.content) {
              full += p.content;
              node.bubble.innerHTML = renderMarkdown(full);
              scrollDown();
            }
          }
        }
      } else {
        full = generate(chat.messages);
        const words = full.match(/\s*\S+/g) || [full];
        let acc = '';
        for (const w of words) {
          acc += w;
          node.bubble.innerHTML = renderMarkdown(acc);
          scrollDown();
          await new Promise((r) => setTimeout(r, 8));
        }
      }
      chat.messages.push({ role: 'assistant', content: full });
      bindCodeActions(node.bubble);
      save();
    } catch (err) {
      node.bubble.innerHTML = `<div class="error-box">⚠️ ${escapeHtml(String(err.message || err))}</div>`;
    } finally {
      busy = false;
      $send.disabled = false;
      scrollDown();
    }
  }

  $send.onclick = () => {
    const t = $input.value;
    $input.value = '';
    autosize();
    send(t);
  };
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $send.click();
    }
  });
  function autosize() {
    $input.style.height = 'auto';
    $input.style.height = Math.min($input.scrollHeight, 160) + 'px';
  }
  $input.addEventListener('input', autosize);

  document.querySelectorAll('.suggestion').forEach((b) => (b.onclick = () => send(b.dataset.prompt)));
  el('newChat').onclick = newChat;
  renderBadge();

  if (chats.length === 0) newChat();
  else {
    if (!currentChat()) currentId = chats[0].id;
    renderSidebar();
    renderMessages();
  }
})();
