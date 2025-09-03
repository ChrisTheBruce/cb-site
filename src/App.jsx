import React from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import HomeHero from "@/components/HomeHero/HomeHero";
import Work from "@/components/Work";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import Downloads from "@/components/Downloads";

import Login from "@/pages/Login";
import Chat from "@/pages/Chat";

import RequireAuth from "@/components/RequireAuth";

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main style={{ minHeight: "60vh" }}>
        <Routes>
          <Route path="/" element={<HomeHero />} />
          <Route path="/Work" element={<Work />} />
          <Route path="/Experience" element={<Experience />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/Downloads" element={<Downloads />} />

          <Route path="/login" element={<Login />} />

          {/* Protect Chat only (no other global redirects) */}
          <Route
            path="/Chat"
            element={
              <RequireAuth>
                <Chat />
              </RequireAuth>
            }
          />

          {/* fallback */}
          <Route path="*" element={<HomeHero />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
