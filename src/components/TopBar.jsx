import { useRef, useState } from "react";
import { exampleData } from "../lib/example.js";
import { todayStr } from "../lib/util.js";

export default function TopBar({ data, actions }) {
  const fileRef = useRef(null);
  const [notice, setNotice] = useState("");

  const activeToday = data.team.filter((person) => !person.pto).length;
  const coverageReady = data.stations.length > 0 && activeToday > 0;

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tmmtx-unit-plant-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    flash("Plant roster exported");
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      actions.loadData(parsed);
      flash("Plant roster imported");
    } catch {
      flash("That file is not valid roster JSON");
    }
  };

  const reloadExample = () => {
    if (
      !window.confirm(
        "Replace the current roster with the Unit Plant example data?"
      )
    )
      return;
    actions.loadData(exampleData());
    flash("Example roster restored");
  };

  return (
    <header className="topbar">
      <div className="plant-stripe" />

      <div className="wrap topbar-inner">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>UP</span>
          </div>
          <div className="brand-copy">
            <div className="brand-kicker">
              <span className="tmmtx-tag">TMMTX</span>
              <span>Unit Plant Operations</span>
            </div>
            <h1>Tundra Coverage Control</h1>
            <p>Certified staffing by process and production half</p>
          </div>
        </div>

        <div className="top-actions">
          {notice && <span className="notice">{notice}</span>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importData}
          />
          <button
            className="btn ghost"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <button className="btn ghost" onClick={exportData}>
            Export
          </button>
          <button className="btn ghost" onClick={reloadExample}>
            Demo roster
          </button>
        </div>
      </div>

      <div className="ops-strip">
        <div className="wrap ops-strip-inner">
          <div className="ops-metric">
            <span>Team Members</span>
            <strong>{data.team.length}</strong>
          </div>
          <div className="ops-metric">
            <span>Active Today</span>
            <strong>{activeToday}</strong>
          </div>
          <div className="ops-metric">
            <span>Unit Processes</span>
            <strong>{data.stations.length}</strong>
          </div>
          <div className="ops-status">
            <span
              className={
                coverageReady ? "status-light ready" : "status-light setup"
              }
            />
            <div>
              <span>Board Status</span>
              <strong>
                {coverageReady ? "Ready to Build" : "Setup Required"}
              </strong>
            </div>
          </div>
          <div className="ops-date">
            <span>Production Date</span>
            <strong>{todayStr()}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
