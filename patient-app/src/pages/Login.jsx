import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { requestLoginLink, verifyMagicLink } from "../services/authService";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error | verifying | link-error
  const [message, setMessage] = useState("");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Magic link: open with ?token=... → verify and log in
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setStatus("sending");
    setMessage("");
    try {
      await requestLoginLink(trimmed);
      setStatus("sent");
      setMessage("Check your email for a link to log in. The link expires in 15 minutes.");
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  if (user) {
    navigate("/", { replace: true });
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
      </div>
    </div>
  );
}
