# 🔥 FireAI

Умный чат-бот с интерфейсом в стиле DeepSeek и **собственным API**. Работает сразу после `npm install && npm start` — без ключей, в демо-режиме, а с ключом превращается в полноценного LLM-ассистента.

## Возможности

- 💬 Чат с потоком ответа в реальном времени (SSE), markdown, блоки кода с копированием
- 📑 Сайдбар с историей чатов (сохраняется в браузере), тёмная тема как у DeepSeek
- 🎮 Генерирует готовую **3D-игру** (three.js) — просто попросите «сделай 3D игру»
- 🎵 Сочиняет **песни**: текст, структура, аккорды
- 💻 Пишет код и знает все популярные языки программирования
- 🔌 **Свой API**: `POST /v1/chat/completions` — OpenAI-совместимый шлюз

## Быстрый старт

```bash
npm install
npm start
# → http://localhost:3000
```

## Подключение настоящего ИИ

Скопируйте `.env.example` в `.env` и заполните:

| Переменная | Описание |
| --- | --- |
| `FIREAI_BASE_URL` | API провайдера (Mistral, OpenAI, Ollama и др.) |
| `FIREAI_API_KEY` | Ключ провайдера (пусто = демо-режим) |
| `FIREAI_MODEL` | Название модели |
| `FIREAI_ACCESS_TOKEN` | Пароль для собственного API FireAI (может быть пустым) |
| `PORT` | Порт (по умолчанию 3000) |

Примеры провайдеров:

```bash
# Mistral
FIREAI_BASE_URL=https://api.mistral.ai/v1
FIREAI_MODEL=mistral-large-latest

# OpenAI
FIREAI_BASE_URL=https://api.openai.com/v1
FIREAI_MODEL=gpt-4o-mini

# Локальная Ollama (без ключа)
FIREAI_BASE_URL=http://localhost:11434/v1
FIREAI_MODEL=llama3.1
FIREAI_API_KEY=ollama
```

## Собственный API FireAI (v1)

FireAI — сам OpenAI-совместимый сервер. Ключ создаётся на странице `http://localhost:3000/api.html` после входа в аккаунт.

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1", api_key="sk-fireai-ВАШ_КЛЮЧ")

r = client.chat.completions.create(
    model="fireai-demo",
    messages=[{"role": "user", "content": "Привет"}],
)
print(r.choices[0].message.content)
```

Поддерживается:
- `POST /v1/chat/completions` — обычный ответ и SSE-стриминг (`"stream": true`) в формате OpenAI;
- `GET /v1/models` — список моделей;
- ключи `sk-fireai-…` создаются и отзываются от имени аккаунта.
## Внутренние эндпоинты

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/status` | Режим, модель, информация об API |
| POST | `/api/register` | Регистрация аккаунта |
| POST | `/api/login` | Вход (возвращает токен на 30 дней) |
| GET | `/api/me` | Проверка сессии |
| POST | `/api/chat` | Чат со стримингом (нужен вход) |
| POST | `/v1/chat/completions` | OpenAI-совместимый API (свой ключ) |
| GET | `/healthz` | Проверка живости |

Аккаунты хранятся локально в `data/users.json` (пароли — scrypt-хэши). История чатов привязана к аккаунту и хранится в браузере/на устройстве.

## Структура

```
fireai/
├── server/
│   ├── index.js        # Express: статика, /api/chat, собственный API
│   ├── core.js         # Стриминг, интеграция с LLM-провайдером
│   └── demo-engine.js  # Офлайн-движок: 3D-игра, песни, код
├── public/
│   ├── index.html      # Интерфейс в стиле DeepSeek
│   ├── style.css
│   └── app.js          # Стриминг, markdown, история чатов
├── .env.example
└── package.json
```

Замечание: `.env` загружается автоматически, если установлен пакет `dotenv`, либо переменные можно передать напрямую: `FIREAI_API_KEY=... npm start`.

## Скачивание готовых сборок

Готовые файлы лежат прямо в репозитории в папке [releases/v1.0.0](https://github.com/m3ufree/FireAI/tree/main/releases/v1.0.0):

| Файл | Как распаковать / использовать |
| --- | --- |
| `FireAI-win-x64.exe.gz` | Windows: скачайте и распакуйте (.gz распаковывается 7-Zip или командой `gunzip`), затем запустите EXE двойным кликом → откройте http://localhost:3000 |
| `FireAI-linux-x64.gz` | Linux: `gunzip FireAI-linux-x64.gz && chmod +x FireAI-linux-x64 && ./FireAI-linux-x64` |
| `FireAI.apk` | Android: разрешите установку из источника, установите, откройте FireAI |

Порт: `set PORT=8080` (Windows) или `PORT=8080` (Linux) перед запуском. Ключ LLM — переменная окружения `FIREAI_API_KEY` (подходят Mistral, OpenAI, OpenRouter, Ollama).

APK работает офлайн в демо-режиме (3D-игра, песни, код). В меню (☰) укажите адрес своего сервера FireAI — и бот будет отвечать через настоящий LLM.

## Сборка EXE и APK из исходников

```bash
# EXE (Linux/macOS, нужен интернет):
npm install && npm run build:exe
# → build/FireAI-win-x64.exe и build/FireAI-linux-x64

# APK (нужен JDK 17 и Android SDK: build-tools 34, platform android-34):
export JAVA_HOME=/путь/к/jdk17
SDK=/путь/к/android-sdk ./mobile/build-apk.sh
# → FireAI.apk (подписан, готов к установке)
```
