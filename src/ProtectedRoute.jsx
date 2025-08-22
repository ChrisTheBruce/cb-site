import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { me } from "./auth";

export default function ProtectedRoute({ children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => { me().then(u => setAllowed(!!u)).catch(() => setAllowed(false)); }, []);
  if (allowed === null) return null; // or a spinner
  return allowed ? children : <Navigate to="/login" replace />;
}
