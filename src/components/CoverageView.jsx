import { useMemo, useState } from "react";
import { usedCategories } from "../lib/util.js";

function initialsOf(name) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "TM"
  );
}

export default function CoverageView({ data }) {
  const { stations, team } = data;
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const q = query.trim().toLowerCase();

  // For each station, the certified members (optionally only those on shift),
  // sorted with on-shift members first, then alphabetically.
  const certifiedByStation = useMemo(() => {
    const map = new Map();
    stations.forEach((station) => {
      const members = team
        .filter((person) => person.certs.includes(station.id))
        .filter((person) => (availableOnly ? !person.pto : true))
        .slice()
        .sort(
          (a, b) =>
            Number(a.pto) - Number(b.pto) || a.name.localeCompare(b.name)
        );
      map.set(station.id, members);
    });
    return map;
  }, [stations, team, availableOnly]);

  const availableCount = (stationId) =>
    team.filter((person) => !person.pto && person.certs.includes(stationId))
      .length;

  const totalCerts = team.reduce((sum, person) => sum + person.certs.length, 0);
  const uncovered = stations.filter(
    (station) => availableCount(station.id) < 1
  ).length;

  const categories = usedCategories(stations);

  // A station matches the search if its name matches, or any certified member
  // on it matches.
  const stationMatches = (station) => {
    if (!q) return true;
    if (station.name.toLowerCase().includes(q)) return true;
    return (certifiedByStation.get(station.id) || []).some((person) =>
      person.name.toLowerCase().includes(q)
    );
  };

  if (!stations.length) {
    return (
      <>
        <div className="panel-head">
          <div>
            <span className="section-kicker">Certification Coverage</span>
            <h2>Certified Members by Process</h2>
            <p>See who can run each Unit Plant process at a glance.</p>
          </div>
        </div>
        <div className="empty">
          <div className="empty-symbol">UP</div>
          <div className="big">No Unit Plant processes loaded</div>
          <div>
            Add processes on the Unit Processes tab, then certify the team
            members who can run them.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-kicker">Certification Coverage</span>
          <h2>Certified Members by Process</h2>
          <p>
            Each process lists every certified team member. Members on PTO are
            shown but marked out for today.
          </p>
        </div>
        <div className="panel-summary" aria-label="Certification summary">
          <span>
            <b>{stations.length}</b> processes
          </span>
          <span>
            <b>{totalCerts}</b> certifications
          </span>
          <span className={uncovered ? "summary-alert" : ""}>
            <b>{uncovered}</b> without coverage
          </span>
        </div>
      </div>

      <div className="cov-toolbar">
        <div className="cov-search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search process or team member"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              className="cov-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <label className="cov-toggle">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
          />
          <span>On-shift only</span>
        </label>
      </div>

      {categories.map((category) => {
        const categoryStations = stations
          .filter((station) => station.category === category)
          .filter(stationMatches);
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
            <div className="covlist">
              {categoryStations.map((station) => {
                const members = certifiedByStation.get(station.id) || [];
                const available = availableCount(station.id);
                return (
                  <div className="covrow" key={station.id}>
                    <div className="cov-station">
                      <span className="cov-station-name">{station.name}</span>
                      <span
                        className={
                          "cov-count" + (available < 1 ? " thin" : "")
                        }
                      >
                        <span className="coverage-dot" />
                        {members.length} certified
                        {!availableOnly && (
                          <span className="cov-today">
                            {" · "}
                            {available} on shift
                          </span>
                        )}
                      </span>
                    </div>
                    {members.length ? (
                      <div className="cov-members">
                        {members.map((person) => (
                          <span
                            className={
                              "memchip" + (person.pto ? " pto" : "")
                            }
                            key={person.id}
                            title={
                              person.pto
                                ? `${person.name} — on PTO today`
                                : person.name
                            }
                          >
                            <span className="mem-ini" aria-hidden="true">
                              {initialsOf(person.name)}
                            </span>
                            <span className="mem-name">{person.name}</span>
                            {person.pto && (
                              <span className="mem-tag">PTO</span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="cov-none">
                        {availableOnly
                          ? "No certified member on shift today"
                          : "No certified team members yet"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="hint">
        Certify team members on the <b>Team Members</b> tab. A process with no
        on-shift certified member cannot be staffed until attendance or
        certifications change.
      </p>
    </>
  );
}
