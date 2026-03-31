import { Router } from "express";

import { itemsController } from "./items.controller.js";

export const itemsRoutes = Router();

itemsRoutes.get("/", itemsController.list);
itemsRoutes.post("/add", itemsController.add);

