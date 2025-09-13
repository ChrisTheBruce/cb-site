import React from 'react'

export default function Footer() {
  const year = new Date().getFullYear()
  const isPreview = (() => {
    try {
      const host = window.location.hostname || ''
      const prodHosts = new Set(['www.chrisbrighouse.com', 'chrisbrighouse.com'])
      return !prodHosts.has(host)
    } catch {
      return false
    }
  })()

  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between text-sm text-slate-600">
        <p>
          © {year} Chris Brighouse {isPreview ? <span className="text-slate-400">(preview)</span> : null}
        </p>
        {/* Removed Download CV link */}
      </div>
    </footer>
  )
}
