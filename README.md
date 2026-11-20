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

## Собственный API FireAI

После запуска FireAI сам становится OpenAI-совместимым сервером:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Привет!"}]}'
```

Если задан `FIREAI_ACCESS_TOKEN`, добавьте заголовок `Authorization: Bearer <токен>`.

## Внутренние эндпоинты

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/api/status` | Режим, модель, информация об API |
| POST | `/api/chat` | Чат со стримингом (SSE): события `meta/delta/done` |
| POST | `/v1/chat/completions` | OpenAI-совместимый API (свой ключ) |
| GET | `/healthz` | Проверка живости |

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
