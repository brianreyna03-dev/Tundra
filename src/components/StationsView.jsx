import { useState } from "react";
import { usedCategories, allCategories, CATS } from "../lib/util.js";

export default function StationsView({ data, actions }) {
  const { stations, team } = data;
  const [name, setName] = useState("");
  const [cat, setCat] = useState(CATS[0]);

  const add = () => {
    const value = name.trim();
    if (!value) return;
    actions.addStation(value, cat);
    setName("");
  };

  const availToday = (stationId) =>
    team.filter((person) => !person.pto && person.certs.includes(stationId)).length;

  const uncovered = stations.filter((station) => availToday(station.id) < 1).length;

  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-kicker">Process Control</span>
          <h2>Unit Processes & Stations</h2>
          <p>
            Organize each process by area. Priority runs top to bottom inside
            every group.
          </p>
        </div>
        <div className="panel-summary" aria-label="Process summary">
          <span><b>{stations.length}</b> processes</span>
          <span className={uncovered ? "summary-alert" : ""}>
            <b>{uncovered}</b> without coverage
          </span>
        </div>
      </div>

      <div className="entry-panel">
        <div>
          <span className="lbl">Add Unit Process</span>
          <p>Choose an area, then place the highest-priority process first.</p>
        </div>
        <div className="addbar station-addbar">
          <input
            type="text"
            placeholder="Process or station name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
          />
          <select value={cat} onChange={(event) => setCat(event.target.value)}>
            {allCategories(stations).map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <button className="btn" onClick={add}>
            Add Process
          </button>
        </div>
      </div>

      {stations.length === 0 ? (
        <div className="empty">
          <div className="empty-symbol">UP</div>
          <div className="big">No Unit Plant processes loaded</div>
          <div>Add processes above, then certify the team members who can run them.</div>
        </div>
      ) : (
        usedCategories(stations).map((category) => {
          const categoryStations = stations.filter(
            (station) => station.category === category
          );
          if (!categoryStations.length) return null;
          return (
            <div className="stgroup" key={category}>
              <header>
                <span className="category-marker" />
                <span className="lbl">{category}</span>
                <span className="cnt">
                  {categoryStations.length} process
                  {categoryStations.length === 1 ? "" : "es"}
                </span>
              </header>
              <div className="stlist">
                {categoryStations.map((station, index) => {
                  const coverage = availToday(station.id);
                  return (
                    <div className="stitem" key={station.id}>
                      <span className="idx">{String(index + 1).padStart(2, "0")}</span>
                      <span className="snm">{station.name}</span>
                      <span className={"cov" + (coverage < 1 ? " thin" : "")}>
                        <span className="coverage-dot" />
                        {coverage < 1
                          ? "No certified member available"
                          : `${coverage} certified today`}
                      </span>
                      <button
                        className="arrbtn"
                        title="Move to higher priority"
                        disabled={index === 0}
                        onClick={() => actions.moveStation(station.id, -1)}
                      >
                        ▲
                      </button>
                      <button
                        className="arrbtn"
                        title="Move to lower priority"
                        disabled={index === categoryStations.length - 1}
                        onClick={() => actions.moveStation(station.id, 1)}
                      >
                        ▼
                      </button>
                      <button
                        className="xbtn"
                        title="Delete process"
                        aria-label={`Delete ${station.name}`}
                        onClick={() => actions.removeStation(station.id)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <p className="hint">
        Coverage counts active team members certified for each process. A red
        process cannot be staffed until attendance or certifications change.
      </p>
    </>
  );
}
