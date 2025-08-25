// App.jsx — full replacement
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import Work from './components/Work';
import Downloads from './components/Downloads';
import Footer from './components/Footer';
import Experience from './components/Experience';
import Contact from './components/Contact';
import HomeHero from './components/HomeHero/HomeHero';
import Login from './src/pages/Login.jsx';
import Chat from './src/pages/Chat.jsx';

// Download-email context (unchanged)
import { DownloadEmailProvider } from './src/context/DownloadEmailContext';

function ProtectedRoute({ children }) {
  const [allowed, setAllowed] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!cancelled) setAllowed(res.ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) return null; // or your spinner
  return allowed ? children : <Navigate to="/login" replace />;
}

// Home page preserves your original structure
function Home() {
  return (
    <main id="main">
      <HomeHero />
      <Work />
      <Downloads />
      <Experience />
      <Contact />
    </main>
  );
}

export default function App() {
  return (
    <DownloadEmailProvider>
      <BrowserRouter>
        <Navbar />

        <Routes>
          {/* Main landing page */}
          <Route path="/" element={<Home />} />

          {/* Top-level pages to match Navbar links */}
          <Route path="/work" element={<Work />} />
          <Route path="/experience" element={<Experience />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/downloads" element={<Downloads />} />

          {/* Auth pages */}
          <Route path="/login" element={<Login />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Footer />
      </BrowserRouter>
    </DownloadEmailProvider>
  );
}
