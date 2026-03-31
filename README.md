# Million Items Selector

## Что это
Интерфейс из двух контейнеров для работы со списком из `1 000 000` элементов.
- слева показываются все невыбранные элементы
- справа показываются выбранные элементы с ручной сортировкой
- поддерживаются фильтрация по `ID`, infinite scroll, drag-and-drop, сохранение выбора и порядка

## Стек
- Backend: `Express.js`
- Frontend: `React + Vite`
- Database: `PostgreSQL`
- Drag&Drop: `dnd-kit` + native HTML5 DnD
- Data access: `pg`

## Что уже реализовано
- cursor pagination по `20` элементов
- versioned API через `/api/v1/...`
- серверное хранение выбора и сортировки
- добавление новых элементов по ручному `ID`
- batching и дедупликация запросов на сервере
- targeted reorder без полной перезаписи `selected_items`
- read batching с короткоживущим read-cache
- виртуализация обоих списков на frontend
- мягкая фоновая синхронизация после `select/deselect`

## Структура проекта
- `apps/backend` — Express API, сервисы, очереди, seed
- `apps/frontend` — UI из двух контейнеров, infinite scroll, DnD
- `packages/shared` — общие типы и константы
- `docs` — контракт API, модель данных, поведение очередей
- `infrastructure` — SQL-инициализация и инфраструктурные файлы
- `tests` — browser/API/backend regression tests

## Как запустить
1. Поднять PostgreSQL через `docker compose up -d` на `localhost:5433`.
2. При необходимости скопировать `.env.example` в `.env`.
3. Установить зависимости через `npm.cmd install`.
4. Выполнить сид через `npm.cmd run seed --workspace @million-items/backend`.
5. Запустить backend через `npm.cmd run dev --workspace @million-items/backend`.
6. Запустить frontend через `npm.cmd run dev --workspace @million-items/frontend`.

## Переменные окружения
- `PORT`
- `DATABASE_URL`
- `DB_POOL_MAX`
- `FRONTEND_URL`
- `ADD_QUEUE_FLUSH_MS`
- `SYNC_QUEUE_FLUSH_MS`
- `PAGE_SIZE`

## API overview
- `GET /api/v1/health`
- `GET /api/v1/items`
- `GET /api/v1/selected-items`
- `POST /api/v1/items/add`
- `POST /api/v1/selected-items/set`
- `POST /api/v1/selected-items/reorder`

## Технические замечания
- `GET`-чтения батчатся раз в `SYNC_QUEUE_FLUSH_MS`, но повторные одинаковые чтения могут обслуживаться из короткоживущего cache.
- После успешных `add/select/reorder` read-cache инвалидируется.
- Поиск не сохраняется между обновлениями страницы.
- Выбор и порядок общие для всех посетителей.
- Несколько клиентов работают с одним глобальным server state: изменения одного пользователя становятся источником истины для всех.
- Открытые вкладки не получают push-обновления автоматически и сходятся к актуальному состоянию после нового чтения или reload.
- Конкурирующие `set` по одному `itemId` внутри одного sync-окна схлопываются до последнего состояния, и все ожидающие запросы получают финальный результат.

## Тесты
- `npm.cmd run test:deep-scroll`
- `npm.cmd run test:browser-scroll`
- `npm.cmd run test:browser-selection-sync`
- `npm.cmd run test:multi-user`
- `npm.cmd run test:multi-user-queue`
- `npm.cmd run test:read-cache`
- `npm.cmd run test:reorder-integrity`
- `npm.cmd run test:reorder-queue`
- `npm.cmd run test:edge-cases`

## Статус
Текущий прогресс реализации и remediation-работы ведётся в `IMPLEMENTATION_PLAN.md`.
