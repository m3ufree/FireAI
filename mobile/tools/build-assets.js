const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const repo = path.resolve(root, '..');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

let out = read(path.join(root, 'index.template.html'));

const style = read(path.join(repo, 'public', 'style.css'));
const engine = read(path.join(repo, 'server', 'demo-engine.js')).replace(/module\.exports = \{ generate \};?/, '');
const app = read(path.join(root, 'app.js'));

const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
out = out
  .replace('{{STYLE}}', () => style)
  .replace('{{ENGINE}}', () => safe(engine))
  .replace('{{APP}}', () => safe(app));

const arg = process.argv.indexOf('--out');
const dest = arg !== -1 ? process.argv[arg + 1] : path.join(root, 'index.html');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('mobile bundle:', dest);
