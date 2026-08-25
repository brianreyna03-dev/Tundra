import { useState } from "react";
import { usedCategories, nameFor, todayStr } from "../lib/util.js";
import AssignmentSelect from "./AssignmentSelect.jsx";

function EmptyState({ big, sub, children }) {
  return (
    <div className="empty">
      <div className="empty-symbol">UP</div>
      <div className="big">{big}</div>
      <div>{sub}</div>
      {children}
    </div>
  );
}

function Slot({
  personId,
  team,
  editing,
  station,
  segment,
  stations,
  onAssign,
}) {
  if (editing) {
    return (
      <AssignmentSelect
        station={station}
        segment={segment}
        stations={stations}
        team={team}
        onAssign={onAssign}
      />
    );
  }

  if (!personId) return <span className="uncovered">Coverage Required</span>;
  return (
    <span className="person">
      <span className="dot" />
      {nameFor(team, personId)}
    </span>
  );
}

function TrainingCell({
  station,
  segment,
  team,
  editing,
  onSetTraining,
}) {
  const traineeIds = Array.isArray(segment?.training?.[station.id])
    ? segment.training[station.id]
    : [];

  const assignedIds = new Set(
    Object.values(segment?.assign || {}).filter(Boolean)
  );
  const trainingIds = new Set(
    Object.values(segment?.training || {}).flatMap((ids) =>
      Array.isArray(ids) ? ids : []
    )
  );
  const trainerIds = new Set(
    Object.values(segment?.trainers || {}).filter(Boolean)
  );

  const available = team
    .filter((person) => person.role !== "tl")
    .filter((person) => !person.pto)
    .filter((person) => !assignedIds.has(person.id))
    .filter((person) => !trainingIds.has(person.id))
    .filter((person) => !trainerIds.has(person.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!editing && !traineeIds.length) {
    return <span className="training-empty">—</span>;
  }

  return (
    <div className={`training-cell${editing ? " is-editing" : ""}`}>
      {traineeIds.length > 0 && (
        <div className="training-list">
          {traineeIds.map((personId) => (
            <span className="training-pill" key={personId}>
              <span>{nameFor(team, personId)}</span>
              {editing && (
                <button
                  type="button"
                  className="training-remove"
                  onClick={() =>
                    onSetTraining(segment.key, station.id, personId, false)
                  }
                  aria-label={`Remove ${nameFor(team, personId)} from training at ${station.name} for ${segment.label}`}
                  title="Remove trainee"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {editing && (
        <label className="training-add-wrap">
          <span className="sr-only">
            Add a trainee to {station.name} for {segment.label}
          </span>
          <select
            className="training-add-select"
            value=""
            onChange={(event) => {
              const personId = event.target.value;
              if (personId) {
                onSetTraining(segment.key, station.id, personId, true);
              }
            }}
          >
            <option value="">
              {available.length ? "+ Add trainee" : "No unassigned members"}
            </option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export default function BoardView({
  data,
  onGenerate,
  onStartManual,
  onAssign,
  onSetTraining,
}) {
  const { stations, team, schedule } = data;
  const [manualMode, setManualMode] = useState(false);
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
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={
                  "stat " + (segment.filled === stats.nS ? "good" : "warn")
                }
              >
                {segment.label} <b>{segment.filled}/{stats.nS}</b>
              </span>
            ))}
            <span className="stat neutral"><b>{stats.working}</b> active members</span>
            <span className="stat neutral"><b>{stats.leaders || 0}</b> TLs</span>
            <span className="stat neutral"><b>{stats.pto}</b> PTO</span>
          </div>
        ) : (
          <p>
            Build an automatic certified plan, or start with a blank plan and
            assign every station yourself.
          </p>
        )}
      </div>
      <div className="control-actions">
        {built && (
          <button
            className={`btn ghost manual-toggle${manualMode ? " is-active" : ""}`}
            type="button"
            onClick={() => setManualMode((current) => !current)}
          >
            {manualMode ? "Done Editing" : "Edit Assignments"}
          </button>
        )}
        {!built && (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              onStartManual();
              setManualMode(true);
            }}
          >
            Start Manual Plan
          </button>
        )}
        <button
          className="gen"
          type="button"
          onClick={() => {
            onGenerate();
            setManualMode(false);
          }}
        >
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
      </div>
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
          sub="Build an automatic plan or start a blank manual plan."
        >
          <div className="empty-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                onStartManual();
                setManualMode(true);
              }}
            >
              Start Manual Plan
            </button>
            <button className="gen" type="button" onClick={onGenerate}>
              Build Coverage
            </button>
          </div>
        </EmptyState>
      </>
    );
  }

  const categories = usedCategories(stations);
  let delay = 0;
  const anyUnfilled = segments.some((segment) => segment.filled < stats.nS);
  const cellClass = (segment) =>
    `slot${segment.key === "ot" ? " slot-ot" : ""}${
      manualMode ? " is-editing" : ""
    }`;

  return (
    <>
      {control}

      {manualMode && (
        <div className="manual-edit-banner">
          <strong>Manual assignment mode</strong>
          <span>
            Choose an on-shift, certified member in any station cell. Selecting
            someone already placed in that quarter moves them to the new station.
            Use the Training row under a process to place any other unassigned
            team member there as a trainee for that period.
          </span>
        </div>
      )}

      {anyUnfilled && !manualMode && (
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
          <span className={`board-state${manualMode ? " is-manual" : ""}`}>
            {manualMode
              ? "MANUAL EDITING"
              : anyUnfilled
                ? "ACTION REQUIRED"
                : "FULL COVERAGE"}
          </span>
        </div>
        <div className="board-head" style={{ "--seg-count": segments.length }}>
          <div>Unit Process</div>
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={segment.key === "ot" ? "head-ot" : undefined}
              title={segment.full}
            >
              {segment.label}
            </div>
          ))}
        </div>

        {categories.map((category) => {
          const rows = stations.filter(
            (station) => station.category === category
          );
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
                  <div className="station-board-group" key={station.id}>
                    <div
                      className="srow reveal"
                      style={{
                        animationDelay: `${delay}ms`,
                        "--seg-count": segments.length,
                      }}
                    >
                      <div className="stname">
                        <span className="process-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {station.name}
                      </div>
                      {segments.map((segment) => (
                        <div className={cellClass(segment)} key={segment.key}>
                          <Slot
                            personId={segment.assign[station.id]}
                            team={team}
                            editing={manualMode}
                            station={station}
                            segment={segment}
                            stations={stations}
                            onAssign={onAssign}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      className="training-row reveal"
                      style={{
                        animationDelay: `${delay + 8}ms`,
                        "--seg-count": segments.length,
                      }}
                    >
                      <div className="training-label">
                        <span className="training-label-mark">T</span>
                        <span>
                          <strong>Training</strong>
                          <small>Unassigned members</small>
                        </span>
                      </div>
                      {segments.map((segment) => (
                        <div
                          className={`training-slot${
                            segment.key === "ot" ? " training-slot-ot" : ""
                          }`}
                          key={segment.key}
                        >
                          <TrainingCell
                            station={station}
                            segment={segment}
                            team={team}
                            editing={manualMode}
                            onSetTraining={onSetTraining}
                          />
                        </div>
                      ))}
                    </div>
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
          {segments.map((segment) => (
            <div className="fcol" key={segment.key}>
              <span className="lbl">{segment.label} Floaters</span>
              {segment.float.length ? (
                segment.float.map((id) => (
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
        {manualMode
          ? "Manual changes save automatically. Production menus require certification; Training menus show active team members who are not assigned anywhere else in that period."
          : "Rebuilding reshuffles production assignments while preserving certification rules. Training assignments stay attached to unassigned members when possible."}
        <button className="btn ghost sm" onClick={() => window.print()}>
          Print / Post Board
        </button>
      </p>
    </>
  );
}
