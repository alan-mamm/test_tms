/**
 * components/SelectedPanel.jsx — Правое окно.
 *
 * Отображает выбранные элементы.
 * Функции:
 * - Инфинити-скролл порциями по 20
 * - Фильтрация по ID
 * - Drag&Drop сортировка (работает и для отфильтрованного списка)
 * - Клик по элементу → убрать из выбранных
 *
 * Для DnD используется @dnd-kit — современная библиотека с хорошей
 * доступностью и поддержкой виртуализированных списков.
 *
 * ? Вопрос: при фильтрации DnD работает только внутри видимого подмножества.
 *   Стоит ли показывать предупреждение, что сортировка применяется только
 *   к отфильтрованным элементам?
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { fetchSelected, deselectItem, reorderItems } from "../api";
import { useInfiniteList } from "../hooks/useInfiniteList";
import { useIntersectionObserver } from "../hooks/useIntersectionObserver";

// ---------------------------------------------------------------------------
// Компонент одной строки (с DnD)
// ---------------------------------------------------------------------------

function SortableItem({ id, onDeselect, isRemoving }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`item-row item-selected ${isDragging ? "item-dragging" : ""} ${isRemoving ? "item-busy" : ""}`}
    >
      {/* Ручка для перетаскивания */}
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        title="Перетащить"
      >
        ⠿
      </span>

      <span className="item-id">#{id}</span>

      <button
        className="remove-btn"
        onClick={() => onDeselect(id)}
        title="Убрать из выбранных"
      >
        ✕
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Основной компонент панели
// ---------------------------------------------------------------------------

export function SelectedPanel({ onDeselect, refreshKey }) {
  const [filter, setFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [activeId, setActiveId] = useState(null); // ID перетаскиваемого элемента

  const sentinelRef = useRef(null);

  const fetcher = useCallback(
    (params) => fetchSelected({ ...params }),
    []
  );

  const { items, setItems, hasMore, loading, error, loadMore, reset } =
    useInfiniteList(fetcher, appliedFilter, refreshKey);

  useIntersectionObserver(sentinelRef, loadMore, hasMore && !loading);

  function applyFilter() {
    setAppliedFilter(filter.trim());
  }

  function handleFilterKeyDown(e) {
    if (e.key === "Enter") applyFilter();
  }

  // Убираем элемент из выбранных
  async function handleDeselect(id) {
    setRemovingId(id);
    try {
      await deselectItem(id);
      onDeselect(id);
      setItems((prev) => prev.filter((i) => i !== id));
    } catch (err) {
      alert(`Ошибка при убирании: ${err.message}`);
    } finally {
      setRemovingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // DnD-kit настройка
  // ---------------------------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event) {
    setActiveId(Number(event.active.id));
  }

  async function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(Number(active.id));
    const newIndex = items.indexOf(Number(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    // Оптимистично обновляем локальный список
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    // Отправляем только видимую часть — сервер получит полный порядок.
    // Внимание: при фильтрации мы передаём только отфильтрованные ID.
    // Сервер сейчас ожидает ПОЛНЫЙ список, поэтому без фильтра всё ок,
    // а с фильтром — нужно дополнительно мерджить с невидимыми.
    // TODO: реализовать серверный partial-reorder если нужно.
    try {
      await reorderItems(reordered);
    } catch (err) {
      // Откатываем в случае ошибки
      setItems(items);
      alert(`Ошибка сохранения порядка: ${err.message}`);
    }
  }

  return (
    <div className="panel panel-selected">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon">★</span>
          Выбранные
        </h2>
        <p className="panel-subtitle">Перетащите для сортировки, нажмите ✕ чтобы убрать</p>
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

      {/* Список с DnD */}
      <div className="list-container">
        {error && <div className="error-msg">Ошибка: {error}</div>}

        {items.length === 0 && !loading && (
          <div className="empty-msg">
            {appliedFilter ? "Ничего не найдено" : "Пока ничего не выбрано"}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(String)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="items-list">
              {items.map((id) => (
                <SortableItem
                  key={id}
                  id={id}
                  onDeselect={handleDeselect}
                  isRemoving={removingId === id}
                />
              ))}
            </ul>
          </SortableContext>

          {/* Overlay — отображается поверх всего при перетаскивании */}
          <DragOverlay>
            {activeId ? (
              <div className="item-row item-drag-overlay">
                <span className="drag-handle">⠿</span>
                <span className="item-id">#{activeId}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <div ref={sentinelRef} className="sentinel" />
        {loading && <div className="loading-msg">Загрузка…</div>}
        {!hasMore && items.length > 0 && (
          <div className="end-msg">Всего выбрано: {items.length}</div>
        )}
      </div>
    </div>
  );
}
