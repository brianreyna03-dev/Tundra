import { nameFor } from "../lib/util.js";

export default function AssignmentSelect({
  station,
  segment,
  stations,
  team,
  onAssign,
  compact = false,
}) {
  const currentId = segment?.assign?.[station.id] || "";
  const currentPerson = currentId
    ? team.find((person) => person.id === currentId)
    : null;

  const assignedStationByPerson = new Map();
  Object.entries(segment?.assign || {}).forEach(([stationId, personId]) => {
    if (personId) assignedStationByPerson.set(personId, stationId);
  });
  const stationNameById = new Map(
    stations.map((candidate) => [candidate.id, candidate.name])
  );

  const eligible = team
    .filter((person) => person.role !== "tl")
    .filter((person) => !person.pto)
    .filter((person) => person.certs.includes(station.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const eligibleIds = new Set(eligible.map((person) => person.id));
  const options =
    currentPerson && !eligibleIds.has(currentPerson.id)
      ? [currentPerson, ...eligible]
      : eligible;

  const currentName = currentId ? nameFor(team, currentId) : "Coverage required";

  return (
    <label
      className={`assignment-select-wrap${compact ? " is-compact" : ""}`}
      title="Selecting a member who is already assigned in this quarter moves them to this station."
    >
      <span className="sr-only">
        Assign a team member to {station.name} for {segment?.label || "this quarter"}
      </span>
      <select
        className="assignment-select"
        value={currentId}
        onChange={(event) =>
          onAssign(segment.key, station.id, event.target.value || null)
        }
      >
        <option value="">Coverage required</option>
        {options.map((person) => {
          const assignedStationId = assignedStationByPerson.get(person.id);
          const movingFrom =
            assignedStationId && assignedStationId !== station.id
              ? stationNameById.get(assignedStationId)
              : null;
          const unavailable =
            person.pto ||
            person.role === "tl" ||
            !person.certs.includes(station.id);

          let suffix = "";
          if (movingFrom) suffix = ` — move from ${movingFrom}`;
          else if (unavailable) suffix = " — currently unavailable";

          return (
            <option
              key={person.id}
              value={person.id}
              disabled={unavailable && person.id !== currentId}
            >
              {person.name}{suffix}
            </option>
          );
        })}
      </select>
      <span className="assignment-print-value">
        {currentName}
      </span>
    </label>
  );
}
