/**
 * Хранит состояние (выбранные элементы + их порядок) прямо в памяти —
 * без базы данных, как и требуется по заданию.
 *
 * В production-режиме также отдаёт собранный React-фронтенд из /client/build.
 *
 * ? добавить периодический дамп состояния в файл,
 *   чтобы оно не сбрасывалось при перезапуске сервера?
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

// В production отдаём статику из сборки React
if (IS_PROD) {
  const buildPath = path.join(__dirname, "..", "client", "build");
  app.use(express.static(buildPath));
}



const extraIds = new Set();
let selectedIds = [];



const BASE_COUNT = 1_000_000;

function idExists(id) {
  const num = Number(id);
  if (num >= 1 && num <= BASE_COUNT) return true;
  return extraIds.has(num);
}

/**
 *для 1 000 000 элементов полный перебор работает быстро (10мс),
 *   но при большом количестве extraIds стоит ли перейти на индексированный поиск?
 */
function getAvailableItems({ filter = "", offset = 0, limit = 20 }) {
  const selectedSet = new Set(selectedIds);
  const filterStr = String(filter).trim();
  const results = [];

  for (let i = 1; i <= BASE_COUNT; i++) {
    if (selectedSet.has(i)) continue;
    if (filterStr && !String(i).includes(filterStr)) continue;
    results.push(i);
  }

  const sortedExtra = Array.from(extraIds).sort((a, b) => a - b);
  for (const id of sortedExtra) {
    if (selectedSet.has(id)) continue;
    if (filterStr && !String(id).includes(filterStr)) continue;
    results.push(id);
  }

  const total = results.length;
  const page = results.slice(offset, offset + limit);
  return { items: page, total, hasMore: offset + limit < total };
}

function getSelectedItems({ filter = "", offset = 0, limit = 20 }) {
  const filterStr = String(filter).trim();
  const filtered = filterStr
    ? selectedIds.filter((id) => String(id).includes(filterStr))
    : selectedIds;

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);
  return { items: page, total, hasMore: offset + limit < total };
}


app.get("/api/items/available", (req, res) => {
  const { filter = "", offset = "0", limit = "20" } = req.query;
  res.json(getAvailableItems({ filter, offset: parseInt(offset, 10), limit: parseInt(limit, 10) }));
});

app.get("/api/items/selected", (req, res) => {
  const { filter = "", offset = "0", limit = "20" } = req.query;
  res.json(getSelectedItems({ filter, offset: parseInt(offset, 10), limit: parseInt(limit, 10) }));
});

app.post("/api/items/select", (req, res) => {
  const { id } = req.body;
  const numId = Number(id);
  if (!idExists(numId)) return res.status(404).json({ error: `ID ${numId} не существует` });
  if (selectedIds.includes(numId)) return res.status(409).json({ error: `ID ${numId} уже выбран` });
  selectedIds.push(numId);
  res.json({ ok: true, selectedCount: selectedIds.length });
});

app.post("/api/items/deselect", (req, res) => {
  const { id } = req.body;
  const numId = Number(id);
  const idx = selectedIds.indexOf(numId);
  if (idx === -1) return res.status(404).json({ error: `ID ${numId} не найден в выбранных` });
  selectedIds.splice(idx, 1);
  res.json({ ok: true, selectedCount: selectedIds.length });
});

app.post("/api/items/add", (req, res) => {
  const { id } = req.body;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).json({ error: "ID должен быть положительным целым числом" });
  }
  if (idExists(numId)) return res.status(409).json({ error: `ID ${numId} уже существует` });
  extraIds.add(numId);
  res.json({ ok: true, id: numId });
});

app.post("/api/items/reorder", (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds должен быть массивом" });
  }
  const selectedSet = new Set(selectedIds);
  const valid = orderedIds.every((id) => selectedSet.has(Number(id)));
  if (!valid || orderedIds.length !== selectedIds.length) {
    return res.status(400).json({ error: "orderedIds не совпадает с текущим списком выбранных" });
  }
  selectedIds = orderedIds.map(Number);
  res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
  res.json({ selectedIds, extraIds: Array.from(extraIds) });
});

// В production отдаём React SPA для всех остальных маршрутов
if (IS_PROD) {
  const buildPath = path.join(__dirname, "..", "client", "build");
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(` Сервер запущен на порту ${PORT} (${IS_PROD ? "production" : "development"})`);
  console.log(`   Базовых элементов: ${BASE_COUNT.toLocaleString()}`);
});
