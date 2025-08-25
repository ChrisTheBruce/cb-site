// components/Navbar.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const hrefFor = (id: string) => (location.pathname === "/" ? `#${id}` : `/#${id}`);
  const skipHref = location.pathname === "/" ? "#main" : "/#main";

  const goHome: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    // Prefer SPA navigation; fall back to normal link if Router isn't active
    try {
      e.preventDefault();
      if (location.pathname !== "/") navigate("/");
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      /* no-op: let the native anchor work */
    }
  };

  return (
    <>
      <a
        href={skipHref}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          {/* Brand: always returns to Home */}
          <a href="/" onClick={goHome} className="font-semibold tracking-tight hover:opacity-80">
            Chris Brighouse
          </a>

          <div className="hidden sm:flex gap-6 text-sm">
            <a href={hrefFor("experience")} className="hover:underline">Experience</a>
            <a href={hrefFor("work")} className="hover:underline">Work</a>
            <a href={hrefFor("downloads")} className="hover:underline">Downloads</a>
            <a href={hrefFor("contact")} className="hover:underline">Contact</a>
          </div>

          <div className="flex items-center">
            <a href="/login" className="px-3 py-1 border rounded text-sm hover:bg-slate-50">
              Login
            </a>
          </div>
        </nav>
      </header>
    </>
  );
}
