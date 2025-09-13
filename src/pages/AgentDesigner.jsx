import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { requestOutline } from "../services/agentDesign";

export default function AgentDesigner() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">
        Loading your session…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await requestOutline(idea);
      setResult(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Agent Designer</h1>
        <button
          onClick={() => navigate("/chat")}
          className="px-3 py-1 border rounded"
        >
          Close
        </button>
      </div>
      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm opacity-80">Consultant: Tell me about the agent you want to build.</div>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            placeholder="Describe your agent idea..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={submitting || !idea.trim()}
          >
            {submitting ? "Requesting Outline..." : "Request Outline"}
          </button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </form>
      ) : (
        <div className="space-y-2">
          <p className="opacity-80">
            Outline agent responded. Review the outline and confirm before moving to the Developer.
          </p>
          <div className="text-sm">Design ID: {result.designId}</div>
        </div>
      )}
    </div>
  );
}
