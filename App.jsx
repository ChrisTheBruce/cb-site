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
import UserAccountBadge from './components/UserAccountBadge.jsx';

// If you've created these pages per our plan, keep these imports.
// Otherwise, you can add them later.
//   src/pages/Login.jsx
//   src/pages/Chat.jsx
import Login from './pages/src/Login.jsx';
import Chat from './pages/src/Chat.jsx';

// --- Guard that checks /api/me and redirects to /login if not authed ---
function ProtectedRoute({ children }) {
  const [allowed, setAllowed] = useState(null); // null = loading, true/false = decided

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/functions/api/me', { credentials: 'include' });
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
    <BrowserRouter>
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
      <UserAccountBadge />
    </BrowserRouter>
  );
}

export default App;
