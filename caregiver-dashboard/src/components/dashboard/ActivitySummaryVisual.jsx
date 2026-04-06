import React from 'react';
import { Link } from "react-router-dom";
import { CheckCircle2, Gamepad2, MapPin, Users, ChevronRight, Sparkles } from "lucide-react";
import "./ActivitySummaryVisual.css";

/**
 * Interactive visual summary: active patients, reminders, games, location.
 * Replaces the top KPI row; uses stats from getDashboardStats and activeAlerts from location.
 */
export default function ActivitySummaryVisual({ stats, activeAlerts = 0 }) {
    const activePatients = stats?.activePatients ?? 0;
    const total = stats?.remindersTotalToday ?? 0;
    const completed = stats?.remindersCompletedToday ?? 0;
    const pending = stats?.remindersPendingToday ?? 0;
    const overdue = stats?.remindersOverdueToday ?? 0;
    const games = stats?.gamesPlayedToday ?? 0;
    const compliance = stats?.reminderCompliance ?? 0;

    const hasReminders = total > 0;
    const allDone = hasReminders && completed === total && overdue === 0;
    const hasIssues = overdue > 0 || (hasReminders && pending > 0 && completed < total);

    // SVG circle: radius 44, circumference ≈ 2 * π * 44 ≈ 276. So strokeDasharray 276, offset = 276 * (1 - pct/100)
    const r = 44;
    const circumference = 2 * Math.PI * r;
    const progressOffset = circumference * (1 - (hasReminders ? compliance / 100 : 0));

    return (
        <div className="dp-summary-visual" role="region" aria-label="Today at a glance">
            <div className="dp-summary-visual__inner">
                {/* Active Patients — link to Patients */}
                <Link to="/patients" className="dp-summary-tile dp-summary-tile--patients">
                    <div className="dp-summary-tile__icon-wrap dp-summary-tile__icon-wrap--patients">
                        <Users size={32} aria-hidden />
                    </div>
                    <div className="dp-summary-tile__copy">
                        <span className="dp-summary-tile__title">Active patients</span>
                        <span className="dp-summary-tile__value-large">{activePatients}</span>
                        <span className="dp-summary-tile__detail">under your care</span>
                    </div>
                    <ChevronRight className="dp-summary-tile__chevron" aria-hidden />
                </Link>

                {/* Reminders — circular progress + link to Activity */}
                <Link to="/activity" className="dp-summary-tile dp-summary-tile--reminders">
                    <div className="dp-summary-tile__ring-wrap">
                        <svg className="dp-summary-ring" viewBox="0 0 100 100" aria-hidden>
                            <circle
                                className="dp-summary-ring__bg"
                                cx="50"
                                cy="50"
                                r={r}
                                fill="none"
                                strokeWidth="10"
                            />
                            <circle
                                className="dp-summary-ring__fill"
                                cx="50"
                                cy="50"
                                r={r}
                                fill="none"
                                strokeWidth="10"
                                strokeDasharray={circumference}
                                strokeDashoffset={progressOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                        <div className="dp-summary-ring__center">
                            <span className="dp-summary-ring__value">{hasReminders ? `${compliance}%` : "—"}</span>
                            <span className="dp-summary-ring__label">done</span>
                        </div>
                    </div>
                    <div className="dp-summary-tile__copy">
                        <span className="dp-summary-tile__title">Reminders today</span>
                        <span className="dp-summary-tile__detail">
                            {hasReminders ? `${completed} of ${total} completed` : "No reminders scheduled"}
                        </span>
                    </div>
                    <ChevronRight className="dp-summary-tile__chevron" aria-hidden />
                </Link>

                {/* Games — number + link */}
                <Link to="/activity" className="dp-summary-tile dp-summary-tile--games">
                    <div className="dp-summary-tile__icon-wrap dp-summary-tile__icon-wrap--games">
                        <Gamepad2 size={32} aria-hidden />
                    </div>
                    <div className="dp-summary-tile__copy">
                        <span className="dp-summary-tile__title">Games played</span>
                        <span className="dp-summary-tile__value-large">{games}</span>
                        <span className="dp-summary-tile__detail">today</span>
                    </div>
                    <ChevronRight className="dp-summary-tile__chevron" aria-hidden />
                </Link>

                {/* Location — status + link */}
                <Link to="/location" className="dp-summary-tile dp-summary-tile--location">
                    <div className={`dp-summary-tile__icon-wrap dp-summary-tile__icon-wrap--location ${activeAlerts > 0 ? "has-alerts" : ""}`}>
                        <MapPin size={32} aria-hidden />
                    </div>
                    <div className="dp-summary-tile__copy">
                        <span className="dp-summary-tile__title">Location</span>
                        {activeAlerts > 0 ? (
                            <>
                                <span className="dp-summary-tile__value-large dp-summary-tile__value-large--alert">
                                    {activeAlerts} alert{activeAlerts !== 1 ? "s" : ""}
                                </span>
                                <span className="dp-summary-tile__detail">View on map</span>
                            </>
                        ) : (
                            <>
                                <span className="dp-summary-tile__status-ok">
                                    <CheckCircle2 size={18} /> All in safe zone
                                </span>
                            </>
                        )}
                    </div>
                    <ChevronRight className="dp-summary-tile__chevron" aria-hidden />
                </Link>
            </div>

            {/* One-line insight */}
            <div className="dp-summary-insight">
                {allDone && (
                    <span className="dp-summary-insight__positive">
                        <Sparkles size={16} /> You're on track — all reminders completed today.
                    </span>
                )}
                {hasIssues && !allDone && overdue > 0 && (
                    <span className="dp-summary-insight__warning">
                        {overdue} reminder{overdue !== 1 ? "s" : ""} overdue. <Link to="/activity">Check Activity</Link>
                    </span>
                )}
                {hasIssues && !allDone && overdue === 0 && pending > 0 && (
                    <span className="dp-summary-insight__neutral">
                        {pending} reminder{pending !== 1 ? "s" : ""} still pending today.
                    </span>
                )}
                {activePatients === 0 && (
                    <span className="dp-summary-insight__neutral">
                        Add patients to get started and see your daily snapshot here.
                    </span>
                )}
                {activePatients > 0 && !hasReminders && games === 0 && activeAlerts === 0 && (
                    <span className="dp-summary-insight__neutral">
                        Add reminders and check in on activity to see more here.
                    </span>
                )}
            </div>
        </div>
    );
}
