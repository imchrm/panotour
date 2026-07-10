# Связка карты киоска со сценами тура

> Рекомендации для navaport-kiosk: как привязать точки на карте (floor plan,
> схема территории) к сценам 360-туров и переходить сразу в нужную сцену.

---

## 1. Модель данных точки карты

Каждая интерактивная точка на карте киоска должна хранить:

```json
{
  "tourId": "museum-main",
  "sceneId": "scene-1783499762803-zpcut5",
  "yaw": 1.23,
  "pitch": 0.0,
  "fov": 1.5707963
}
```

| Поле | Обязательное | Описание |
|---|---|---|
| `tourId` | да | Идентификатор тура = имя папки экспортированного тура |
| `sceneId` | да | `id` сцены из `tour.json` этого тура |
| `yaw`, `pitch`, `fov` | нет | Направление взгляда при входе; если не заданы — `initialView` сцены |

Все угловые значения — **радианы** (как везде в tour.json).
`fov` — горизонтальный.

Рекомендуемое размещение туров на киоске:

```
/tours/
  museum-main/          <- tourId
    index.html          <- viewer
    tour.json
    tiles/
    media/
  museum-annex/
    ...
```

`tourId` в модели точки — это сегмент пути. Viewer сам не знает своего
tourId (в debug-логе он берёт последний сегмент pathname), маршрутизация —
ответственность киоска.

---

## 2. Два механизма перехода к сцене

### 2.1 Холодный старт — URL-параметр `?scene=`

Когда iframe ещё не загружен или загружен другой тур:

```js
iframe.src = `/tours/${point.tourId}/index.html` +
  `?lang=${lang}&scene=${encodeURIComponent(point.sceneId)}`;
```

Поведение viewer: `?scene=` с известным `sceneId` открывает тур сразу
с этой сцены; неизвестный `sceneId` молча откатывается к `defaultSceneId`.
Направление взгляда при холодном старте всегда `initialView` сцены —
переопределить его URL-параметром нельзя. Если точке карты нужно особое
направление, после события загрузки iframe отправьте `TOUR_NAVIGATE`
(см. 2.2) — но лучше задать правильный `initialView` сцены в редакторе.

### 2.2 Живой iframe — postMessage `TOUR_NAVIGATE`

Когда iframe уже показывает нужный тур:

```js
iframe.contentWindow.postMessage({
  type: 'TOUR_NAVIGATE',
  sceneId: point.sceneId,
  yaw:   point.yaw,    // опционально
  pitch: point.pitch,  // опционально
  fov:   point.fov,    // опционально
}, '*');
```

Поведение viewer:
- crossfade 600 мс, без zoom-фаз (в отличие от переходов по хотспотам);
- незаданные `yaw`/`pitch`/`fov` берутся из `initialView` сцены;
- сообщение **молча игнорируется**, если `sceneId` неизвестен или совпадает
  с текущей сценой — подтверждения доставки нет.

### 2.3 Рекомендуемая логика киоска

```js
function goToPoint(point) {
  const tourUrl = `/tours/${point.tourId}/index.html`;
  const sameTour = iframe.src.startsWith(location.origin + tourUrl);
  if (sameTour) {
    iframe.contentWindow.postMessage({ type: 'TOUR_NAVIGATE', ...point }, '*');
  } else {
    iframe.src = `${tourUrl}?lang=${lang}&scene=${encodeURIComponent(point.sceneId)}`;
  }
}
```

Держите iframe загруженным между обращениями к одному туру: `TOUR_NAVIGATE`
мгновеннее и дешевле полной перезагрузки (тайлы уже в кеше Marzipano).

---

## 3. Как получить значения yaw/pitch/fov для точки

1. Откройте сцену в редакторе panotour.
2. Поверните камеру в направление, которое должен видеть посетитель.
3. Нажмите **Capture view** — значения появятся в панели (в градусах
   в UI, но в store и экспорте — радианы).
4. Внесите радианы в данные точки карты.

Для большинства точек проще задать правильный `initialView` сцены в
редакторе и не передавать yaw/pitch/fov вовсе.

---

## 4. Стабильность sceneId

`sceneId` генерируется редактором при добавлении панорамы
(`scene-<timestamp>-<random>`) и далее **не меняется** — переименование
сцены меняет только `title`. Правила:

- **Не удаляйте и не пересоздавайте сцену** ради замены панорамы — замените
  JPEG в `scenes/{sceneId}.jpg` и перенарежьте тайлы; id сохранится.
- Удаление сцены из тура делает все ссылающиеся точки карты битыми:
  `?scene=` откатится на `defaultSceneId`, `TOUR_NAVIGATE` молча
  проигнорируется. Ошибок не будет — точка просто перестанет работать.
- После каждого переэкспорта тура прогоняйте сверку: каждый `sceneId`
  из точек карты должен присутствовать в `tour.json` соответствующего тура.

Пример скрипта сверки:

```js
const points = require('./map-points.json');
const fs = require('fs');
for (const p of points) {
  const tour = JSON.parse(fs.readFileSync(`tours/${p.tourId}/tour.json`, 'utf8'));
  if (!tour.scenes.some((s) => s.id === p.sceneId)) {
    console.error(`BROKEN: ${p.tourId} / ${p.sceneId}`);
  }
}
```

---

## 5. Обратная связь viewer -> киоск

| Сообщение | Когда | Реакция киоска |
|---|---|---|
| `{ type: 'TOUR_EXIT' }` | кнопка «Выход» или Escape | вернуться к карте |
| `{ type: 'TOUR_ACTIVITY' }` | активность пользователя, throttle 2500 мс | сброс таймера бездействия |

Отладка: добавьте `&debug=1` к URL — viewer логирует init-параметры,
TOUR_EXIT (с причиной) и TOUR_ACTIVITY в консоль с префиксом `[panotour]`.

---

## 6. Сводка ограничений

- Переход в текущую сцену через `TOUR_NAVIGATE` — no-op (нельзя использовать
  для «сброса» взгляда в той же сцене).
- Подтверждения доставки `TOUR_NAVIGATE` нет; при необходимости валидируйте
  `sceneId` на стороне киоска до отправки (по своей копии `tour.json`).
- `?scene=` не принимает yaw/pitch/fov.
- Радианы везде; типовые значения: `fov` 1.5708 (90 град), yaw в диапазоне
  [-pi, pi].
