import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { startOutlineDesign, updateOutlineDesign } from "../services/agentDesign";
import { renderBasicMarkdown } from "../utils/markdown";

export default function AgentOutline() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState("");
  const [answersSaved, setAnswersSaved] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">Loading your session…</div>;
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await startOutlineDesign(idea);
      setResult(res);
      setIteration(1);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitAnswers(e) {
    e?.preventDefault?.();
    if (!result?.designId || !result?.outline || !answers.trim()) return;
    try {
      setUpdating(true);
      const updated = await updateOutlineDesign({
        designId: result.designId,
        idea,
        outline: result.outline,
        answers,
        questions: result.questions || [],
        checkerExplanation: result.checkerInitialExplanation || '',
      });
      setResult(updated);
      setAnswers("");
      setAnswersSaved(true);
      setIteration((n) => Math.min(5, (n || 1) + 1));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, position: 'relative' }}>
      <div style={{ position: 'absolute', right: 16, top: 16 }}>
        <CloseToChat onClose={() => navigate('/chat')} />
      </div>
      <h1 className="text-2xl font-bold mb-1">Outline</h1>
      <p className="mb-4 opacity-80 text-sm">Draft the high-level design and surface questions. A design ID will be created.</p>
      {!result ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            placeholder="Describe the idea to outline…"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={submitting || !idea.trim()}
          >
            {submitting ? "Outlining…" : "Create Outline"}
          </button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </form>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-semibold">Design ID:</span> {result.designId}
            {user ? (
              <span> — <span className="font-semibold">User:</span> {user.name || user.email || user.id}</span>
            ) : null}
          </div>
          {result.checkerInitialExplanation && (
            <div>
              <div className="font-semibold mb-1">Checker explanation</div>
              <div className="text-sm opacity-80">{result.checkerInitialExplanation}</div>
            </div>
          )}
          {/* Two-column layout */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 460px', minWidth: 300 }}>
              <div className="font-semibold mb-1">Initial Outline</div>
              <div
                style={{ background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                dangerouslySetInnerHTML={{ __html: renderBasicMarkdown(result.outline || '') }}
              />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 260 }}>
              <div className="font-semibold mb-1">Questions</div>
              <div className="text-xs opacity-70 mb-1">Iterations: {Math.max(1, iteration || 1)}/5</div>
              <ul className="list-disc ml-5">
                {(result.questions || []).map((q, i) => (<li key={i}>{q}</li>))}
              </ul>
              <div className="mt-3">
                <label className="font-semibold block mb-1">Your answers</label>
                <textarea
                  className="w-full border rounded p-2"
                  rows={6}
                  placeholder="Write your answers to the questions here…"
                  value={answers}
                  onChange={(e) => { setAnswers(e.target.value); setAnswersSaved(false); }}
                />
                <button
                  onClick={onSubmitAnswers}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  disabled={!answers.trim() || updating || iteration >= 5}
                >
                  {updating ? 'Submitting…' : 'Submit'}
                </button>
                {iteration >= 5 && (
                  <div className="text-xs opacity-70 mt-1">Maximum iterations reached.</div>
                )}
                {answersSaved && (
                  <div className="text-sm opacity-80 mt-1">Outline updated.</div>
                )}
              </div>
            </div>
          </div>
          {updating && (<ProcessingDots label="Updating outline" />)}
          <div>
            <CloseToChat onClose={() => navigate('/chat')} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessingDots({ label = 'Processing' }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-sm opacity-80 mt-2">{label}{dots}</div>
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
