# API Contract

## `GET /api/v1/health`
Проверяет доступность backend и соединение с PostgreSQL.

Пример ответа:

```json
{
  "services": {
    "db": {
      "latencyMs": 26,
      "status": "ok"
    }
  },
  "status": "ok"
}
```

## `GET /api/v1/items`
Возвращает список невыбранных элементов.

Query params:
- `limit` — максимум `20`
- `cursor` — base64 cursor следующей страницы
- `id` — фильтр по префиксу `ID`

Примечания:
- список исключает элементы из `selected_items`
- чтения батчатся
- одинаковые повторные чтения могут быть отданы из short-lived read-cache

Пример ответа:

```json
{
  "items": [
    {
      "id": 2,
      "imgUrl": "https://picsum.photos/seed/item-2/160/160",
      "title": "Item 2 title 1013904226"
    }
  ],
  "nextCursor": "eyJpZCI6Mn0="
}
```

## `GET /api/v1/selected-items`
Возвращает список выбранных элементов в текущем порядке.

Query params:
- `limit` — максимум `20`
- `cursor` — base64 cursor следующей страницы
- `id` — фильтр по префиксу `ID`

Примечания:
- порядок строится по `sort_rank ASC, item_id ASC`
- reorder затрагивает только переданный subset, остальные элементы сохраняют относительные позиции

Пример ответа:

```json
{
  "items": [
    {
      "id": 3,
      "imgUrl": "https://picsum.photos/seed/item-3/160/160",
      "itemId": 3,
      "sortRank": 1,
      "title": "Item 3 title 3668339987"
    }
  ],
  "nextCursor": null
}
```

## `POST /api/v1/items/add`
Ставит добавление новых `ID` в add queue.

Body:

```json
{
  "ids": [1000001, 1000002]
}
```

Примечания:
- одинаковые `ID` дедуплицируются до flush
- существующие `ID` не обновляются
- endpoint возвращает `202 Accepted`

Пример ответа:

```json
{
  "createdIds": [1000001, 1000002],
  "skippedIds": []
}
```

## `POST /api/v1/selected-items/set`
Ставит операции выбора и снятия выбора в sync queue.

Body:

```json
{
  "operations": [
    { "itemId": 1, "selected": true },
    { "itemId": 2, "selected": false }
  ]
}
```

Примечания:
- последнее состояние по одному `itemId` побеждает предыдущее в том же flush-окне
- endpoint возвращает `202 Accepted`

Пример ответа:

```json
{
  "selectedIds": [1],
  "deselectedIds": [2]
}
```

## `POST /api/v1/selected-items/reorder`
Меняет порядок выбранных элементов.

Body:

```json
{
  "itemIds": [3, 1, 2]
}
```

Примечания:
- идентичные reorder внутри одного flush-окна дедуплицируются
- разные reorder внутри одного flush-окна выполняются последовательно
- backend переиспользует существующие `sort_rank` subset-а вместо полной перезаписи всей таблицы
- endpoint возвращает `202 Accepted`

Пример ответа:

```json
{
  "orderedIds": [3, 1, 2]
}
```
