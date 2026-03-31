# Queue Behavior

## Add queue
- обслуживает `POST /api/v1/items/add`
- flush выполняется раз в `ADD_QUEUE_FLUSH_MS`
- ключ дедупликации: `item_id`
- если один и тот же `id` приходит несколько раз до flush, в БД уходит одна вставка
- insert выполняется батчем через `INSERT ... SELECT FROM UNNEST`
- после успешного flush read-cache инвалидируется

## Sync queue
- обслуживает `POST /api/v1/selected-items/set` и `POST /api/v1/selected-items/reorder`
- flush выполняется раз в `SYNC_QUEUE_FLUSH_MS`
- последнее состояние по одному `item_id` побеждает предыдущие операции в том же flush-окне
- все ожидающие `set`-запросы по одному `item_id` получают один и тот же финальный результат и не остаются в подвешенном состоянии
- идентичные `reorder` в одном flush-окне дедуплицируются и делят один результат
- разные `reorder` в одном flush-окне выполняются последовательно в порядке поступления
- на flush сначала применяются `set`-операции, затем `reorder`
- после успешного flush read-cache инвалидируется

## Read batching
- чтения `GET /api/v1/items` и `GET /api/v1/selected-items` батчатся раз в `SYNC_QUEUE_FLUSH_MS`
- дедупликация идентичных чтений делается по ключу query-параметров
- одинаковые запросы в одном flush-окне делят один и тот же результат
- short-lived read-cache переиспользует результат идентичного чтения до истечения `SYNC_QUEUE_FLUSH_MS`
- после write/add flush read-cache сбрасывается

## Practical Consequences
- UI не обязан каждый раз ждать новый flush для повторного одинакового чтения
- reorder и `set` остаются eventual-consistent в пределах sync-окна
- одинаковые browser/API read burst-ы не создают лишнюю нагрузку на БД
- все пользователи делят один общий state без изоляции по аккаунтам
- другие открытые вкладки не получают live-push и видят чужие изменения только после fresh read или reload
