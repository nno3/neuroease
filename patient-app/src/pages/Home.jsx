import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="pa-page">
      <h2 className="pa-heading">Home</h2>
      <p className="pa-muted">Your reminders will appear here (or on the Reminders page).</p>
      <Link to="/reminders" className="pa-btn pa-btn--primary">
        View reminders
      </Link>
    </div>
  );
}
