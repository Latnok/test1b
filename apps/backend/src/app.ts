import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { itemsRoutes } from "./modules/items/items.routes.js";
import { selectionRoutes } from "./modules/selection/selection.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

export const createApp = () => {
  const app = express();
  const apiV1 = express.Router();

  app.use(cors());
  app.use(express.json());

  apiV1.use("/health", healthRoutes);
  apiV1.use("/items", itemsRoutes);
  apiV1.use("/selected-items", selectionRoutes);

  app.use("/api/v1", apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
