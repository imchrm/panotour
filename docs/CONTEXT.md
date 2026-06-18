# CONTEXT.md — panotour

> Главный файл для AI-сессий. Передай его в начале сессии — AI сразу в контексте.
> В конце сессии обновляй разделы "Что сделано" и "Следующий шаг".

---

## Проект

**Название:** panotour — редактор и viewer 360-туров на базе Marzipano
**Репозиторий:** `panotour` (GitHub)
**Концепция:** Собственный редактор хотспотов + tiler + viewer. Полный контроль
над схемой данных тура. Независимость от Marzipano Tool.

**Два независимых приложения в одном репозитории (monorepo):**

| Приложение | Путь | Назначение |
|---|---|---|
| `editor` | `packages/editor/` | React + Vite. Редактор тура: загрузка панорам, расстановка хотспотов, экспорт |
| `viewer` | `packages/viewer/` | Vanilla JS. Готовый тур: рендер панорам, переходы, InfoPanel |
| `tiler` | `packages/tiler/` | Node.js CLI. Нарезка equirectangular → CubeGeometry тайлы |

---

## Стек

### Editor (`packages/editor/`)
| Слой | Технология |
|---|---|
| UI фреймворк | React 19 + TypeScript 6 |
| Сборка | Vite 8 |
| Стили | CSS Modules |
| Превью панорамы | Marzipano (встроен в редактор для позиционирования хотспотов) |
| Хранение состояния | React Context + useReducer |
| Экспорт | JSZip (ZIP) + FileSaver.js |

### Viewer (`packages/viewer/`)
| Слой | Технология |
|---|---|
| 360° рендер | Marzipano (standalone `marzipano.js`) |
| Логика | Vanilla JS (ES2020, ES modules) |
| Стили | CSS3 |
| Входные данные | `tour.json` — генерируется редактором |

### Tiler (`packages/tiler/`)
| Слой | Технология |
|---|---|
| Runtime | Node.js 20+ |
| Нарезка | Собственная обратная проекция equirectangular→куб + `sharp` |
| Интерфейс | CLI (`node tiler.js --input pano.jpg --output ./tiles/scene-01`) |

---

## Структура файлов (целевая)

```
panotour/
  packages/
    editor/
      src/
        components/
          PanoramaList/       # Список загруженных панорам
          PanoramaCanvas/     # Превью панорамы с Marzipano для клика по хотспотам
          HotspotPanel/       # Форма редактирования выбранного хотспота
          InfoHotspotForm/    # Подформа для type=info (текст, фото, видео)
          NavHotspotForm/     # Подформа для type=link (targetYaw, targetPitch, targetFov)
          ExportButton/       # Кнопка экспорта (ZIP + папка)
          SceneSettings/      # Настройки сцены (название, initialView)
        store/
          tourStore.ts        # Context + useReducer: состояние тура
          types.ts            # TourData, Scene, Hotspot, InfoContent и др.
        lib/
          exporter.ts         # Генерация tour.json + структуры тура для экспорта
          zipper.ts           # Упаковка в ZIP через JSZip
        App.tsx
        main.tsx
      index.html
      vite.config.ts
      tsconfig.json
      package.json

    viewer/
      index.html
      app.js                  # Инициализация viewer, загрузка tour.json
      style.css
      marzipano.js            # Библиотека (не модифицируется)
      transitions/
        TransitionEngine.js   # Zoom + Move + Fade оркестрация
        easing.js             # easeInOutQuad, easeOutCubic, easeInQuad
      hotspots/
        NavHotspot.js         # Хотспот перехода между сценами
        InfoHotspot.js        # Хотспот вызова InfoPanel
        InfoPanel.js          # DOM-компонент информационной панели
      tour.json               # Данные тура (генерируется редактором, заменяется при деплое)
      tiles/
        {scene_id}/           # Тайлы (генерируется tiler)
          preview.jpg
          {z}/{f}/{y}/{x}.jpg

    tiler/
      tiler.js                # CLI точка входа
      lib/
        cubemapTiler.js       # Собственная обратная проекция + sharp; FACE_NAMES=['r','l','u','d','f','b']
        manifest.js           # Генерация манифеста уровней для Marzipano
      package.json

  package.json                # Root: workspaces, общие dev-скрипты
  .gitignore
  README.md
```

---

## Схема данных `tour.json`

Это центральный контракт между редактором и viewer. Редактор генерирует,
viewer читает. Схема расширяется добавлением полей — обе стороны под нашим контролем.

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
      "initialView": {
        "yaw": 0.0,
        "pitch": 0.0,
        "fov": 1.5707963
      },
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
            "text": "Описание в формате plain text или HTML",
            "imageUrl": "media/photo-01.jpg",
            "videoUrl": "https://www.youtube.com/embed/VIDEOID"
          }
        }
      ]
    }
  ]
}
```

**Все угловые значения — радианы.** `fov` — горизонтальный (соответствует Marzipano API).

---

## Ключевые константы viewer

```js
// transitions/TransitionEngine.js
const T = {
  WIDE_FOV:      1.7453,  // ~100° — кратковременное расширение FOV ("вдох")
  NORMAL_FOV:    1.5708,  // ~90°  — стандартный FOV
  ZOOM_IN_FOV:   0.3491,  // ~20°  — агрессивный zoom (ощущение движения)
  INHALE_MS:     80,      // мс — фаза вдоха
  RUSH_MS:       520,     // мс — фаза рывка
  FADE_DURATION: 280,     // мс — crossfade между сценами
};
// LAND_DURATION и animateFov удалены: целевая сцена появляется сразу с targetFov.
```

## Кiosk IPC — контракт

Viewer встраивается как `<iframe>` в Electron-киоск. Все взаимодействия
только через URL-параметры и `postMessage` — без дополнительных каналов.

### Входящие параметры (URL)

| Параметр | Значения | По умолчанию | Описание |
|---|---|---|---|
| `?lang=` | `uz` \| `ru` \| `en` | `ru` | Язык UI (кнопки, подсказки, ошибки) |
| `?scene=` | любой `sceneId` из `tour.json` | `defaultSceneId` | Начальная сцена при открытии |

Пример: `viewer/index.html?lang=uz&scene=scene-02`

### Входящие сообщения (postMessage → viewer)

```js
// Перейти к конкретной сцене (прямой crossfade, 600ms)
window.frames[0].postMessage({
  type:   'TOUR_NAVIGATE',
  sceneId: 'scene-02',       // обязательно — id сцены из tour.json
  yaw:    1.23,              // необязательно — угол прибытия (рад)
  pitch: -0.05,              // необязательно
  fov:    1.5707,            // необязательно
}, '*');
```

Если `yaw/pitch/fov` не переданы — используется `initialView` целевой сцены.
Если `sceneId` не найден или совпадает с текущей — сообщение игнорируется.

### Исходящие сообщения (viewer → родительский фрейм)

```js
// Пользователь нажал кнопку "Выход" или Escape (вне InfoPanel)
window.parent.postMessage({ type: 'TOUR_EXIT' }, '*');
```

---

## Marzipano API — выжимка для AI

```js
// Инициализация
const viewer = new Marzipano.Viewer(element, { controls: { mouseViewMode: 'drag' } });

// Создание сцены
const geometry = new Marzipano.CubeGeometry(levels);
const source   = Marzipano.ImageUrlSource.fromString(
  'tiles/{scene_id}/{z}/{f}/{y}/{x}.jpg',
  { cubeMapPreviewUrl: 'tiles/{scene_id}/preview.jpg' }
);
const limiter  = Marzipano.RectilinearView.limit.traditional(1024, 120 * Math.PI / 180);
const view     = new Marzipano.RectilinearView(initialView, limiter);
const scene    = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

// Переключение сцены (встроенный Fade)
scene.switchTo({ transitionDuration: 1000 });

// Анимация взгляда
scene.lookTo({ yaw, pitch, fov }, { transitionDuration: 600 });

// Текущий view
const view  = scene.view();
view.yaw(); view.pitch(); view.fov();
view.setParameters({ yaw, pitch, fov });

// Хотспоты
scene.hotspotContainer().createHotspot(domElement, { yaw, pitch });
```

---

## Три фазы viewer (порядок реализации)

### Фаза 1 — Базовый viewer
- Загрузка `tour.json`
- Рендер сцен через Marzipano
- Навигационные хотспоты с встроенным Fade (`scene.switchTo`)
- Корректный `targetYaw` / `targetPitch` при входе в сцену

### Фаза 2 — Кастомные переходы
- `TransitionEngine`: Zoom-in к хотспоту → Fade → Zoom-out в новой сцене
- `easing.js`: easeInOutQuad, easeOutCubic, easeInQuad

### Фаза 3 — InfoPanel
- Информационные хотспоты (`type: "info"`)
- DOM-панель: текст + изображение + YouTube embed / `<video>`
- Закрытие по кнопке, по Escape, по клику вне панели

---

## Редактор — порядок реализации

### Этап 1 — Скелет и типы
- Monorepo: root `package.json` с workspaces
- `packages/editor`: Vite + React + TypeScript
- `types.ts`: `TourData`, `Scene`, `Hotspot`, `NavHotspot`, `InfoHotspot`, `InfoContent`
- `tourStore.ts`: Context + useReducer, actions: ADD_SCENE, UPDATE_SCENE, ADD_HOTSPOT,
  UPDATE_HOTSPOT, DELETE_HOTSPOT, SET_DEFAULT_SCENE

### Этап 2 — Загрузка панорам и превью
- `PanoramaList`: загрузка файлов через `<input type="file" multiple accept="image/*">`
- `PanoramaCanvas`: рендер выбранной панорамы через Marzipano для визуального
  позиционирования хотспотов (клик → yaw/pitch из `view.screenToCoordinates()`)

### Этап 3 — Редактирование хотспотов
- `HotspotPanel`: список хотспотов сцены + кнопка добавить
- `NavHotspotForm`: поля targetSceneId (select), targetYaw, targetPitch, targetFov
- `InfoHotspotForm`: поля title, text (textarea), imageUrl, videoUrl

### Этап 4 — Экспорт
- `exporter.ts`: генерация `tour.json` из состояния store
- `zipper.ts`: упаковка viewer + tour.json + tiles (если загружены) в ZIP
- Экспорт папки: `showDirectoryPicker()` (File System Access API) — только Chrome/Edge

---

## Tiler — реализован

```bash
# Только desktop
node tiler.js --input ./panos/entrance.jpg --output ./tiles/scene-01 --id scene-01

# Desktop + mobile за один прогон
node tiler.js --input ./panos/entrance.jpg --output ./tiles/scene-01 --id scene-01 --mobile
```

Генерирует (без `--mobile`):
```
tiles/scene-01/
  preview.jpg          (256×1536, вертикальный стрип 6 граней: b,d,f,l,r,u)
  {z}/{f}/{y}/{x}.jpg
  manifest.json
```

Генерирует (с `--mobile`):
```
tiles/scene-01/
  preview.jpg
  {z}/{f}/{y}/{x}.jpg
  manifest.json
  mobile/
    preview.jpg
    {z}/{f}/{y}/{x}.jpg
    manifest.json
```

**Флаг `--mobile`:** проецирует 6 граней один раз (на desktop faceSize), затем
из тех же буферов нарезает два независимых набора тайлов. Дополнительного времени
на проекцию не тратится, только на resize + запись мобильных тайлов.

**Порядок граней (f в URL — буквенные коды Marzipano):**
| f    | Направление | Центр панорамы |
|---|---|---|
| `r` | +X (правая грань)      | lon=+90° |
| `l` | -X (левая грань)       | lon=-90° |
| `u` | +Y (верхняя грань)     | lat=+90° |
| `d` | -Y (нижняя грань)      | lat=-90° |
| `f` | +Z (фронтальная грань) | lon=0° — центр equirectangular |
| `b` | -Z (задняя грань)      | lon=±180° |

**z — 0-based:** z=0 — fallback (256×256, загружается первым), z=N — максимальное качество.

**Desktop — уровни по ширине входного изображения:**
| Ширина | faceSize | Уровни (size / tileSize) |
|---|---|---|
| < 2048  | 256  | 256/256(fb) |
| 2048    | 512  | 256/256(fb), 512/512 |
| 4096    | 1024 | 256/256(fb), 512/512, 1024/512 |
| 8192    | 2048 | 256/256(fb), 512/512, 1024/512, 2048/512 |
| 16384   | 4096 | 256/256(fb), 512/512, 1024/512, 2048/512, 4096/512 |

**Mobile — всегда:**
| faceSize | Уровни (size / tileSize) | Макс. GPU-текстура |
|---|---|---|
| min(512, desktopFaceSize) | 256/256(fb), 512/256 | 256×256 (4× меньше desktop) |

**Viewer — переключение на mobile:** изменить `tilesPath` сцены с `tiles/scene-01`
на `tiles/scene-01/mobile` и загрузить `mobile/manifest.json`.

**Зависимости:** `sharp` (нативный, через libvips), `minimist`
**Конвертация:** обратная проекция equirectangular → CubeGeometry, билинейная интерполяция.

---

## Editor — реализован полностью

**Стек:** React 19 + Vite 8 + TypeScript 6. Marzipano подключён через npm (`marzipano ^0.10.2`).

**Архитектура:** 3-колоночный layout.
```
┌─────────────┬───────────────────────────┬──────────────────┐
│ PanoramaList│     PanoramaCanvas        │  SceneSettings   │
│  220px      │   (Marzipano viewer)      │  HotspotPanel    │
│             │   EquirectGeometry        │  NavHotspotForm  │
│             │   клик → ADD_HOTSPOT      │  InfoHotspotForm │
│             │                           │     300px        │
└─────────────┴───────────────────────────┴──────────────────┘
```

**Состояние (`tourStore.tsx`):**
```typescript
EditorState {
  tour: { version, defaultSceneId, scenes: EditorScene[] }
  activeSceneId: string | null
  activeHotspotId: string | null
  placingHotspot: false | 'link' | 'info'
  capturedView: { yaw, pitch, fov } | null  // захват камеры ("Capture view")
  flipArrivalYaw: boolean                    // авто-разворот targetYaw на 180° (по умолчанию true)
}
```
`EditorScene` extends `Scene` + `panoramaObjectUrl?: string` (Object URL загруженного файла).
13 actions: ADD/UPDATE/DELETE_SCENE, SET_DEFAULT_SCENE, SET_ACTIVE_SCENE,
ADD/UPDATE/DELETE_HOTSPOT, SET_ACTIVE_HOTSPOT, START/CANCEL_PLACING_HOTSPOT,
CAPTURE_VIEW, TOGGLE_FLIP_ARRIVAL_YAW.

**Поток добавления хотспота:**
1. Нажать "+ Nav" / "+ Info" → `START_PLACING_HOTSPOT`
2. Клик по canvas → `view.screenToCoordinates({x,y})` → yaw/pitch
3. `ADD_HOTSPOT` → хотспот появляется в списке, открывается форма
4. Esc → `CANCEL_PLACING_HOTSPOT`

**Загрузка панорамы:** `<input type="file" multiple accept="image/*">` → `URL.createObjectURL(file)` → `ADD_SCENE`. Marzipano рендерит через `EquirectGeometry` без тайлинга.

**Экспорт (`src/lib/`):**
- `exporter.ts` — `exportTour()` снимает `panoramaObjectUrl` с EditorScene, возвращает чистый `TourData`
- `zipper.ts` — `downloadTourJson()` (Blob), `downloadZip()` (JSZip + 9 viewer-файлов), `exportToFolder()` (File System Access API, fallback на ZIP для Firefox)

---

## Viewer — реализован полностью

**Стек:** Vanilla JS (ES2020, ES modules). Marzipano v0.10.2 скопирован как `marzipano.js`.

**Архитектура:**
```
packages/viewer/
  index.html                  — подключает marzipano.js и app.js как module
  app.js                      — загрузка tour.json, инициализация viewer и сцен
  i18n.js                     — словарь uz/ru/en + t(key) + определение lang из URL
  style.css                   — базовые стили, хотспоты, InfoPanel, exit-кнопка
  marzipano.js                — библиотека (не модифицируется)
  hotspots/
    NavHotspot.js             — хотспот перехода (DOM-элемент с yaw/pitch)
    InfoHotspot.js            — хотспот информации (DOM-элемент)
    InfoPanel.js              — DOM-панель: текст + фото + YouTube/video
  transitions/
    TransitionEngine.js       — оркестрация Zoom + Fade
    easing.js                 — easeInOutQuad, easeOutCubic, easeInQuad
  tour.json                   — placeholder для разработки
```

**Поток инициализации (`app.js`):**
1. `fetch('tour.json')` → данные тура
2. Для каждой сцены: `CubeGeometry(levels)` + `ImageUrlSource` + `RectilinearView` → `viewer.createScene()`
3. `TransitionEngine` — создаётся один раз, управляет переходами
4. Для каждого хотспота сцены: `NavHotspot.create()` или `InfoHotspot.create()`
5. Стартовая сцена: `?scene=` URL-параметр → `defaultSceneId` → первая сцена в массиве
6. `startEntry.marzipanoScene.switchTo()` — показ стартовой сцены

**TransitionEngine — две фазы перехода (через хотспот):**
```
t=0:    from.lookTo(hotspot, WIDE_FOV=1.75, 80ms)            // вдох: FOV →100°
t=80:   from.lookTo(hotspot, ZOOM_IN_FOV=0.35, 520ms)        // рывок: FOV →20°
t=444:  to.view.setParameters(targetYaw/pitch/fov)
        to.switchTo(FADE_DURATION=280ms)                       // fade (на 70% рывка)
t=724:  _busy = false
```
Целевая сцена появляется сразу с `targetFov` (из hotspot.targetFov) — без фазы
приземления, чтобы не создавать ощущение отступления назад.

**Прямой переход через postMessage** (`TOUR_NAVIGATE`): `switchTo(600ms)` без фаз
zoom-in/out — используется для навигации из родительского фрейма (киоск).

**InfoPanel:**
- Открывается кликом на info-хотспот
- Поддерживает: текст (innerHTML), `imageUrl`, YouTube iframe (`/embed/` URL), `<video>` (локальный mp4)
- Закрывается по кнопке ×, Escape, клику вне панели
- Останавливает медиа при закрытии (pause/src="")

**ZIP-экспорт (editor → viewer):**
- `vite.config.ts` — плагин `viewer-files`:
  - dev: middleware `/viewer/*` → `packages/viewer/*`
  - build: `generateBundle` → эмитирует все файлы viewer как `viewer/*` ассеты
- `zipper.ts` — `downloadZip()` фетчит 9 файлов viewer с `/viewer/*`, упаковывает в ZIP вместе с `tour.json`

---

## Текущий статус

**Фаза:** MVP завершён, полный цикл готов к тестированию

**Что сделано:**
- [x] Инициализирован monorepo (root package.json + workspaces)
- [x] Создан пакет `tiler` — полностью реализован, флаг `--mobile`
- [x] Исправлен `preview.jpg`: теперь вертикальный стрип 256×1536 (6 граней в порядке bdflru)
- [x] Исправлен `manifest.json`: поле `sceneId` вместо `id`; editor принимает оба
- [x] Создан пакет `editor` — полностью реализован
- [x] `src/store/types.ts` — все TypeScript-типы схемы тура
- [x] `src/store/tourStore.tsx` — Context + useReducer, 13 actions
- [x] `PanoramaList` — загрузка файлов, список сцен
- [x] `PanoramaCanvas` — Marzipano EquirectGeometry, клик → yaw/pitch, маркеры хотспотов,
      overlay с текущим yaw/pitch/fov, кнопка "Capture view"
- [x] `SceneSettings` — название сцены, initialView, tilesPath, импорт manifest.json
- [x] `PanoramaList` — ☆/★ кнопка выбора дефолтной сцены
- [x] `HotspotPanel` — чекбокс "Auto-flip arrival yaw" (по умолчанию включён)
- [x] `NavHotspotForm` — поля targetYaw/Pitch/Fov, кнопка "Apply" из capturedView
- [x] `InfoHotspotForm` — поля title, text, imageUrl, videoUrl
- [x] `exporter.ts` + `zipper.ts` — сериализация, ZIP с viewer-файлами, экспорт в папку
- [x] Создан пакет `viewer` — полностью реализован
- [x] Реализован базовый viewer (Фаза 1)
- [x] Реализован `TransitionEngine` (Фаза 2, без фазы приземления)
- [x] Реализована `InfoPanel` (Фаза 3)
- [x] Кiosk IPC: `i18n.js` (uz/ru/en), кнопка выхода, `TOUR_EXIT` postMessage
- [x] Навигация по `?scene=sceneId` (URL) и `TOUR_NAVIGATE` (postMessage)
- [x] Исправлен zoom: лимитер FOV, scroll wheel RAF, pinch-to-zoom
- [x] Хотспоты масштабируются с FOV (`--hs-scale`); nav-хотспоты — эллипсы на полу
- [ ] Протестирован полный цикл: pano → tiler → editor → export → viewer

**Следующий шаг:**
Протестировать полный цикл (см. docs/TESTING.md): нарезать тестовую панораму tiler-ом,
расставить хотспоты в редакторе, экспортировать ZIP, встроить viewer в киоск,
проверить `?lang=`, `?scene=`, `TOUR_NAVIGATE` и `TOUR_EXIT`.

**Известное ограничение редактора:**
`PanoramaCanvas` загружает полное equirectangular-изображение как одну текстуру
(`EquirectGeometry`), без тайлинга. Для больших файлов (8192px+) возможна высокая
нагрузка на VRAM. Приемлемо для десктопного инструмента; оптимизация — в backlog.

---

## Открытые вопросы

1. `view.screenToCoordinates({x,y})` — **подтверждён** по исходнику `marzipano.js` v0.10.2.
   Реализован в `RectilinearView` и `FlatView`. Используется в `PanoramaCanvas.tsx`.
2. File System Access API (`showDirectoryPicker`) — поддержка только Chrome/Edge.
   **Решено:** реализован graceful fallback — в Firefox кнопка "→ Folder" автоматически
   вызывает `downloadZip()`.
3. Тайлинг в браузере (без Node.js tiler) — **не планируется** (см. ADR-001):
   требует COOP/COEP заголовков, что ломает YouTube iframe в InfoPanel.
4. Лицензия на использование Marzipano внутри редактора: Apache 2.0, коммерческое
   использование разрешено. Проверено.
