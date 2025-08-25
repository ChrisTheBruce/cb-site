// App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import Work from './components/Work';
import Downloads from './components/Downloads';
import Footer from './components/Footer';
import Experience from './components/Experience';
import Contact from './components/Contact';
import HomeHero from './components/HomeHero/HomeHero';
//import UserAccountBadge from './components/UserAccountBadge.jsx';
import Login from './src/pages/Login.jsx';
import Chat from './src/pages/Chat.jsx';

// 🔹 NEW: download-email context provider + hook
import { DownloadEmailProvider, useDownloadEmail } from './src/context/DownloadEmailContext';

// --- Guard that checks /api/me and redirects to /login if not authed ---
function ProtectedRoute({ children }) {
  const [allowed, setAllowed] = useState(null); // null = loading, true/false = decided

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        const ok = res.ok;
        if (!cancelled) setAllowed(ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) return null; // or a spinner
  return allowed ? children : <Navigate to="/login" replace />;
}

// --- Global fixed top-right badge showing the downloads email ---
function GlobalDownloadEmailBadge() {
  const { email, clearEmail } = useDownloadEmail();

  if (!email) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 12,
        fontSize: 12,
        opacity: 0.9,
        background: 'rgba(248,250,252,0.95)', // subtle light bg
        border: '1px solid rgba(203,213,225,0.9)', // gray-ish border
        borderRadius: 9999,
        padding: '4px 10px',
        zIndex: 1000
      }}
      role="status"
      aria-live="polite"
      title="Download email (click × to clear)"
    >
      <span>downloads: {email}</span>
      <button
        type="button"
        onClick={clearEmail}
        style={{ marginLeft: 8, fontSize: 12 }}
        aria-label="Clear download email"
      >
        ×
      </button>
    </div>
  );
}

// --- Home page preserves your original structure ---
function Home() {
  return (
    <>
      <main id="main">
        <HomeHero />
        <Work />
        <Downloads />
        <Experience />
        <Contact />
      </main>
    </>
  );
}

function App() {
  return (
    // 🔹 Wrap the whole app so all pages can read/set the downloads email
    <DownloadEmailProvider>
      <BrowserRouter>
        {/* Fixed badge visible on every page */}
        <GlobalDownloadEmailBadge />

        <Navbar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
        </Routes>

        <Footer />
      </BrowserRouter>
    </DownloadEmailProvider>
  );
}

export default App;
