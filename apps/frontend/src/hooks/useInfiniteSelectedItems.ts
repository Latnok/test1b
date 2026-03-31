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

  const fetchVisibleItems = useCallback(async (filter: string, targetCount: number) => {
    const collectedItems: SelectedItem[] = [];
    let cursor: string | undefined;
    let nextCursor: string | null = null;
    const desiredCount = Math.max(PAGE_SIZE, targetCount);

    do {
      const response = await selectionService.list({
        cursor,
        id: filter || undefined,
        limit: PAGE_SIZE
      });

      collectedItems.push(...response.items);
      nextCursor = response.nextCursor;
      cursor = nextCursor ?? undefined;
    } while (collectedItems.length < desiredCount && nextCursor);

    return {
      items: collectedItems,
      nextCursor
    };
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
      if (loadingRef.current) {
        return;
      }

      const requestVersion = ++requestVersionRef.current;
      setError(null);

      try {
        const response = await fetchVisibleItems(idFilter, targetCount);

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        setItems(response.items);
        setNextCursor(response.nextCursor);
        nextCursorRef.current = response.nextCursor;
        setHasMore(Boolean(response.nextCursor));
      } catch (caughtError) {
        if (requestVersion === requestVersionRef.current) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to sync selected items");
        }
      }
    },
    [fetchVisibleItems, idFilter]
  );

  return {
    error,
    hasMore,
    isLoading,
    items,
    loadMore,
    reload,
    syncToCount
  };
};
