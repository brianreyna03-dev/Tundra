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

function TrainingPairBox({
  station,
  segment,
  team,
  movingPersonId,
  trainingDropTargetStationId,
  onTrainingDrop,
  onTrainingDropTargetChange,
  onSetTraining,
}) {
  const trainerId = segment?.assign?.[station.id] || null;
  const trainerName = trainerId ? nameFor(team, trainerId) : null;
  const traineeIds = Array.isArray(segment?.training?.[station.id])
    ? segment.training[station.id]
    : [];

  const movingPerson = movingPersonId
    ? team.find((person) => person.id === movingPersonId)
    : null;
  const canAcceptAsTrainee = Boolean(
    movingPerson && movingPerson.role !== "tl" && !movingPerson.pto
  );
  const isTrainingDropTarget =
    trainingDropTargetStationId === station.id && canAcceptAsTrainee;

  const placeTrainee = () => {
    if (!movingPerson || !canAcceptAsTrainee) return;
    onTrainingDrop?.(station, movingPerson);
  };

  return (
    <div
      className={`map-training-card${traineeIds.length ? " has-trainees" : ""}${
        movingPerson ? " is-training-drag-active" : ""
      }${isTrainingDropTarget ? " is-trainee-drop-target" : ""}`}
    >
      <div className="map-training-card-head">
        <span>Training</span>
        <small>
          {traineeIds.length
            ? `${traineeIds.length} trainee${traineeIds.length === 1 ? "" : "s"}`
            : "Ready for trainee"}
        </small>
      </div>

      <div className="map-training-person-block map-training-trainer-block">
        <span className="map-training-pair-label">Trainer</span>
        {trainerName ? (
          <strong className="map-training-full-name">{trainerName}</strong>
        ) : (
          <span className="map-training-missing">
            {traineeIds.length ? "Trainer required" : "No assigned operator"}
          </span>
        )}
      </div>

      <div
        className={`map-training-person-block map-training-trainee-block${
          movingPerson ? " is-trainee-drop-option" : ""
        }${isTrainingDropTarget ? " is-trainee-drop-target" : ""}`}
        role={movingPerson ? "button" : undefined}
        tabIndex={movingPerson ? 0 : undefined}
        aria-label={
          movingPerson
            ? `Add ${movingPerson.name} as a trainee at ${station.name}`
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          if (movingPerson) placeTrainee();
        }}
        onKeyDown={(event) => {
          if (!movingPerson || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          placeTrainee();
        }}
        onDragEnter={(event) => {
          if (!movingPerson) return;
          event.preventDefault();
          event.stopPropagation();
          onTrainingDropTargetChange?.(station.id);
        }}
        onDragOver={(event) => {
          if (!movingPerson) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          onTrainingDropTargetChange?.(station.id);
        }}
        onDragLeave={(event) => {
          event.stopPropagation();
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onTrainingDropTargetChange?.(null);
          }
        }}
        onDrop={(event) => {
          if (!movingPerson) return;
          event.preventDefault();
          event.stopPropagation();
          onTrainingDropTargetChange?.(null);
          placeTrainee();
        }}
      >
        <span className="map-training-pair-label">Trainee</span>

        {traineeIds.length ? (
          <div className="map-training-full-name-list">
            {traineeIds.map((traineeId) => {
              const traineeName = nameFor(team, traineeId);
              return (
                <div className="map-training-full-name-row" key={traineeId}>
                  <strong className="map-training-full-name">{traineeName}</strong>
                  {onSetTraining && (
                    <button
                      type="button"
                      className="map-trainee-remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSetTraining?.(
                          segment.key,
                          station.id,
                          traineeId,
                          false
                        );
                      }}
                      aria-label={`Remove ${traineeName} from training at ${station.name}`}
                      title="Remove trainee"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span className="map-training-pair-empty">
            {movingPerson ? `Drop ${movingPerson.name} here` : "Drop any floater here to train"}
          </span>
        )}
      </div>
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
  trainingDropTargetStationId,
  onTrainingDrop,
  onTrainingDropTargetChange,
  onSetTraining,
  kind = "station",
  zone,
}) {
  const zoneClass = zone ? ` map-zone-${zone}` : "";

  if (kind === "blocked") {
    return (
      <div className={`map-process map-process-blocked${zoneClass}`} aria-label={code}>
        <span className="map-code">{code}</span>
        <span className="map-special-copy">Restricted area</span>
      </div>
    );
  }

  if (kind === "buffer" || kind === "empty") {
    return (
      <div className={`map-process map-process-${kind}${zoneClass}`} aria-label={code}>
        <span className="map-code map-special-label">{code}</span>
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
        <span className="map-special-copy">Open map location</span>
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
  const personName = personId ? nameFor(team, personId) : null;
  const traineeIds = Array.isArray(segment?.training?.[station.id])
    ? segment.training[station.id]
    : [];
  const trainees = traineeIds.map((traineeId) => ({
    id: traineeId,
    name: nameFor(team, traineeId),
  }));
  const hasTraining = trainees.length > 0;
  const titleParts = [station.name];

  titleParts.push(personName ? `Assigned: ${personName}` : "Coverage required");
  if (hasTraining) {
    titleParts.push(personName ? `Trainer: ${personName}` : "Trainer required");
    titleParts.push(`Training: ${trainees.map((trainee) => trainee.name).join(", ")}`);
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
    if (event.target.closest("select, button, .map-training-card")) return;
    handleFloaterPlacement();
  };

  const handleCellKeyDown = (event) => {
    if (!movingPersonId || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    handleFloaterPlacement();
  };

  return (
    <div
      className={`map-process${zoneClass}${personName ? " is-staffed" : " is-open"}${
        hasTraining ? " has-training" : ""
      }${editing ? " is-editing" : ""}${
        movingPerson ? " is-drop-option has-trainee-drop-option" : ""
      }${movingPerson && !canAcceptMovingPerson ? " is-drop-ineligible" : ""}${
        isDropTarget ? " is-drop-target" : ""
      }`}
      title={titleParts.join(" — ")}
      role={movingPersonId ? "button" : undefined}
      tabIndex={movingPersonId ? 0 : undefined}
      aria-label={
        movingPerson
          ? `${station.name}. ${
              canAcceptMovingPerson
                ? `Place ${movingPerson.name} here for production coverage`
                : `${movingPerson.name} is not certified for production coverage here; use the Trainee box to train`
            }`
          : undefined
      }
      onClick={handleCellClick}
      onKeyDown={handleCellKeyDown}
      onDragEnter={(event) => {
        if (!movingPersonId || event.target.closest(".map-training-card")) return;
        event.preventDefault();
        if (canAcceptMovingPerson) onDropTargetChange?.(station.id);
      }}
      onDragOver={(event) => {
        if (!movingPersonId || event.target.closest(".map-training-card")) return;
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
        if (!movingPersonId || event.target.closest(".map-training-card")) return;
        event.preventDefault();
        onDropTargetChange?.(null);
        handleFloaterPlacement();
      }}
    >
      {movingPerson && (
        <span
          className={`map-drop-hint${canAcceptMovingPerson ? " is-eligible" : ""}`}
          aria-hidden="true"
        >
          {canAcceptMovingPerson
            ? `Drop ${movingPerson.name.split(/\s+/)[0]} to work`
            : "Training still available"}
        </span>
      )}

      <div className="map-process-topline">
        <span className="map-code">{code}</span>
        <span className="map-process-name">{station.name}</span>
      </div>

      {editing ? (
        <div className="map-assignment-editor">
          <span className="map-role-label map-role-assigned">Station assignment</span>
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
          <span className="map-avatar" aria-hidden="true">
            {initialsOf(personName)}
          </span>
          <span className="map-person-copy">
            <small className="map-role-label map-role-assigned">Assigned</small>
            <strong>{personName}</strong>
          </span>
        </div>
      ) : (
        <span className="map-uncovered">Coverage required</span>
      )}

      <TrainingPairBox
        station={station}
        segment={segment}
        team={team}
        movingPersonId={movingPersonId}
        trainingDropTargetStationId={trainingDropTargetStationId}
        onTrainingDrop={onTrainingDrop}
        onTrainingDropTargetChange={onTrainingDropTargetChange}
        onSetTraining={onSetTraining}
      />
    </div>
  );
}

export default function MapView({
  data,
  onGenerate,
  onStartManual,
  onAssign,
  onSetTraining,
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


  const [trainingDropTargetStationId, setTrainingDropTargetStationId] =
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

  /* Team Leader Zone 2: PM 3 + PM 4. Team Leader Zone 3: PM 1 + PM 2. */
  const pmSlots = [4, 3, 2, 1].map(
    (number) => ({
      code: `PM ${number}`,
      station: stationFor(`pm${number}`),
      zone:
        number >= 3 ? "zone2a" : "zone2b",
    })
  );

  /* Team Leader Zone 2: Sub 6. Team Leader Zone 4: Sub 1 through Sub 5. */
  const subSlots = [6, 5, 4, 3, 2, 1].map(
    (number) => ({
      code: `Sub ${number}`,
      station: stationFor(`sub${number}`),
      zone:
        number === 6 ? "zone2a" : "zone3",
    })
  );

  /* Team Leader Zone 2: ST 4-7. Team Leader Zone 3: ST 8-11. */
  const mainTop = [
    4, 5, 6, 7, 8, 9, 10, 11,
  ].map((number) => ({
    code: `ST ${number}`,
    station: stationFor(`st${number}`),
    zone:
      number <= 7 ? "zone2a" : "zone2b",
  }));

  /* Team Leader Zone 1: ST 3, ST 2, ST 1, ST 12 + Kick Out. */
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

  const movingFloaterId = draggedFloaterId || selectedFloaterId;
  const movingFloater = movingFloaterId
    ? team.find((person) => person.id === movingFloaterId)
    : null;

  const placeFloaterAtStation = (station, person) => {
    if (!segment || !station || !person) return;

    onAssign(segment.key, station.id, person.id);
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setCoverageDropTarget(null);
    setTrainingDropTargetStationId(null);
    setPlacementMessage(`${person.name} moved to ${station.name}.`);
  };

  const rejectFloaterAtStation = (station, person) => {
    if (!station || !person) return;
    setCoverageDropTarget(null);
    setTrainingDropTargetStationId(null);
    setPlacementMessage(
      `${person.name} is not certified for ${station.name}.`
    );
  };


  const placeFloaterAsTrainee = (station, person) => {
    if (!segment || !station || !person) return;

    onSetTraining(segment.key, station.id, person.id, true);
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setCoverageDropTarget(null);
    setTrainingDropTargetStationId(null);
    setPlacementMessage(`${person.name} is now training at ${station.name}.`);
  };

  const setCoverageDropTarget = (stationId) => {
    setDropTargetStationId(stationId);
    if (stationId) {
        setTrainingDropTargetStationId(null);
    }
  };


  const setTrainingDropTarget = (stationId) => {
    setTrainingDropTargetStationId(stationId);
    if (stationId) {
      setCoverageDropTarget(null);
      }
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
    onDropTargetChange: setCoverageDropTarget,
    trainingDropTargetStationId,
    onTrainingDrop: placeFloaterAsTrainee,
    onTrainingDropTargetChange: setTrainingDropTarget,
    onSetTraining,
  };

  useEffect(() => {
    setDraggedFloaterId(null);
    setSelectedFloaterId(null);
    setCoverageDropTarget(null);
    setTrainingDropTargetStationId(null);
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
                Drag a floater onto a station body for production coverage, or onto
                the Trainee area to train them at any station. Production coverage
                requires certification; training does not. The assigned operator is
                automatically the trainer.
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
                training
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
                  Drop on a station body for certified production coverage, or
                  drop on the Trainee area to train at any station. The assigned
                  operator is automatically the trainer.
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
                        title={`Drag ${personName} to work or train`}
                        onClick={() => {
                          setDraggedFloaterId(null);
                          setCoverageDropTarget(null);
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
                            `Moving ${personName}. Drop on a station body for coverage or the Trainee area to train.`
                          );
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", personId);
                        }}
                        onDragEnd={() => {
                          setDraggedFloaterId(null);
                          setCoverageDropTarget(null);
                                                setTrainingDropTargetStationId(null);
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
                    All active members are assigned or training.
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
                    : "Drag a floater to a station body for coverage or the Trainee area to train.")}
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
                            movingPerson ? "is-drop-option has-trainee-drop-option " : ""
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
                              setCoverageDropTarget(station.id);
                            }
                          }}
                          onDragOver={(event) => {
                            if (!movingPerson) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect =
                              canAcceptMovingPerson ? "move" : "none";
                            if (canAcceptMovingPerson) {
                              setCoverageDropTarget(station.id);
                            }
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              setCoverageDropTarget(null);
                            }
                          }}
                          onDrop={(event) => {
                            if (!movingPerson) return;
                            event.preventDefault();
                            setCoverageDropTarget(null);
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
                            <TrainingPairBox
                              station={station}
                              segment={segment}
                              team={team}
                              movingPersonId={movingFloaterId}
                              trainingDropTargetStationId={trainingDropTargetStationId}
                              onTrainingDrop={placeFloaterAsTrainee}
                              onTrainingDropTargetChange={setTrainingDropTarget}
                              onSetTraining={onSetTraining}
                            />

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
