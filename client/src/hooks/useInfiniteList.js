/**
 * hooks/useInfiniteList.js
 *
 * Универсальный хук для инфинити-скролла.
 * Принимает функцию-загрузчик и параметр фильтра,
 * сам управляет страничным состоянием и подгрузкой.
 *
 * ? Вопрос: стоит ли кешировать загруженные страницы,
 *   чтобы не перезапрашивать при смене фильтра обратно?
 */

import { useState, useEffect, useCallback, useRef } from "react";

const PAGE_SIZE = 20;

/**
 * @param {Function} fetcher - функция (params) => Promise<{items, total, hasMore}>
 * @param {string} filter - строка фильтрации; при смене — список сбрасывается
 * @param {number} refreshKey - внешний триггер для принудительного обновления
 */
export function useInfiniteList(fetcher, filter, refreshKey = 0) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Текущий offset для следующей страницы
  const offsetRef = useRef(0);
  // Флаг, чтобы не запускать параллельные запросы
  const loadingRef = useRef(false);

  /** Сбрасывает список и загружает первую страницу */
  const reset = useCallback(async () => {
    offsetRef.current = 0;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await fetcher({ filter, offset: 0, limit: PAGE_SIZE });
      setItems(data.items);
      setHasMore(data.hasMore);
      offsetRef.current = data.items.length;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetcher, filter]);

  /** Загружает следующую порцию (вызывается при скролле) */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);

    try {
      const data = await fetcher({
        filter,
        offset: offsetRef.current,
        limit: PAGE_SIZE,
      });
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      offsetRef.current += data.items.length;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetcher, filter, hasMore]);

  // Сбрасываем при смене фильтра или внешнем refreshKey
  useEffect(() => {
    reset();
  }, [reset, refreshKey]);

  return { items, setItems, hasMore, loading, error, loadMore, reset };
}
