import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const { login } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await login(username, password);
      nav("/chat"); // go to chat once logged in
    } catch {
      setErr("Invalid username or password");
    }
  };

  return (
    <div className="container mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="border rounded p-2" placeholder="Username" value={username} onChange={e=>setU(e.target.value)} />
        <input className="border rounded p-2" type="password" placeholder="Password" value={password} onChange={e=>setP(e.target.value)} />
        {err && <div className="text-red-600">{err}</div>}
        <button className="border rounded p-2" type="submit">Login</button>
      </form>
    </div>
  );
}
