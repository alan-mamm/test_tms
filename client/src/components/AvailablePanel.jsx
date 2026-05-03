/**
 * components/AvailablePanel.jsx — Левое окно.
 *
 * Отображает все элементы, кроме выбранных.
 * Функции:
 * - Инфинити-скролл порциями по 20
 * - Фильтрация по  айди
 * - Добавление элементов с произвольным айди (батчинг раз в 10 сек)
 * - Клик по элементу - выбор (перемещение вправо)
 */

import React, { useCallback, useRef, useState } from "react";
import { fetchAvailable, selectItem, addItem } from "../api";
import { useInfiniteList } from "../hooks/useInfiniteList";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";

export function AvailablePanel({ onSelect, refreshKey }) {
  const [filter, setFilter] = useState("");
  // Значение фильтра, которое реально применяется (с debounce)
  const [appliedFilter, setAppliedFilter] = useState("");

  const [newId, setNewId] = useState("");
  const [addStatus, setAddStatus] = useState(null); // { type: 'success'|'error'|'pending', text }
  const [selectingId, setSelectingId] = useState(null);

  const sentinelRef = useRef(null);

  // Fetcher для хука инфинити-скролла
  const fetcher = useCallback(
    (params) => fetchAvailable({ ...params }),
    []
  );

  const { items, hasMore, loading, error, loadMore, reset } = useInfiniteList(
    fetcher,
    appliedFilter,
    refreshKey
  );

  // Подгрузка при прокрутке
  useIntersectionObserver(sentinelRef, loadMore, hasMore && !loading);

  // Применяем фильтр по нажатию Enter или кнопки
  function applyFilter() {
    setAppliedFilter(filter.trim());
  }

  function handleFilterKeyDown(e) {
    if (e.key === "Enter") applyFilter();
  }

  // Клик по элементу — добавляем в выбранные
  async function handleSelect(id) {
    setSelectingId(id);
    try {
      await selectItem(id);
      // Убираем из локального списка сразу (оптимистичное обновление)
      onSelect(id);
    } catch (err) {
      alert(`Ошибка при выборе: ${err.message}`);
    } finally {
      setSelectingId(null);
    }
  }

  // Добавление нового элемента
  async function handleAdd() {
    const num = Number(newId.trim());
    if (!newId.trim() || isNaN(num) || !Number.isInteger(num) || num <= 0) {
      setAddStatus({ type: "error", text: "Введите положительное целое число" });
      return;
    }

    setAddStatus({ type: "pending", text: `ID ${num} добавлен в очередь (отправка через ~10 сек)…` });
    setNewId("");

    try {
      await addItem(num);
      setAddStatus({ type: "success", text: `ID ${num} успешно добавлен!` });
      reset(); // Обновляем список
    } catch (err) {
      setAddStatus({ type: "error", text: `Ошибка: ${err.message}` });
    }
  }

  function handleAddKeyDown(e) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon">☰</span>
          Все элементы
        </h2>
        <p className="panel-subtitle">Нажмите на элемент, чтобы выбрать его</p>
      </div>

      {/* Поиск */}
      <div className="search-bar">
        <input
          className="input"
          type="text"
          placeholder="Фильтр по ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleFilterKeyDown}
        />
        <button className="btn btn-ghost" onClick={applyFilter}>
          Найти
        </button>
      </div>

      {/* Добавление нового элемента */}
      <div className="add-bar">
        <input
          className="input"
          type="number"
          placeholder="Новый ID…"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          onKeyDown={handleAddKeyDown}
          min="1"
        />
        <button className="btn btn-accent" onClick={handleAdd}>
          + Добавить
        </button>
      </div>

      {addStatus && (
        <div className={`status-badge status-${addStatus.type}`}>
          {addStatus.text}
        </div>
      )}

      {/* Список */}
      <div className="list-container">
        {error && <div className="error-msg">Ошибка: {error}</div>}

        {items.length === 0 && !loading && (
          <div className="empty-msg">
            {appliedFilter ? "Ничего не найдено" : "Список пуст"}
          </div>
        )}

        <ul className="items-list">
          {items.map((id) => (
            <li
              key={id}
              className={`item-row item-available ${selectingId === id ? "item-busy" : ""}`}
              onClick={() => selectingId === null && handleSelect(id)}
            >
              <span className="item-id">#{id}</span>
              <span className="item-action">→</span>
            </li>
          ))}
        </ul>

        {/* Sentinel — триггер инфинити-скролла */}
        <div ref={sentinelRef} className="sentinel" />

        {loading && <div className="loading-msg">Загрузка…</div>}
        {!hasMore && items.length > 0 && (
          <div className="end-msg">Все элементы загружены ({items.length})</div>
        )}
      </div>
    </div>
  );
}
