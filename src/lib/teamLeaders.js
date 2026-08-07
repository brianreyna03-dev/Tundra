export const TL_ZONE_SLOTS = [
  { key: "zone1", label: "ZONE 1", position: "Leader position 1" },
  { key: "zone2a", label: "ZONE 2", position: "Leader position 2" },
  { key: "zone2b", label: "ZONE 3", position: "Leader position 3" },
  { key: "zone3", label: "ZONE 4", position: "Leader position 4" },
];

export const TL_ZONE_KEYS = new Set(TL_ZONE_SLOTS.map((slot) => slot.key));

export function isTeamLeader(person) {
  return person?.role === "tl";
}

export function leaderForSlot(team, slotKey, { includePTO = false } = {}) {
  return team.find(
    (person) =>
      isTeamLeader(person) &&
      person.tlZone === slotKey &&
      (includePTO || !person.pto)
  );
}

export function firstOpenLeaderSlot(team, ignorePersonId = null) {
  const occupied = new Set(
    team
      .filter(
        (person) =>
          person.id !== ignorePersonId &&
          isTeamLeader(person) &&
          TL_ZONE_KEYS.has(person.tlZone)
      )
      .map((person) => person.tlZone)
  );
  return TL_ZONE_SLOTS.find((slot) => !occupied.has(slot.key))?.key || null;
}
