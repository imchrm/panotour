# panotour

Редактор и viewer 360-туров на базе [Marzipano](https://www.marzipano.net).

```
packages/
  electron/ Electron main-процесс        — desktop-редактор (проект, тайлинг, экспорт)
  editor/   React + Vite + TypeScript    — UI редактора (renderer Electron / браузер)
  viewer/   Vanilla JS                   — статический 360-тур
  tiler/    Node.js CLI                  — нарезка панорам в тайлы
  server/   Express                      — legacy (Вариант B, заменён Electron IPC)
```

---

## Быстрый старт

### Desktop-редактор (основной сценарий)

```bash
npm install          # из корня монорепо
npm run editor       # терминал 1: Vite dev-сервер → http://localhost:5173
npm run electron     # терминал 2: окно Electron
```

**Workflow:**
1. «New project» — создать папку проекта (`project.json`, `scenes/`, `tiles/`, `media/`)
2. «+ Add» — выбрать equirectangular JPEG, файл копируется в `scenes/`
3. «Tile selected» — нарезать тайлы (desktop + mobile за один прогон)
4. Расставить хотспоты: навигационные (→) и информационные (ℹ);
   направление прибытия nav-хотспота задать через «Capture view» → «Apply»
5. «Preview» — предпросмотр тура в отдельном окне
6. Экспорт: «→ Folder» (папка с viewer + tour.json + tiles) или «↓ ZIP»

Проект сохраняется автоматически (дебаунс 2 с) и кнопкой «Save».

### Браузерный режим (без Electron)

```bash
npm run editor       # http://localhost:5173
```
Работает загрузка панорам, хотспоты и экспорт `tour.json`/ZIP без тайлов.

---

## Формат папки проекта

```
my-tour/
  project.json        метаданные + полная схема тура
  scenes/             исходные equirectangular JPEG
  tiles/{sceneId}/    нарезанные тайлы (+ mobile/)
  media/              медиафайлы info-хотспотов
```

---

## Tiler

Конвертирует equirectangular JPEG в CubeGeometry-тайлы для Marzipano.
Electron-редактор вызывает его автоматически; вручную:

```bash
node packages/tiler/tiler.js \
  --input  ./panos/entrance.jpg \
  --output ./tiles/scene-01 \
  --id     scene-01 \
  --mobile
```

**Выходные файлы:**
```
tiles/scene-01/
  preview.jpg          256×1536, вертикальный стрип 6 граней (b,d,f,l,r,u)
  {z}/{f}/{y}/{x}.jpg  тайлы по уровням
  manifest.json        описание уровней
  mobile/              (при --mobile) мобильный набор тайлов
```

---

## Viewer

Статические файлы, не требуют сборки. Копируются при экспорте тура.

```bash
npx serve packages/viewer   # → http://localhost:3000
```

Viewer читает `tour.json` из своей директории. Параметры: `?lang=uz|ru|en`,
`?scene=sceneId`, `?debug=1`. Встраивание в киоск — `postMessage`
(`TOUR_NAVIGATE`, `TOUR_EXIT`, `TOUR_ACTIVITY`), детали в
`docs/kiosk-map-linking.md`.

---

## Полный цикл

```
pano.jpg
  └─ editor (Electron) → проект → тайлинг → хотспоты
       └─ export → папка/ZIP: viewer + tour.json + tiles
            └─ статический хостинг / киоск
```

---

## Документация

- `docs/CONTEXT.md` — главный файл для AI-сессий, текущий статус
- `docs/TODO.md` — список задач
- `docs/ARCHITECTURE.md` — архитектурные решения (ADR-001…ADR-011)
- `docs/CHANGELOG.md` — история изменений
- `docs/TESTING.md` — методика тестирования полного цикла
- `docs/kiosk-map-linking.md` — связка карты киоска со сценами тура
- `docs/electron-agent-briefing.md` — briefing для AI-сессий Electron-редактора
