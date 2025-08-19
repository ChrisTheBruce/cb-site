/*
import { useState } from 'react'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
       
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <div><a href="/cb-index.html">CB Site</a></div>
      <div>
      <a href="/terms.html">Terms</a> . <a href="/privacy.html">Privacy</a>
      </div>
    </>
  )
}

export default App
*/

import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import About from './components/About';
import Experience from './components/Experience';
import Downloads from './components/Downloads';
import Contact from './components/Contact';
import Footer from './components/Footer';

/* old typescript version
const App: React.FC = () => {
  return (
    <div className="bg-brand-light min-h-screen">
      <Header />
      <main>
        <Hero />
        <About />
        <Experience />
        <Downloads />
        <Contact />
      </main>
      <Footer />
    </div>
  );
*/

  const App = () => {
  return (
    <div className="bg-brand-light min-h-screen">
      <Header />
      <main>
        <Hero />
        <About />
        <Experience />
        <Downloads />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};
};

export default App;
