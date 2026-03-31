import { Router } from "express";

import { getDbHealth } from "../../config/db.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_req, res) => {
  try {
    const db = await getDbHealth();

    res.json({
      services: {
        db
      },
      status: "ok"
    });
  } catch (error) {
    console.error("Health check failed", error);

    res.status(503).json({
      services: {
        db: {
          status: "error"
        }
      },
      status: "degraded"
    });
  }
});
