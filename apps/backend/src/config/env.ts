import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5433/million_items"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  ADD_QUEUE_FLUSH_MS: z.coerce.number().default(10000),
  SYNC_QUEUE_FLUSH_MS: z.coerce.number().default(1000),
  PAGE_SIZE: z.coerce.number().default(20)
});

export const env = envSchema.parse(process.env);
