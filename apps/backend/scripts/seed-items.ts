import { closePool, withClient } from "../src/config/db.js";
import { buildItemImageUrl, buildItemTitle } from "../src/utils/item-factory.js";

const DEFAULT_TOTAL_ITEMS = 1_000_000;
const DEFAULT_BATCH_SIZE = 10_000;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const totalItems = parsePositiveInt(process.env.SEED_TOTAL_ITEMS, DEFAULT_TOTAL_ITEMS);
const batchSize = parsePositiveInt(process.env.SEED_BATCH_SIZE, DEFAULT_BATCH_SIZE);

const buildBatchValues = (startId: number, size: number) => {
  const ids: number[] = [];
  const titles: string[] = [];
  const imageUrls: string[] = [];

  for (let offset = 0; offset < size; offset += 1) {
    const id = startId + offset;
    ids.push(id);
    titles.push(buildItemTitle(id));
    imageUrls.push(buildItemImageUrl(id));
  }

  return { ids, imageUrls, titles };
};

const run = async () => {
  const startedAt = Date.now();

  await withClient(async (client) => {
    for (let startId = 1; startId <= totalItems; startId += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalItems - startId + 1);
      const { ids, imageUrls, titles } = buildBatchValues(startId, currentBatchSize);

      await client.query(
        `
          INSERT INTO items (id, title, img_url)
          SELECT *
          FROM UNNEST($1::bigint[], $2::text[], $3::text[])
          ON CONFLICT (id) DO NOTHING
        `,
        [ids, titles, imageUrls]
      );

      const processed = startId + currentBatchSize - 1;
      console.log(`Seeded ${processed.toLocaleString()} / ${totalItems.toLocaleString()} items`);
    }
  });

  console.log(`Seed completed in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
};

run()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
