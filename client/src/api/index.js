/**
 * api/index.js — Слой работы с сервером.
 *
 * Реализует:
 * - Очередь запросов с дедупликацией (один и тот же запрос не отправляется дважды)
 * - Батчинг: добавление элементов — раз в 10 сек; остальные мутации — раз в 1 сек
 * - GET-запросы выполняются немедленно (данные нужны для отображения)
 *
 * ? Вопрос: стоит ли объединять запросы select/deselect в один батч-эндпоинт,
 *   чтобы сократить количество HTTP-запросов при массовом выборе?
 */

const API_BASE = process.env.REACT_APP_API_URL || "";

// ---------------------------------------------------------------------------
// Низкоуровневая функция запроса
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Ошибка сервера");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Очередь мутаций с дедупликацией
// ---------------------------------------------------------------------------

/**
 * Очередь для операций select/deselect/reorder.
 * Ключ — строковый ключ дедупликации, значение — описание операции.
 */
const mutationQueue = new Map(); // key → { type, payload, resolve, reject }

/**
 * Очередь для операций add (батч раз в 10 сек).
 * Используем Map<id, { resolve, reject }> для дедупликации по ID.
 */
const addQueue = new Map(); // id → { resolve, reject }

/** Добавляет мутацию в очередь. Если такой ключ уже есть — перезаписывает (дедупликация). */
function enqueueMutation(key, type, payload) {
  return new Promise((resolve, reject) => {
    mutationQueue.set(key, { type, payload, resolve, reject });
  });
}

/** Обработчик очереди мутаций — запускается раз в 1 секунду */
async function flushMutations() {
  if (mutationQueue.size === 0) return;

  // Забираем все текущие задачи
  const tasks = Array.from(mutationQueue.entries());
  mutationQueue.clear();

  // Выполняем последовательно, чтобы сервер не получал конфликтующие запросы
  for (const [, task] of tasks) {
    try {
      let result;
      if (task.type === "select") {
        result = await apiFetch("/items/select", {
          method: "POST",
          body: JSON.stringify(task.payload),
        });
      } else if (task.type === "deselect") {
        result = await apiFetch("/items/deselect", {
          method: "POST",
          body: JSON.stringify(task.payload),
        });
      } else if (task.type === "reorder") {
        result = await apiFetch("/items/reorder", {
          method: "POST",
          body: JSON.stringify(task.payload),
        });
      }
      task.resolve(result);
    } catch (err) {
      task.reject(err);
    }
  }
}

/** Обработчик очереди добавления — запускается раз в 10 секунд */
async function flushAdds() {
  if (addQueue.size === 0) return;

  const tasks = Array.from(addQueue.entries()); // [[id, {resolve, reject}], ...]
  addQueue.clear();

  // Отправляем каждый add отдельно (можно было бы сделать batch-эндпоинт,
  // но по заданию такого нет, поэтому делаем параллельно)
  await Promise.all(
    tasks.map(async ([id, { resolve, reject }]) => {
      try {
        const result = await apiFetch("/items/add", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    })
  );
}

// Запускаем периодические обработчики очередей
setInterval(flushMutations, 1000);
setInterval(flushAdds, 10000);

// ---------------------------------------------------------------------------
// Публичное API
// ---------------------------------------------------------------------------

/** Получить доступные (невыбранные) элементы */
export function fetchAvailable({ filter = "", offset = 0, limit = 20 } = {}) {
  const params = new URLSearchParams({ filter, offset, limit });
  return apiFetch(`/items/available?${params}`);
}

/** Получить выбранные элементы */
export function fetchSelected({ filter = "", offset = 0, limit = 20 } = {}) {
  const params = new URLSearchParams({ filter, offset, limit });
  return apiFetch(`/items/selected?${params}`);
}

/** Получить полное состояние при загрузке страницы */
export function fetchState() {
  return apiFetch("/state");
}

/**
 * Выбрать элемент (переместить в правое окно).
 * Дедупликация: повторный вызов с тем же ID заменяет предыдущий в очереди.
 */
export function selectItem(id) {
  return enqueueMutation(`select:${id}`, "select", { id });
}

/**
 * Убрать элемент из правого окна.
 */
export function deselectItem(id) {
  return enqueueMutation(`deselect:${id}`, "deselect", { id });
}

/**
 * Сохранить новый порядок после Drag&Drop.
 * Дедупликация: всегда один ключ — будет использоваться последняя версия.
 */
export function reorderItems(orderedIds) {
  return enqueueMutation("reorder", "reorder", { orderedIds });
}

/**
 * Добавить новый элемент с произвольным ID.
 * Дедупликация: если тот же ID уже в очереди — просто возвращаем тот же промис.
 */
export function addItem(id) {
  const numId = Number(id);
  if (addQueue.has(numId)) {
    // Уже в очереди — не дублируем
    return new Promise((resolve, reject) => {
      const existing = addQueue.get(numId);
      // Подписываемся «вместе» с уже ожидающим промисом
      const origResolve = existing.resolve;
      const origReject = existing.reject;
      existing.resolve = (v) => { origResolve(v); resolve(v); };
      existing.reject = (e) => { origReject(e); reject(e); };
    });
  }
  return new Promise((resolve, reject) => {
    addQueue.set(numId, { resolve, reject });
  });
}
