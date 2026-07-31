import { useVotingApp } from "./useVotingApp";
import { color, sans } from "./theme";
import Landing from "./components/Landing";
import Admin from "./components/Admin";
import Voter from "./components/Voter";
import AdminLogin from "./components/AdminLogin";

function Banner({ children, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: color.redSoft,
        color: color.red,
        padding: "11px 16px",
        fontSize: 12.5,
        lineHeight: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        borderTop: "1px solid rgba(178,59,59,.25)",
      }}
      role="alert"
    >
      <span>{children}</span>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "1px solid rgba(178,59,59,.4)",
          color: color.red,
          borderRadius: 7,
          fontSize: 11,
          padding: "3px 9px",
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

export default function App() {
  const { state, stats, actions, isLive } = useVotingApp();

  const shell = {
    minHeight: "100vh",
    background: color.bg,
    color: color.ink,
    fontFamily: sans,
  };

  if (state.loading) {
    return (
      <div style={{ ...shell, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: color.ink2 }}>Loading the meeting…</div>
      </div>
    );
  }

  // Admin screens require a session whenever a real backend is configured.
  const needsLogin = state.screen === "admin" && !state.adminEmail;

  return (
    <div style={shell}>
      {state.screen === "land" && (
        <Landing
          cfg={state.cfg}
          isLive={isLive}
          onAdmin={actions.goAdmin}
          onVoter={actions.goVoter}
        />
      )}

      {needsLogin && (
        <AdminLogin
          onSignIn={actions.signIn}
          onBack={actions.goLand}
          busy={state.busy}
          error={state.authError}
        />
      )}

      {state.screen === "admin" && !needsLogin && (
        <Admin state={state} stats={stats} actions={actions} isLive={isLive} />
      )}

      {state.screen === "voter" && <Voter state={state} actions={actions} />}

      {state.error && <Banner onDismiss={actions.dismissError}>{state.error}</Banner>}
    </div>
  );
}
