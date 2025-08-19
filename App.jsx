export default App;

import React from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Work from './components/Work'
import Downloads from './components/Downloads'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Work />
        <Downloads />
        <section id="contact" className="py-20 bg-slate-50 border-y">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold">Contact</h2>
            <p className="mt-3 text-slate-600">Best email: <a className="underline" href="mailto:your@email">your@email</a></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
