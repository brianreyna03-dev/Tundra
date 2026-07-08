import { useReducer, useEffect, useMemo, useState } from "react";
import { uid } from "../lib/util.js";
import { loadData, saveData } from "../lib/storage.js";
import { exampleData } from "../lib/example.js";
import { generateSchedule } from "../lib/scheduler.js";

// Coerce any loaded/imported object into a clean, well-formed state.
// Certifications are pruned to stations that actually exist.
function normalize(d) {
  const data = d || {};
  const stations = (data.stations || []).map((s) => ({
    id: s.id || uid(),
    name: String(s.name ?? "Untitled"),
    category: s.category || "Stations",
  }));
  const validIds = new Set(stations.map((s) => s.id));
  const team = (data.team || []).map((p) => ({
    id: p.id || uid(),
    name: String(p.name ?? "Unnamed"),
    pto: !!p.pto,
    certs: Array.isArray(p.certs) ? p.certs.filter((c) => validIds.has(c)) : [],
  }));
  // Only keep a schedule that matches the current segment-based shape; an older
  // saved schedule (e.g. the previous two-half format) is dropped so it can be
  // rebuilt cleanly rather than rendered against the new board.
  const schedule =
    data.schedule && Array.isArray(data.schedule.segments)
      ? data.schedule
      : null;
  return { stations, team, schedule };
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_PERSON":
      return {
        ...state,
        team: [
          ...state.team,
          { id: uid(), name: action.name, pto: false, certs: [] },
        ],
      };

    case "REMOVE_PERSON":
      return { ...state, team: state.team.filter((p) => p.id !== action.id) };

    case "RENAME_PERSON":
      return {
        ...state,
        team: state.team.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      };

    case "SET_PTO":
      return {
        ...state,
        team: state.team.map((p) =>
          p.id === action.id ? { ...p, pto: action.pto } : p
        ),
      };

    case "TOGGLE_CERT":
      return {
        ...state,
        team: state.team.map((p) => {
          if (p.id !== action.personId) return p;
          const has = p.certs.includes(action.stationId);
          return {
            ...p,
            certs: has
              ? p.certs.filter((c) => c !== action.stationId)
              : [...p.certs, action.stationId],
          };
        }),
      };

    case "SET_CATEGORY_CERTS": {
      const ids = state.stations
        .filter((s) => s.category === action.category)
        .map((s) => s.id);
      const idSet = new Set(ids);
      return {
        ...state,
        team: state.team.map((p) => {
          if (p.id !== action.personId) return p;
          const rest = p.certs.filter((c) => !idSet.has(c));
          return { ...p, certs: action.on ? [...rest, ...ids] : rest };
        }),
      };
    }

    case "ADD_STATION":
      return {
        ...state,
        stations: [
          ...state.stations,
          { id: uid(), name: action.name, category: action.category },
        ],
      };

    case "REMOVE_STATION":
      return {
        ...state,
        stations: state.stations.filter((s) => s.id !== action.id),
        team: state.team.map((p) => ({
          ...p,
          certs: p.certs.filter((c) => c !== action.id),
        })),
      };

    case "RENAME_STATION":
      return {
        ...state,
        stations: state.stations.map((s) =>
          s.id === action.id ? { ...s, name: action.name } : s
        ),
      };

    case "MOVE_STATION": {
      // move a station up/down within its own category (priority order)
      const stations = [...state.stations];
      const s = stations.find((x) => x.id === action.id);
      if (!s) return state;
      const sameCat = stations.filter((x) => x.category === s.category);
      const pos = sameCat.indexOf(s);
      const swap = sameCat[pos + action.dir];
      if (!swap) return state;
      const iA = stations.indexOf(s);
      const iB = stations.indexOf(swap);
      [stations[iA], stations[iB]] = [stations[iB], stations[iA]];
      return { ...state, stations };
    }

    case "SET_SCHEDULE":
      return { ...state, schedule: action.schedule };

    case "LOAD_DATA":
      return normalize(action.data);

    default:
      return state;
  }
}

export function useShiftData() {
  const [storageOK, setStorageOK] = useState(true);

  // Lazy initial state: load from storage, or fall back to the example roster.
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadData();
    return normalize(loaded || exampleData());
  });

  // Persist on every change.
  useEffect(() => {
    if (!saveData(state)) setStorageOK(false);
  }, [state]);

  const actions = useMemo(
    () => ({
      addPerson: (name) => dispatch({ type: "ADD_PERSON", name }),
      removePerson: (id) => dispatch({ type: "REMOVE_PERSON", id }),
      renamePerson: (id, name) => dispatch({ type: "RENAME_PERSON", id, name }),
      setPTO: (id, pto) => dispatch({ type: "SET_PTO", id, pto }),
      toggleCert: (personId, stationId) =>
        dispatch({ type: "TOGGLE_CERT", personId, stationId }),
      setCategoryCerts: (personId, category, on) =>
        dispatch({ type: "SET_CATEGORY_CERTS", personId, category, on }),
      addStation: (name, category) =>
        dispatch({ type: "ADD_STATION", name, category }),
      removeStation: (id) => dispatch({ type: "REMOVE_STATION", id }),
      renameStation: (id, name) =>
        dispatch({ type: "RENAME_STATION", id, name }),
      moveStation: (id, dir) => dispatch({ type: "MOVE_STATION", id, dir }),
      generate: () =>
        dispatch({
          type: "SET_SCHEDULE",
          schedule: generateSchedule(state.stations, state.team),
        }),
      loadData: (data) => dispatch({ type: "LOAD_DATA", data }),
    }),
    // generate() reads the current stations/team, so refresh when they change
    [state.stations, state.team]
  );

  return { data: state, actions, storageOK };
}
