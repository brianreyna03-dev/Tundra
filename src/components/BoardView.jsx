import { usedCategories, nameFor, todayStr } from "../lib/util.js";

function EmptyState({ big, sub }) {
  return (
    <div className="empty">
      <div className="empty-symbol">UP</div>
      <div className="big">{big}</div>
      <div>{sub}</div>
    </div>
  );
}

function Slot({ personId, team }) {
  if (!personId) return <span className="uncovered">Coverage Required</span>;
  return (
    <span className="person">
      <span className="dot" />
      {nameFor(team, personId)}
    </span>
  );
}

export default function BoardView({ data, onGenerate }) {
  const { stations, team, schedule } = data;
  const stats = schedule?.stats;
  const segments = schedule?.segments;
  const built = Array.isArray(segments) && segments.length > 0;

  const control = (
    <section className="control" aria-label="Coverage board controls">
      <div className="date-box">
        <span className="lbl">Production Coverage</span>
        <strong>{todayStr()}</strong>
      </div>
      <div className="control-summary">
        {built ? (
          <div className="sumline">
            {segments.map((seg) => (
              <span
                key={seg.key}
                className={
                  "stat " + (seg.filled === stats.nS ? "good" : "warn")
                }
              >
                {seg.label} <b>{seg.filled}/{stats.nS}</b>
              </span>
            ))}
            <span className="stat neutral"><b>{stats.working}</b> active</span>
            <span className="stat neutral"><b>{stats.pto}</b> PTO</span>
          </div>
        ) : (
          <p>Build a certified assignment plan across four quarters and overtime.</p>
        )}
      </div>
      <button className="gen" onClick={onGenerate}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-3.5-7.1" />
          <path d="M21 4v5h-5" />
        </svg>
        {built ? "Rebuild Coverage" : "Build Coverage"}
      </button>
    </section>
  );

  if (!stations.length) {
    return (
      <>
        {control}
        <EmptyState
          big="Add Unit Plant processes first"
          sub="Open Unit Processes to create the stations that need daily coverage."
        />
      </>
    );
  }

  if (!built) {
    return (
      <>
        {control}
        <EmptyState
          big="Coverage board not built"
          sub="Select Build Coverage to place certified team members across all four quarters and overtime."
        />
      </>
    );
  }

  const categories = usedCategories(stations);
  let delay = 0;
  const anyUnfilled = segments.some((seg) => seg.filled < stats.nS);
  const cellClass = (seg) => "slot" + (seg.key === "ot" ? " slot-ot" : "");

  return (
    <>
      {control}

      {anyUnfilled && (
        <div className="coverage-alert">
          <span className="alert-icon">!</span>
          <div>
            <strong>Coverage gap detected</strong>
            <span>
              One or more processes do not have a free, certified team member
              for a quarter or overtime.
            </span>
          </div>
        </div>
      )}

      <div className="board">
        <div className="board-titlebar">
          <div>
            <span className="section-kicker">Daily Staffing Plan</span>
            <h2>Unit Plant Coverage Board</h2>
          </div>
          <span className="board-state">{anyUnfilled ? "ACTION REQUIRED" : "FULL COVERAGE"}</span>
        </div>
        <div className="board-head" style={{ "--seg-count": segments.length }}>
          <div>Unit Process</div>
          {segments.map((seg) => (
            <div
              key={seg.key}
              className={seg.key === "ot" ? "head-ot" : undefined}
              title={seg.full}
            >
              {seg.label}
            </div>
          ))}
        </div>

        {categories.map((category) => {
          const rows = stations.filter((station) => station.category === category);
          if (!rows.length) return null;
          return (
            <div key={category}>
              <div className="catband">
                <span className="category-marker" />
                <span className="lbl">{category}</span>
                <span className="cnt">{rows.length}</span>
              </div>
              {rows.map((station, index) => {
                delay += 16;
                return (
                  <div
                    className="srow reveal"
                    style={{ animationDelay: `${delay}ms`, "--seg-count": segments.length }}
                    key={station.id}
                  >
                    <div className="stname">
                      <span className="process-number">{String(index + 1).padStart(2, "0")}</span>
                      {station.name}
                    </div>
                    {segments.map((seg) => (
                      <div className={cellClass(seg)} key={seg.key}>
                        <Slot personId={seg.assign[station.id]} team={team} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="floaters">
        <div className="floaters-head">
          <div>
            <span className="section-kicker">Flexible Staffing</span>
            <h3>Float Coverage</h3>
          </div>
          <span>Available for relief, support, or response</span>
        </div>
        <div className="fbody">
          {segments.map((seg) => (
            <div className="fcol" key={seg.key}>
              <span className="lbl">{seg.label} Floaters</span>
              {seg.float.length ? (
                seg.float.map((id) => (
                  <span className="pill" key={id}>{nameFor(team, id)}</span>
                ))
              ) : (
                <span className="pill muted-pill">All active members assigned</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="hint board-hint">
        {anyUnfilled &&
          "Coverage Required means every certified team member is already assigned in that segment or is on PTO. "}
        Rebuilding reshuffles assignments while preserving certification rules.
        <button className="btn ghost sm" onClick={() => window.print()}>
          Print / Post Board
        </button>
      </p>
    </>
  );
}
