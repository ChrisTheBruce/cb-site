import React from 'react'

export default function Navbar() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight">Chris Brighouse</a>
          <div className="hidden sm:flex gap-6 text-sm">
            <a href="#experience" className="hover:underline">Experience</a>
            <a href="#work" className="hover:underline">Work</a>
            <a href="#downloads" className="hover:underline">Downloads</a>
            <a href="#contact" className="hover:underline">Contact</a>
          </div>
        </nav>
      </header>
    </>
  )
}
