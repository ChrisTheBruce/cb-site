import React from 'react'

const items = [
  { title: 'AI Presentations to MIT', desc: 'Presented the AI futures and strategy section for an MIT Product Roadmapping course', badge: 'AI Strategy' },
  { title: 'CFIHOS Standards Contributor', desc: 'Contributed to requirements and designs for the CFIHOS engineering information standard', badge: 'Data Standards' },
  { title: 'Accruent Strategy Presentation', desc: 'Presented to senior management on engineering data extraction and cleaning technologies', badge: 'Data Insights' },
]

export default function Work() {
  return (
    <section id="work" className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-bold">Selected Work</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((x) => (
            <article key={x.title} className="rounded-xl border bg-white p-5 shadow-sm">
              <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-slate-100 border">{x.badge}</span>
              <h3 className="mt-3 font-semibold">{x.title}</h3>
              <p className="mt-2 text-slate-600 text-sm">{x.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
