const THREE_D_GAME = `Держи готовую 3D-игру на three.js — сохрани как \`game.html\` и открой в браузере. Управление: стрелки/A-D — движение, пробел — прыжок. Собирай золотые кубы, уворачивайся от красных.

\`\`\`html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>FireAI 3D — Golden Dash</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#0d0f1a;font-family:sans-serif}
  #hud{position:fixed;top:12px;left:12px;color:#ffd76a;font-size:20px;font-weight:700}
  #hint{position:fixed;bottom:12px;left:12px;color:#8a90b4;font-size:13px}
</style>
</head>
<body>
<div id="hud">Монеты: 0</div>
<div id="hint">← → или A/D — движение, пробел — прыжок</div>
<script type="importmap">
{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}
</script>
<script type="module">
import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f1a);
scene.fog = new THREE.Fog(0x0d0f1a, 18, 60);

const camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 4, 9);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight(0x9db4ff, 0x1a1c2e, 1.1));
const sun = new THREE.DirectionalLight(0xffb26b, 1.4);
sun.position.set(5, 10, 4);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 200),
  new THREE.MeshStandardMaterial({ color: 0x1c2038, roughness: 0.9 })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.5, 0.8, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0xff6a3d, emissive: 0x441206 })
);
player.position.set(0, 1, 0);
scene.add(player);

const coins = [], hazards = [];
function spawn(mesh, z) { mesh.position.z = z; scene.add(mesh); return mesh; }
for (let i = 0; i < 14; i++) {
  coins.push(spawn(new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0x554400 })
  ), -10 - i * 9));
}
for (let i = 0; i < 8; i++) {
  hazards.push(spawn(new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xe0316b, emissive: 0x40001a })
  ), -14 - i * 16));
}

let vx = 0, vy = 0, speed = 0.22, score = 0;
const hud = document.getElementById('hud');
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

function hit(a, b) {
  return Math.abs(a.position.x-b.position.x) < 1 &&
         Math.abs(a.position.y-b.position.y) < 1.2 &&
         Math.abs(a.position.z-b.position.z) < 1;
}

function animate() {
  requestAnimationFrame(animate);
  if (keys['ArrowLeft'] || keys['KeyA']) vx = -0.12;
  else if (keys['ArrowRight'] || keys['KeyD']) vx = 0.12;
  else vx *= 0.85;
  player.position.x = Math.max(-8, Math.min(8, player.position.x + vx));

  const grounded = player.position.y <= 1.01;
  if ((keys['Space']) && grounded) vy = 0.22;
  vy -= 0.011;
  player.position.y = Math.max(1, player.position.y + vy);

  player.rotation.x -= speed;

  for (const c of coins) {
    c.rotation.y += 0.05;
    c.position.z += speed;
    if (hit(player, c)) {
      score++; hud.textContent = 'Монеты: ' + score;
      c.position.set((Math.random()*14)-7, 1, player.position.z - 90);
    }
    if (c.position.z > 12) c.position.z -= 130;
  }
  for (const h of hazards) {
    h.position.z += speed;
    if (hit(player, h)) {
      player.position.set(0, 1, 0);
      score = Math.max(0, score - 1);
      hud.textContent = 'Монеты: ' + score;
    }
    if (h.position.z > 12) h.position.z -= 150;
  }

  camera.position.x += (player.position.x*0.6 - camera.position.x)*0.08;
  camera.lookAt(player.position.x, 1.5, player.position.z - 6);
  renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>
\`\`\``;

const SONG = `Вот песня «**Огонь в проводах**» — фирменный трек FireAI 🔥

**Жанр:** синтвейв / электропоп, ~110 BPM, тональность A-minor.
**Аккорды:** Am — F — C — G (повтор на куплет и припев).

**Куплет 1**
Am
Город спит, а сервер гудит,
F
В байтах теплятся сны огоньков.
C
Я сквозь провода к тебе лечу,
G
Слово за словом, без лишних оков.

**Припев**
Am              F
Огонь в проводах — это зов,
C                 G
Код превращается в голос рассвета.
Am                F
Спроси меня — и мир готов,
C                G
Разгореться ответом на твой вопрос.

**Куплет 2**
Am
Три измерения, свет и полигоны,
F
Я соберу мир из чистого света.
C
Песня из нулей, мелодия единиц —
G
Файр, между строк, всегда у тебя под сердцем.

**Бридж** (тише, полушёпот)
F — G — Am — Em
Если станет темно — просто набери мне,
Я всегда в сети, я всегда в теме.

Хочешь — перепишу в другом жанре (рэп, рок, баллада) или добавлю припев на английском.`;

const LANG_HINTS = {
  python: ['python', 'питон', 'python', 'py '],
  javascript: ['javascript', ' js', 'node', 'джаваскрипт'],
  typescript: ['typescript', ' ts '],
  java: ['java'],
  c: [' c++', ' c#', '+ плюсы', ' c'],
  go: [' golang', ' go '],
  rust: ['rust', 'раст'],
  sql: ['sql', 'sql-запрос'],
};

function detectProgramming(prompt) {
  const p = ' ' + prompt.toLowerCase() + ' ';
  for (const [lang, keys] of Object.entries(LANG_HINTS)) {
    if (keys.some((k) => p.includes(k))) return lang.trim();
  }
  return null;
}

function codeAnswer(prompt, lang) {
  const task = prompt.length > 90 ? prompt.slice(0, 87) + '…' : prompt;
  if (lang === 'python') {
    return `Задача: ${task}. Вот аккуратное решение на Python:

\`\`\`python
from dataclasses import dataclass

@dataclass
class Result:
    value: int
    steps: list[int]

def solve(data: list[int]) -> Result:
    """Рабочая заготовка: подставь свою логику и тесты."""
    steps: list[int] = []
    total = 0
    for i, x in enumerate(data):
        total += x
        steps.append(total)
    return Result(value=total, steps=steps)

if __name__ == "__main__":
    print(solve([1, 2, 3, 4]))
\`\`\`

В демо-режиме это шаблон. Добавь API-ключ в \`.env\` — и FireAI будет решать такие задачи по-настоящему, на любом языке: Python, JS/TS, C++, Java, Go, Rust, SQL и других.`;
  }
  return `Задача: ${task}. Вот отправная точка на ${lang}:

\`\`\`${lang}
// Заготовка от FireAI — подставь свою логику
function main(input) {
  return input
    .map((x, i) => ({ i, x }))
    .filter(({ x }) => x != null)
    .reduce((acc, { x }) => acc + x, 0);
}

console.log(main([1, 2, 3, 4]));
\`\`\`

В демо-режиме это шаблон. Добавь API-ключ в \`.env\` — и FireAI будет писать полноценный рабочий код на любом языке.`;
}

const GREETING_RE = /^\s*(привет|приветик|здрас|здравств|здоров|хй|хай|ку(?!б)|hello|hi|hey|добрый (день|вечер|утр))[!.?, ]*$/i;

function greetingAnswer(name) {
  const who = name ? ', ' + name : '';
  return [
    'О, Привет' + who + '! 🔥',
    '',
    'О чём сегодня? Могу:',
    '- 🎮 собрать **3D-игру** — скажи *«сделай 3D игру»*;',
    '- 🎵 сочинить **песню** — скажи *«напиши песню»*;',
    '- 💻 написать **код** на любом языке — *«напиши код на python»*;',
    '- 🧠 или просто поболтать.',
  ].join('\n');
}

function generate(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = (last && last.content) || '';

  if (GREETING_RE.test(prompt.trim())) return greetingAnswer('');

  if (/как (дела|ты)|что (нового|делаешь)|всё хорошо|чем занят/i.test(prompt)) {
    const greeted = /привет|здравств|хай|хэй|hello|hi/i.test(prompt);
    return (greeted ? 'О, Привет! 🔥\n\n' : '') + 'У меня всё отлично — сервера гудят, код компилируется. А у тебя как? Может, сделаем что-то крутое: 3D-игру, песню или приложение?';
  }

  if (/^\/?помощь|^\/help|^help|что ты (умеешь|можешь)|кто ты/i.test(prompt.trim())) {
    return [
      '**FireAI** — очень умный ИИ-бот. Умею:',
      '- 🎮 писать **3D-игры** и генерировать 3D-модели — попробуй: *«сделай 3D игру»*;',
      '- 🎵 сочинять **песни** — попробуй: *«напиши песню»*;',
      '- 💻 программировать на **всех языках** — попробуй: *«напиши код на python»*;',
      '- 🧠 отвечать на любые вопросы, когда подключён настоящий LLM.',
      '',
      'Сейчас я работаю в **демо-режиме**: заполните `.env` (скопируйте из `.env.example`), перезапустите сервер — и я стану полноценным ассистентом.',
    ].join('\n');
  }

  if (/(3\s*d|3d|трейс|three|игру|game)/i.test(prompt)) return THREE_D_GAME;
  if (/(песн|song|музык|music|трек)/i.test(prompt)) return SONG;

  const lang = detectProgramming(prompt);
  if (lang) return codeAnswer(prompt, lang);

  return `Принято: «${prompt.slice(0, 120)}».

Сейчас я в **демо-режиме** и отвечаю шаблонами, но и без ключа умею:
- 🎮 *сделай 3D игру* — соберу готовую 3D-игру одним HTML-файлом;
- 🎵 *напиши песню* — текст, аккорды, структура;
- 💻 *напиши код на python* — заготовки кода.

Чтобы я стал по-настоящему умным (любые вопросы, любой язык, большие проекты):
1. Скопируйте \`.env.example\` в \`.env\`.
2. Вставьте ключ провайдера (\`FIREAI_API_KEY\`) — подходит Mistral, OpenAI, OpenRouter или локальная Ollama.
3. Перезапустите \`npm start\`. 🔥`;
}

module.exports = { generate };
