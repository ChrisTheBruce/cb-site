// App.jsx
import React from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Work from './components/Work'
import Downloads from './components/Downloads'
import Footer from './components/Footer'
import Contact from './components/Contact'


function App() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Work />
        <Downloads />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default App
