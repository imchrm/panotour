# panotour — CLAUDE.md

## Проект
Monorepo: редактор 360-туров (React+Vite+TS) + viewer (Vanilla JS) + tiler (Node.js CLI).
Полная документация: docs/CONTEXT.md

## Структура
packages/editor   — React + Vite + TypeScript
packages/viewer   — Vanilla JS, статика
packages/tiler    — Node.js CLI, нарезка панорам

## Команды
npm run editor          — dev-сервер редактора (http://localhost:5173)
npm install             — всегда из корня монорепо, не из packages/

## Правила
- Все угловые значения в tour.json — радианы
- marzipano.js не модифицируется, только публичный API
- Новые поля в tour.json всегда опциональны на стороне viewer
- UTF-8, без эмодзи в коде и скриптах