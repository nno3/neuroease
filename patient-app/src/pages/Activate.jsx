import { useSearchParams, Link } from "react-router-dom";

export default function Activate() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="pa-page pa-page--center">
      <div className="pa-card">
        <h1 className="pa-title">Activate your account</h1>
        <p className="pa-muted">
          {token
            ? "Opening your account… (activate flow will be implemented in Issue 1.3)"
            : "Use the link from the email your caregiver sent you."}
        </p>
        <Link to="/login" className="pa-btn pa-btn--secondary">
          Back to login
        </Link>
      </div>
    </div>
  );
}
