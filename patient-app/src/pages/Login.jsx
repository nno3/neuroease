import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="pa-page pa-page--center">
      <div className="pa-card">
        <h1 className="pa-title">Log in</h1>
        <p className="pa-muted">Patient login (placeholder). Auth will be added in a later issue.</p>
        <Link to="/" className="pa-btn pa-btn--primary">
          Go to home
        </Link>
      </div>
    </div>
  );
}
