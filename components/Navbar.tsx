import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          {/* Brand → use Link so it doesn't hard reload */}
          <Link to="/" className="font-semibold tracking-tight">
            Chris Brighouse
          </Link>

          {/* Main menu (hidden on small screens, as before) */}
          <div className="hidden sm:flex gap-6 text-sm">
            <a href="#experience" className="hover:underline">Experience</a>
            <a href="#work" className="hover:underline">Work</a>
            <a href="#downloads" className="hover:underline">Downloads</a>
            <a href="#contact" className="hover:underline">Contact</a>
          </div>

          {/* Right-end: Login button (visible on all breakpoints) */}
          <div className="flex items-center">
            <Link
              to="/login"
              className="px-3 py-1 border rounded text-sm hover:bg-slate-50"
            >
              Login
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
