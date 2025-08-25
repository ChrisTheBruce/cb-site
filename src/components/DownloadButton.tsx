import React, { useState } from "react";
import { useDownloadEmail } from "../context/DownloadEmailContext";

type Props = {
  filename: string;
};

const DownloadButton: React.FC<Props> = ({ filename }) => {
  const { email, setEmail } = useDownloadEmail();
  const [input, setInput] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    if (!email) {
      setShowPrompt(true);
    } else {
      window.location.href = `/api/download/${filename}`;
    }
  };

  const handleSubmit = async () => {
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input)) {
      setError("Invalid email format");
      return;
    }
    const ok = await setEmail(input);
    if (ok) {
      setShowPrompt(false);
      window.location.href = `/api/download/${filename}`;
    } else {
      setError("Failed to save email");
    }
  };

  return (
    <div>
      <button onClick={handleClick} className="px-4 py-2 bg-blue-600 text-white rounded">
        Download {filename}
      </button>

      {showPrompt && (
        <div className="mt-2 p-2 border rounded bg-gray-100">
          <p className="mb-1">Enter your email to download:</p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="border p-1 rounded w-full"
            type="email"
            placeholder="you@example.com"
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          <button
            onClick={handleSubmit}
            className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
};

export default DownloadButton;
