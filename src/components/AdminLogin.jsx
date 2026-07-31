import { useState } from "react";
import { color, serif } from "../theme";
import { card, fieldLabel, input, primaryBtn, btn } from "../ui.jsx";

// Admin sign-in. This is not decoration: the database gives write access to
// the `authenticated` role only, so without a session every admin action is
// refused by RLS.
export default function AdminLogin({ onSignIn, onBack, busy, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!busy) onSignIn(email, password);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form onSubmit={submit} style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ ...card, padding: "24px 24px 26px", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, fontFamily: serif }}>
            Administrator sign in
          </div>
          <div style={{ fontSize: 12.5, color: color.ink2, marginBottom: 18, lineHeight: 1.6 }}>
            The register and session controls are restricted to meeting officers.
          </div>

          {error && (
            <div
              style={{
                padding: "10px 13px",
                borderRadius: 9,
                fontSize: 12,
                marginBottom: 14,
                background: color.redSoft,
                color: color.red,
                lineHeight: 1.55,
              }}
            >
              {error}
            </div>
          )}

          <label style={fieldLabel} htmlFor="admin-email">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            className="focus-navy"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...input, marginBottom: 12 }}
          />

          <label style={fieldLabel} htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            className="focus-navy"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...input, marginBottom: 18 }}
          />

          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.5 : 1 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <button type="button" onClick={onBack} style={{ ...btn, width: "100%" }}>
          ← Back
        </button>
      </form>
    </div>
  );
}
