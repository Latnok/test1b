import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { MAX_PAGE_SIZE } from "../../utils/pagination.js";
import { itemsService } from "./items.service.js";

const listItemsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  id: z
    .string()
    .trim()
    .regex(/^\d+$/, "ID filter must contain only digits")
    .optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(MAX_PAGE_SIZE)
});

const addItemsBodySchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1)
});

export const itemsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listItemsQuerySchema.parse(req.query);
      const response = await itemsService.listAvailableItems({
        cursor: query.cursor,
        idFilter: query.id,
        limit: query.limit
      });

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
  add: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = addItemsBodySchema.parse(req.body);
      const response = await itemsService.addItems(body.ids);

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }
};
