// ---------------------------------------------------------------------------
//  Scheduling engine
//
//  Given the stations (in priority order) and the team (with certifications and
//  PTO status), build a schedule across the day's segments — four quarters and
//  an overtime period — such that:
//    - anyone on PTO is left out entirely
//    - only certified people are placed on a station
//    - nobody is placed on two processes in the same segment
//    - EVERY station that can be covered by a free, certified person IS covered
//      (this is a maximum bipartite matching via augmenting paths, so the
//       backfill is optimal — not just greedy)
//    - each later segment tries to move each person to a different station than
//      the segment before it, then backfills any station still empty
//    - anyone left over in a segment is listed as a floater (extra coverage)
//
//  Each automatic build reshuffles the order, so pressing Generate again gives
//  a fresh mix. A blank manual plan can also be created and filled by hand.
// ---------------------------------------------------------------------------

export const SCHEDULE_SEGMENTS = [
  { key: "q1", label: "Q1", full: "1st Quarter" },
  { key: "q2", label: "Q2", full: "2nd Quarter" },
  { key: "q3", label: "Q3", full: "3rd Quarter" },
  { key: "q4", label: "Q4", full: "4th Quarter" },
  { key: "ot", label: "OT", full: "Overtime" },
];

function activeProductionTeam(team) {
  return team.filter((person) => !person.pto && person.role !== "tl");
}

function scheduleStats(stations, team) {
  return {
    nS: stations.length,
    working: activeProductionTeam(team).length,
    pto: team.filter((person) => person.pto).length,
    leaders: team.filter((person) => !person.pto && person.role === "tl").length,
  };
}

export function createEmptySchedule(stations, team) {
  const active = activeProductionTeam(team);
  const float = active.map((person) => person.id);

  return {
    generatedAt: Date.now(),
    mode: "manual",
    segments: SCHEDULE_SEGMENTS.map((segment) => ({
      ...segment,
      assign: Object.fromEntries(stations.map((station) => [station.id, null])),
      float: [...float],
      filled: 0,
      manuallyEdited: false,
    })),
    stats: scheduleStats(stations, team),
  };
}

// Fisher–Yates shuffle of [0..n-1].
function shuffled(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Augmenting-path assignment: try to seat a person on station `st`, re-routing
// existing assignments if that frees up coverage. `matchP[person] = station`.
function tryAssign(st, matchP, visited, can, order) {
  for (let k = 0; k < order.length; k++) {
    const p = order[k];
    if (can[p][st] && !visited[p]) {
      visited[p] = true;
      if (
        matchP[p] === -1 ||
        tryAssign(matchP[p], matchP, visited, can, order)
      ) {
        matchP[p] = st;
        return true;
      }
    }
  }
  return false;
}

export function generateSchedule(stations, team) {
  const active = activeProductionTeam(team);
  const nS = stations.length;
  const nP = active.length;

  const can = active.map((person) => {
    const certSet = new Set(person.certs);
    return stations.map((station) => certSet.has(station.id));
  });

  const segments = [];
  let prevMatch = null;

  for (const seg of SCHEDULE_SEGMENTS) {
    const match = new Array(nP).fill(-1);
    const order = shuffled(nP);

    if (prevMatch) {
      const canDiff = active.map((_, personIndex) =>
        stations.map(
          (__, stationIndex) =>
            can[personIndex][stationIndex] &&
            prevMatch[personIndex] !== stationIndex
        )
      );
      for (let stationIndex = 0; stationIndex < nS; stationIndex++) {
        tryAssign(
          stationIndex,
          match,
          new Array(nP).fill(false),
          canDiff,
          order
        );
      }
      for (let stationIndex = 0; stationIndex < nS; stationIndex++) {
        if (!match.includes(stationIndex)) {
          tryAssign(
            stationIndex,
            match,
            new Array(nP).fill(false),
            can,
            order
          );
        }
      }
    } else {
      for (let stationIndex = 0; stationIndex < nS; stationIndex++) {
        tryAssign(
          stationIndex,
          match,
          new Array(nP).fill(false),
          can,
          order
        );
      }
    }

    const assign = {};
    const personByStation = new Array(nS).fill(null);
    for (let personIndex = 0; personIndex < nP; personIndex++) {
      if (match[personIndex] >= 0) {
        personByStation[match[personIndex]] = active[personIndex].id;
      }
    }
    stations.forEach((station, index) => {
      assign[station.id] = personByStation[index];
    });

    const float = [];
    active.forEach((person, index) => {
      if (match[index] < 0) float.push(person.id);
    });

    segments.push({
      key: seg.key,
      label: seg.label,
      full: seg.full,
      assign,
      float,
      filled: personByStation.filter(Boolean).length,
      manuallyEdited: false,
    });

    prevMatch = match;
  }

  return {
    generatedAt: Date.now(),
    mode: "automatic",
    segments,
    stats: scheduleStats(stations, team),
  };
}
