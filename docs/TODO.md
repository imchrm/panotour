# TODO.md — panotour

> Живой список задач. `[ ]` -> `[x]` по мере выполнения.
> Перемещай выполненные задачи в CHANGELOG.md.

---

## Срочно (MVP — полный цикл)

### Инфраструктура
- [x] Создать root `package.json` с `workspaces: ["packages/*"]`
- [x] Создать `.gitignore` (node_modules, dist, *.tgz, .DS_Store)
- [x] Создать `README.md` с инструкцией запуска

### Пакет `tiler`
- [x] Инициализировать `packages/tiler/package.json`
- [x] Реализовать `tiler.js` CLI (аргументы: --input, --output, --id)
- [x] Реализовать `lib/cubemapTiler.js` — обратная проекция + sharp (без panorama-to-cubemap)
- [x] Реализовать `lib/manifest.js` — генерация `manifest.json` с levels[]
- [x] Добавить флаг `--mobile` — генерация mobile-набора тайлов за один прогон
- [x] Протестировать на синтетической equirectangular (2048x1024 градиент)

### Пакет `editor`
- [x] Scaffold (Vite + React + TS)
- [x] Создать `src/store/types.ts` — все TypeScript-типы схемы тура
- [x] Создать `src/store/tourStore.tsx` — Context + useReducer (9 actions)
- [x] Реализовать `PanoramaList` — загрузка файлов, список сцен
- [x] Реализовать `PanoramaCanvas` — Marzipano EquirectGeometry, клик → yaw/pitch
- [x] Реализовать `HotspotPanel` — список хотспотов, кнопка добавить/удалить
- [x] Реализовать `NavHotspotForm` — поля link-хотспота
- [x] Реализовать `InfoHotspotForm` — поля info-хотспота
- [x] Реализовать `SceneSettings` — название сцены, initialView
- [x] Реализовать `exporter.ts` — сериализация store -> tour.json
- [x] Реализовать `zipper.ts` — упаковка в ZIP через JSZip
- [x] Добавить viewer-файлы в ZIP-архив (после реализации packages/viewer)
- [ ] Реализовать экспорт в папку через File System Access API (Chrome/Edge)
- [ ] Добавить fallback: если File System Access недоступен — только ZIP

### Пакет `viewer`
- [x] Создать базовую структуру файлов viewer
- [x] Реализовать `app.js` — загрузка tour.json, инициализация viewer
- [x] Реализовать `hotspots/NavHotspot.js`
- [x] Реализовать базовый переход (switchTo + targetYaw/targetPitch)
- [x] Реализовать `hotspots/InfoHotspot.js` + `hotspots/InfoPanel.js`
- [x] Реализовать `transitions/easing.js`
- [x] Реализовать `transitions/TransitionEngine.js` — Zoom + Fade + Land
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
