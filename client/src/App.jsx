
import React, { useState } from "react";
import { AvailablePanel } from "./components/AvailablePanel";
import { SelectedPanel } from "./components/SelectedPanel";
import "./App.css";

export default function App() {
  // Инкрементируем этот ключ чтобы перезагрузить обе панели
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Item Manager</h1>
        <p className="app-desc">1 000 000 элементов · выбор · сортировка</p>
      </header>

      <main className="panels">
        <AvailablePanel onSelect={refresh} refreshKey={refreshKey} />
        <div className="panels-divider" />
        <SelectedPanel onDeselect={refresh} refreshKey={refreshKey} />
      </main>
    </div>
  );
}
