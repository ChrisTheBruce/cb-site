import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";

// Existing components/pages:
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
import AgentDesigner from "./pages/AgentDesigner.jsx";
import AgentChecker from "./pages/AgentChecker.jsx";
import AgentOutline from "./pages/AgentOutline.jsx";
import AgentDeveloper from "./pages/AgentDeveloper.jsx";

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
          <Route path="/agent-designer" element={<AgentDesigner />} />
          <Route path="/agent-checker" element={<AgentChecker />} />
          <Route path="/agent-outline" element={<AgentOutline />} />
          <Route path="/agent-developer" element={<AgentDeveloper />} />
          {/* Chat2 removed */}

          {/* Admin logs (backend enforces auth) */}
          <Route path="/admin/downloads" element={<AdminDownloads />} />

          {/* Fallback */}
          <Route path="*" element={<HomeHero />} />
        </Routes>
      </div>

      <Footer />
      {/* Only shows on /chat */}
      <ChatOnlyLogsButton />
    </div>
  );
}
