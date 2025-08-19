import React from 'react'

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-blue-600">
            Product Management & AI Transformation for <span className="text-blue-600">Engineering Projects and Operations</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed">
            I define product strategy and help to build innovative, AI led solutions for the Energy, Utilities and Engineering Construction industries.
          </p>
          <div className="mt-8 flex gap-3">
            <a href="#contact" className="inline-flex items-center px-5 py-3 rounded-lg border font-medium hover:bg-slate-50">
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
              <li className="rounded border p-3">AI Transformation</li>
              <li className="rounded border p-3">Product Management</li>
              <li className="rounded border p-3">Strategic Consulting</li>
              <li className="rounded border p-3">Product Strategy</li>
            </ul>
            <p className="mt-6 text-lg font-semibold text-slate-800">Experience, Innovation and Drive.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
