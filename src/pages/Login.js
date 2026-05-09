import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (email === "yousef@salesscales.com" && password === "owner123") {
        const user = { name: "Yousef", email: "yousef@salesscales.com", role: "owner" };
        localStorage.setItem("user", JSON.stringify(user));
        onLogin(user);
      } else {
        setError("Invalid email or password. Please try again.");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "16px",
        padding: "40px",
        width: "400px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "3px", color: "var(--navy)", marginBottom: "4px" }}>SALES SCALES</div>
          <div style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: "1px" }}>AI REVENUE SYSTEM</div>
          <div style={{ width: "40px", height: "2px", background: "var(--green)", margin: "12px auto 0" }}></div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "6px", fontWeight: 500 }}>EMAIL</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter your email"
            style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "var(--navy)", outline: "none", background: "var(--bg)" }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "6px", fontWeight: 500 }}>PASSWORD</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter your password"
            style={{ width: "100%", border: "0.5px solid var(--border)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "var(--navy)", outline: "none", background: "var(--bg)" }}
          />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#dc2626", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: "100%", padding: "12px", fontSize: "13px", borderRadius: "8px", background: "var(--green)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 500 }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: "var(--muted)" }}>
          Sales Scales — Owner Portal
        </div>
      </div>
    </div>
  );
}
