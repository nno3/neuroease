import React from 'react';
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile, deleteAccount } from "../services/authService";
import { apiRequest } from "../services/apiClient";
import { registerCaregiverPushSubscription } from "../hooks/usePushSubscription";
import { LogOut, User, Save, Trash2, KeyRound, LogOut as SessionIcon, AlertTriangle, Camera, Mail, MapPin, Bell, Gamepad2, MessageSquare } from "lucide-react";
import "./Settings.css";

const MAX_AVATAR_BYTES = 1024 * 1024; // 1MB
const AVATAR_SIZE = 256;

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
    });
}

function resizeImageDataUrl(dataUrl, maxSize) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let w = img.width;
            let h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = (h * maxSize) / w;
                    w = maxSize;
                } else {
                    w = (w * maxSize) / h;
                    h = maxSize;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            try {
                resolve(canvas.toDataURL("image/jpeg", 0.88));
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error("Invalid image"));
        img.src = dataUrl;
    });
}

function getInitials(name) {
    if (!name || typeof name !== "string") return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || "?").toUpperCase();
}

const NOTIFICATION_OPTIONS = [
    { key: "locationAlerts", label: "Patient leaves safe zone", desc: "Get an email when a patient goes outside their safe zone.", icon: MapPin },
    { key: "missedReminders", label: "Patient misses reminder", desc: "Get an email when a patient has an overdue reminder.", icon: Bell },
    { key: "gameCompletion", label: "Patient completes a game", desc: "Get an email when a patient finishes a game.", icon: Gamepad2 },
    { key: "messages", label: "New messages", desc: "Get an email when a patient sends you a message or meeting request.", icon: MessageSquare },
];

const Settings = () => {
    const { user: contextUser, logout, updateUser } = useAuth();
    const [profile, setProfile] = useState({ name: "", email: "", avatar: null, emailNotificationPreferences: {} });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
    const [passwordErrors, setPasswordErrors] = useState({});
    const [pushCallDeviceCount, setPushCallDeviceCount] = useState(null);
    const [pushCallBusy, setPushCallBusy] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        getProfile()
            .then((res) => {
                const u = res?.data?.user ?? res?.user ?? contextUser;
                if (u) {
                    const prefs = u.emailNotificationPreferences ?? { locationAlerts: false, missedReminders: false, gameCompletion: false, messages: false };
                    setProfile({
                        name: u.name ?? "",
                        email: u.email ?? "",
                        avatar: u.avatar ?? null,
                        emailNotificationPreferences: prefs,
                    });
                }
            })
            .catch(() => {
                if (contextUser) setProfile({
                    name: contextUser.name ?? "",
                    email: contextUser.email ?? "",
                    avatar: contextUser.avatar ?? null,
                    emailNotificationPreferences: { locationAlerts: false, missedReminders: false, gameCompletion: false, messages: false },
                });
            })
            .finally(() => setLoading(false));
    }, [contextUser]);

    useEffect(() => {
        if (!contextUser?.id) return;
        let cancelled = false;
        apiRequest("/push/status")
            .then((r) => {
                if (!cancelled && r?.data?.count !== undefined) setPushCallDeviceCount(r.data.count);
            })
            .catch(() => {
                if (!cancelled) setPushCallDeviceCount(0);
            });
        return () => { cancelled = true; };
    }, [contextUser?.id]);

    const handleRegisterCallPush = async () => {
        setPushCallBusy(true);
        setMessage({ type: "", text: "" });
        try {
            const result = await registerCaregiverPushSubscription();
            if (!result.ok) {
                setMessage({ type: "error", text: result.error || "Could not enable call alerts." });
                return;
            }
            const st = await apiRequest("/push/status");
            setPushCallDeviceCount(st?.data?.count ?? 0);
            setMessage({ type: "success", text: "This device can now receive incoming call notifications." });
        } catch (err) {
            setMessage({ type: "error", text: err?.message || "Could not register for call alerts." });
        } finally {
            setPushCallBusy(false);
        }
    };

    const handleProfileChange = (field, value) => {
        setProfile((p) => ({ ...p, [field]: value }));
        setMessage({ type: "", text: "" });
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        setSaving(true);
        try {
            const res = await updateProfile({ name: profile.name.trim(), email: profile.email.trim().toLowerCase() });
            const updated = res?.data?.user ?? res?.user;
            if (updated) {
                setProfile({
                    name: updated.name ?? "",
                    email: updated.email ?? "",
                    avatar: updated.avatar ?? profile.avatar,
                    emailNotificationPreferences: updated.emailNotificationPreferences ?? profile.emailNotificationPreferences,
                });
                updateUser(updated);
                setMessage({ type: "success", text: "Profile updated successfully." });
            }
        } catch (err) {
            setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to update profile." });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const errs = {};
        if (!passwordForm.current.trim()) errs.current = "Current password is required.";
        if (!passwordForm.new.trim()) errs.new = "New password is required.";
        else if (passwordForm.new.length < 6) errs.new = "New password must be at least 6 characters.";
        if (passwordForm.new !== passwordForm.confirm) errs.confirm = "New passwords do not match.";
        setPasswordErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setSaving(true);
        setMessage({ type: "", text: "" });
        try {
            await updateProfile({
                currentPassword: passwordForm.current,
                newPassword: passwordForm.new,
            });
            setPasswordForm({ current: "", new: "", confirm: "" });
            setPasswordErrors({});
            setMessage({ type: "success", text: "Password updated successfully." });
        } catch (err) {
            setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to update password." });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to log out?")) {
            logout();
            window.location.href = "/login";
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target?.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "Please choose an image file (e.g. JPG or PNG)." });
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setMessage({ type: "error", text: "Image is too large. Please choose an image under 1MB." });
            return;
        }
        setSaving(true);
        setMessage({ type: "", text: "" });
        try {
            let dataUrl = await fileToDataUrl(file);
            dataUrl = await resizeImageDataUrl(dataUrl, AVATAR_SIZE);
            const res = await updateProfile({ avatar: dataUrl });
            const updated = res?.data?.user ?? res?.user;
            if (updated) {
                setProfile((p) => ({ ...p, avatar: updated.avatar ?? dataUrl }));
                updateUser(updated);
                setMessage({ type: "success", text: "Profile photo updated." });
            }
        } catch (err) {
            setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to update photo." });
        } finally {
            setSaving(false);
        }
    };

    const handleNotificationPrefChange = async (key, checked) => {
        const prevPrefs = { ...profile.emailNotificationPreferences };
        const newPrefs = { ...prevPrefs, [key]: checked };
        setProfile((p) => ({ ...p, emailNotificationPreferences: newPrefs }));
        setMessage({ type: "", text: "" });
        setSaving(true);
        try {
            const res = await updateProfile({ emailNotificationPreferences: newPrefs });
            const updated = res?.data?.user ?? res?.user;
            if (updated?.emailNotificationPreferences) {
                setProfile((p) => ({ ...p, emailNotificationPreferences: updated.emailNotificationPreferences }));
            }
            updateUser(updated ?? { ...contextUser, emailNotificationPreferences: newPrefs });
            setMessage({ type: "success", text: "Notification preferences updated." });
            setTimeout(() => setMessage({ type: "", text: "" }), 2000);
        } catch (err) {
            setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to update preferences." });
            setProfile((p) => ({ ...p, emailNotificationPreferences: prevPrefs }));
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveAvatar = async () => {
        setSaving(true);
        setMessage({ type: "", text: "" });
        try {
            const res = await updateProfile({ avatar: null });
            const updated = res?.data?.user ?? res?.user;
            if (updated) {
                setProfile((p) => ({ ...p, avatar: null }));
                updateUser(updated);
                setMessage({ type: "success", text: "Photo removed. Using default initials." });
            }
        } catch (err) {
            setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to remove photo." });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = () => {
        const msg = "Permanently delete your account? You will be signed out and will need to register again to use the dashboard. This cannot be undone.";
        if (!window.confirm(msg)) return;
        setSaving(true);
        deleteAccount()
            .then(() => {
                logout();
                window.location.href = "/login";
            })
            .catch((err) => {
                setMessage({ type: "error", text: err?.data?.message ?? err?.message ?? "Failed to delete account." });
                setSaving(false);
            });
    };

    if (loading) return <div className="stg-page"><p className="stg-loading">Loading settings…</p></div>;

    return (
        <div className="stg-page">
            <h1 className="stg-page-title">Settings</h1>
            <p className="stg-page-subtitle">Manage your account, password, and session</p>

            <div className="stg-panel">
                <div className="stg-panel-header">
                    <h2 className="stg-panel-title">Account</h2>
                    <p className="stg-panel-subtitle">Update your profile and security</p>
                </div>
                {message.text && (
                    <div className={`stg-message stg-message--${message.type}`} role="alert">
                        {message.text}
                    </div>
                )}

                <section className="stg-section" aria-labelledby="stg-profile-heading">
                    <h3 id="stg-profile-heading" className="stg-section-title">
                        <User size={18} aria-hidden /> Profile
                    </h3>
                    <div className="stg-avatar-block">
                        <div className="stg-avatar-preview" aria-hidden>
                            {profile.avatar ? (
                                <img src={profile.avatar} alt="" className="stg-avatar-img" />
                            ) : (
                                <span className="stg-avatar-initials">{getInitials(profile.name)}</span>
                            )}
                        </div>
                        <div className="stg-avatar-actions">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="stg-avatar-input"
                                onChange={handleAvatarChange}
                                aria-label="Choose profile photo"
                            />
                            <button
                                type="button"
                                className="stg-btn stg-btn-secondary stg-btn-sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={saving}
                            >
                                <Camera size={16} aria-hidden /> Choose photo
                            </button>
                            {profile.avatar && (
                                <button
                                    type="button"
                                    className="stg-btn stg-btn-ghost stg-btn-sm"
                                    onClick={handleRemoveAvatar}
                                    disabled={saving}
                                >
                                    Use default
                                </button>
                            )}
                        </div>
                    </div>
                    <form onSubmit={handleSaveProfile} className="stg-form stg-form-row">
                        <div className="stg-field">
                            <label className="stg-label" htmlFor="stg-name">Name</label>
                            <input
                                id="stg-name"
                                type="text"
                                className="stg-input"
                                value={profile.name}
                                onChange={(e) => handleProfileChange("name", e.target.value)}
                                autoComplete="name"
                                
                                
                            />
                        </div>
                        <div className="stg-field">
                            <label className="stg-label" htmlFor="stg-email">Email</label>
                            <input
                                id="stg-email"
                                type="email"
                                className="stg-input"
                                value={profile.email}
                                onChange={(e) => handleProfileChange("email", e.target.value)}
                                autoComplete="email"
                                
                                
                            />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <button type="submit" className="stg-btn stg-btn-primary" disabled={saving}>
                                <Save size={18} aria-hidden /> {saving ? "Saving…" : "Save changes"}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="stg-section" aria-labelledby="stg-notifications-heading">
                    <h3 id="stg-notifications-heading" className="stg-section-title">
                        <Mail size={18} aria-hidden /> Email notifications
                    </h3>
                    <p className="stg-section-text">
                        Choose which updates you want to receive by email. You can select more than one.
                    </p>
                    <div className="stg-checkbox-group">
                        {NOTIFICATION_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const checked = !!profile.emailNotificationPreferences?.[opt.key];
                            return (
                                <label key={opt.key} className="stg-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => handleNotificationPrefChange(opt.key, e.target.checked)}
                                        disabled={saving}
                                        className="stg-checkbox"
                                    />
                                    <span className="stg-checkbox-icon">
                                        <Icon size={20} aria-hidden />
                                    </span>
                                    <div className="stg-checkbox-content">
                                        <span className="stg-checkbox-label">{opt.label}</span>
                                        <span className="stg-checkbox-desc">{opt.desc}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </section>

                <section className="stg-section" aria-labelledby="stg-call-push-heading">
                    <h3 id="stg-call-push-heading" className="stg-section-title">
                        <Bell size={18} aria-hidden /> Calls (browser push)
                    </h3>
                    <p className="stg-section-text">
                        When a patient calls you and this dashboard is closed or in the background, we send a push if you allow notifications.
                        Requires VAPID keys on the server (same as reminders). iOS: install the site to the Home Screen for best results.
                    </p>
                    <p className="stg-section-text">
                        {pushCallDeviceCount === null && <span className="stg-muted">Checking devices…</span>}
                        {pushCallDeviceCount !== null && (
                            <>
                                Registered devices for your account: <strong>{pushCallDeviceCount}</strong>
                            </>
                        )}
                    </p>
                    <button
                        type="button"
                        className="stg-btn stg-btn-secondary"
                        onClick={handleRegisterCallPush}
                        disabled={pushCallBusy || saving}
                    >
                        {pushCallBusy ? "Working…" : "Allow incoming call notifications on this device"}
                    </button>
                </section>

                <section className="stg-section" aria-labelledby="stg-password-heading">
                    <h3 id="stg-password-heading" className="stg-section-title">
                        <KeyRound size={18} aria-hidden /> Change password
                    </h3>
                    <form onSubmit={handleChangePassword} className="stg-form">
                        <div className="stg-field">
                            <label className="stg-label" htmlFor="stg-current-pw">Current password</label>
                            <input
                                id="stg-current-pw"
                                type="password"
                                className="stg-input"
                                value={passwordForm.current}
                                onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                                autoComplete="current-password"
                                
                            />
                            {passwordErrors.current && <span className="stg-error">{passwordErrors.current}</span>}
                        </div>
                        <div className="stg-field">
                            <label className="stg-label" htmlFor="stg-new-pw">New password</label>
                            <input
                                id="stg-new-pw"
                                type="password"
                                className="stg-input"
                                value={passwordForm.new}
                                onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
                                autoComplete="new-password"
                                
                            />
                            {passwordErrors.new && <span className="stg-error">{passwordErrors.new}</span>}
                        </div>
                        <div className="stg-field">
                            <label className="stg-label" htmlFor="stg-confirm-pw">Confirm new password</label>
                            <input
                                id="stg-confirm-pw"
                                type="password"
                                className="stg-input"
                                value={passwordForm.confirm}
                                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                                autoComplete="new-password"
                                
                            />
                            {passwordErrors.confirm && <span className="stg-error">{passwordErrors.confirm}</span>}
                        </div>
                        <button type="submit" className="stg-btn stg-btn-secondary" disabled={saving}>
                            Update password
                        </button>
                    </form>
                </section>

                <section className="stg-section" aria-labelledby="stg-session-heading">
                    <h3 id="stg-session-heading" className="stg-section-title">
                        <SessionIcon size={18} aria-hidden /> Session
                    </h3>
                    <div className="stg-actions">
                        <button type="button" className="stg-btn stg-btn-logout" onClick={handleLogout}>
                            <LogOut size={18} aria-hidden /> Log out
                        </button>
                    </div>
                </section>

                <section className="stg-section stg-danger-zone" aria-labelledby="stg-delete-heading">
                    <h3 id="stg-delete-heading" className="stg-section-title">
                        <AlertTriangle size={18} aria-hidden /> Delete account
                    </h3>
                    <p className="stg-section-text">
                        Permanently delete your caregiver account. You will lose access to all patients and data. This cannot be undone.
                    </p>
                    <button
                        type="button"
                        className="stg-btn stg-btn-delete"
                        onClick={handleDeleteAccount}
                        disabled={saving}
                        title={undefined}
                    >
                        <Trash2 size={18} aria-hidden /> Delete my account
                    </button>
                </section>
            </div>
        </div>
    );
};

export default Settings;
