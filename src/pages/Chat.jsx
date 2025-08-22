import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Chat() {
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/functions/api/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) nav("/functions/api/login", { replace: true });
          return;
        }
        const data = await res.json();
        if (!cancelled) setUsername(data?.username ?? null);
      } catch {
        if (!cancelled) nav("/functions/api/login", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nav]);

  const doLogout = async () => {
    try {
      await fetch("/functions/api/logout", { method: "POST", credentials: "include" });
    } finally {
      nav("/functions/api/login", { replace: true });
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chat</h1>
        <div className="flex items-center gap-3">
          {username && <span className="text-sm text-gray-600">{username}</span>}
          <button className="border rounded px-3 py-1" onClick={doLogout}>Logout</button>
        </div>
      </div>

      {/* Placeholder content — we’ll replace with real chat next */}
      <div className="border rounded p-4 bg-white">
        <p className="text-gray-700">Chat area (secured)</p>
      </div>
    </div>
  );
}
