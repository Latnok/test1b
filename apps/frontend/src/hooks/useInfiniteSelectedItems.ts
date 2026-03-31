import { useCallback, useEffect, useRef, useState } from "react";

import { selectionService } from "../services/selection";

import type { SelectedItem } from "../types/item";

const PAGE_SIZE = 20;

export const useInfiniteSelectedItems = (idFilter: string, refreshKey: number) => {
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const loadingRef = useRef(false);
  const itemsRef = useRef<SelectedItem[]>([]);
  const nextCursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(async (reset: boolean, filter: string, cursor?: string | null) => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    const requestVersion = ++requestVersionRef.current;

    try {
      const response = await selectionService.list({
        cursor: reset ? undefined : cursor ?? undefined,
        id: filter || undefined,
        limit: PAGE_SIZE
      });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setItems((currentItems) => (reset ? response.items : [...currentItems, ...response.items]));
      setNextCursor(response.nextCursor);
      nextCursorRef.current = response.nextCursor;
      setHasMore(Boolean(response.nextCursor));
    } catch (caughtError) {
      if (requestVersion === requestVersionRef.current) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load selected items");
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
      }

      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const setLocalItems = useCallback((updater: (currentItems: SelectedItem[]) => SelectedItem[]) => {
    setItems((currentItems) => {
      const nextItems = updater(currentItems);
      itemsRef.current = nextItems;
      return nextItems;
    });
  }, []);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    nextCursorRef.current = null;
    setHasMore(true);
    setError(null);
    loadingRef.current = false;
    void fetchPage(true, idFilter, null);
  }, [fetchPage, idFilter, refreshKey]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !nextCursorRef.current) {
      return Promise.resolve();
    }

    return fetchPage(false, idFilter, nextCursorRef.current);
  }, [fetchPage, idFilter]);

  const reload = useCallback(() => {
    requestVersionRef.current += 1;
    setItems([]);
    setNextCursor(null);
    nextCursorRef.current = null;
    setHasMore(true);
    setError(null);
    loadingRef.current = false;

    return fetchPage(true, idFilter, null);
  }, [fetchPage, idFilter]);

  const syncToCount = useCallback(
    async (targetCount: number) => {
      const desiredCount = Math.max(PAGE_SIZE, targetCount);

      if (loadingRef.current || itemsRef.current.length >= desiredCount || !nextCursorRef.current) {
        return;
      }

      loadingRef.current = true;
      setIsLoading(true);
      const requestVersion = ++requestVersionRef.current;
      setError(null);

      try {
        const collectedItems = [...itemsRef.current];
        let cursor: string | null = nextCursorRef.current;
        let lastNextCursor: string | null = nextCursorRef.current;

        while (collectedItems.length < desiredCount && cursor) {
          const remainingCount = desiredCount - collectedItems.length;
          const response = await selectionService.list({
            cursor: cursor ?? undefined,
            id: idFilter || undefined,
            limit: Math.min(PAGE_SIZE, remainingCount)
          });

          if (requestVersion !== requestVersionRef.current) {
            return;
          }

          collectedItems.push(...response.items);
          lastNextCursor = response.nextCursor;
          cursor = response.nextCursor;
        }

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setItems(collectedItems);
        setNextCursor(lastNextCursor);
        nextCursorRef.current = lastNextCursor;
        setHasMore(Boolean(lastNextCursor));
      } catch (caughtError) {
        if (requestVersion === requestVersionRef.current) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to sync selected items");
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setIsLoading(false);
        }

        loadingRef.current = false;
      }
    },
    [idFilter]
  );

  return {
    error,
    hasMore,
    isLoading,
    items,
    loadMore,
    reload,
    setLocalItems,
    syncToCount
  };
};
