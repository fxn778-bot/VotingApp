import { useVotingApp } from "./useVotingApp";
import { color, sans } from "./theme";
import Landing from "./components/Landing";
import Admin from "./components/Admin";
import Voter from "./components/Voter";

export default function App() {
  const { state, stats, actions } = useVotingApp();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: color.bg,
        color: color.ink,
        fontFamily: sans,
      }}
    >
      {state.screen === "land" && (
        <Landing cfg={state.cfg} onAdmin={actions.goAdmin} onVoter={actions.goVoter} />
      )}
      {state.screen === "admin" && <Admin state={state} stats={stats} actions={actions} />}
      {state.screen === "voter" && <Voter state={state} actions={actions} />}
    </div>
  );
}
