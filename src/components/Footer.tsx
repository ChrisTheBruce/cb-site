import React from 'react'

export default function Footer() {
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between text-sm text-slate-600">
        <p>© {new Date().getFullYear()} Chris Brighouse</p>
        {/* Removed Download CV link */}
      </div>
    </footer>
  )
}
