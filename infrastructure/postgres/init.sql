CREATE TABLE IF NOT EXISTS items (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  img_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id > 0)
);

CREATE TABLE IF NOT EXISTS selected_items (
  item_id BIGINT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  sort_rank BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS selected_items_sort_rank_uidx
  ON selected_items(sort_rank);

CREATE INDEX IF NOT EXISTS selected_items_sort_rank_item_id_idx
  ON selected_items(sort_rank, item_id);

