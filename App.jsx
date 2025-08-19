// App.jsx
import React from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Work from './components/Work'
import Downloads from './components/Downloads'
import Footer from './components/Footer'
import Experience from './components/Experience'
import Contact from './components/Contact'
import HomeHero from './components/HomeHero/HomeHero'

function App() {
  return (
    <>
      <Navbar />
      <main id="main">
        <HomeHero />
        <Hero />
        <Work />
        <Downloads />
        <Experience />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default App
