# Data Model

## Tables

### `items`
- `id BIGINT PRIMARY KEY`
- `title TEXT NOT NULL`
- `img_url TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Назначение:
- основной каталог элементов
- базовый набор содержит `1_000_000` записей с `id` от `1` до `1_000_000`
- новые записи могут добавляться вручную по уникальному `id`

### `selected_items`
- `item_id BIGINT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE`
- `sort_rank BIGINT NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Назначение:
- глобальное состояние выбранных элементов
- хранение пользовательского порядка выбранных элементов

## Indexes
- `items_pkey` на `items(id)` для поиска по `id` и cursor pagination левого списка
- `selected_items_sort_rank_uidx` на `selected_items(sort_rank)` для уникального глобального порядка
- `selected_items_sort_rank_item_id_idx` на `selected_items(sort_rank, item_id)` для cursor pagination и стабильной сортировки правого списка

## Query Intent
- левый список: читать из `items`, исключая `selected_items`, сортировка по `id ASC`
- правый список: читать `selected_items JOIN items`, сортировка по `sort_rank ASC, item_id ASC`
- фильтрация в обоих списках: только по `id`

## Ordering Notes
- reorder обновляет только затронутые `sort_rank`, а не переписывает всю таблицу `selected_items`
- subset reorder сохраняет те же rank slots, которые занимали элементы subset-а до операции
- элементы вне subset-а сохраняют относительный порядок

## Constraints
- `id` уникален и положителен
- повторное добавление существующего `id` не создаёт новую запись и не обновляет текущую
- `sort_rank` остаётся уникальным для всего выбранного списка
