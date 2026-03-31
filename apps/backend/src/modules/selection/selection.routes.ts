import { Router } from "express";

import { selectionController } from "./selection.controller.js";

export const selectionRoutes = Router();

selectionRoutes.get("/", selectionController.list);
selectionRoutes.post("/set", selectionController.setSelection);
selectionRoutes.post("/reorder", selectionController.reorder);

