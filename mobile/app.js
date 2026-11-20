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
    renderBadge();
    $sidebar.classList.add('collapsed');
  };
  el('toggleSidebar').onclick = () => $sidebar.classList.toggle('collapsed');

  function renderBadge() {
    if (!SERVER) {
      $modeBadge.textContent = 'офлайн · демо';
      $modeBadge.className = 'mode-badge demo';
    } else {
      $modeBadge.textContent = 'live · сервер';
      $modeBadge.className = 'mode-badge live';
    }
  }

  const LS_CHATS = 'fireai.chats.v1';
  const LS_CURRENT = 'fireai.current.v1';
  let chats = load();
  let currentId = storage.getItem(LS_CURRENT);

  function load() {
    try {
      const p = JSON.parse(storage.getItem(LS_CHATS));
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
        html += `<div class="codeblock"><div class="codeblock-head"><span>${escapeHtml(lang || 'код')}</span><button class="copy-btn">Копировать</button></div><pre>${escapeHtml(code.replace(/\n$/, ''))}</pre></div>`;
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

  function bindCopy(root) {
    root.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.onclick = () => {
        const code = btn.closest('.codeblock').querySelector('pre').textContent;
        try { navigator.clipboard && navigator.clipboard.writeText(code); } catch (_) {}
        btn.textContent = '✓';
        setTimeout(() => (btn.textContent = 'Копировать'), 1200);
      };
    });
  }

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chat.messages }),
        });
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
      chat.messages.push({ role: 'assistant', content: full || generate(chat.messages) });
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
  renderBadge();

  if (chats.length === 0) newChat();
  else {
    if (!currentChat()) currentId = chats[0].id;
    renderSidebar();
    renderMessages();
  }
})();
