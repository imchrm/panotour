# TODO.md — panotour

> Живой список задач. `[ ]` -> `[x]` по мере выполнения.
> Перемещай выполненные задачи в CHANGELOG.md.

---

## Срочно (MVP — полный цикл)

### Инфраструктура
- [ ] Создать root `package.json` с `workspaces: ["packages/*"]`
- [ ] Создать `.gitignore` (node_modules, dist, *.tgz, .DS_Store)
- [ ] Создать `README.md` с инструкцией запуска

### Пакет `tiler`
- [x] Инициализировать `packages/tiler/package.json`
- [x] Реализовать `tiler.js` CLI (аргументы: --input, --output, --id)
- [x] Реализовать `lib/cubemapTiler.js` — обратная проекция + sharp (без panorama-to-cubemap)
- [x] Реализовать `lib/manifest.js` — генерация `manifest.json` с levels[]
- [x] Добавить флаг `--mobile` — генерация mobile-набора тайлов за один прогон
- [x] Протестировать на синтетической equirectangular (2048x1024 градиент)

### Пакет `editor`
- [ ] Scaffold через `npm create vite packages/editor -- --template react-ts`
- [ ] Создать `src/store/types.ts` — все TypeScript-типы схемы тура
- [ ] Создать `src/store/tourStore.ts` — Context + useReducer
- [ ] Реализовать `PanoramaList` — загрузка файлов, список сцен
- [ ] Реализовать `PanoramaCanvas` — рендер панорамы через Marzipano
- [ ] Выяснить и реализовать конвертацию клика в yaw/pitch (см. открытый вопрос #1)
- [ ] Реализовать `HotspotPanel` — список хотспотов, кнопка добавить/удалить
- [ ] Реализовать `NavHotspotForm` — поля link-хотспота
- [ ] Реализовать `InfoHotspotForm` — поля info-хотспота
- [ ] Реализовать `SceneSettings` — название сцены, initialView
- [ ] Реализовать `exporter.ts` — сериализация store -> tour.json
- [ ] Реализовать `zipper.ts` — упаковка в ZIP через JSZip
- [ ] Реализовать экспорт в папку через File System Access API (Chrome/Edge)
- [ ] Добавить fallback: если File System Access недоступен — только ZIP

### Пакет `viewer`
- [ ] Создать базовую структуру файлов viewer
- [ ] Реализовать `app.js` — загрузка tour.json, инициализация viewer
- [ ] Реализовать `hotspots/NavHotspot.js`
- [ ] Реализовать базовый переход (switchTo + targetYaw/targetPitch)
- [ ] Реализовать `hotspots/InfoHotspot.js` + `hotspots/InfoPanel.js`
- [ ] Реализовать `transitions/easing.js`
- [ ] Реализовать `transitions/TransitionEngine.js` — Zoom + Fade + Land
- [ ] Mobile: при загрузке определять тип устройства, использовать `tiles/{id}/mobile/`
      и `mobile/manifest.json` если они присутствуют (graceful fallback на desktop)
- [ ] Протестировать полный цикл: tiler -> editor -> export -> viewer

---

## Улучшения UX редактора

- [ ] Drag-and-drop загрузка панорам (помимо file input)
- [ ] Визуальные маркеры хотспотов прямо на canvas (поверх Marzipano)
- [ ] Выделение активного хотспота при клике на маркер
- [ ] Предпросмотр перехода: стрелка от source-хотспота к target-сцене
- [ ] Undo/redo (история действий через useReducer)
- [ ] Импорт существующего `tour.json` для продолжения работы
- [ ] Валидация перед экспортом: предупреждение если есть сцены без хотспотов
- [ ] Миниатюры сцен в `PanoramaList` (thumbnail из preview.jpg)

---

## Улучшения UX viewer

- [ ] Анимация хотспота: пульсация при idle
- [ ] Индикатор загрузки сцены во время перехода
- [ ] Плавное появление хотспотов после завершения перехода
- [ ] Кнопка fullscreen
- [ ] Autorotate при бездействии (пауза при hover на хотспоте)
- [ ] Закрытие InfoPanel по клику вне панели и по Escape
- [ ] Остановка видео в InfoPanel при закрытии
- [ ] Поддержка `<video>` (локальные mp4) и YouTube iframe в InfoPanel

---

## Технический долг

- [ ] Настроить ESLint для editor (eslint + @typescript-eslint)
- [ ] Настроить ESLint для tiler (eslint + node globals)
- [ ] JSDoc-аннотации на публичные функции TransitionEngine
- [ ] JSDoc-аннотации на публичные функции InfoPanel
- [ ] Проверить утечки памяти при многократных переходах (hotspotContainer cleanup)
- [ ] Проверить корректность позиционирования хотспотов при resize окна
- [ ] Добавить обработку ошибок загрузки тайлов (fallback на preview.jpg)
- [ ] Версионирование схемы tour.json (поле `version`) с миграциями

---

## Функциональные идеи (backlog)

- [ ] Тайлинг прямо в браузере (WebAssembly libvips) — убрать зависимость от Node.js tiler
- [ ] Навигационная карта-схема (floor plan) с отметкой текущей позиции
- [ ] Глубокие ссылки: URL hash `#scene-id` для прямого перехода к сцене
- [ ] Галерея изображений внутри InfoPanel (несколько фото)
- [ ] Аудиогид: поле `audioUrl` в сцене, воспроизведение при входе
- [ ] Серверный API для хранения туров (FastAPI бэкенд — отдельный проект)
- [ ] Режим kiosk: отключение UI-элементов управления, только хотспоты
- [ ] Экспорт в iframe-embed код для вставки на сторонний сайт
