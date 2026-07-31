import { color, serif, mono } from "../theme";

export default function Landing({ cfg, isLive, onAdmin, onVoter }) {
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
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: ".09em",
            textTransform: "uppercase",
            color: color.ink3,
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          {cfg.org}
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.16,
            marginBottom: 12,
          }}
        >
          {cfg.mtg}
        </div>
        <div style={{ fontSize: 14.5, color: color.ink2, marginBottom: 38 }}>
          Register-authenticated ballots · one member, one vote
        </div>

        <button
          onClick={onAdmin}
          className="land-admin"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 22px",
            background: "#fff",
            borderRadius: 16,
            textAlign: "left",
            marginBottom: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            color: color.ink,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#EFEAE0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              flexShrink: 0,
              color: color.navy,
            }}
          >
            ⚙
          </span>
          <span>
            <span style={{ fontSize: 15, fontWeight: 600, display: "block" }}>Administrator</span>
            <span style={{ fontSize: 12.5, color: color.ink2, display: "block", marginTop: 2 }}>
              Register, ballot, session, results
            </span>
          </span>
        </button>

        <button
          onClick={onVoter}
          className="land-voter"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 22px",
            border: `1px solid ${color.navy}`,
            borderRadius: 16,
            textAlign: "left",
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(31,58,95,.28)",
            fontFamily: "inherit",
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(255,255,255,.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              flexShrink: 0,
              color: "#fff",
            }}
          >
            ✓
          </span>
          <span>
            <span style={{ fontSize: 15, fontWeight: 600, display: "block", color: "#fff" }}>
              Cast my vote
            </span>
            <span
              style={{
                fontSize: 12.5,
                color: "rgba(255,255,255,.72)",
                display: "block",
                marginTop: 2,
              }}
            >
              Members: enter your voting token
            </span>
          </span>
        </button>

        {/* Which backend is in use is stated plainly. Running a real AGM while
            silently in demo mode would lose every vote cast in the room. */}
        {isLive ? (
          <div
            style={{
              textAlign: "left",
              marginTop: 26,
              padding: "13px 15px",
              borderRadius: 10,
              background: color.greenSoft,
              fontSize: 12,
              color: color.green,
              lineHeight: 1.6,
            }}
          >
            <strong>Live meeting.</strong> Ballots are recorded on the meeting server and counted
            across every device in the room.
          </div>
        ) : (
          <div
            style={{
              textAlign: "left",
              marginTop: 26,
              padding: "13px 15px",
              borderRadius: 10,
              background: color.soft,
              fontSize: 12,
              color: color.ink2,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: color.ink }}>Demo mode</strong> — all data lives in this browser
            only, and nothing syncs between devices. On the voter side try member{" "}
            <strong style={{ color: color.ink, fontFamily: mono, letterSpacing: ".05em" }}>
              MG-004
            </strong>{" "}
            with token{" "}
            <strong style={{ color: color.ink, fontFamily: mono, letterSpacing: ".05em" }}>
              WBN-206
            </strong>{" "}
            (Sam Okafor, not yet voted). Both are needed.
          </div>
        )}
      </div>
    </div>
  );
}
