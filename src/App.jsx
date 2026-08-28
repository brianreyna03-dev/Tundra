import { useState } from "react";
import { useShiftData } from "./hooks/useShiftData.js";
import TopBar from "./components/TopBar.jsx";
import Tabs from "./components/Tabs.jsx";
import BoardView from "./components/BoardView.jsx";
import TeamView from "./components/TeamView.jsx";
import StationsView from "./components/StationsView.jsx";
import CoverageView from "./components/CoverageView.jsx";
import MapView from "./components/MapView.jsx";

export default function App() {
  const { data, actions, storageOK, loading } = useShiftData();
  const [tab, setTab] = useState("board");
  const [openCertId, setOpenCertId] = useState(null);

  return (
    <>
      <TopBar data={data} actions={actions} />
      <Tabs
        tab={tab}
        setTab={setTab}
        team={data.team}
        stations={data.stations}
      />

      <main className="wrap">
        {loading && (
          <div className="banner">
            <span>↻</span>
            <span>Loading shared Unit Plant board from Supabase…</span>
          </div>
        )}

        {!loading && !storageOK && (
          <div className="banner">
            <span>⚠</span>
            <span>
              Shared sync is not connected right now. Changes may only save on
              this device. Check <code> VITE_SUPABASE_URL </code> and
              <code> VITE_SUPABASE_PUBLISHABLE_KEY </code> in Vercel, then
              redeploy.
            </span>
          </div>
        )}

        {tab === "board" && (
          <BoardView
            data={data}
            onGenerate={actions.generate}
            onStartManual={actions.startManual}
            onAssign={actions.assignPerson}
            onSetTraining={actions.setTraining}
          />
        )}
        {tab === "map" && (
          <MapView
            data={data}
            onGenerate={actions.generate}
            onStartManual={actions.startManual}
            onAssign={actions.assignPerson}
            onSetTraining={actions.setTraining}
            onSetLineSupport={actions.setLineSupport}
            onRenameLineSupportSlot={actions.renameLineSupportSlot}
          />
        )}
        {tab === "team" && (
          <TeamView
            data={data}
            actions={actions}
            openCertId={openCertId}
            setOpenCertId={setOpenCertId}
          />
        )}
        {tab === "stations" && <StationsView data={data} actions={actions} />}
        {tab === "coverage" && <CoverageView data={data} />}
      </main>

      <footer className="foot">
        <span className="foot-mark">TMMTX · UNIT PLANT</span>
        <span>Tundra Coverage Control</span>
        <span>
          {storageOK
            ? "Shared data syncs through Supabase."
            : "Data saves locally until shared sync is restored."}
        </span>
      </footer>
    </>
  );
}

