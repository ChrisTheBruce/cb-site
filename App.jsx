// App.jsx
import React from 'react'
import Navbar from './components/Navbar'
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
