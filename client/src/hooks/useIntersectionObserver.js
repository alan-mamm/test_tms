/**
 * hooks/useIntersectionObserver.js
 *
 * Хук-обёртка над IntersectionObserver.
 * Принимает callback и ref-элемент (sentinel),
 * вызывает callback когда sentinel становится видимым.
 */

import { useEffect } from "react";

/**
 * @param {React.RefObject} sentinelRef - ref на «заглушку» в конце списка
 * @param {Function} onIntersect - вызывается при появлении sentinel во viewport
 * @param {boolean} enabled - включён ли наблюдатель
 */
export function useIntersectionObserver(sentinelRef, onIntersect, enabled = true) {
  useEffect(() => {
    if (!enabled || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      // rootMargin: чуть заранее начинаем подгрузку (200px до конца)
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sentinelRef, onIntersect, enabled]);
}
