/**
 * Activate page – opened from caregiver invite link (/activate?token=...).
 * Validates token, activates account (no password), signs user in and redirects to home.
 * Passwordless by design for accessibility (e.g. people with dementia).
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { activate } from "../services/authService";

export default function Activate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("idle"); // idle | activating | success | error
  const [errorMessage, setErrorMessage] = useState("");
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Use the link from the email your caregiver sent you.");
      return;
    }
    setStatus("activating");
    activate(token)
      .then((data) => {
        login(data.user, data.token);
        setStatus("success");
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(
          err.message || "This link has expired or is invalid. Ask your caregiver to send a new invite."
        );
      });
  }, [token, login, navigate]);

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="pa-page pa-page--center">
      <div className="pa-card">
        <h1 className="pa-title">Activate your account</h1>
        <p className="pa-muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          Use the link from your caregiver&apos;s email. You&apos;ll be signed in in a moment.
        </p>
        {status === "activating" && (
          <>
            <p className="pa-muted">Opening your account…</p>
            <p className="pa-muted" style={{ marginTop: 0 }}>You'll be signed in in a moment.</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="pa-error">{errorMessage}</p>
            <Link to="/login" className="pa-btn pa-btn--primary">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
