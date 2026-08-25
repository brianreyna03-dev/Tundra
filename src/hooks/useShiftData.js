import { useReducer, useEffect, useMemo, useState } from "react";
import { uid } from "../lib/util.js";
import { loadData, saveData } from "../lib/storage.js";
import { exampleData } from "../lib/example.js";
import {
  createEmptySchedule,
  generateSchedule,
} from "../lib/scheduler.js";
import { TL_ZONE_KEYS } from "../lib/teamLeaders.js";

function normalizePersonName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function personNameKey(name) {
  return normalizePersonName(name).toLocaleLowerCase();
}

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

// Keep a saved or manually edited plan valid after attendance, role,
// certification, roster, or station changes. Valid assignments are preserved;
// invalid ones are cleared and the floater list is rebuilt.
function reconcileSchedule(schedule, stations, team) {
  if (!schedule || !Array.isArray(schedule.segments)) return null;

  const active = activeProductionTeam(team);
  const activeById = new Map(active.map((person) => [person.id, person]));

  const segments = schedule.segments.map((segment) => {
    const assign = {};
    const usedPeople = new Set();

    stations.forEach((station) => {
      const personId = segment.assign?.[station.id] || null;
      const person = personId ? activeById.get(personId) : null;
      const valid =
        person &&
        person.certs.includes(station.id) &&
        !usedPeople.has(person.id);

      assign[station.id] = valid ? person.id : null;
      if (valid) usedPeople.add(person.id);
    });

    const trainers = {};
    const trainerPeople = new Set();

    stations.forEach((station) => {
      const personId = segment.trainers?.[station.id] || null;
      const person = personId ? activeById.get(personId) : null;
      const valid =
        person &&
        person.certs.includes(station.id) &&
        !usedPeople.has(person.id) &&
        !trainerPeople.has(person.id);

      trainers[station.id] = valid ? person.id : null;
      if (valid) trainerPeople.add(person.id);
    });

    const training = {};
    const trainingPeople = new Set();

    stations.forEach((station) => {
      const requested = Array.isArray(segment.training?.[station.id])
        ? segment.training[station.id]
        : [];

      training[station.id] = requested.filter((personId) => {
        const valid =
          activeById.has(personId) &&
          !usedPeople.has(personId) &&
          !trainerPeople.has(personId) &&
          !trainingPeople.has(personId);

        if (valid) trainingPeople.add(personId);
        return valid;
      });
    });

    return {
      ...segment,
      assign,
      training,
      trainers,
      float: active
        .filter(
          (person) =>
            !usedPeople.has(person.id) &&
            !trainerPeople.has(person.id) &&
            !trainingPeople.has(person.id)
        )
        .map((person) => person.id),
      filled: usedPeople.size,
    };
  });

  return {
    ...schedule,
    segments,
    stats: scheduleStats(stations, team),
  };
}

function assignPerson(schedule, stations, team, segmentKey, stationId, personId) {
  if (!schedule || !Array.isArray(schedule.segments)) return schedule;

  const station = stations.find((candidate) => candidate.id === stationId);
  if (!station) return schedule;

  const active = activeProductionTeam(team);
  const person = personId
    ? active.find((candidate) => candidate.id === personId)
    : null;

  if (personId && (!person || !person.certs.includes(stationId))) {
    return schedule;
  }

  const segments = schedule.segments.map((segment) => {
    if (segment.key !== segmentKey) return segment;

    const assign = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.assign?.[candidate.id] || null,
      ])
    );
    const training = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        Array.isArray(segment.training?.[candidate.id])
          ? [...segment.training[candidate.id]]
          : [],
      ])
    );
    const trainers = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.trainers?.[candidate.id] || null,
      ])
    );

    // One person can occupy only one process during a quarter. Selecting a
    // person who is already placed elsewhere moves them to the new station.
    if (personId) {
      Object.keys(assign).forEach((candidateStationId) => {
        if (assign[candidateStationId] === personId) {
          assign[candidateStationId] = null;
        }
      });

      Object.keys(training).forEach((candidateStationId) => {
        training[candidateStationId] = training[candidateStationId].filter(
          (candidatePersonId) => candidatePersonId !== personId
        );
      });

      Object.keys(trainers).forEach((candidateStationId) => {
        if (trainers[candidateStationId] === personId) {
          trainers[candidateStationId] = null;
        }
      });
    }

    assign[stationId] = personId || null;

    const assignedPeople = new Set(Object.values(assign).filter(Boolean));
    const trainingPeople = new Set(Object.values(training).flat());
    const trainerPeople = new Set(Object.values(trainers).filter(Boolean));
    return {
      ...segment,
      assign,
      training,
      trainers,
      float: active
        .filter(
          (candidate) =>
            !assignedPeople.has(candidate.id) &&
            !trainingPeople.has(candidate.id) &&
            !trainerPeople.has(candidate.id)
        )
        .map((candidate) => candidate.id),
      filled: assignedPeople.size,
      manuallyEdited: true,
    };
  });

  return {
    ...schedule,
    mode: schedule.mode === "manual" ? "manual" : "adjusted",
    manuallyEditedAt: Date.now(),
    segments,
    stats: scheduleStats(stations, team),
  };
}

function setTrainingPerson(
  schedule,
  stations,
  team,
  segmentKey,
  stationId,
  personId,
  isTraining
) {
  if (!schedule || !Array.isArray(schedule.segments)) return schedule;

  const station = stations.find((candidate) => candidate.id === stationId);
  if (!station) return schedule;

  const active = activeProductionTeam(team);
  const activeIds = new Set(active.map((person) => person.id));
  if (isTraining && !activeIds.has(personId)) return schedule;

  const segments = schedule.segments.map((segment) => {
    if (segment.key !== segmentKey) return segment;

    const assign = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.assign?.[candidate.id] || null,
      ])
    );
    const assignedPeople = new Set(Object.values(assign).filter(Boolean));
    const trainers = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.trainers?.[candidate.id] || null,
      ])
    );
    const trainerPeople = new Set(Object.values(trainers).filter(Boolean));

    // Training is only available to active team members who are not already
    // covering production or serving as a trainer during the same period.
    if (
      isTraining &&
      (assignedPeople.has(personId) || trainerPeople.has(personId))
    ) {
      return segment;
    }

    const training = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        Array.isArray(segment.training?.[candidate.id])
          ? [...segment.training[candidate.id]]
          : [],
      ])
    );

    // A member can train at only one process in a period. Adding them to a new
    // process moves their training assignment there.
    Object.keys(training).forEach((candidateStationId) => {
      training[candidateStationId] = training[candidateStationId].filter(
        (candidatePersonId) => candidatePersonId !== personId
      );
    });

    if (isTraining) {
      training[stationId] = [...training[stationId], personId];
    }

    const trainingPeople = new Set(Object.values(training).flat());

    return {
      ...segment,
      assign,
      training,
      trainers,
      float: active
        .filter(
          (candidate) =>
            !assignedPeople.has(candidate.id) &&
            !trainerPeople.has(candidate.id) &&
            !trainingPeople.has(candidate.id)
        )
        .map((candidate) => candidate.id),
      filled: assignedPeople.size,
      manuallyEdited: true,
    };
  });

  return {
    ...schedule,
    mode: schedule.mode === "manual" ? "manual" : "adjusted",
    manuallyEditedAt: Date.now(),
    segments,
    stats: scheduleStats(stations, team),
  };
}

function setTrainerPerson(
  schedule,
  stations,
  team,
  segmentKey,
  stationId,
  personId
) {
  if (!schedule || !Array.isArray(schedule.segments)) return schedule;

  const station = stations.find((candidate) => candidate.id === stationId);
  if (!station) return schedule;

  const active = activeProductionTeam(team);
  const person = personId
    ? active.find((candidate) => candidate.id === personId)
    : null;

  if (personId && (!person || !person.certs.includes(stationId))) {
    return schedule;
  }

  const segments = schedule.segments.map((segment) => {
    if (segment.key !== segmentKey) return segment;

    const assign = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.assign?.[candidate.id] || null,
      ])
    );
    const training = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        Array.isArray(segment.training?.[candidate.id])
          ? [...segment.training[candidate.id]]
          : [],
      ])
    );
    const trainers = Object.fromEntries(
      stations.map((candidate) => [
        candidate.id,
        segment.trainers?.[candidate.id] || null,
      ])
    );

    const assignedPeople = new Set(Object.values(assign).filter(Boolean));
    const trainingPeople = new Set(Object.values(training).flat());

    if (
      personId &&
      (assignedPeople.has(personId) || trainingPeople.has(personId))
    ) {
      return segment;
    }

    if (personId) {
      Object.keys(trainers).forEach((candidateStationId) => {
        if (trainers[candidateStationId] === personId) {
          trainers[candidateStationId] = null;
        }
      });
    }

    trainers[stationId] = personId || null;

    const trainerPeople = new Set(Object.values(trainers).filter(Boolean));

    return {
      ...segment,
      assign,
      training,
      trainers,
      float: active
        .filter(
          (candidate) =>
            !assignedPeople.has(candidate.id) &&
            !trainingPeople.has(candidate.id) &&
            !trainerPeople.has(candidate.id)
        )
        .map((candidate) => candidate.id),
      filled: assignedPeople.size,
      manuallyEdited: true,
    };
  });

  return {
    ...schedule,
    mode: schedule.mode === "manual" ? "manual" : "adjusted",
    manuallyEditedAt: Date.now(),
    segments,
    stats: scheduleStats(stations, team),
  };
}

function preserveTraining(nextSchedule, previousSchedule) {
  if (
    !nextSchedule ||
    !Array.isArray(nextSchedule.segments) ||
    !previousSchedule ||
    !Array.isArray(previousSchedule.segments)
  ) {
    return nextSchedule;
  }

  const previousByKey = new Map(
    previousSchedule.segments.map((segment) => [segment.key, segment])
  );

  return {
    ...nextSchedule,
    segments: nextSchedule.segments.map((segment) => {
      const previous = previousByKey.get(segment.key);
      const training = previous?.training || segment.training;
      const trainers = previous?.trainers || segment.trainers;
      const reservedPeople = new Set([
        ...Object.values(training || {}).flatMap((ids) =>
          Array.isArray(ids) ? ids : []
        ),
        ...Object.values(trainers || {}).filter(Boolean),
      ]);
      const assign = Object.fromEntries(
        Object.entries(segment.assign || {}).map(([stationId, personId]) => [
          stationId,
          reservedPeople.has(personId) ? null : personId,
        ])
      );

      return {
        ...segment,
        assign,
        training,
        trainers,
      };
    }),
  };
}

// Coerce any loaded/imported object into a clean, well-formed state.
// Certifications are pruned to stations that actually exist.
function normalize(d) {
  const data = d || {};
  const stations = (data.stations || []).map((station) => ({
    id: station.id || uid(),
    name: String(station.name ?? "Untitled"),
    category: station.category || "Stations",
  }));
  const validIds = new Set(stations.map((station) => station.id));
  const usedLeaderZones = new Set();
  const team = (data.team || []).map((person) => {
    const role = person.role === "tl" || person.isTL === true ? "tl" : "member";

    const requestedZone = TL_ZONE_KEYS.has(person.tlZone)
      ? person.tlZone
      : null;
    const tlZone =
      role === "tl" &&
      requestedZone &&
      !usedLeaderZones.has(requestedZone)
        ? requestedZone
        : null;
    if (tlZone) usedLeaderZones.add(tlZone);

    return {
      id: person.id || uid(),
      name: String(person.name ?? "Unnamed"),
      pto: !!person.pto,
      role,
      tlZone,
      certs: Array.isArray(person.certs)
        ? person.certs.filter((certificationId) =>
            validIds.has(certificationId)
          )
        : [],
    };
  });

  const loadedSchedule =
    data.schedule && Array.isArray(data.schedule.segments)
      ? data.schedule
      : null;

  return {
    stations,
    team,
    schedule: reconcileSchedule(loadedSchedule, stations, team),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD_PERSON": {
      const name = normalizePersonName(action.name);
      if (!name) return state;

      const duplicate = state.team.some(
        (person) => personNameKey(person.name) === personNameKey(name)
      );
      if (duplicate) return state;

      const nextTeam = [
        ...state.team,
        {
          id: uid(),
          name,
          pto: false,
          role: action.role === "tl" ? "tl" : "member",
          // Zone assignment is intentionally only changed in Skills / Certs.
          tlZone: null,
          certs: [],
        },
      ];
      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "REMOVE_PERSON": {
      const nextTeam = state.team.filter((person) => person.id !== action.id);
      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "RENAME_PERSON": {
      const name = normalizePersonName(action.name);
      if (!name) return state;

      const duplicate = state.team.some(
        (person) =>
          person.id !== action.id &&
          personNameKey(person.name) === personNameKey(name)
      );
      if (duplicate) return state;

      return {
        ...state,
        team: state.team.map((person) =>
          person.id === action.id ? { ...person, name } : person
        ),
      };
    }

    case "SET_PTO": {
      const nextTeam = state.team.map((person) =>
        person.id === action.id ? { ...person, pto: action.pto } : person
      );
      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "SET_TEAM_ROLE": {
      const current = state.team.find((person) => person.id === action.id);
      if (!current) return state;

      const nextRole = action.role === "tl" ? "tl" : "member";
      const currentZone = TL_ZONE_KEYS.has(current.tlZone)
        ? current.tlZone
        : null;
      const nextZone = nextRole === "tl" ? currentZone : null;
      const nextTeam = state.team.map((person) =>
        person.id === action.id
          ? { ...person, role: nextRole, tlZone: nextZone }
          : person
      );

      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "SET_TL_ZONE": {
      const requestedZone = TL_ZONE_KEYS.has(action.tlZone)
        ? action.tlZone
        : null;
      const occupied = state.team.some(
        (person) =>
          person.id !== action.id &&
          person.role === "tl" &&
          person.tlZone === requestedZone
      );
      if (requestedZone && occupied) return state;
      return {
        ...state,
        team: state.team.map((person) =>
          person.id === action.id && person.role === "tl"
            ? { ...person, tlZone: requestedZone }
            : person
        ),
      };
    }

    case "CLEAR_TL_ZONES":
      return {
        ...state,
        team: state.team.map((person) =>
          person.role === "tl" && person.tlZone
            ? { ...person, tlZone: null }
            : person
        ),
      };

    case "TOGGLE_CERT": {
      const nextTeam = state.team.map((person) => {
        if (person.id !== action.personId) return person;
        const hasCertification = person.certs.includes(action.stationId);
        return {
          ...person,
          certs: hasCertification
            ? person.certs.filter(
                (certificationId) => certificationId !== action.stationId
              )
            : [...person.certs, action.stationId],
        };
      });
      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "SET_CATEGORY_CERTS": {
      const ids = state.stations
        .filter((station) => station.category === action.category)
        .map((station) => station.id);
      const idSet = new Set(ids);
      const nextTeam = state.team.map((person) => {
        if (person.id !== action.personId) return person;
        const rest = person.certs.filter(
          (certificationId) => !idSet.has(certificationId)
        );
        return {
          ...person,
          certs: action.on ? [...rest, ...ids] : rest,
        };
      });
      return {
        ...state,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, state.stations, nextTeam),
      };
    }

    case "ADD_STATION": {
      const nextStations = [
        ...state.stations,
        { id: uid(), name: action.name, category: action.category },
      ];
      return {
        ...state,
        stations: nextStations,
        schedule: reconcileSchedule(state.schedule, nextStations, state.team),
      };
    }

    case "REMOVE_STATION": {
      const nextStations = state.stations.filter(
        (station) => station.id !== action.id
      );
      const nextTeam = state.team.map((person) => ({
        ...person,
        certs: person.certs.filter(
          (certificationId) => certificationId !== action.id
        ),
      }));
      return {
        ...state,
        stations: nextStations,
        team: nextTeam,
        schedule: reconcileSchedule(state.schedule, nextStations, nextTeam),
      };
    }

    case "RENAME_STATION":
      return {
        ...state,
        stations: state.stations.map((station) =>
          station.id === action.id
            ? { ...station, name: action.name }
            : station
        ),
      };

    case "MOVE_STATION": {
      const stations = [...state.stations];
      const station = stations.find((candidate) => candidate.id === action.id);
      if (!station) return state;
      const sameCategory = stations.filter(
        (candidate) => candidate.category === station.category
      );
      const position = sameCategory.indexOf(station);
      const swap = sameCategory[position + action.dir];
      if (!swap) return state;
      const stationIndex = stations.indexOf(station);
      const swapIndex = stations.indexOf(swap);
      [stations[stationIndex], stations[swapIndex]] = [
        stations[swapIndex],
        stations[stationIndex],
      ];
      return { ...state, stations };
    }

    case "SET_ASSIGNMENT":
      return {
        ...state,
        schedule: assignPerson(
          state.schedule,
          state.stations,
          state.team,
          action.segmentKey,
          action.stationId,
          action.personId
        ),
      };

    case "SET_TRAINING":
      return {
        ...state,
        schedule: setTrainingPerson(
          state.schedule,
          state.stations,
          state.team,
          action.segmentKey,
          action.stationId,
          action.personId,
          action.isTraining
        ),
      };

    case "SET_TRAINER":
      return {
        ...state,
        schedule: setTrainerPerson(
          state.schedule,
          state.stations,
          state.team,
          action.segmentKey,
          action.stationId,
          action.personId
        ),
      };

    case "SET_SCHEDULE":
      return {
        ...state,
        schedule: reconcileSchedule(
          action.schedule,
          state.stations,
          state.team
        ),
      };

    case "LOAD_DATA":
      return normalize(action.data);

    default:
      return state;
  }
}

export function useShiftData() {
  const [storageOK, setStorageOK] = useState(true);
  const [loading, setLoading] = useState(true);

  const [state, dispatch] = useReducer(reducer, undefined, () =>
    normalize(exampleData())
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const loaded = await loadData();
        if (!cancelled) {
          dispatch({ type: "LOAD_DATA", data: loaded || exampleData() });
          setStorageOK(true);
        }
      } catch (error) {
        console.warn("Could not load saved shift data.", error);
        if (!cancelled) {
          dispatch({ type: "LOAD_DATA", data: exampleData() });
          setStorageOK(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function persist() {
      const ok = await saveData(state);
      if (!cancelled) setStorageOK(ok);
    }

    persist();

    return () => {
      cancelled = true;
    };
  }, [state, loading]);

  const actions = useMemo(
    () => ({
      addPerson: (name, role = "member") =>
        dispatch({ type: "ADD_PERSON", name, role }),
      removePerson: (id) => dispatch({ type: "REMOVE_PERSON", id }),
      renamePerson: (id, name) =>
        dispatch({ type: "RENAME_PERSON", id, name }),
      setPTO: (id, pto) => dispatch({ type: "SET_PTO", id, pto }),
      setTeamRole: (id, role) =>
        dispatch({ type: "SET_TEAM_ROLE", id, role }),
      setTLZone: (id, tlZone) =>
        dispatch({ type: "SET_TL_ZONE", id, tlZone }),
      clearTLZones: () => dispatch({ type: "CLEAR_TL_ZONES" }),
      toggleCert: (personId, stationId) =>
        dispatch({ type: "TOGGLE_CERT", personId, stationId }),
      setCategoryCerts: (personId, category, on) =>
        dispatch({ type: "SET_CATEGORY_CERTS", personId, category, on }),
      addStation: (name, category) =>
        dispatch({ type: "ADD_STATION", name, category }),
      removeStation: (id) => dispatch({ type: "REMOVE_STATION", id }),
      renameStation: (id, name) =>
        dispatch({ type: "RENAME_STATION", id, name }),
      moveStation: (id, dir) =>
        dispatch({ type: "MOVE_STATION", id, dir }),
      assignPerson: (segmentKey, stationId, personId) =>
        dispatch({
          type: "SET_ASSIGNMENT",
          segmentKey,
          stationId,
          personId,
        }),
      setTraining: (segmentKey, stationId, personId, isTraining) =>
        dispatch({
          type: "SET_TRAINING",
          segmentKey,
          stationId,
          personId,
          isTraining,
        }),
      setTrainer: (segmentKey, stationId, personId) =>
        dispatch({
          type: "SET_TRAINER",
          segmentKey,
          stationId,
          personId,
        }),
      generate: () =>
        dispatch({
          type: "SET_SCHEDULE",
          schedule: preserveTraining(
            generateSchedule(state.stations, state.team),
            state.schedule
          ),
        }),
      startManual: () =>
        dispatch({
          type: "SET_SCHEDULE",
          schedule: createEmptySchedule(state.stations, state.team),
        }),
      loadData: (data) => dispatch({ type: "LOAD_DATA", data }),
    }),
    [state.schedule, state.stations, state.team]
  );

  return { data: state, actions, storageOK, loading };
}
