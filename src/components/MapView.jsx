import { useEffect, useMemo, useRef, useState } from "react";
import { nameFor, todayStr } from "../lib/util.js";
import TeamLeaderStrip from "./TeamLeaderStrip.jsx";
import AssignmentSelect from "./AssignmentSelect.jsx";

const MAP_AREAS = {
  unit: { prefix: "st", count: 12 },
  sub: { prefix: "sub", count: 6 },
  material: { prefix: "pm", count: 4 },
};

const JACKPOT_REELS = [
  ["7", "★", "⚙", "◆", "⚡", "★", "7", "⚙", "◆", "⚡", "7"],
  ["★", "⚙", "7", "⚡", "◆", "7", "★", "◆", "⚙", "⚡", "7"],
  ["⚙", "◆", "★", "7", "⚡", "◆", "⚙", "★", "7", "⚡", "7"],
];

const LEVER_TRIGGER_POINT = 0.72;
const LEVER_PULL_DISTANCE = 96;

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

function TrainerDropZone({
  station,
  segment,
  team,
  editing,
  movingPersonId,
  trainerDropTargetStationId,
  onTrainerDrop,
  onTrainerDropRejected,
  onTrainerDropTargetChange,
  onSetTrainer,
}) {
  const explicitTrainerId = segment?.trainers?.[station.id] || null;
  const traineeIds = Array.isArray(segment?.training?.[station.id])
    ? segment.training[station.id]
    : [];
  const trainerName = explicitTrainerId
    ? nameFor(team, explicitTrainerId)
    : null;

  const movingPerson = movingPersonId
    ? team.find((person) => person.id === movingPersonId)
    : null;
  const canAcceptMovingPerson = Boolean(
    movingPerson &&
      movingPerson.role !== "tl" &&
      !movingPerson.pto &&
      movingPerson.certs.includes(station.id)
  );
  const isDropTarget =
    trainerDropTargetStationId === station.id && canAcceptMovingPerson;

  if (!editing && !trainerName && !traineeIds.length) {
    return null;
  }

  const placeTrainer = () => {
    if (!movingPerson) return;

    if (!canAcceptMovingPerson) {
      onTrainerDropRejected?.(station, movingPerson);
      return;
    }

    onTrainerDrop?.(station, movingPerson);
  };

  return (
    <div
      className={`map-trainer-zone${trainerName ? " has-trainer" : " is-empty"}${
        movingPerson ? " is-trainer-drop-option" : ""
      }${
        movingPerson && !canAcceptMovingPerson ? " is-trainer-drop-ineligible" : ""
      }${isDropTarget ? " is-trainer-drop-target" : ""}`}
      role={editing && movingPerson ? "button" : undefined}
      tabIndex={editing && movingPerson ? 0 : undefined}
      aria-label={
        editing && movingPerson
          ? `${station.name} trainer slot. ${
              canAcceptMovingPerson
                ? `Set ${movingPerson.name} as trainer`
                : `${movingPerson.name} is not certified to train this station`
            }`
          : undefined
      }
      onClick={(event) => {
        event.stopPropagation();
        if (editing && movingPerson) placeTrainer();
      }}
      onKeyDown={(event) => {
        if (
          !editing ||
          !movingPerson ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        placeTrainer();
      }}
      onDragEnter={(event) => {
        if (!editing || !movingPerson) return;
        event.preventDefault();
        event.stopPropagation();
        if (canAcceptMovingPerson) {
          onTrainerDropTargetChange?.(station.id);
        }
      }}
      onDragOver={(event) => {
        if (!editing || !movingPerson) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = canAcceptMovingPerson ? "move" : "none";
        if (canAcceptMovingPerson) {
          onTrainerDropTargetChange?.(station.id);
        }
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onTrainerDropTargetChange?.(null);
        }
      }}
      onDrop={(event) => {
        if (!editing || !movingPerson) return;
        event.preventDefault();
        event.stopPropagation();
        onTrainerDropTargetChange?.(null);
        placeTrainer();
      }}
    >
      <div className="map-trainer-zone-head">
        <span className="map-role-label map-role-trainer">Trainer</span>
        <small>
          {explicitTrainerId
            ? "Dedicated trainer"
            : editing
              ? "Drop certified floater"
              : "Trainer needed"}
        </small>
      </div>

      {trainerName ? (
        <div className="map-trainer-person">
          <span className="map-trainer-avatar" aria-hidden="true">
            {initialsOf(trainerName)}
          </span>
          <strong>{trainerName}</strong>
          {editing && explicitTrainerId && (
            <button
              type="button"
              className="map-trainer-remove"
              onClick={(event) => {
                event.stopPropagation();
                onSetTrainer?.(segment.key, station.id, null);
              }}
              aria-label={`Remove ${trainerName} as trainer from ${station.name}`}
              title="Remove trainer"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <span className="map-trainer-empty">
          {traineeIds.length
            ? "Trainer required"
            : "Drag a certified floater here"}
        </span>
      )}

      {movingPerson && editing && (
        <span
          className={`map-trainer-drop-cue${
            canAcceptMovingPerson ? " is-eligible" : ""
          }`}
          aria-hidden="true"
        >
          {canAcceptMovingPerson
            ? `Drop ${movingPerson.name.split(/\s+/)[0]} as trainer`
            : "Not certified to train here"}
        </span>
      )}
    </div>
  );
}

function ProcessCell({
  code,
  station,
  segment,
  stations,
  team,
  editing,
  onAssign,
  movingPersonId,
  dropTargetStationId,
  onFloaterDrop,
  onFloaterDropRejected,
  onDropTargetChange,
  trainerDropTargetStationId,
  onTrainerDrop,
  onTrainerDropRejected,
  onTrainerDropTargetChange,
  onSetTrainer,
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

  const movingPerson = movingPersonId
    ? team.find((person) => person.id === movingPersonId)
    : null;
  const canAcceptMovingPerson = Boolean(
    movingPerson &&
      movingPerson.role !== "tl" &&
      !movingPerson.pto &&
      movingPerson.certs.includes(station.id)
  );
  const isDropTarget =
    dropTargetStationId === station.id && canAcceptMovingPerson;

  const personId = segment?.assign?.[station.id];

  const personName = personId
    ? nameFor(team, personId)
    : null;

  const traineeIds = Array.isArray(
    segment?.training?.[station.id]
  )
    ? segment.training[station.id]
    : [];

  const trainees = traineeIds.map((traineeId) => ({
    id: traineeId,
    name: nameFor(team, traineeId),
  }));

  const hasTraining = trainees.length > 0;
  const explicitTrainerId = segment?.trainers?.[station.id] || null;
  const effectiveTrainerName = explicitTrainerId
    ? nameFor(team, explicitTrainerId)
    : null;
  const titleParts = [station.name];

  titleParts.push(
    personName ? `Assigned: ${personName}` : "Coverage required"
  );

  if (explicitTrainerId) {
    titleParts.push(`Trainer: ${effectiveTrainerName}`);
  } else if (hasTraining) {
    titleParts.push("Trainer required");
  }

  if (hasTraining) {
    titleParts.push(
      `Training: ${trainees
        .map((trainee) => trainee.name)
        .join(", ")}`
    );
  }

  const handleFloaterPlacement = () => {
    if (!movingPerson) return;

    if (!canAcceptMovingPerson) {
      onFloaterDropRejected?.(station, movingPerson);
      return;
    }

    onFloaterDrop?.(station, movingPerson);
  };

  const handleCellClick = (event) => {
    if (!movingPersonId) return;
    if (event.target.closest("select, button")) return;
    handleFloaterPlacement();
  };

  const handleCellKeyDown = (event) => {
    if (!movingPersonId || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    handleFloaterPlacement();
  };

  return (
    <div
      className={`map-process${zoneClass}${
        personName ? " is-staffed" : " is-open"
      }${hasTraining ? " has-training" : ""}${
        explicitTrainerId ? " has-dedicated-trainer" : ""
      }${editing ? " is-editing" : ""
      }${movingPerson ? " is-drop-option" : ""}${
        movingPerson && !canAcceptMovingPerson ? " is-drop-ineligible" : ""
      }${isDropTarget ? " is-drop-target" : ""}`}
      title={titleParts.join(" — ")}
      role={movingPersonId ? "button" : undefined}
      tabIndex={movingPersonId ? 0 : undefined}
      aria-label={
        movingPerson
          ? `${station.name}. ${
              canAcceptMovingPerson
                ? `Place ${movingPerson.name} here`
                : `${movingPerson.name} is not certified for this station`
            }`
          : undefined
      }
      onClick={handleCellClick}
      onKeyDown={handleCellKeyDown}
      onDragEnter={(event) => {
        if (!movingPersonId) return;
        event.preventDefault();
        if (canAcceptMovingPerson) onDropTargetChange?.(station.id);
      }}
      onDragOver={(event) => {
        if (!movingPersonId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = canAcceptMovingPerson ? "move" : "none";
        if (canAcceptMovingPerson) onDropTargetChange?.(station.id);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onDropTargetChange?.(null);
        }
      }}
      onDrop={(event) => {
        if (!movingPersonId) return;
        event.preventDefault();
        onDropTargetChange?.(null);
        handleFloaterPlacement();
      }}
    >
      {movingPerson && (
        <span
          className={`map-drop-hint${
            canAcceptMovingPerson ? " is-eligible" : ""
          }`}
          aria-hidden="true"
        >
          {canAcceptMovingPerson
            ? `Drop ${movingPerson.name.split(/\s+/)[0]}`
            : "Not certified"}
        </span>
      )}
      <div className="map-process-topline">
        <span className="map-code">{code}</span>

        <span className="map-process-name">
          {station.name}
        </span>
      </div>

      {editing ? (
        <div className="map-assignment-editor">
          <span className="map-role-label map-role-assigned">
            Station assignment
          </span>

          <AssignmentSelect
            station={station}
            segment={segment}
            stations={stations}
            team={team}
            onAssign={onAssign}
            compact
          />
        </div>
      ) : personName ? (
        <div className="map-assignee">
          <span
            className="map-avatar"
            aria-hidden="true"
          >
            {initialsOf(personName)}
          </span>

          <span className="map-person-copy">
            <small className="map-role-label map-role-assigned">
              Assigned
            </small>
            <strong>{personName}</strong>
          </span>
        </div>
      ) : (
        <span className="map-uncovered">Coverage required</span>
      )}

      <TrainerDropZone
        station={station}
        segment={segment}
        team={team}
        editing={editing}
        movingPersonId={movingPersonId}
        trainerDropTargetStationId={trainerDropTargetStationId}
        onTrainerDrop={onTrainerDrop}
        onTrainerDropRejected={onTrainerDropRejected}
        onTrainerDropTargetChange={onTrainerDropTargetChange}
        onSetTrainer={onSetTrainer}
      />

      {hasTraining && (
        <div
          className="map-training-group"
          aria-label={`Training at ${station.name}`}
        >
          <span className="map-role-label map-role-training">
            Training
          </span>

          <div className="map-training-list">
            {trainees.map((trainee) => (
              <span
                className="map-trainee"
                key={trainee.id}
              >
                <span
                  className="map-trainee-avatar"
                  aria-hidden="true"
                >
                  {initialsOf(trainee.name)}
                </span>

                <strong>{trainee.name}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapView({
  data,
  onGenerate,
  onStartManual,
  onAssign,
  onSetTrainer,
}) {
  const { stations, team, schedule } = data;

  const [segmentKey, setSegmentKey] =
    useState("q1");

  const [manualMode, setManualMode] =
    useState(false);

  const [draggedFloaterId, setDraggedFloaterId] =
    useState(null);

  const [selectedFloaterId, setSelectedFloaterId] =
    useState(null);

  const [dropTargetStationId, setDropTargetStationId] =
    useState(null);

  const [trainerDropTargetStationId, setTrainerDropTargetStationId] =
    useState(null);

  const [placementMessage, setPlacementMessage] =
    useState("");

  const [leverPull, setLeverPull] =
    useState(0);

  const [isLeverDragging, setIsLeverDragging] =
    useState(false);

  const [isSpinning, setIsSpinning] =
    useState(false);

  const [showCelebration, setShowCelebration] =
    useState(false);

  const rebuildTimers = useRef([]);
  const leverDrag = useRef({
    pointerId: null,
    startY: 0,
    pull: 0,
  });

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

  const trainingCount = segment
    ? Object.values(segment.training || {}).reduce(
        (total, personIds) =>
          total +
          (Array.isArray(personIds)
            ? personIds.length
            : 0),
        0
      )
    : 0;

  const trainerCount = segment
    ? Object.values(segment.trainers || {}).filter(Boolean).length
    : 0;

  const movingFloaterId = draggedFloaterId || selectedFloaterId;
  const movingFloater = movingFloaterId
    ? team.find((person) => person.id === movingFloaterId)
    : null;

  const placeFloaterAtStation = (station, person) => {
    if (!segment || !station || !person) return;

    onAssign(segment.key, station.id, person.id);
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setDropTargetStationId(null);
    setTrainerDropTargetStationId(null);
    setPlacementMessage(`${person.name} moved to ${station.name}.`);
  };

  const rejectFloaterAtStation = (station, person) => {
    if (!station || !person) return;
    setDropTargetStationId(null);
    setTrainerDropTargetStationId(null);
    setPlacementMessage(
      `${person.name} is not certified for ${station.name}.`
    );
  };

  const placeFloaterAsTrainer = (station, person) => {
    if (!segment || !station || !person) return;

    onSetTrainer(segment.key, station.id, person.id);
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setDropTargetStationId(null);
    setTrainerDropTargetStationId(null);
    setPlacementMessage(`${person.name} is now the trainer at ${station.name}.`);
  };

  const rejectFloaterAsTrainer = (station, person) => {
    if (!station || !person) return;
    setDropTargetStationId(null);
    setTrainerDropTargetStationId(null);
    setPlacementMessage(
      `${person.name} cannot train ${station.name} because they are not certified there.`
    );
  };

  const processProps = {
    segment,
    stations,
    team,
    editing: manualMode,
    onAssign,
    movingPersonId: movingFloaterId,
    dropTargetStationId,
    onFloaterDrop: placeFloaterAtStation,
    onFloaterDropRejected: rejectFloaterAtStation,
    onDropTargetChange: setDropTargetStationId,
    trainerDropTargetStationId,
    onTrainerDrop: placeFloaterAsTrainer,
    onTrainerDropRejected: rejectFloaterAsTrainer,
    onTrainerDropTargetChange: setTrainerDropTargetStationId,
    onSetTrainer,
  };

  useEffect(() => {
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setDropTargetStationId(null);
    setTrainerDropTargetStationId(null);
    setPlacementMessage("");
  }, [segment?.key]);

  useEffect(() => {
    return () => {
      rebuildTimers.current.forEach((timer) =>
        window.clearTimeout(timer)
      );
    };
  }, []);

  const clearRebuildTimers = () => {
    rebuildTimers.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    rebuildTimers.current = [];
  };

  const startJackpotRebuild = () => {
    if (isSpinning) return;

    const confirmed = window.confirm(
      "Rebuild the floor map? This will replace all current quarter assignments, including manual changes."
    );

    if (!confirmed) {
      setLeverPull(0);
      return;
    }

    clearRebuildTimers();
    setShowCelebration(false);
    setLeverPull(1);
    setIsSpinning(true);

    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    const reelDuration = reducedMotion ? 250 : 1900;

    rebuildTimers.current.push(
      window.setTimeout(() => {
        setLeverPull(0);
      }, reducedMotion ? 80 : 520)
    );

    rebuildTimers.current.push(
      window.setTimeout(() => {
        onGenerate();
        setManualMode(false);
        setIsSpinning(false);
        setShowCelebration(true);
      }, reelDuration)
    );

    rebuildTimers.current.push(
      window.setTimeout(() => {
        setShowCelebration(false);
      }, reelDuration + 3000)
    );
  };

  const beginLeverPull = (event) => {
    if (
      isSpinning ||
      (event.pointerType === "mouse" &&
        event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    leverDrag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      pull: 0,
    };

    setIsLeverDragging(true);
    setLeverPull(0);
  };

  const moveLever = (event) => {
    if (
      leverDrag.current.pointerId !==
      event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const distance = Math.max(
      0,
      event.clientY - leverDrag.current.startY
    );
    const pull = Math.min(
      1,
      distance / LEVER_PULL_DISTANCE
    );

    leverDrag.current.pull = pull;
    setLeverPull(pull);
  };

  const finishLeverPull = (event) => {
    if (
      leverDrag.current.pointerId !==
      event.pointerId
    ) {
      return;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    const shouldRebuild =
      leverDrag.current.pull >=
      LEVER_TRIGGER_POINT;

    leverDrag.current = {
      pointerId: null,
      startY: 0,
      pull: 0,
    };

    setIsLeverDragging(false);

    if (shouldRebuild) {
      startJackpotRebuild();
    } else {
      setLeverPull(0);
    }
  };

  const cancelLeverPull = (event) => {
    if (
      leverDrag.current.pointerId !==
      event.pointerId
    ) {
      return;
    }

    leverDrag.current = {
      pointerId: null,
      startY: 0,
      pull: 0,
    };

    setIsLeverDragging(false);
    setLeverPull(0);
  };

  const handleLeverKeyDown = (event) => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    event.preventDefault();
    startJackpotRebuild();
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
                Drag a floater onto a station body to assign production coverage,
                or drop them into the Trainer box to make them the dedicated trainer.
                Click-to-place still works as a fallback. Only certified trainer
                placements are accepted.
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
                processes staffed · {trainingCount}{" "}
                training · {trainerCount} dedicated trainer{trainerCount === 1 ? "" : "s"}
              </strong>
            </div>

            <div className="map-status-actions">
              <div
                className={`map-jackpot${
                  isLeverDragging
                    ? " is-dragging"
                    : ""
                }${
                  isSpinning ? " is-spinning" : ""
                }${
                  showCelebration
                    ? " is-celebrating"
                    : ""
                }`}
                style={{
                  "--lever-arm-height": `${
                    108 - leverPull * 68
                  }px`,
                  "--lever-knob-shift": `${
                    leverPull * 2
                  }px`,
                }}
              >
                <div className="map-jackpot-machine">
                  <div className="map-jackpot-display">
                    <div
                      className="map-jackpot-reels"
                      aria-hidden="true"
                    >
                      {JACKPOT_REELS.map(
                        (symbols, reelIndex) => (
                          <div
                            className={`map-jackpot-reel reel-${
                              reelIndex + 1
                            }`}
                            key={`reel-${reelIndex}`}
                          >
                            <div className="map-jackpot-reel-strip">
                              {symbols.map(
                                (symbol, symbolIndex) => (
                                  <span
                                    key={`${reelIndex}-${symbolIndex}`}
                                  >
                                    {symbol}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <strong
                      className="map-jackpot-message"
                      aria-live="polite"
                    >
                      {isSpinning
                        ? "Rebuilding..."
                        : showCelebration
                          ? "Jackpot!"
                          : "Pull lever down"}
                    </strong>
                  </div>

                  <button
                    className="map-jackpot-lever"
                    type="button"
                    title="Pull the gold lever downward to rebuild the floor map"
                    aria-label="Pull the gold lever downward to rebuild the floor map. Press Enter or Space as a keyboard alternative."
                    onPointerDown={beginLeverPull}
                    onPointerMove={moveLever}
                    onPointerUp={finishLeverPull}
                    onPointerCancel={cancelLeverPull}
                    onKeyDown={handleLeverKeyDown}
                    disabled={isSpinning}
                  >
                    <span className="map-jackpot-pivot" />
                    <span className="map-jackpot-arm">
                      <span className="map-jackpot-knob" />
                    </span>
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

          <section
            className={`map-support-row${additional.length ? "" : " is-single"}`}
          >
            <div className="map-support-card">
              <span className="section-kicker">
                Unassigned &amp; Available
              </span>

              <h3>
                {segment.label} Floaters
              </h3>

              <div className="map-floater-help">
                <span className="map-drag-icon" aria-hidden="true">↗</span>
                <span>
                  Drop on a station to assign coverage, or drop on its Trainer box
                  to assign a dedicated trainer. Click-to-place also works.
                </span>
              </div>

              <div
                className={`map-floater-list${movingFloaterId ? " has-selection" : ""}`}
              >
                {segment.float?.length ? (
                  segment.float.map((personId) => {
                    const personName = nameFor(team, personId);
                    const selected = movingFloaterId === personId;

                    return (
                      <button
                        className={`map-floater-chip${selected ? " is-selected" : ""}`}
                        key={personId}
                        type="button"
                        draggable
                        aria-pressed={selected}
                        title={`Drag ${personName} to a certified station`}
                        onClick={() => {
                          setDraggedFloaterId(null);
                          setDropTargetStationId(null);
                          setSelectedFloaterId((current) =>
                            current === personId ? null : personId
                          );
                          setPlacementMessage(
                            selected
                              ? "Placement selection cleared."
                              : `${personName} selected. Choose a highlighted station.`
                          );
                        }}
                        onDragStart={(event) => {
                          setSelectedFloaterId(null);
                          setDraggedFloaterId(personId);
                          setPlacementMessage(
                            `Moving ${personName}. Drop on a station for coverage or on a Trainer box.`
                          );
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", personId);
                        }}
                        onDragEnd={() => {
                          setDraggedFloaterId(null);
                          setDropTargetStationId(null);
                          setTrainerDropTargetStationId(null);
                        }}
                      >
                        <span className="map-floater-grip" aria-hidden="true">
                          ⋮⋮
                        </span>
                        <span className="mem-ini" aria-hidden="true">
                          {initialsOf(personName)}
                        </span>
                        <span className="mem-name">{personName}</span>
                        <span className="map-floater-action" aria-hidden="true">
                          Drag
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <span className="map-none">
                    All active members are assigned, training, or serving as trainers.
                  </span>
                )}
              </div>

              <div
                className="map-placement-message"
                aria-live="polite"
              >
                {placementMessage ||
                  (movingFloater
                    ? `${movingFloater.name} is ready to place.`
                    : "Drag a floater to a station for coverage or into a Trainer box.")}
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
                      const personName = personId
                        ? nameFor(team, personId)
                        : null;
                      const traineeIds = Array.isArray(
                        segment.training?.[station.id]
                      )
                        ? segment.training[station.id]
                        : [];
                      const hasTraining =
                        traineeIds.length > 0;

                      const movingPerson = movingFloaterId
                        ? team.find((person) => person.id === movingFloaterId)
                        : null;
                      const canAcceptMovingPerson = Boolean(
                        movingPerson &&
                          movingPerson.role !== "tl" &&
                          !movingPerson.pto &&
                          movingPerson.certs.includes(station.id)
                      );
                      const isDropTarget =
                        dropTargetStationId === station.id &&
                        canAcceptMovingPerson;

                      return (
                        <div
                          key={station.id}
                          className={`${
                            manualMode ? "is-editing " : ""
                          }${hasTraining ? "has-training " : ""}${
                            movingPerson ? "is-drop-option " : ""
                          }${
                            movingPerson && !canAcceptMovingPerson
                              ? "is-drop-ineligible "
                              : ""
                          }${isDropTarget ? "is-drop-target" : ""}`.trim()}
                          role={movingPerson ? "button" : undefined}
                          tabIndex={movingPerson ? 0 : undefined}
                          onClick={(event) => {
                            if (!movingPerson || event.target.closest("select, button")) {
                              return;
                            }
                            if (canAcceptMovingPerson) {
                              placeFloaterAtStation(station, movingPerson);
                            } else {
                              rejectFloaterAtStation(station, movingPerson);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (
                              !movingPerson ||
                              (event.key !== "Enter" && event.key !== " ")
                            ) {
                              return;
                            }
                            event.preventDefault();
                            if (canAcceptMovingPerson) {
                              placeFloaterAtStation(station, movingPerson);
                            } else {
                              rejectFloaterAtStation(station, movingPerson);
                            }
                          }}
                          onDragEnter={(event) => {
                            if (!movingPerson) return;
                            event.preventDefault();
                            if (canAcceptMovingPerson) {
                              setDropTargetStationId(station.id);
                            }
                          }}
                          onDragOver={(event) => {
                            if (!movingPerson) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect =
                              canAcceptMovingPerson ? "move" : "none";
                            if (canAcceptMovingPerson) {
                              setDropTargetStationId(station.id);
                            }
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              setDropTargetStationId(null);
                            }
                          }}
                          onDrop={(event) => {
                            if (!movingPerson) return;
                            event.preventDefault();
                            setDropTargetStationId(null);
                            if (canAcceptMovingPerson) {
                              placeFloaterAtStation(station, movingPerson);
                            } else {
                              rejectFloaterAtStation(station, movingPerson);
                            }
                          }}
                        >
                          <span>
                            {station.name}
                          </span>

                          <div className="map-additional-assignment">
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
                                {personName || "Coverage required"}
                              </strong>
                            )}

                            <TrainerDropZone
                              station={station}
                              segment={segment}
                              team={team}
                              editing={manualMode}
                              movingPersonId={movingFloaterId}
                              trainerDropTargetStationId={trainerDropTargetStationId}
                              onTrainerDrop={placeFloaterAsTrainer}
                              onTrainerDropRejected={rejectFloaterAsTrainer}
                              onTrainerDropTargetChange={setTrainerDropTargetStationId}
                              onSetTrainer={onSetTrainer}
                            />

                            {hasTraining && (
                              <div className="map-additional-training">
                                <span className="map-role-label map-role-training">
                                  Training
                                </span>
                                <strong>
                                  {traineeIds
                                    .map((traineeId) =>
                                      nameFor(
                                        team,
                                        traineeId
                                      )
                                    )
                                    .join(", ")}
                                </strong>
                              </div>
                            )}
                          </div>
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
