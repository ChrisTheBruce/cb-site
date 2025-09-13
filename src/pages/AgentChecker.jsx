import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { checkDesign } from "../services/agentDesign";

export default function AgentChecker() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [outline, setOutline] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">Loading your session…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {};
      if (idea.trim()) payload.idea = idea.trim();
      if (outline.trim()) payload.outline = outline.trim();
      const res = await checkDesign(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, position: 'relative' }}>
      <div style={{ position: 'absolute', right: 16, top: 16 }}>
        <CloseToChat onClose={() => navigate('/chat')} />
      </div>
      <h1 className="text-2xl font-bold mb-1">Checker</h1>
      <p className="mb-4 opacity-80 text-sm">Validate whether an idea or outline is a good fit for agents.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <textarea
          className="w-full border rounded p-2"
          rows={3}
          placeholder="Idea (optional if Outline provided)"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <textarea
          className="w-full border rounded p-2"
          rows={4}
          placeholder="Outline (optional if Idea provided)"
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={submitting || (!idea.trim() && !outline.trim())}
        >
          {submitting ? "Checking…" : "Run Check"}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </form>

      {result && (
        <div className="mt-4 p-3 border rounded" style={{ background: '#f8fafc' }}>
          <div><span className="font-semibold">Valid:</span> {String(result.valid)}</div>
          <div className="mt-1 text-sm opacity-80">{result.explanation}</div>
        </div>
      )}

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

