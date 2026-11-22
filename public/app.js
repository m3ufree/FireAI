/* FireAI — клиент. Стриминг через SSE, история чатов в storage. */
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

  const LS_CHATS = 'fireai.chats';
  const LS_CURRENT = 'fireai.current';
  const kk = (b) => (ME ? `${b}.${ME}.v1` : `${b}.v1`);

  let ME = '';
  let chats = load();
  let currentId = storage.getItem(kk(LS_CURRENT));

  function load() {
    try {
      const parsed = JSON.parse(storage.getItem(kk(LS_CHATS)));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  const save = () => {
    storage.setItem(kk(LS_CHATS), JSON.stringify(chats));
    storage.setItem(kk(LS_CURRENT), currentId || '');
  };

  function currentChat() {
    return chats.find((c) => c.id === currentId) || null;
  }

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

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

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
        let t = escapeHtml(parts[i]);
        t = t.replace(/^### (.*)$/gm, '<h3>$1</h3>')
          .replace(/^## (.*)$/gm, '<h2>$1</h2>')
          .replace(/^# (.*)$/gm, '<h1>$1</h1>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
          .replace(/`([^`\n]+)`/g, '<code>$1</code>')
          .replace(/^\s*[-•] (.*)$/gm, '<li>$1</li>')
          .replace(/^\s*\d+\. (.*)$/gm, '<li>$1</li>');
        t = t.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
        html += t
          .split(/\n{2,}/)
          .map((block) => (block.trim() && !/^<(h\d|ul|div|li)/.test(block.trim()) ? `<p>${block.trim()}</p>` : block))
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

  const bindCopyButtons = bindCodeActions;

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
        bindCopyButtons(node.bubble);
      }
    }
    scrollToBottom();
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

  function scrollToBottom() {
    $scroller.scrollTop = $scroller.scrollHeight;
  }

  let busy = false;

  async function send(prompt) {
    if (busy || !prompt.trim()) return;
    if (!currentChat()) newChat();
    const chat = currentChat();

    chat.messages.push({ role: 'user', content: prompt });
    if (chat.title === 'Новый чат') chat.title = prompt.slice(0, 34) || 'Новый чат';
    save();
    renderSidebar();

    $welcome.style.display = 'none';
    addBubble('user', prompt);
    scrollToBottom();

    busy = true;
    $send.disabled = true;
    const node = addBubble('ai', '');
    node.bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ messages: chat.messages }),
      });
      if (res.status === 401) {
        ME = '';
        renderUser();
        showAuth('Нужно войти в аккаунт');
        throw new Error('Нужно войти в аккаунт');
      }
      if (!res.ok || !res.body) throw new Error('Сервер ответил ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();
        for (const ev of events) {
          const dataLine = ev.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          let payload;
          try { payload = JSON.parse(dataLine.slice(5).trim()); } catch (_) { continue; }

          if (ev.includes('event: error')) {
            throw new Error(payload.message || 'Ошибка стрима');
          }
          if (payload.content) {
            full += payload.content;
            node.bubble.innerHTML = renderMarkdown(full);
            scrollToBottom();
          }
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
      scrollToBottom();
    }
  }

  $send.onclick = () => {
    const text = $input.value;
    $input.value = '';
    autosize();
    send(text);
  };
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $send.click();
    }
  });
  function autosize() {
    $input.style.height = 'auto';
    $input.style.height = Math.min($input.scrollHeight, 200) + 'px';
  }
  $input.addEventListener('input', autosize);

  el('newChat').onclick = newChat;
  el('toggleSidebar').onclick = () => $sidebar.classList.toggle('collapsed');
  document.querySelectorAll('.suggestion').forEach((btn) => {
    btn.onclick = () => send(btn.dataset.prompt);
  });

  (async () => {
    try {
      const status = await (await fetch('/api/status')).json();
      $modeBadge.textContent = status.mode === 'demo' ? 'демо-режим · без ключа' : `live · ${status.model}`;
      $modeBadge.className = 'mode-badge ' + status.mode;
    } catch (_) {
      $modeBadge.textContent = 'офлайн';
    }
  })();

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
    if (ME) { b.style.display = 'block'; b.textContent = '👤 ' + ME; l.style.display = 'block'; }
    else { b.style.display = 'none'; l.style.display = 'none'; }
  }
  async function tryAuth(registerMode) {
    const login = el('authLogin').value.trim();
    const password = el('authPassword').value;
    if (!login || !password) return showAuth('Введите логин и пароль');
    try {
      const r = await fetch('/api/' + (registerMode ? 'register' : 'login'), {
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
  el('authLoginBtn').onclick = () => tryAuth(false);
  el('authRegisterBtn').onclick = () => tryAuth(true);
  el('authSkip').onclick = () => {
    ME = '';
    storage.removeItem('fireai.token');
    storage.removeItem('fireai.user');
    hideAuth();
    renderUser();
    chats = load();
    if (chats.length === 0) newChat();
    else { renderSidebar(); renderMessages(); }
  };
  el('logoutBtn').onclick = async () => {
    try { await fetch('/api/logout', { method: 'POST', headers: authHeaders() }); } catch (_) {}
    storage.removeItem('fireai.token');
    storage.removeItem('fireai.user');
    ME = '';
    renderUser();
    chats = load();
    if (chats.length === 0) newChat();
    else { renderSidebar(); renderMessages(); }
    showAuth('Вошли как гость — войдите, чтобы вернуть историю');
  };

  (async () => {
    const t = storage.getItem('fireai.token');
    if (t) {
      try {
        const r = await fetch('/api/me', { headers: authHeaders() });
        if (r.ok) { ME = (await r.json()).user; renderUser(); }
        else {
          storage.removeItem('fireai.token');
          showAuth('Сессия истекла — войдите заново');
        }
      } catch (_) {
        /* сервер пока офлайн */
      }
    } else {
      showAuth();
    }
  })();

  if (chats.length === 0) newChat();
  else {
    if (!currentChat()) currentId = chats[0].id;
    renderSidebar();
    renderMessages();
  }
})();
