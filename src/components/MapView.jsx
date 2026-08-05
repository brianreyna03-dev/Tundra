import { useMemo, useState } from "react";
import { nameFor, todayStr } from "../lib/util.js";

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

  if (/\b(sub|subassembly|sub assembly|sub-line|sub line)\b/.test(text)) {
    return "sub";
  }
  if (
    /\b(material|parts|part management|parts management|material support|material route|pm)\b/.test(
      text
    )
  ) {
    return "material";
  }
  if (/\b(unit|main|main line|unit assembly|station|st)\b/.test(text)) {
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
    if (match) return Number(match[1]);
  }
  return null;
}

function firstEmptySlot(layout, area) {
  const { prefix, count } = MAP_AREAS[area];
  for (let number = 1; number <= count; number++) {
    const key = `${prefix}${number}`;
    if (!layout[key]) return key;
  }
  return null;
}

// Existing boards do not all use the same category labels. This mapper first
// recognizes station codes/names, then category aliases, and finally uses the
// existing station order as a safe legacy fallback so a populated board does
// not render as entirely "Not configured."
function buildAutoLayout(stations) {
  const layout = {};
  const used = new Set();
  const classified = [];
  const unclassified = [];

  stations.forEach((station) => {
    const area = areaForStation(station);
    if (area) classified.push({ station, area });
    else unclassified.push(station);
  });

  // Pass 1: exact numbered names such as ST 4, SUB 2, or PM 1.
  classified.forEach(({ station, area }) => {
    const number = stationNumber(station, area);
    const spec = MAP_AREAS[area];
    if (!number || number < 1 || number > spec.count) return;
    const key = `${spec.prefix}${number}`;
    if (!layout[key]) {
      layout[key] = station.id;
      used.add(station.id);
    }
  });

  // Pass 2: category/name-recognized processes without a usable number.
  classified.forEach(({ station, area }) => {
    if (used.has(station.id)) return;
    const key = firstEmptySlot(layout, area);
    if (key) {
      layout[key] = station.id;
      used.add(station.id);
    }
  });

  // Pass 3: legacy boards sometimes stored every process under one generic
  // category. Keep their original ordering: main line, sub line, then parts.
  const remaining = stations.filter((station) => !used.has(station.id));
  const fallbackOrder = [
    ...Array.from({ length: 12 }, (_, index) => `st${index + 1}`),
    ...Array.from({ length: 6 }, (_, index) => `sub${index + 1}`),
    ...Array.from({ length: 4 }, (_, index) => `pm${index + 1}`),
  ].filter((key) => !layout[key]);

  remaining.forEach((station, index) => {
    const key = fallbackOrder[index];
    if (key) layout[key] = station.id;
  });

  return layout;
}

function ProcessCell({ code, station, segment, team, kind = "station" }) {
  if (kind === "blocked") {
    return (
      <div className="map-process map-process-blocked" aria-label={code}>
        <span className="map-code">{code}</span>
        <span className="map-special-copy">Restricted area</span>
      </div>
    );
  }

  if (kind === "buffer" || kind === "empty") {
    return (
      <div className={`map-process map-process-${kind}`} aria-label={code}>
        <span className="map-code">{code}</span>
        <span className="map-special-copy">
          {kind === "buffer" ? "Open support space" : "No assigned process"}
        </span>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="map-process map-process-unconfigured" aria-label={`${code}, open map location`}>
        <span className="map-code">{code}</span>
        <span className="map-special-copy">Open map location</span>
      </div>
    );
  }

  const personId = segment?.assign?.[station.id];
  const personName = personId ? nameFor(team, personId) : null;

  return (
    <div
      className={`map-process${personName ? " is-staffed" : " is-open"}`}
      title={`${station.name}${personName ? ` — ${personName}` : " — Coverage required"}`}
    >
      <div className="map-process-topline">
        <span className="map-code">{code}</span>
        <span className="map-process-name">{station.name}</span>
      </div>
      {personName ? (
        <div className="map-assignee">
          <span className="map-avatar" aria-hidden="true">
            {initialsOf(personName)}
          </span>
          <strong>{personName}</strong>
        </div>
      ) : (
        <span className="map-uncovered">Coverage required</span>
      )}
    </div>
  );
}

export default function MapView({ data, onGenerate }) {
  const { stations, team, schedule } = data;
  const [segmentKey, setSegmentKey] = useState("q1");
  const segments = Array.isArray(schedule?.segments) ? schedule.segments : [];
  const segment = segments.find((candidate) => candidate.key === segmentKey) || segments[0];
  const built = Boolean(segment);

  const autoLayout = useMemo(() => buildAutoLayout(stations), [stations]);
  const stationById = useMemo(
    () => new Map(stations.map((station) => [station.id, station])),
    [stations]
  );
  const stationFor = (slotKey) => stationById.get(autoLayout[slotKey]);

  const pmSlots = [4, 3, 2, 1].map((number) => ({
    code: `PM ${number}`,
    station: stationFor(`pm${number}`),
  }));
  const subSlots = [6, 5, 4, 3, 2, 1].map((number) => ({
    code: `Sub ${number}`,
    station: stationFor(`sub${number}`),
  }));
  const mainTop = [4, 5, 6, 7, 8, 9, 10, 11].map((number) => ({
    code: `ST ${number}`,
    station: stationFor(`st${number}`),
  }));
  const mainBottom = [3, 2, 1, 12].map((number) => ({
    code: `ST ${number}`,
    station: stationFor(`st${number}`),
  }));

  const mappedIds = new Set(Object.values(autoLayout).filter(Boolean));
  const additional = stations.filter((station) => !mappedIds.has(station.id));
  const filled = segment
    ? Object.values(segment.assign || {}).filter(Boolean).length
    : 0;

  return (
    <>
      <div className="panel-head map-panel-head">
        <div>
          <span className="section-kicker">Quarter-by-Quarter Location Plan</span>
          <h2>Unit Plant Team Map</h2>
          <p>
            Select a quarter to see the scheduled team member at every mapped
            process location.
          </p>
        </div>
        <div className="map-filter-card">
          <label htmlFor="quarter-filter">Quarter of day</label>
          <select
            id="quarter-filter"
            value={segment?.key || segmentKey}
            onChange={(event) => setSegmentKey(event.target.value)}
            disabled={!built}
          >
            {(segments.length
              ? segments
              : [
                  { key: "q1", label: "Q1", full: "1st Quarter" },
                  { key: "q2", label: "Q2", full: "2nd Quarter" },
                  { key: "q3", label: "Q3", full: "3rd Quarter" },
                  { key: "q4", label: "Q4", full: "4th Quarter" },
                  { key: "ot", label: "OT", full: "Overtime" },
                ]
            ).map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} — {option.full}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!built ? (
        <div className="empty map-empty">
          <div className="empty-symbol">MAP</div>
          <div className="big">Build coverage to populate the floor map</div>
          <div>
            The map uses the same certified quarter assignments as the coverage
            board.
          </div>
          <button className="gen map-build" onClick={onGenerate}>
            Build Coverage
          </button>
        </div>
      ) : (
        <>
          <section className="map-statusbar" aria-label="Map status">
            <div>
              <span className="lbl">Showing</span>
              <strong>{segment.label} · {segment.full}</strong>
            </div>
            <div>
              <span className="lbl">Date</span>
              <strong>{todayStr()}</strong>
            </div>
            <div>
              <span className="lbl">Mapped coverage</span>
              <strong>{filled}/{stations.length} processes staffed</strong>
            </div>
            <button className="btn ghost sm" onClick={() => window.print()}>
              Print Map
            </button>
          </section>

          <div className="floor-map-shell">
            <div className="floor-map" aria-label={`${segment.full} floor assignment map`}>
              <section className="map-zone map-zone-parts" aria-label="Parts management area">
                <div className="map-zone-label map-zone-label-parts">
                  <span>Parts Management</span>
                  <small>Material support</small>
                </div>
                {pmSlots.map((slot) => (
                  <ProcessCell
                    key={slot.code}
                    {...slot}
                    segment={segment}
                    team={team}
                  />
                ))}
              </section>

              <div className="map-aisle map-aisle-upper" aria-hidden="true">
                <span />
              </div>

              <section className="map-zone map-zone-sub" aria-label="Sub line area">
                <div className="map-zone-label map-zone-label-sub">
                  <span>Sub Line</span>
                  <small>Sub-assembly</small>
                </div>
                <ProcessCell {...subSlots[0]} segment={segment} team={team} />
                <ProcessCell code="Access" kind="blocked" />
                {subSlots.slice(1).map((slot) => (
                  <ProcessCell
                    key={slot.code}
                    {...slot}
                    segment={segment}
                    team={team}
                  />
                ))}
              </section>

              <div className="map-aisle map-aisle-main" aria-hidden="true">
                <span />
              </div>

              <section className="map-zone map-zone-main" aria-label="Main line area">
                <div className="map-zone-label map-zone-label-main">
                  <span>Main Line</span>
                  <small>Unit assembly</small>
                </div>
                <div className="map-main-grid">
                  <div className="map-main-row map-main-top">
                    {mainTop.map((slot) => (
                      <ProcessCell
                        key={slot.code}
                        {...slot}
                        segment={segment}
                        team={team}
                      />
                    ))}
                  </div>
                  <div className="map-main-row map-main-bottom">
                    <ProcessCell {...mainBottom[0]} segment={segment} team={team} />
                    <ProcessCell {...mainBottom[1]} segment={segment} team={team} />
                    <ProcessCell {...mainBottom[2]} segment={segment} team={team} />
                    <ProcessCell code="Empty" kind="empty" />
                    <ProcessCell {...mainBottom[3]} segment={segment} team={team} />
                    <div className="map-buffer-span">
                      <ProcessCell code="Buffer" kind="buffer" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="map-support-row">
            <div className="map-support-card">
              <span className="section-kicker">Unassigned & Available</span>
              <h3>{segment.label} Floaters</h3>
              <div className="map-floater-list">
                {segment.float?.length ? (
                  segment.float.map((personId) => (
                    <span className="memchip" key={personId}>
                      <span className="mem-ini" aria-hidden="true">
                        {initialsOf(nameFor(team, personId))}
                      </span>
                      <span className="mem-name">{nameFor(team, personId)}</span>
                    </span>
                  ))
                ) : (
                  <span className="map-none">All active members are assigned.</span>
                )}
              </div>
            </div>

            {additional.length > 0 && (
              <div className="map-support-card">
                <span className="section-kicker">Outside Reference Layout</span>
                <h3>Additional Processes</h3>
                <div className="map-additional-list">
                  {additional.map((station) => {
                    const personId = segment.assign?.[station.id];
                    return (
                      <div key={station.id}>
                        <span>{station.name}</span>
                        <strong>
                          {personId ? nameFor(team, personId) : "Coverage required"}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
