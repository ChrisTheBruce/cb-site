import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "@/hooks/useAuth";

/* ---- Init debug flag ----
   1) Build-time: set from VITE_DEBUG_MODE (true/1/yes/on)
   2) Runtime: attempt GET /api/debug-config { debug: boolean }
      to mirror the Worker env.DEBUG_MODE without a rebuild.
   Both are safe; neither blocks rendering.
*/
(function initDebugFromVite() {
  try {
    const v = String(import.meta?.env?.VITE_DEBUG_MODE ?? "").toLowerCase();
    const on = v === "1" || v === "true" || v === "yes" || v === "on";
    const w = /** @type {any} */ (window);
    if (w.__DEBUG__ === undefined) w.__DEBUG__ = on;
    if (w.__DEBUG__) {
      // eslint-disable-next-line no-console
      console.debug("[boot] __DEBUG__ enabled via VITE_DEBUG_MODE");
    }
  } catch {
    /* no-op */
  }
})();
/*
(async function initDebugFromServer() {
  try {
    const w = /** @type {any}  (window);
    if (w.__DEBUG__ === true) return; // already on from Vite or manual toggle
    const r = await fetch("/api/debug-config", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    if (j && j.debug === true) {
      w.__DEBUG__ = true;
      // eslint-disable-next-line no-console
      console.debug("[boot] __DEBUG__ enabled via /api/debug-config");
    }
  } catch {
    // endpoint might not exist yet; ignore
  }
})();
*/

// Minimal error boundary to avoid white screens
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("App error boundary caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
