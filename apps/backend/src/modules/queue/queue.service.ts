import { env } from "../../config/env.js";
import { withClient } from "../../config/db.js";
import { ItemsRepository } from "../items/items.repository.js";
import { SelectionRepository } from "../selection/selection.repository.js";
import type { ItemsListParams } from "../items/items.types.js";
import type { SelectedItemsListParams } from "../selection/selection.types.js";

import type {
  QueuedAddResult,
  QueuedReadKey,
  QueuedReorderResult,
  QueuedSelectionResult
} from "./queue.types.js";

type QueueServiceDependencies = {
  addFlushMs?: number;
  itemsRepository?: ItemsRepository;
  now?: () => number;
  selectionRepository?: SelectionRepository;
  syncFlushMs?: number;
};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error?: unknown) => void;
  resolve: (value: T) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

export class QueueService {
  private addFlushTimer: NodeJS.Timeout | null = null;

  private syncFlushTimer: NodeJS.Timeout | null = null;

  private readFlushTimer: NodeJS.Timeout | null = null;

  private readonly addQueue = new Map<number, Deferred<QueuedAddResult>>();

  private readonly selectionQueue = new Map<
    number,
    {
      deferreds: Deferred<QueuedSelectionResult>[];
      selected: boolean;
      sequence: number;
    }
  >();

  private readonly reorderQueue = new Map<
    string,
    {
      deferreds: Deferred<QueuedReorderResult>[];
      itemIds: number[];
      sequence: number;
    }
  >();

  private selectionSequence = 0;

  private reorderSequence = 0;

  private readonly itemsRepository: ItemsRepository;

  private readonly selectionRepository: SelectionRepository;

  private readonly readQueue = new Map<
    QueuedReadKey,
    {
      deferred: Deferred<unknown>;
      runner: () => Promise<unknown>;
    }
  >();

  private readonly readCache = new Map<
    QueuedReadKey,
    {
      expiresAt: number;
      value: unknown;
    }
  >();

  private readonly addFlushMs: number;

  private readonly syncFlushMs: number;

  private readonly now: () => number;

  constructor(dependencies: QueueServiceDependencies = {}) {
    this.itemsRepository = dependencies.itemsRepository ?? new ItemsRepository();
    this.selectionRepository = dependencies.selectionRepository ?? new SelectionRepository();
    this.addFlushMs = dependencies.addFlushMs ?? env.ADD_QUEUE_FLUSH_MS;
    this.syncFlushMs = dependencies.syncFlushMs ?? env.SYNC_QUEUE_FLUSH_MS;
    this.now = dependencies.now ?? Date.now;
  }

  enqueueAdd(itemId: number) {
    const existingTask = this.addQueue.get(itemId);

    if (existingTask) {
      return existingTask.promise;
    }

    const task = createDeferred<QueuedAddResult>();
    this.addQueue.set(itemId, task);

    if (!this.addFlushTimer) {
      this.addFlushTimer = setTimeout(() => {
        void this.flushAddQueue();
      }, this.addFlushMs);
    }

    return task.promise;
  }

  enqueueSelection(itemId: number, selected: boolean) {
    const task = createDeferred<QueuedSelectionResult>();
    this.selectionSequence += 1;

    const existingTask = this.selectionQueue.get(itemId);

    if (existingTask) {
      existingTask.deferreds.push(task);
      existingTask.selected = selected;
      existingTask.sequence = this.selectionSequence;
      this.ensureSyncFlushTimer();

      return task.promise;
    }

    this.selectionQueue.set(itemId, {
      deferreds: [task],
      selected,
      sequence: this.selectionSequence
    });
    this.ensureSyncFlushTimer();

    return task.promise;
  }

  enqueueReorder(itemIds: number[]) {
    const task = createDeferred<QueuedReorderResult>();
    const key = this.buildReorderKey(itemIds);
    const existingTask = this.reorderQueue.get(key);

    if (existingTask) {
      existingTask.deferreds.push(task);
      this.ensureSyncFlushTimer();

      return task.promise;
    }

    this.reorderSequence += 1;
    this.reorderQueue.set(key, {
      deferreds: [task],
      itemIds: [...itemIds],
      sequence: this.reorderSequence
    });
    this.ensureSyncFlushTimer();

    return task.promise;
  }

  enqueueAvailableItemsRead(params: ItemsListParams) {
    return this.enqueueRead(this.buildReadKey("items", params), () => this.itemsRepository.listAvailableItems(params));
  }

  enqueueSelectedItemsRead(params: SelectedItemsListParams) {
    return this.enqueueRead(this.buildReadKey("selected-items", params), () =>
      this.selectionRepository.listSelectedItems(params)
    );
  }

  private async flushAddQueue() {
    const currentQueue = new Map(this.addQueue);
    this.addQueue.clear();

    if (this.addFlushTimer) {
      clearTimeout(this.addFlushTimer);
      this.addFlushTimer = null;
    }

    if (currentQueue.size === 0) {
      return;
    }

    const ids = [...currentQueue.keys()].sort((left, right) => left - right);

    try {
      const result = await this.itemsRepository.addItems(ids);
      const createdSet = new Set(result.createdIds);
      this.invalidateReadCache();

      for (const [id, deferred] of currentQueue.entries()) {
        deferred.resolve({
          created: createdSet.has(id),
          id
        });
      }
    } catch (error) {
      for (const deferred of currentQueue.values()) {
        deferred.reject(error);
      }
    }
  }

  private ensureSyncFlushTimer() {
    if (this.syncFlushTimer) {
      return;
    }

    this.syncFlushTimer = setTimeout(() => {
      void this.flushSyncQueue();
    }, this.syncFlushMs);
  }

  private enqueueRead<T>(key: QueuedReadKey, runner: () => Promise<T>): Promise<T> {
    const cachedValue = this.readCache.get(key);

    if (cachedValue && cachedValue.expiresAt > this.now()) {
      return Promise.resolve(cachedValue.value as T);
    }

    if (cachedValue) {
      this.readCache.delete(key);
    }

    const existingTask = this.readQueue.get(key);

    if (existingTask) {
      return existingTask.deferred.promise as Promise<T>;
    }

    const deferred = createDeferred<T>();
    this.readQueue.set(key, {
      deferred: deferred as Deferred<unknown>,
      runner: runner as () => Promise<unknown>
    });

    if (!this.readFlushTimer) {
      this.readFlushTimer = setTimeout(() => {
        void this.flushReadQueue();
      }, this.syncFlushMs);
    }

    return deferred.promise;
  }

  private buildReadKey(scope: string, params: object) {
    return `${scope}:${JSON.stringify(params)}`;
  }

  private buildReorderKey(itemIds: number[]) {
    return itemIds.join(",");
  }

  private async flushSyncQueue() {
    const currentSelectionQueue = new Map(this.selectionQueue);
    const currentReorderQueue = [...this.reorderQueue.values()].sort((left, right) => left.sequence - right.sequence);

    this.selectionQueue.clear();
    this.reorderQueue.clear();

    if (this.syncFlushTimer) {
      clearTimeout(this.syncFlushTimer);
      this.syncFlushTimer = null;
    }

    if (currentSelectionQueue.size === 0 && currentReorderQueue.length === 0) {
      return;
    }

    try {
      await withClient(async (client) => {
        await client.query("BEGIN");

        try {
          const reorderResults: Array<{
            deferreds: Deferred<QueuedReorderResult>[];
            result: QueuedReorderResult;
          }> = [];

          if (currentSelectionQueue.size > 0) {
            const operations = [...currentSelectionQueue.entries()]
              .sort((left, right) => left[1].sequence - right[1].sequence)
              .map(([itemId, task]) => ({
                itemId,
                selected: task.selected
              }));

            await this.selectionRepository.applySelectionOperations(client, operations);
          }

          for (const reorderTask of currentReorderQueue) {
            const repositoryResult = await this.selectionRepository.reorderSelectedItems(client, reorderTask.itemIds);

            reorderResults.push({
              deferreds: reorderTask.deferreds,
              result: {
                orderedIds: repositoryResult.orderedIds
              }
            });
          }

          await client.query("COMMIT");
          this.invalidateReadCache();

          for (const [itemId, task] of currentSelectionQueue.entries()) {
            for (const deferred of task.deferreds) {
              deferred.resolve({
                itemId,
                selected: task.selected
              });
            }
          }

          for (const reorderTask of reorderResults) {
            for (const deferred of reorderTask.deferreds) {
              deferred.resolve(reorderTask.result);
            }
          }
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      });
    } catch (error) {
      for (const task of currentSelectionQueue.values()) {
        for (const deferred of task.deferreds) {
          deferred.reject(error);
        }
      }

      for (const reorderTask of currentReorderQueue) {
        for (const deferred of reorderTask.deferreds) {
          deferred.reject(error);
        }
      }
    }
  }

  private async flushReadQueue() {
    const currentReadQueue = new Map(this.readQueue);
    this.readQueue.clear();

    if (this.readFlushTimer) {
      clearTimeout(this.readFlushTimer);
      this.readFlushTimer = null;
    }

    if (currentReadQueue.size === 0) {
      return;
    }

    await Promise.all(
      [...currentReadQueue.values()].map(async ({ deferred, runner }) => {
        try {
          const result = await runner();
          const cacheEntries = [...currentReadQueue.entries()].filter(([, queuedTask]) => queuedTask.deferred === deferred);

          for (const [key] of cacheEntries) {
            this.readCache.set(key, {
              expiresAt: this.now() + this.syncFlushMs,
              value: result
            });
          }

          deferred.resolve(result);
        } catch (error) {
          deferred.reject(error);
        }
      })
    );
  }

  private invalidateReadCache() {
    this.readCache.clear();
  }
}

export const queueService = new QueueService();
