import React, { useState } from "react";
import { API_BASE } from '../config';
import axios from "axios";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    // Owner login — validated server-side against users table
    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        axios.defaults.headers.common["Authorization"] = "Bearer " + data.token;
        onLogin(data.user);
        setLoading(false);
        return;
      }
    } catch (ownerErr) {
      if (ownerErr.response?.status === 401) {
        // Not an owner — fall through to client login
      } else if (ownerErr.response?.status !== 401) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
    }

    // Client login — server-side bcrypt comparison (supports both hashed and legacy plain-text)
    try {
      const { data: clientData } = await axios.post(`${API_BASE}/auth/client-login`, { email, password });
      const user = {
        name: clientData.name,
        email: clientData.email,
        role: "client",
        clientId: clientData.client_id,
        clientName: clientData.client_name,
        tier: clientData.tier,
      };
      localStorage.setItem("user", JSON.stringify(user));
      onLogin(user);
    } catch (e) {
      if (e.response?.status === 401) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }

    setLoading(false);
  };

  const sendResetCode = async () => {
    setError(""); setResetMsg("");
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, { email });
      setResetSent(true);
      setResetMsg("If an account exists for that email, a 6-digit code is on its way. Enter it below with your new password.");
    } catch (e) {
      setError("Could not send a reset code. Please try again.");
    }
    setLoading(false);
  };

  const confirmReset = async () => {
    setError(""); setResetMsg("");
    if (!resetCode || newPassword.length < 8) { setError("Enter the code and a new password of at least 8 characters."); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/confirm-reset`, { email, code: resetCode, new_password: newPassword });
      setResetDone(true);
      setResetMsg("Password updated. You can now sign in with your new password.");
    } catch (e) {
      setError(e.response?.data?.error || "Could not reset password. Please try again.");
    }
    setLoading(false);
  };

  const backToLogin = () => {
    setShowReset(false); setResetSent(false); setResetDone(false);
    setResetCode(""); setNewPassword(""); setResetMsg(""); setError("");
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

        {!showReset && (
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
        )}

        {/* RESET FLOW */}
        {showReset && resetSent && !resetDone && (
          <>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: "#8896a8", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Reset Code</div>
              <input
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
                placeholder="6-digit code"
                style={{ width: "100%", border: "1px solid #e4e9f0", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#0a1628", outline: "none", background: "white", boxSizing: "border-box", fontFamily: "DM Sans, sans-serif" }}
              />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "10px", color: "#8896a8", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>New Password</div>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmReset()}
                placeholder="At least 8 characters"
                style={{ width: "100%", border: "1px solid #e4e9f0", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#0a1628", outline: "none", background: "white", boxSizing: "border-box", fontFamily: "DM Sans, sans-serif" }}
              />
            </div>
          </>
        )}

        {resetMsg && (
          <div style={{ background: resetDone ? "#f0fdf4" : "#eff6ff", border: `1px solid ${resetDone ? "#a7f3d0" : "#bfdbfe"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: resetDone ? "#059669" : "#3b82f6", marginBottom: "16px" }}>
            {resetMsg}
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#dc2626", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {!showReset && (
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ width: "100%", padding: "12px", fontSize: "13px", borderRadius: "8px", background: "#0a1628", color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        )}

        {showReset && !resetDone && (
          <button
            onClick={resetSent ? confirmReset : sendResetCode}
            disabled={loading}
            style={{ width: "100%", padding: "12px", fontSize: "13px", borderRadius: "8px", background: "#0a1628", color: "white", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}
          >
            {loading ? "Please wait..." : resetSent ? "Reset Password" : "Send Reset Code"}
          </button>
        )}

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          {!showReset ? (
            <button onClick={() => { setShowReset(true); setError(""); }}
              style={{ background: "none", border: "none", color: "#8896a8", fontSize: "11px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", textDecoration: "underline" }}>
              Forgot password?
            </button>
          ) : (
            <button onClick={backToLogin}
              style={{ background: "none", border: "none", color: "#8896a8", fontSize: "11px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", textDecoration: "underline" }}>
              ← Back to sign in
            </button>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: "16px", fontSize: "11px", color: "#8896a8" }}>
          Sales Scales · Powered by AI
        </div>
      </div>
    </div>
  );
}
