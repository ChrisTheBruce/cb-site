import React from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";

// Existing components/pages in your repo:
import Navbar from "./components/Navbar.tsx";
import Footer from "./components/Footer.tsx";
import Downloads from "./components/Downloads.tsx";
import Work from "./components/Work.tsx";
import Experience from "./components/Experience.tsx";
import Contact from "./components/Contact.tsx";
import HomeHero from "./components/HomeHero/HomeHero.tsx";
import Login from "./pages/Login.jsx";
import Chat from "./pages/Chat.jsx";

// New page:
import AdminDownloads from "./pages/AdminDownloads.tsx";

function ChatOnlyLogsButton() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname !== "/chat") return null;

  return (
    <button
      onClick={() => navigate("/admin/downloads")}
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        padding: "10px 14px",
        borderRadius: "999px",
        border: "1px solid #e5e5e5",
        background: "white",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        fontSize: 14
      }}
      aria-label="View Download Logs"
      title="View Download Logs"
    >
      Download Logs
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />

        <div style={{ flex: 1 }}>
          <Routes>
            {/* Home */}
            <Route path="/" element={<HomeHero />} />

            {/* Public sections */}
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/work" element={<Work />} />
            <Route path="/experience" element={<Experience />} />
            <Route path="/contact" element={<Contact />} />

            {/* Auth / chat */}
            <Route path="/login" element={<Login />} />
            <Route path="/chat" element={<Chat />} />

            {/* New admin logs page (auth is enforced by the backend) */}
            <Route path="/admin/downloads" element={<AdminDownloads />} />

            {/* Fallback to home */}
            <Route path="*" element={<HomeHero />} />
          </Routes>
        </div>

        <Footer />
        {/* Renders only on /chat */}
        <ChatOnlyLogsButton />
      </div>
    </BrowserRouter>
  );
}
