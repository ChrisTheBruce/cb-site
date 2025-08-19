import React from 'react'

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Product & Platform for <span className="text-blue-600">Engineering Ops</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            I build Azure-native, Cloudflare-first web apps with AI features for large-scale operational plants.
            Pragmatic, measurable outcomes. No fluff.
          </p>
          <div className="mt-8 flex gap-3">
            <a href="#contact" className="inline-flex items-center px-5 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
              Let’s talk
            </a>
            <a href="#work" className="inline-flex items-center px-5 py-3 rounded-lg border font-medium hover:bg-slate-50">
              See work
            </a>
          </div>
        </div>
        <div className="md:justify-self-end">
          <div className="aspect-video rounded-xl border bg-white shadow-sm p-5">
            <ul className="grid grid-cols-2 gap-3 text-sm">
              <li className="rounded border p-3">Cloudflare Workers</li>
              <li className="rounded border p-3">Vite + React</li>
              <li className="rounded border p-3">Azure & MS365</li>
              <li className="rounded border p-3">RAG / Graph</li>
            </ul>
            <p className="mt-4 text-xs text-slate-500">Fast edge, sensible caching, clean DX.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
