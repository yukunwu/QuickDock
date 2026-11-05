import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
const DetachedApp = React.lazy(() => import("./DetachedApp"));
import { tools } from "./catalog";
const detachedTool = tools.find(
  (t) => t.id === new URLSearchParams(location.search).get("tool"),
);
import "./style.css";
import "./ui.css";
import { isMac } from "./platform";
document.documentElement.dataset.platform = isMac ? "mac" : "other";
document.documentElement.dataset.runtime =
  location.protocol === "wails:" ||
  !!(window as unknown as { _wails?: { environment?: unknown } })._wails
    ?.environment
    ? "native"
    : "preview";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      {detachedTool ? <DetachedApp id={detachedTool.id} /> : <App />}
    </React.Suspense>
  </React.StrictMode>,
);
