const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'session-secret');
const TTL = 1000 * 60 * 60 * 24 * 30;

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
  if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
}

function secret() {
  return fs.readFileSync(SECRET_FILE, 'utf8').trim();
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

const LOGIN_RE = /^[a-zA-Z0-9_.-]{2,32}$/;

function register(login, password) {
  ensure();
  if (!LOGIN_RE.test(login || '')) return { error: 'Логин: 2-32 символа, латиница/цифры/_ . -' };
  if (!password || String(password).length < 4) return { error: 'Пароль минимум 4 символа' };
  const users = loadUsers();
  const key = login.toLowerCase();
  if (users[key]) return { error: 'Логин уже занят' };
  const salt = crypto.randomBytes(16).toString('hex');
  users[key] = { display: login, salt, hash: hashPassword(password, salt), createdAt: Date.now() };
  saveUsers(users);
  return { user: login };
}

function login(loginName, password) {
  ensure();
  const users = loadUsers();
  const record = users[String(loginName || '').toLowerCase()];
  if (!record) return { error: 'Неверный логин или пароль' };
  const hash = hashPassword(password, record.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(record.hash));
  return ok ? { user: record.display } : { error: 'Неверный логин или пароль' };
}

function sign(username) {
  ensure();
  const payload = `${username}.${Date.now() + TTL}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

function check(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const idx = token.lastIndexOf('.');
    if (idx === -1) return null;
    const b = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const payload = Buffer.from(b, 'base64url').toString('utf8');
    const expect = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
    const parts = payload.split('.');
    const user = parts.slice(0, -1).join('.');
    const exp = Number(parts[parts.length - 1]);
    if (!exp || exp < Date.now()) return null;
    return user;
  } catch (_) {
    return null;
  }
}

function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return check(header.slice(7).trim());
}

module.exports = { register, login, sign, check, userFromRequest };
