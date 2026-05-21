import React, { useState } from "react";
import { supabase } from "../supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    // Owner login
    if (email === "yousef@salesscales.com" && password === "owner123") {
      const user = { name: "Yousef", email: "yousef@salesscales.com", role: "owner" };
      localStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
      setLoading(false);
      return;
    }

    // Client login
    try {
      const { data, error: dbError } = await supabase
        .from("client_users")
        .select("*, clients(id, name, business_type, niche, tier, status, health_score)")
        .eq("email", email)
        .eq("password", password)
        .single();

      if (dbError || !data) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }

      await supabase.from("client_users").update({ last_login: new Date().toISOString() }).eq("id", data.id);

      const user = {
        name: data.name,
        email: data.email,
        role: "client",
        clientId: data.client_id,
        clientName: data.clients?.name || "Your Store",
        tier: data.clients?.tier || "starter"
      };

      localStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f3f8",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <div style={{
        background: "white",
        border: "1px solid #e4e9f0",
        borderRadius: "16px",
        padding: "40px",
        width: "420px",
        boxShadow: "0 10px 25px rgba(10,22,40,0.08)"
      }}>
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "5px", color: "#0a1628", marginBottom: "4px" }}>SALES SCALES</div>
          <div style={{ fontSize: "9px", color: "#8896a8", letterSpacing: "3px" }}>AI REVENUE SYSTEM</div>
          <div style={{ width: "32px", height: "1.5px", background: "linear-gradient(90deg, #c9a84c, #3b82f6)", margin: "12px auto 0", borderRadius: "1px" }}></div>
        </div>

        <div style={{ fontSize: "16px", fontWeight: 700, color: "#0a1628", marginBottom: "6px", textAlign: "center" }}>Welcome back</div>
        <div style={{ fontSize: "12px", color: "#8896a8", marginBottom: "28px", textAlign: "center" }}>Sign in to your account</div>

        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "10px", color: "#8896a8", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="your@email.com"
            style={{ width: "100%", border: "1px solid #e4e9f0", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#0a1628", outline: "none", background: "white", boxSizing: "border-box", fontFamily: "DM Sans, sans-serif" }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "10px", color: "#8896a8", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter your password"
            style={{ width: "100%", border: "1px solid #e4e9f0", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#0a1628", outline: "none", background: "white", boxSizing: "border-box", fontFamily: "DM Sans, sans-serif" }}
          />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#dc2626", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: "100%", padding: "12px", fontSize: "13px", borderRadius: "8px", background: "#0a1628", color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: "#8896a8" }}>
          Sales Scales · Powered by AI
        </div>
      </div>
    </div>
  );
}
