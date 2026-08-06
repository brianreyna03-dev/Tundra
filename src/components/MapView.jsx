import { useEffect, useMemo, useRef, useState } from "react";
import { nameFor, todayStr } from "../lib/util.js";
import TeamLeaderStrip from "./TeamLeaderStrip.jsx";
import AssignmentSelect from "./AssignmentSelect.jsx";

const MAP_AREAS = {
  unit: { prefix: "st", count: 12 },
  sub: { prefix: "sub", count: 6 },
  material: { prefix: "pm", count: 4 },
};

function initialsOf(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areaForStation(station) {
  const category = cleanText(station.category);
  const name = cleanText(station.name);
  const text = `${category} ${name}`;

  if (
    /\b(sub|subassembly|sub assembly|sub-line|sub line)\b/.test(
      text
    )
  ) {
    return "sub";
  }

  if (
    /\b(material|parts|part management|parts management|material support|material route|pm)\b/.test(
      text
    )
  ) {
    return "material";
  }

  if (
    /\b(unit|main|main line|unit assembly|station|st)\b/.test(
      text
    )
  ) {
    return "unit";
  }

  return null;
}

function stationNumber(station, area) {
  const text = cleanText(station.name);

  const patterns = {
    unit: [
      /\b(?:st|station|unit station|unit|main station|main)\s*[-#:]*\s*(\d{1,2})\b/,
      /\b(\d{1,2})\s*(?:st|station)\b/,
    ],
    sub: [
      /\b(?:sub|subassembly|sub assembly|sub-line|sub line)\s*[-#:]*\s*(\d{1,2})\b/,
      /\b(\d{1,2})\s*(?:sub|subassembly|sub assembly)\b/,
    ],
    material: [
      /\b(?:pm|material route|material support|parts management|parts|material)\s*[-#:]*\s*(\d{1,2})\b/,
      /\b(\d{1,2})\s*(?:pm|material route|parts)\b/,
    ],
  };

  for (const pattern of patterns[area] || []) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function firstEmptySlot(layout, area) {
  const { prefix, count } = MAP_AREAS[area];

  for (let number = 1; number <= count; number++) {
    const key = `${prefix}${number}`;

    if (!layout[key]) {
      return key;
    }
  }

  return null;
}

function buildAutoLayout(stations) {
  const layout = {};
  const used = new Set();
  const classified = [];

  stations.forEach((station) => {
    const area = areaForStation(station);

    if (area) {
      classified.push({ station, area });
    }
  });

  classified.forEach(({ station, area }) => {
    const number = stationNumber(station, area);
    const spec = MAP_AREAS[area];

    if (!number || number < 1 || number > spec.count) {
      return;
    }

    const key = `${spec.prefix}${number}`;

    if (!layout[key]) {
      layout[key] = station.id;
      used.add(station.id);
    }
  });

  classified.forEach(({ station, area }) => {
    if (used.has(station.id)) {
      return;
    }

    const key = firstEmptySlot(layout, area);

    if (key) {
      layout[key] = station.id;
      used.add(station.id);
    }
  });

  const remaining = stations.filter(
    (station) => !used.has(station.id)
  );

  const fallbackOrder = [
    ...Array.from(
      { length: 12 },
      (_, index) => `st${index + 1}`
    ),
    ...Array.from(
      { length: 6 },
      (_, index) => `sub${index + 1}`
    ),
    ...Array.from(
      { length: 4 },
      (_, index) => `pm${index + 1}`
    ),
  ].filter((key) => !layout[key]);

  remaining.forEach((station, index) => {
    const key = fallbackOrder[index];

    if (key) {
      layout[key] = station.id;
    }
  });

  return layout;
}

function ProcessCell({
  code,
  station,
  segment,
  stations,
  team,
  editing,
  onAssign,
  kind = "station",
  zone,
}) {
  const zoneClass = zone ? ` map-zone-${zone}` : "";

  if (kind === "blocked") {
    return (
      <div
        className={`map-process map-process-blocked${zoneClass}`}
        aria-label={code}
      >
        <span className="map-code">{code}</span>

        <span className="map-special-copy">
          Restricted area
        </span>
      </div>
    );
  }

  if (kind === "buffer" || kind === "empty") {
    return (
      <div
        className={`map-process map-process-${kind}${zoneClass}`}
        aria-label={code}
      >
        <span className="map-code map-special-label">
          {code}
        </span>
      </div>
    );
  }

  if (!station) {
    return (
      <div
        className={`map-process map-process-unconfigured${zoneClass}`}
        aria-label={`${code}, open map location`}
      >
        <span className="map-code">{code}</span>

        <span className="map-special-copy">
          Open map location
        </span>
      </div>
    );
  }

  const personId = segment?.assign?.[station.id];

  const personName = personId
    ? nameFor(team, personId)
    : null;

  return (
    <div
      className={`map-process${zoneClass}${
        personName ? " is-staffed" : " is-open"
      }${editing ? " is-editing" : ""}`}
      title={`${station.name}${
        personName
          ? ` — ${personName}`
          : " — Coverage required"
      }`}
    >
      <div className="map-process-topline">
        <span className="map-code">{code}</span>

        <span className="map-process-name">
          {station.name}
        </span>
      </div>

      {editing ? (
        <AssignmentSelect
          station={station}
          segment={segment}
          stations={stations}
          team={team}
          onAssign={onAssign}
          compact
        />
      ) : personName ? (
        <div className="map-assignee">
          <span
            className="map-avatar"
            aria-hidden="true"
          >
            {initialsOf(personName)}
          </span>

          <strong>{personName}</strong>
        </div>
      ) : (
        <span className="map-uncovered">
          Coverage required
        </span>
      )}
    </div>
  );
}

export default function MapView({
  data,
  onGenerate,
  onStartManual,
  onAssign,
}) {
  const { stations, team, schedule } = data;

  const [segmentKey, setSegmentKey] =
    useState("q1");

  const [manualMode, setManualMode] =
    useState(false);

  const [isPullingLever, setIsPullingLever] =
    useState(false);

  const [showCelebration, setShowCelebration] =
    useState(false);

  const rebuildTimers = useRef([]);

  const segments = Array.isArray(
    schedule?.segments
  )
    ? schedule.segments
    : [];

  const segment =
    segments.find(
      (candidate) => candidate.key === segmentKey
    ) || segments[0];

  const built = Boolean(segment);

  const autoLayout = useMemo(
    () => buildAutoLayout(stations),
    [stations]
  );

  const stationById = useMemo(
    () =>
      new Map(
        stations.map((station) => [
          station.id,
          station,
        ])
      ),
    [stations]
  );

  const stationFor = (slotKey) =>
    stationById.get(autoLayout[slotKey]);

  /*
   * Zone 2A:
   * PM 3 and PM 4
   *
   * Zone 2B:
   * PM 1 and PM 2
   */
  const pmSlots = [4, 3, 2, 1].map(
    (number) => ({
      code: `PM ${number}`,
      station: stationFor(`pm${number}`),
      zone:
        number >= 3 ? "zone2a" : "zone2b",
    })
  );

  /*
   * Zone 2A:
   * Sub 6
   *
   * Zone 3:
   * Sub 1 through Sub 5
   */
  const subSlots = [6, 5, 4, 3, 2, 1].map(
    (number) => ({
      code: `Sub ${number}`,
      station: stationFor(`sub${number}`),
      zone:
        number === 6 ? "zone2a" : "zone3",
    })
  );

  /*
   * Zone 2A:
   * ST 4 through ST 7
   *
   * Zone 2B:
   * ST 8 through ST 11
   */
  const mainTop = [
    4, 5, 6, 7, 8, 9, 10, 11,
  ].map((number) => ({
    code: `ST ${number}`,
    station: stationFor(`st${number}`),
    zone:
      number <= 7 ? "zone2a" : "zone2b",
  }));

  /*
   * Zone 1:
   * ST 1, ST 2, ST 3 and ST 12
   */
  const mainBottom = [3, 2, 1, 12].map(
    (number) => ({
      code: `ST ${number}`,
      station: stationFor(`st${number}`),
      zone: "zone1",
    })
  );

  const mappedIds = new Set(
    Object.values(autoLayout).filter(Boolean)
  );

  const additional = stations.filter(
    (station) => !mappedIds.has(station.id)
  );

  const filled = segment
    ? Object.values(
        segment.assign || {}
      ).filter(Boolean).length
    : 0;

  const processProps = {
    segment,
    stations,
    team,
    editing: manualMode,
    onAssign,
  };

  useEffect(() => {
    return () => {
      rebuildTimers.current.forEach((timer) =>
        window.clearTimeout(timer)
      );
    };
  }, []);

  const triggerJackpotRebuild = () => {
    if (isPullingLever) return;

    const confirmed = window.confirm(
      "Rebuild the floor map? This will replace all current quarter assignments, including manual changes."
    );

    if (!confirmed) return;

    rebuildTimers.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    rebuildTimers.current = [];

    setIsPullingLever(true);
    setShowCelebration(true);

    rebuildTimers.current.push(
      window.setTimeout(() => {
        onGenerate();
        setManualMode(false);
      }, 900)
    );

    rebuildTimers.current.push(
      window.setTimeout(() => {
        setIsPullingLever(false);
      }, 1100)
    );

    rebuildTimers.current.push(
      window.setTimeout(() => {
        setShowCelebration(false);
      }, 3200)
    );
  };

  return (
    <>
      <div className="panel-head map-panel-head">
        <div>
          <span className="section-kicker">
            Quarter-by-Quarter Location Plan
          </span>

          <h2>Unit Plant Team Map</h2>

          <p>
            Select a quarter to view assignments,
            or turn on manual editing to place team
            members directly into mapped stations.
          </p>
        </div>

        <div className="map-filter-card">
          <label htmlFor="quarter-filter">
            Quarter of day
          </label>

          <select
            id="quarter-filter"
            value={segment?.key || segmentKey}
            onChange={(event) =>
              setSegmentKey(event.target.value)
            }
            disabled={!built}
          >
            {(segments.length
              ? segments
              : [
                  {
                    key: "q1",
                    label: "Q1",
                    full: "1st Quarter",
                  },
                  {
                    key: "q2",
                    label: "Q2",
                    full: "2nd Quarter",
                  },
                  {
                    key: "q3",
                    label: "Q3",
                    full: "3rd Quarter",
                  },
                  {
                    key: "q4",
                    label: "Q4",
                    full: "4th Quarter",
                  },
                  {
                    key: "ot",
                    label: "OT",
                    full: "Overtime",
                  },
                ]
            ).map((option) => (
              <option
                key={option.key}
                value={option.key}
              >
                {option.label} — {option.full}
              </option>
            ))}
          </select>

          {built && (
            <button
              className={`btn ghost sm manual-toggle${
                manualMode ? " is-active" : ""
              }`}
              type="button"
              onClick={() =>
                setManualMode(
                  (current) => !current
                )
              }
            >
              {manualMode
                ? "Done Editing"
                : "Edit Assignments"}
            </button>
          )}
        </div>
      </div>

      <TeamLeaderStrip
        team={team}
        compact
      />

      {!built ? (
        <div className="empty map-empty">
          <div className="empty-symbol">
            MAP
          </div>

          <div className="big">
            Create a coverage plan to populate
            the floor map
          </div>

          <div>
            Build an automatic certified plan,
            or start blank and place team members
            manually.
          </div>

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

            <button
              className="gen map-build"
              type="button"
              onClick={onGenerate}
            >
              Build Coverage
            </button>
          </div>
        </div>
      ) : (
        <>
          {manualMode && (
            <div className="manual-edit-banner">
              <strong>
                Manual assignment mode
              </strong>

              <span>
                Use the dropdown inside each
                mapped process. A person selected
                elsewhere in this quarter will be
                moved here automatically.
              </span>
            </div>
          )}

          <section
            className="map-statusbar"
            aria-label="Map status"
          >
            <div>
              <span className="lbl">
                Showing
              </span>

              <strong>
                {segment.label} ·{" "}
                {segment.full}
              </strong>
            </div>

            <div>
              <span className="lbl">
                Date
              </span>

              <strong>
                {todayStr()}
              </strong>
            </div>

            <div>
              <span className="lbl">
                Mapped coverage
              </span>

              <strong>
                {filled}/{stations.length}{" "}
                processes staffed
              </strong>
            </div>

            <div className="map-status-actions">
              <div
                className={`map-jackpot${
                  isPullingLever ? " is-pulling" : ""
                }${
                  showCelebration
                    ? " is-celebrating"
                    : ""
                }`}
              >
                <div className="map-jackpot-machine">
                  <span className="map-jackpot-kicker">
                    Vegas rebuild
                  </span>

                  <div className="map-jackpot-window">
                    <span aria-hidden="true">
                      🎰
                    </span>

                    <strong>Pull to rebuild</strong>
                  </div>

                  <button
                    className="map-jackpot-lever"
                    type="button"
                    title="Pull the lever to rebuild the floor map"
                    aria-label="Pull the lever to rebuild the floor map"
                    onClick={triggerJackpotRebuild}
                    disabled={isPullingLever}
                  >
                    <span className="map-jackpot-shaft" />
                    <span className="map-jackpot-knob" />
                  </button>

                  <div
                    className="map-jackpot-burst map-jackpot-confetti"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 18 }, (_, index) => (
                      <span
                        key={`confetti-${index}`}
                        className={`confetti-piece cp-${index + 1}`}
                      />
                    ))}
                  </div>

                  <div
                    className="map-jackpot-burst map-jackpot-fireworks"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 3 }, (_, index) => (
                      <span
                        key={`firework-${index}`}
                        className={`firework fw-${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                className="btn ghost sm"
                type="button"
                onClick={() => window.print()}
              >
                Print Map
              </button>
            </div>
          </section>

          <div className="floor-map-shell">
            <div
              className="floor-map"
              aria-label={`${segment.full} floor assignment map`}
            >
              <section
                className="map-zone map-zone-parts"
                aria-label="Parts management area"
              >
                <div className="map-zone-label map-zone-label-parts">
                  <span>
                    Parts Management
                  </span>

                  <small>
                    Material support
                  </small>
                </div>

                {pmSlots.map((slot) => (
                  <ProcessCell
                    key={slot.code}
                    {...slot}
                    {...processProps}
                  />
                ))}
              </section>

              <div
                className="map-aisle map-aisle-upper"
                aria-hidden="true"
              >
                <span />
              </div>

              <section
                className="map-zone map-zone-sub"
                aria-label="Sub line area"
              >
                <div className="map-zone-label map-zone-label-sub">
                  <span>
                    Sub Line
                  </span>

                  <small>
                    Sub-assembly
                  </small>
                </div>

                <ProcessCell
                  {...subSlots[0]}
                  {...processProps}
                />

                <ProcessCell
                  code="Access"
                  kind="blocked"
                />

                {subSlots
                  .slice(1)
                  .map((slot) => (
                    <ProcessCell
                      key={slot.code}
                      {...slot}
                      {...processProps}
                    />
                  ))}
              </section>

              <div
                className="map-aisle map-aisle-main"
                aria-hidden="true"
              >
                <span />
              </div>

              <section
                className="map-zone map-zone-main"
                aria-label="Main line area"
              >
                <div className="map-zone-label map-zone-label-main">
                  <span>
                    Main Line
                  </span>

                  <small>
                    Unit assembly
                  </small>
                </div>

                <div className="map-main-grid">
                  <div className="map-main-row map-main-top">
                    {mainTop.map((slot) => (
                      <ProcessCell
                        key={slot.code}
                        {...slot}
                        {...processProps}
                      />
                    ))}
                  </div>

                  <div className="map-main-row map-main-bottom">
                    <ProcessCell
                      {...mainBottom[0]}
                      {...processProps}
                    />

                    <ProcessCell
                      {...mainBottom[1]}
                      {...processProps}
                    />

                    <ProcessCell
                      {...mainBottom[2]}
                      {...processProps}
                    />

                    <ProcessCell
                      code="Stairs"
                      kind="empty"
                    />

                    <ProcessCell
                      {...mainBottom[3]}
                      {...processProps}
                    />

                    <div className="map-buffer-span">
                      <ProcessCell
                        code="Kick Out"
                        kind="buffer"
                        zone="zone1"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="map-support-row">
            <div className="map-support-card">
              <span className="section-kicker">
                Unassigned &amp; Available
              </span>

              <h3>
                {segment.label} Floaters
              </h3>

              <div className="map-floater-list">
                {segment.float?.length ? (
                  segment.float.map(
                    (personId) => (
                      <span
                        className="memchip"
                        key={personId}
                      >
                        <span
                          className="mem-ini"
                          aria-hidden="true"
                        >
                          {initialsOf(
                            nameFor(
                              team,
                              personId
                            )
                          )}
                        </span>

                        <span className="mem-name">
                          {nameFor(
                            team,
                            personId
                          )}
                        </span>
                      </span>
                    )
                  )
                ) : (
                  <span className="map-none">
                    All active members are
                    assigned.
                  </span>
                )}
              </div>
            </div>

            {additional.length > 0 && (
              <div className="map-support-card">
                <span className="section-kicker">
                  Outside Reference Layout
                </span>

                <h3>
                  Additional Processes
                </h3>

                <div className="map-additional-list">
                  {additional.map(
                    (station) => {
                      const personId =
                        segment.assign?.[
                          station.id
                        ];

                      return (
                        <div
                          key={station.id}
                          className={
                            manualMode
                              ? "is-editing"
                              : ""
                          }
                        >
                          <span>
                            {station.name}
                          </span>

                          {manualMode ? (
                            <AssignmentSelect
                              station={station}
                              segment={segment}
                              stations={
                                stations
                              }
                              team={team}
                              onAssign={
                                onAssign
                              }
                              compact
                            />
                          ) : (
                            <strong>
                              {personId
                                ? nameFor(
                                    team,
                                    personId
                                  )
                                : "Coverage required"}
                            </strong>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
