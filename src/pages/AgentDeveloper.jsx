import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function AgentDeveloper() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">Loading your session…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, position: 'relative' }}>
      <div style={{ position: 'absolute', right: 16, top: 16 }}>
        <CloseToChat onClose={() => navigate('/chat')} />
      </div>
      <h1 className="text-2xl font-bold mb-1">Developer</h1>
      <p className="mb-4 opacity-80 text-sm">When the Consultant issues "Go", the Developer generates detailed specifications for each agent. This page will accept the approved outline and answers, then produce specs. (Endpoint coming next.)</p>
      <div className="opacity-70 text-sm">This is a placeholder UI; final behavior will call <code>/api/design/go</code> once implemented.</div>
      <div className="mt-4">
        <CloseToChat onClose={() => navigate('/chat')} />
      </div>
    </div>
  );
}

function CloseToChat({ onClose }) {
  return (
    <button
      onClick={onClose}
      className="px-3 py-1 text-sm"
      style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, cursor: 'pointer' }}
      aria-label="Close and return to chat"
    >
      Close
    </button>
  );
}

