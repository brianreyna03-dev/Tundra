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
//  Each call reshuffles the order, so pressing Generate again gives a fresh mix.
// ---------------------------------------------------------------------------

// The staffed segments of the day, in order. Overtime is treated like a
// quarter (same rules); change `full`/`label` here to relabel the board.
export const SCHEDULE_SEGMENTS = [
  { key: "q1", label: "Q1", full: "1st Quarter" },
  { key: "q2", label: "Q2", full: "2nd Quarter" },
  { key: "q3", label: "Q3", full: "3rd Quarter" },
  { key: "q4", label: "Q4", full: "4th Quarter" },
  { key: "ot", label: "OT", full: "Overtime" },
];

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
  const active = team.filter((p) => !p.pto);
  const nS = stations.length;
  const nP = active.length;
  const ptoCount = team.length - nP;

  // certification matrix: can[personIndex][stationIndex]
  const can = active.map((p) => {
    const certSet = new Set(p.certs);
    return stations.map((s) => certSet.has(s.id));
  });

  const segments = [];
  let prevMatch = null; // person->station from the previous segment

  for (const seg of SCHEDULE_SEGMENTS) {
    const match = new Array(nP).fill(-1);
    const order = shuffled(nP);

    if (prevMatch) {
      // Pass 1: prefer a station different from this person's previous segment.
      const canDiff = active.map((_, pi) =>
        stations.map((__, si) => can[pi][si] && prevMatch[pi] !== si)
      );
      for (let s = 0; s < nS; s++) {
        tryAssign(s, match, new Array(nP).fill(false), canDiff, order);
      }
      // Pass 2: any station still empty gets filled even if it means a repeat.
      for (let s = 0; s < nS; s++) {
        if (!match.includes(s)) {
          tryAssign(s, match, new Array(nP).fill(false), can, order);
        }
      }
    } else {
      // First segment: fill every station possible.
      for (let s = 0; s < nS; s++) {
        tryAssign(s, match, new Array(nP).fill(false), can, order);
      }
    }

    // invert person->station into station->personId
    const assign = {};
    const personByStation = new Array(nS).fill(null);
    for (let p = 0; p < nP; p++) {
      if (match[p] >= 0) personByStation[match[p]] = active[p].id;
    }
    stations.forEach((s, i) => {
      assign[s.id] = personByStation[i];
    });

    const float = [];
    active.forEach((p, i) => {
      if (match[i] < 0) float.push(p.id);
    });

    segments.push({
      key: seg.key,
      label: seg.label,
      full: seg.full,
      assign,
      float,
      filled: personByStation.filter(Boolean).length,
    });

    prevMatch = match;
  }

  return {
    generatedAt: Date.now(),
    segments,
    stats: {
      nS,
      working: nP,
      pto: ptoCount,
    },
  };
}
