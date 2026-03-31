import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { MAX_PAGE_SIZE } from "../../utils/pagination.js";
import { selectionService } from "./selection.service.js";

const listSelectionQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  id: z
    .string()
    .trim()
    .regex(/^\d+$/, "ID filter must contain only digits")
    .optional(),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(MAX_PAGE_SIZE)
});

const setSelectionBodySchema = z.object({
  operations: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        selected: z.boolean()
      })
    )
    .min(1)
});

const reorderSelectionBodySchema = z.object({
  itemIds: z.array(z.coerce.number().int().positive()).min(1)
});

export const selectionController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listSelectionQuerySchema.parse(req.query);
      const response = await selectionService.listSelectedItems({
        cursor: query.cursor,
        idFilter: query.id,
        limit: query.limit
      });

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
  setSelection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = setSelectionBodySchema.parse(req.body);
      const response = await selectionService.setSelection(body.operations);

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  },
  reorder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = reorderSelectionBodySchema.parse(req.body);
      const response = await selectionService.reorderSelectedItems(body.itemIds);

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  }
};
