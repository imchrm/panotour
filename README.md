# panotour

Редактор и viewer 360-туров на базе [Marzipano](https://www.marzipano.net).

```
packages/
  editor/   React + Vite + TypeScript  — редактор хотспотов
  viewer/   Vanilla JS                 — статический 360-тур
  tiler/    Node.js CLI                — нарезка панорам в тайлы
```

---

## Быстрый старт

```bash
npm install          # установить зависимости всех пакетов
npm run editor       # запустить редактор → http://localhost:5173
```

---

## Tiler

Конвертирует equirectangular JPEG/PNG в CubeGeometry-тайлы для Marzipano.

```bash
# Только desktop
node packages/tiler/tiler.js \
  --input  ./panos/entrance.jpg \
  --output ./packages/viewer/tiles/scene-01 \
  --id     scene-01

# Desktop + mobile (меньший tileSize, меньше нагрузки на GPU)
node packages/tiler/tiler.js \
  --input  ./panos/entrance.jpg \
  --output ./packages/viewer/tiles/scene-01 \
  --id     scene-01 \
  --mobile
```

**Выходные файлы:**
```
tiles/scene-01/
  preview.jpg          256×256, фронтальная грань
  {z}/{f}/{y}/{x}.jpg  тайлы по уровням
  manifest.json        описание уровней (импортируется редактором)
  mobile/              (при --mobile) тайлы 256×256 для мобильных
```

---

## Editor

Запуск:
```bash
npm run editor
# или
npm run dev --workspace=packages/editor
```

**Workflow:**
1. Загрузить equirectangular-панорамы через «+ Add scene»
2. Кликнуть по панораме — откроется форма хотспота
3. Расставить хотспоты: навигационные (→) и информационные (ℹ)
4. Нажать «↓ tour.json» — скачать файл данных тура

---

## Viewer

Статические файлы, не требуют сборки. Разместить на любом сервере:

```bash
# Для разработки
npx serve packages/viewer

# Открыть http://localhost:3000
```

Viewer читает `tour.json` из той же директории.

---

## Полный цикл

```
pano.jpg
  └─ tiler → tiles/scene-01/ + manifest.json
               └─ editor → расставить хотспоты → tour.json
                             └─ viewer → готовый тур
```

---

## Документация

- `docs/CONTEXT.md` — главный файл для AI-сессий, текущий статус
- `docs/TODO.md` — список задач
- `docs/ARCHITECTURE.md` — архитектурные решения (ADR)
