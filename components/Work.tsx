import React from 'react'

const items = [
  { title: 'Picklist Service', desc: 'CosmosDB + React + Graph deps, chat/RAG access.', badge: 'SaaS' },
  { title: 'Plant Data Explorer', desc: 'BIM/IFC/Navisworks viewer with entity graph.', badge: 'Eng' },
  { title: 'SharePoint Commands', desc: 'Custom commands integrating external apps.', badge: 'M365' },
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
