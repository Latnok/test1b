# Implementation Plan

## 1. Bootstrap
- [x] Создать корневую структуру монорепо
- [x] Инициализировать backend приложение
- [x] Инициализировать frontend приложение
- [x] Добавить shared package
- [x] Настроить общие скрипты запуска

## 2. Infrastructure
- [x] Подготовить `docker-compose.yml` с PostgreSQL
- [x] Добавить `.env.example`
- [x] Настроить подключение backend к PostgreSQL
- [x] Добавить SQL-инициализацию схемы

## 3. Data model
- [x] Создать таблицу `items`
- [x] Создать таблицу `selected_items`
- [x] Добавить индексы для pagination и выборки
- [x] Зафиксировать модель данных в `docs/data-model.md`

## 4. Seed
- [x] Реализовать сид на 1 000 000 элементов
- [x] Генерировать `title` и `img_url`
- [x] Проверить производительность массовой вставки

## 5. Backend API
- [x] Реализовать `GET /api/v1/items`
- [x] Реализовать `GET /api/v1/selected-items`
- [x] Реализовать `POST /api/v1/items/add`
- [x] Реализовать `POST /api/v1/selected-items/set`
- [x] Реализовать `POST /api/v1/selected-items/reorder`
- [x] Добавить health endpoint
- [x] Описать контракт API в `docs/api-contract.md`

## 6. Queue and batching
- [x] Реализовать очередь добавления с flush раз в 10 сек
- [x] Реализовать очередь чтения/изменения с flush раз в 1 сек
- [x] Добавить дедупликацию одинаковых операций
- [x] Зафиксировать поведение очередей в `docs/queue-behavior.md`

## 7. Frontend UI
- [x] Собрать layout из двух контейнеров
- [x] Реализовать левый список
- [x] Реализовать правый список
- [x] Добавить поиск по ID в обоих контейнерах
- [x] Добавить infinite scroll в обоих контейнерах
- [x] Добавить форму ручного добавления ID
- [x] Добавить выбор и снятие выбора элементов
- [x] Добавить Drag&Drop сортировку выбранных элементов

## 8. State and sync
- [x] Подключить frontend к backend API
- [x] Обработать optimistic/non-optimistic сценарии
- [x] Корректно сбрасывать search при reload
- [x] Подтвердить сохранение выбора и порядка после reload

## 9. Testing
- [x] Проверить cursor pagination
- [x] Проверить фильтрацию по ID
- [x] Проверить отсутствие дублей при add
- [x] Проверить перенос между контейнерами
- [x] Проверить reorder без фильтра
- [x] Проверить reorder с фильтром
- [x] Проверить поведение очередей при конкурентных запросах

## 10. Finalization
- [x] Обновить README
- [x] Пройти smoke test полного сценария
- [ ] Подготовить проект к сдаче

## 11. Remediation
- [x] Replace full-table reorder rewrite with targeted rank updates
- [x] Protect reorder against rank conflicts inside a transaction
- [x] Reconcile left/right optimistic updates with cursor pagination after mutations
- [x] Add virtualization for the selected list
- [x] Add regression coverage for reorder integrity and deep browser scroll behavior

## 12. Multi-user validation
- [x] Verify shared-state behavior with multiple browser clients
- [x] Verify concurrent selection and reorder semantics against the global queue
- [x] Document current cross-client consistency model and its limits

## Rules
- Выполненный пункт отмечается только после фактической проверки результата.
- Если меняется реализация, нужно обновлять формулировку пункта, а не вести рядом альтернативный список.
- Если появляется новый обязательный шаг, его нужно добавлять в тематический раздел, а не в конец файла.
