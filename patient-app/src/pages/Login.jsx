/**
 * Patient login – two flows: (1) URL has ?token=... (magic link) → verify and redirect to home;
 * (2) no token → show email form, "Send login link", then show success or error message.
 */
import React from 'react';
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { requestLoginLink, verifyMagicLink, verifyCode } from "../services/authService";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error | verifying | link-error
  const [message, setMessage] = useState("");
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState("idle"); // idle | submitting | error
  const [codeError, setCodeError] = useState("");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;
    setStatus("verifying");
    setMessage("Opening your account…");
    verifyMagicLink(token)
      .then((data) => {
        login(data.user, data.token);
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setStatus("link-error");
        setMessage(err.message || "This link has expired. Request a new login link.");
      });
  }, [token, login, navigate]);

  useEffect(() => {
    if (!user) return;
    navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus("sending");
    setMessage("");
    try {
      await requestLoginLink(trimmed);
      setStatus("sent");
      setMessage("Check your email. Use the link, or open this app from your home screen and enter the code from the email.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!codeEmail.trim() || !code.trim()) return;
    setCodeStatus("submitting");
    setCodeError("");
    try {
      const data = await verifyCode(codeEmail.trim().toLowerCase(), code.trim());
      login(data.user, data.token);
      navigate("/", { replace: true });
    } catch (err) {
      setCodeStatus("error");
      setCodeError(err.message || "Invalid or expired code.");
    }
  };

  if (user) {
    return null;
  }

  if (token) {
    return (
      <div className="pa-page pa-page--center">
        <div className="pa-card">
          <h1 className="pa-title">Log in</h1>
          <p className="pa-muted">{status === "link-error" ? message : "Opening your account…"}</p>
          {status === "link-error" && (
            <Link to="/login" className="pa-btn pa-btn--primary">
              Back to login
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pa-page pa-page--center">
      <div className="pa-card">
        <h1 className="pa-title">Log in</h1>
        <p className="pa-muted">We'll send you a link to open the app. No password needed.</p>
        <form onSubmit={handleSubmit} className="pa-form">
          <label htmlFor="pa-email" className="pa-label">
            Email
          </label>
          <input
            id="pa-email"
            type="email"
            className="pa-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            disabled={status === "sending"}
            required
          />
          <button
            type="submit"
            className="pa-btn pa-btn--primary"
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send login link"}
          </button>
        </form>
        {message && (
          <p className={status === "error" ? "pa-error" : "pa-muted"} style={{ marginTop: "1rem" }}>
            {message}
          </p>
        )}
        <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid #e2e8f0" }} />
        <p className="pa-muted" style={{ marginBottom: "0.75rem" }}>
          Added the app to your home screen? Enter the code from your email here:
        </p>
        <form onSubmit={handleCodeSubmit} className="pa-form">
          <label htmlFor="pa-code-email" className="pa-label">Email</label>
          <input
            id="pa-code-email"
            type="email"
            className="pa-input"
            value={codeEmail}
            onChange={(e) => setCodeEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email"
            disabled={codeStatus === "submitting"}
          />
          <label htmlFor="pa-code" className="pa-label">Code from email</label>
          <input
            id="pa-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="pa-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            autoComplete="one-time-code"
            disabled={codeStatus === "submitting"}
          />
          <button type="submit" className="pa-btn pa-btn--primary" disabled={codeStatus === "submitting"}>
            {codeStatus === "submitting" ? "Logging in…" : "Log in with code"}
          </button>
        </form>
        {codeError && <p className="pa-error" style={{ marginTop: "0.75rem" }}>{codeError}</p>}
      </div>
    </div>
  );
}
