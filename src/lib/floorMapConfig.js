export const KICK_OUT_REPAIR_STATION = {
  id: "floor-kick-out-repair",
  name: "Kick Out & Repair",
  category: "Unit Assembly",
};

export const LINE_SUPPORT_SLOTS = [
  { id: "ls-gate-check-st1", label: "Gate Check ST 1", kind: "gate" },
  { id: "ls-gate-check-st5", label: "Gate Check ST 5", kind: "gate" },
  { id: "ls-gate-check-st67", label: "Gate Check ST 6/7", kind: "gate" },
  { id: "ls-gate-check-1", label: "Gate Check", kind: "gate" },
  { id: "ls-gate-check-2", label: "Gate Check", kind: "gate" },
  { id: "ls-gate-check-3", label: "Gate Check", kind: "gate" },
  { id: "ls-il-spotter-1", label: "IL Spotter", kind: "spotter" },
  { id: "ls-il-spotter-2", label: "IL Spotter", kind: "spotter" },
  { id: "ls-scrap-1", label: "Scrap", kind: "scrap" },
  { id: "ls-scrap-2", label: "Scrap", kind: "scrap" },
];

export const LINE_SUPPORT_SLOT_IDS = LINE_SUPPORT_SLOTS.map((slot) => slot.id);
