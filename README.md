# panotour

Редактор и viewer 360-туров на базе библиотеки [Marzipano](https://www.marzipano.net).

---

## Что сделать в репозитории ПЕРЕД первой сессией в Code

Выполни эти шаги вручную один раз. После этого Code-сессии начинаются
с передачи `CONTEXT.md` и продолжают с готовой основой.

### 1. Создать репозиторий на GitHub

```
Название:     panotour
Visibility:   Private (или Public — на твоё усмотрение)
Initialize:   NO (без README, без .gitignore — добавим сами)
```

### 2. Клонировать локально

```bash
git clone git@github.com:YOUR_USERNAME/panotour.git
cd panotour
```

### 3. Создать root package.json

```bash
cat > package.json << 'EOF'
{
  "name": "panotour",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "editor": "npm run dev --workspace=packages/editor",
    "tiler": "npm run --workspace=packages/tiler",
    "build:editor": "npm run build --workspace=packages/editor"
  }
}
EOF
```

### 4. Создать .gitignore

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.DS_Store
*.local
*.tgz
tiles/
EOF
```

### 5. Создать структуру папок

```bash
mkdir -p packages/editor
mkdir -p packages/viewer
mkdir -p packages/tiler
```

### 6. Scaffold editor через Vite

```bash
cd packages
npm create vite@latest editor -- --template react-ts
cd editor
# НЕ запускать npm install ещё
```

### 7. Инициализировать tiler

```bash
cd ../tiler
cat > package.json << 'EOF'
{
  "name": "@panotour/tiler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node tiler.js"
  },
  "dependencies": {
    "panorama-to-cubemap": "^1.1.0",
    "sharp": "^0.33.0"
  }
}
EOF
```

### 8. Установить все зависимости из корня

```bash
cd ../../        # вернуться в корень panotour/
npm install      # установит зависимости всех workspaces
```

### 9. Первый коммит

```bash
git add .
git commit -m "chore: init monorepo structure (editor, viewer, tiler)"
git push origin main
```

### 10. Проверить

```bash
# Должна запуститься dev-версия редактора
npm run editor
# Открыть http://localhost:5173
```

После этих шагов репозиторий готов. Открывай Code, передавай `CONTEXT.md`
в начале сессии и продолжай по `TODO.md`.

---

## Структура проекта

```
panotour/
  packages/
    editor/     React + Vite + TypeScript  — редактор хотспотов
    viewer/     Vanilla JS                 — готовый 360-тур
    tiler/      Node.js CLI                — нарезка панорам в тайлы
  CONTEXT.md    Главный файл для AI-сессий
  TODO.md       Список задач
  ARCHITECTURE.md  Архитектурные решения
  CHANGELOG.md  Хронология
```

## Быстрый старт (после setup)

```bash
# Редактор
npm run editor

# Tiler (нарезать панораму)
cd packages/tiler
node tiler.js --input ../../panos/entrance.jpg --output ../../packages/viewer/tiles/scene-01 --id scene-01

# Viewer (статический сервер)
cd packages/viewer
npx serve .
```
