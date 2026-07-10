# Electron Editor — Agent Briefing

> Передай этот файл AI-агенту в начале сессии реализации Electron-редактора.
> Он содержит полный контекст: существующий проект, схему данных, IPC-контракт с kiоsk,
> архитектурные решения и пошаговый план реализации.

> **Статус (2026-07-08):** исторический снимок на момент старта реализации.
> Шаги 1–6 плана выполнены, идёт доработка (см. `docs/TODO.md`, раздел U).
> Актуальное состояние — `docs/CONTEXT.md`; детали кода могли уйти вперёд
> (например, store уже 17 actions, добавлены `arrivalSet`, `originalPath`).

---

## 1. Проект: panotour

**Что это:** Monorepo — редактор и viewer 360-туров на базе Marzipano.
**Репозиторий:** `panotour` (GitHub, `imchrm/panotour`).
**Рабочая директория:** `/home/user/panotour` (или корень репо).

### Четыре пакета

| Пакет | Путь | Статус |
|---|---|---|
| `editor` | `packages/editor/` | **Заменяется** Electron-приложением |
| `viewer` | `packages/viewer/` | Готов, не меняется |
| `tiler` | `packages/tiler/` | Готов, используется как CLI |
| `server` | `packages/server/` | **Упраздняется** (заменён Electron IPC) |

---

## 2. Задача

Реализовать `packages/electron/` — Electron-приложение, которое:

1. Управляет **рабочим проектом** как папкой на файловой системе
2. Открывает **panorama-изображения** (JPEG) и нарезает их через `packages/tiler/`
3. Позволяет **расставлять хотспоты** через Marzipano-canvas (как текущий editor)
4. **Экспортирует** готовый тур в папку или ZIP (viewer + tour.json + tiles)

**Целевая платформа:** Windows x64 (приоритет). Портативный `.exe` без инсталлятора.

---

## 3. Текущий editor — что уже реализовано и переиспользуется

`packages/editor/src/` содержит рабочий React+Vite+TS редактор. При миграции в Electron
его компоненты переиспользуются как renderer-процесс Electron.

### Компоненты
```
packages/editor/src/
  components/
    PanoramaList/       — список сцен, загрузка файлов
    PanoramaCanvas/     — Marzipano preview, клик → yaw/pitch, маркеры хотспотов
    HotspotPanel/       — список хотспотов активной сцены
    NavHotspotForm/     — форма nav-хотспота (targetSceneId, targetYaw/Pitch/Fov)
    InfoHotspotForm/    — форма info-хотспота (title, text, imageUrl, videoUrl)
    SceneSettings/      — название сцены, initialView, статус тайлинга
    ExportButton/       — кнопки экспорта
  store/
    tourStore.tsx       — Context + useReducer, 13 actions
    types.ts            — TypeScript-типы (TourData, Scene, Hotspot, NavHotspot, InfoHotspot)
  lib/
    exporter.ts         — генерация tour.json из store
    zipper.ts           — ZIP-экспорт (переписать для Electron)
    serverApi.ts        — HTTP-транспорт для сервера (ЗАМЕНИТЬ IPC-вызовами)
```

### Store — 13 actions
```typescript
ADD_SCENE | UPDATE_SCENE | DELETE_SCENE | SET_DEFAULT_SCENE | SET_ACTIVE_SCENE
ADD_HOTSPOT | UPDATE_HOTSPOT | DELETE_HOTSPOT | SET_ACTIVE_HOTSPOT
START_PLACING_HOTSPOT | CANCEL_PLACING_HOTSPOT
CAPTURE_VIEW | TOGGLE_FLIP_ARRIVAL_YAW
```

### EditorState (типы)
```typescript
interface EditorState {
  tour: { version: string; defaultSceneId: string; scenes: EditorScene[] };
  activeSceneId: string | null;
  activeHotspotId: string | null;
  placingHotspot: false | 'link' | 'info';
  capturedView: { yaw: number; pitch: number; fov: number } | null;
  flipArrivalYaw: boolean;
}

// EditorScene = Scene + panoramaObjectUrl? (object URL файла на диске или blob)
```

---

## 4. Схема данных: tour.json

Центральный контракт между редактором и viewer. Редактор генерирует, viewer читает.

```json
{
  "version": "1.0",
  "defaultSceneId": "scene-01",
  "scenes": [
    {
      "id": "scene-01",
      "title": "Главный вход",
      "tilesPath": "tiles/scene-01",
      "previewUrl": "tiles/scene-01/preview.jpg",
      "levels": [
        { "tileSize": 256, "size": 256, "fallbackOnly": true },
        { "tileSize": 512, "size": 512 },
        { "tileSize": 512, "size": 1024 }
      ],
      "initialView": { "yaw": 0.0, "pitch": 0.0, "fov": 1.5707963 },
      "hotspots": [
        {
          "id": "hs-001",
          "type": "link",
          "yaw": 1.23,
          "pitch": -0.1,
          "targetSceneId": "scene-02",
          "targetYaw": -1.57,
          "targetPitch": 0.0,
          "targetFov": 1.5707963
        },
        {
          "id": "hs-002",
          "type": "info",
          "yaw": 0.5,
          "pitch": 0.1,
          "content": {
            "title": "Название объекта",
            "text": "Описание",
            "imageUrl": "media/photo-01.jpg",
            "videoUrl": "https://www.youtube.com/embed/VIDEOID"
          }
        }
      ]
    }
  ]
}
```

**Все угловые значения — радианы.** `fov` — горизонтальный (Marzipano API).
**Новые поля в tour.json всегда опциональны на стороне viewer.**

---

## 5. Формат рабочего проекта (папка на диске)

```
my-tour/
  project.json          — метаданные + полная схема тура (все сцены, хотспоты)
  scenes/
    scene-01.jpg        — оригинальные equirectangular JPEG-панорамы
    scene-02.jpg
  tiles/
    scene-01/
      preview.jpg       — вертикальный стрип 256×1536 (6 граней: b,d,f,l,r,u)
      manifest.json     — описание уровней тайлов
      {z}/{f}/{y}/{x}.jpg
      mobile/           — мобильный набор тайлов (если генерировался с --mobile)
    scene-02/
      ...
  media/
    photo-01.jpg        — медиафайлы info-хотспотов (изображения, видео)
    video-01.mp4
```

### project.json
```json
{
  "schemaVersion": "1.0",
  "name": "Моя экскурсия",
  "createdAt": "2026-07-06T12:00:00Z",
  "defaultLang": "ru",
  "defaultSceneId": "scene-01",
  "autorotate": { "enabled": false, "speed": 0.5 },
  "scenes": [
    {
      "id": "scene-01",
      "title": "Главный вход",
      "sourceFile": "scenes/scene-01.jpg",
      "sourceHash": "sha1:abc123...",
      "tiledAt": "2026-07-06T12:05:00Z",
      "tilesPath": "tiles/scene-01",
      "previewUrl": "tiles/scene-01/preview.jpg",
      "levels": [...],
      "initialView": { "yaw": 0, "pitch": 0, "fov": 1.5707963 },
      "hotspots": [...]
    }
  ]
}
```

**`sourceHash`** — SHA-1 исходного JPEG. Используется для определения «тайлы устарели»
(файл изменился с момента последнего тайлинга).

---

## 6. Viewer — уже реализован, не меняется

`packages/viewer/` — Vanilla JS, статические файлы. Экспортируется вместе с туром.

### Структура
```
packages/viewer/
  index.html
  app.js          — загрузка tour.json, инициализация Marzipano, сцены, хотспоты
  i18n.js         — словарь uz/ru/en + t(key); lang из ?lang= URL-параметра
  style.css
  marzipano.js    — библиотека (не модифицируется)
  hotspots/
    NavHotspot.js
    InfoHotspot.js
    InfoPanel.js  — текст + фото + YouTube/video; закрытие Escape/клик/кнопка
  transitions/
    TransitionEngine.js   — Zoom + Fade (2 фазы: вдох 80ms + рывок 520ms + fade 280ms)
    easing.js
```

### Ключевые константы (TransitionEngine.js)
```js
const T = {
  WIDE_FOV: 1.7453,    // ~100° — вдох
  ZOOM_IN_FOV: 0.3491, // ~20° — рывок (ощущение движения)
  INHALE_MS: 80,
  RUSH_MS: 520,
  FADE_DURATION: 280,
};
```

---

## 7. Kiosk IPC — контракт viewer

Viewer встраивается как `<iframe>` в Electron-киоск. Контракт строго через URL и postMessage.

### Входящие URL-параметры
| Параметр | Значения | По умолчанию |
|---|---|---|
| `?lang=` | `uz` \| `ru` \| `en` | `ru` |
| `?scene=` | любой `sceneId` | `defaultSceneId` |
| `?debug=1` | включён | выключен |

### postMessage: Киоск → Viewer
```js
// Перейти к сцене (crossfade 600ms, без zoom фаз)
iframe.contentWindow.postMessage({
  type: 'TOUR_NAVIGATE',
  sceneId: 'scene-02',
  yaw: 1.23,    // опционально
  pitch: -0.05, // опционально
  fov: 1.5707,  // опционально
}, '*');
```

### postMessage: Viewer → Киоск
```js
// Пользователь нажал "Выход" или Escape (вне InfoPanel)
window.parent.postMessage({ type: 'TOUR_EXIT' }, '*');

// Активность пользователя — throttle 2500ms, leading, только в iframe
window.parent.postMessage({ type: 'TOUR_ACTIVITY' }, '*');
```

`TOUR_ACTIVITY` — при любом из: `pointerdown`, `pointermove`, `wheel`, `keydown`,
`touchstart`, `touchmove` (capture-фаза, passive).

### Debug-лог (`?debug=1`)
```
[panotour] init { tourId, lang, scene, embedded }
[panotour] -> TOUR_EXIT (button|Escape)
[panotour] -> TOUR_ACTIVITY
```

---

## 8. Marzipano API — выжимка

```js
const viewer = new Marzipano.Viewer(element, { controls: { mouseViewMode: 'drag' } });

// Создание сцены
const geometry = new Marzipano.CubeGeometry(levels);
const source   = Marzipano.ImageUrlSource.fromString(
  'tiles/{sceneId}/{z}/{f}/{y}/{x}.jpg',
  { cubeMapPreviewUrl: 'tiles/{sceneId}/preview.jpg' }
);
// faceSize clamp to ≥4096 чтобы minFOV не превышал maxFOV
const limiter  = Marzipano.RectilinearView.limit.traditional(
  Math.max(maxSize, 4096), 100 * Math.PI / 180, 120 * Math.PI / 180
);
const view     = new Marzipano.RectilinearView(initialView, limiter);
const scene    = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

scene.switchTo({ transitionDuration: 1000 });
scene.lookTo({ yaw, pitch, fov }, { transitionDuration: 600 });

// В редакторе: EquirectGeometry (один файл, без тайлов)
const geo = new Marzipano.EquirectGeometry([{ width: 4000 }]);
// view.screenToCoordinates({x, y}) — клик → yaw/pitch
```

---

## 9. Tiler CLI — команды

```bash
# Desktop тайлы
node packages/tiler/tiler.js \
  --input  scenes/scene-01.jpg \
  --output tiles/scene-01 \
  --id     scene-01

# Desktop + Mobile за один прогон (всегда использовать этот вариант)
node packages/tiler/tiler.js \
  --input  scenes/scene-01.jpg \
  --output tiles/scene-01 \
  --id     scene-01 \
  --mobile
```

Генерирует в `tiles/scene-01/`:
```
preview.jpg         — 256×1536, вертикальный стрип граней b,d,f,l,r,u
manifest.json       — { sceneId, levels: [...] }
{z}/{f}/{y}/{x}.jpg
mobile/             — (при --mobile) мобильный набор
  preview.jpg
  manifest.json
  {z}/{f}/{y}/{x}.jpg
```

**Уровни по ширине входного JPEG:**
| Ширина | faceSize | Уровни |
|---|---|---|
| < 2048 | 256 | 256/256(fb) |
| 2048 | 512 | 256/256(fb), 512/512 |
| 4096 | 1024 | 256/256(fb), 512/512, 1024/512 |
| 8192 | 2048 | 256/256(fb), 512/512, 1024/512, 2048/512 |

**Mobile:** всегда faceSize=min(512, desktopFaceSize), уровни 256/256(fb), 512/256.

Зависимости tiler: `sharp`, `minimist`. Уже в `packages/tiler/node_modules/`.

---

## 10. Архитектура Electron-приложения

```
packages/electron/
  main.js                 — main-процесс: BrowserWindow, IPC-обработчики, Node.js-check
  preload.js              — contextBridge: экспортирует window.electronApi для renderer
  renderer/               — React-приложение (или симлинк на packages/editor/src)
    index.html
    src/                  — компоненты из packages/editor/ (переиспользуются)
  package.json            — electron, electron-builder зависимости
  electron-builder.yml    — конфигурация сборки (portable, extraFiles)
```

### IPC-каналы (main ↔ renderer)

Все вызовы файловой системы и tiler — через IPC. Renderer никогда не трогает `fs` напрямую.

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronApi', {
  // Проект
  createProject: (opts) => ipcRenderer.invoke('project:create', opts),
  openProject:   ()     => ipcRenderer.invoke('project:open'),
  saveProject:   (data) => ipcRenderer.invoke('project:save', data),

  // Сцены
  addScene:      (sceneId, srcPath) => ipcRenderer.invoke('scene:add', sceneId, srcPath),
  deleteScene:   (sceneId)          => ipcRenderer.invoke('scene:delete', sceneId),

  // Тайлинг
  tileScene:     (sceneId, onProgress) => {
    ipcRenderer.on(`tile:progress:${sceneId}`, (_, p) => onProgress(p));
    return ipcRenderer.invoke('tile:run', sceneId);
  },
  tileAll:       (sceneIds) => ipcRenderer.invoke('tile:runAll', sceneIds),

  // Медиафайлы
  copyMedia:     (srcPath) => ipcRenderer.invoke('media:copy', srcPath),

  // Предпросмотр
  openPreview:   (tourJson) => ipcRenderer.invoke('preview:open', tourJson),

  // Экспорт
  exportFolder:  (tourJson) => ipcRenderer.invoke('export:folder', tourJson),
  exportZip:     (tourJson) => ipcRenderer.invoke('export:zip', tourJson),
});
```

### main.js — ключевые блоки

```js
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// --- Проверка Node.js при запуске ---
function checkNodeJs() {
  try {
    execSync('node -e ""', { stdio: 'ignore' });
  } catch {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Node.js не найден',
      message: 'Для работы тайлера требуется Node.js.\n\nСкачайте и установите Node.js LTS с nodejs.org, затем перезапустите приложение.',
      buttons: ['Закрыть'],
    });
    app.quit();
  }
}

// --- Путь к tiler.js ---
// В dev: из корня монорепо
// В prod: из extraFiles рядом с .exe
function getTilerPath() {
  const appRoot = app.getAppPath();
  const devPath  = path.join(appRoot, '..', 'packages', 'tiler', 'tiler.js');
  const prodPath = path.join(path.dirname(process.execPath), 'tiler', 'tiler.js');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

// --- Тайлинг одной сцены ---
ipcMain.handle('tile:run', async (event, sceneId) => {
  const projectPath = getProjectPath(); // сохранённый путь к папке проекта
  const inputFile   = path.join(projectPath, 'scenes', `${sceneId}.jpg`);
  const outputDir   = path.join(projectPath, 'tiles', sceneId);

  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      getTilerPath(),
      '--input',  inputFile,
      '--output', outputDir,
      '--id',     sceneId,
      '--mobile',
    ]);

    child.stdout.on('data', (data) => {
      event.sender.send(`tile:progress:${sceneId}`, data.toString());
    });
    child.on('close', (code) => {
      if (code === 0) {
        // Прочитать manifest.json, вернуть levels
        const manifest = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8')
        );
        resolve({ tilesPath: `tiles/${sceneId}`, previewUrl: `tiles/${sceneId}/preview.jpg`, levels: manifest.levels });
      } else {
        reject(new Error(`tiler exited with code ${code}`));
      }
    });
  });
});

// --- Очередь параллельного тайлинга ---
ipcMain.handle('tile:runAll', async (event, sceneIds) => {
  const concurrency = Math.max(1, os.cpus().length - 1);
  // реализовать p-limit или вручную через Promise pool
});
```

---

## 11. План реализации — пошагово

> **`packages/electron/` уже создан** — шаги 1–6 реализованы (scaffold, IPC проекта,
> сцены, тайлинг, предпросмотр, экспорт). Пакеты `viewer`, `tiler`, `editor` не трогать —
> только использовать как зависимости или копировать при экспорте.

Реализовывать строго в этом порядке — каждый шаг верифицируется перед следующим.

### Шаг 1 — Scaffold (Фаза 0)
1. Создать `packages/electron/package.json` (зависимости: `electron`, `electron-builder`)
2. Создать `packages/electron/main.js` — минимальный: `createWindow`, `checkNodeJs()` при `app.ready`
3. Создать `packages/electron/preload.js` — минимальный: `contextBridge` с `ping: () => 'pong'`
4. Настроить загрузку renderer: в dev — `http://localhost:5173` (Vite editor), в prod — `loadFile`
5. Проверить: приложение открывается, DevTools работают

### Шаг 2 — IPC проекта (Фаза 0.4–0.7)
1. IPC-обработчики: `project:create`, `project:open`, `project:save`
2. Сохранить путь к папке проекта в памяти main-процесса (`let projectPath`)
3. В renderer: убрать `serverApi.ts`, заменить создание/открытие проекта на `window.electronApi.*`
4. Проверить: создать проект → папка появляется на диске с `project.json`, `scenes/`, `tiles/`, `media/`

### Шаг 3 — Сцены (Фаза 1)
1. IPC `scene:add`: `showOpenDialog` JPEG → `fs.copyFile` → `scenes/{sceneId}.jpg`
2. IPC `scene:delete`: удалить файлы, вернуть список оставшихся сцен
3. Проверить: добавить/удалить сцену → файлы на диске

### Шаг 4 — Тайлинг (Фаза 2)
1. IPC `tile:run` (см. блок выше)
2. Progress-события через `event.sender.send`
3. SHA-1 хеш исходника: `crypto.createHash('sha1').update(fs.readFileSync(src)).digest('hex')`
4. Запись `scene.tiledAt` + `scene.sourceHash` в `project.json` после успеха
5. Параллельная очередь `tile:runAll` с `os.cpus().length - 1`
6. Проверить: нарезать одну и несколько сцен → `tiles/` на диске корректны

### Шаг 5 — Предпросмотр (Фаза 6)
1. IPC `preview:open`: записать `tour.json` в `os.tmpdir()/panotour-preview/`
2. Открыть второй `BrowserWindow` с `packages/viewer/index.html`
3. Viewer читает `tour.json` по относительному пути — настроить `webPreferences.webSecurity: false`
   или отдать файлы через `protocol.registerFileProtocol`
4. Проверить: предпросмотр открывается, переходы между сценами работают

### Шаг 6 — Экспорт (Фаза 7)
1. IPC `export:folder`: `showOpenDialog` директории → скопировать `tiles/`, `media/`, `packages/viewer/*`, записать `tour.json`
2. IPC `export:zip`: собрать ZIP в main-процессе (`archiver` npm пакет) → `showSaveDialog` → записать
3. `shell.openPath(outputDir)` после успеха
4. Проверить: экспорт → открыть `index.html` из папки — тур работает

### Шаг 7 — Сборка (Дистрибуция)
1. `electron-builder.yml`:
   ```yaml
   appId: com.panotour.editor
   productName: Panotour Editor
   win:
     target: portable
   extraFiles:
     - from: ../../packages/tiler
       to: tiler
       filter: ["**/*", "!node_modules/.cache/**"]
   ```
2. `npm run build` → `dist/Panotour Editor.exe`
3. Проверить: `.exe` запускается, Node.js-check работает, проект создаётся

---

## 12. Ключевые технические решения

| Решение | Детали |
|---|---|
| Node.js требуется | `execSync('node -e ""')` при старте → `dialog.showMessageBoxSync` если не найден |
| Renderer ↔ main | только через `ipcRenderer.invoke` / `ipcMain.handle` (contextBridge) |
| Файловая система | только в main-процессе через `fs` |
| Тайлер | `child_process.spawn('node', ['tiler.js', ...])`, путь через `app.getAppPath()` |
| Предпросмотр | второй `BrowserWindow`, `tour.json` во временной папке |
| Экспорт ZIP | `archiver` в main-процессе (не JSZip — он для browser) |
| Хеш исходника | `crypto.sha1` файла → `sourceHash` в `project.json` |
| Параллельный тайлинг | Promise pool, concurrency = `os.cpus().length - 1` |
| Windows portable | `electron-builder` target `portable`, tiler в `extraFiles` |

---

## 13. Что НЕ трогать

- `packages/viewer/` — не модифицировать. Это готовый продукт, он копируется при экспорте.
- `packages/tiler/` — не модифицировать. Используется как есть через `child_process.spawn`.
- `marzipano.js` — не модифицировать. Только публичный API.
- Схема `tour.json` — расширять можно, новые поля всегда опциональны на стороне viewer.

---

## 14. Как запустить существующий проект (для справки)

```bash
# Установить зависимости (из корня монорепо)
npm install

# Запустить текущий browser-based editor + Express server (Variant B)
npm run dev
# Editor: http://localhost:5173
# Server: http://localhost:3333

# Только editor
npm run editor

# Тайлинг вручную
node packages/tiler/tiler.js --input pano.jpg --output tiles/scene-01 --id scene-01 --mobile
```

---

## 15. Связанная документация

- `docs/CONTEXT.md` — полный контекст проекта (текущее состояние)
- `docs/ARCHITECTURE.md` — архитектурные решения (ADR-001 … ADR-011)
- `docs/TODO.md` — задачи Electron-редактора (раздел «Electron-редактор»)
- `docs/CHANGELOG.md` — история изменений
- `packages/editor/src/store/types.ts` — TypeScript-типы TourData, Scene, Hotspot
- `packages/viewer/app.js` — viewer: инициализация, IPC-контракт, TOUR_ACTIVITY
- `packages/tiler/tiler.js` — CLI точка входа тайлера
