import { TL_ZONE_SLOTS, leaderForSlot } from "../lib/teamLeaders.js";

function initialsOf(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function TeamLeaderStrip({ team, compact = false }) {
  return (
    <section
      className={`leader-strip${compact ? " leader-strip-compact" : ""}`}
      aria-label="Team leader zone assignments"
    >
      <div className="leader-strip-head">
        <div>
          <span className="section-kicker">Leadership Coverage</span>
          <h3>Team Leaders</h3>
        </div>
        <span>Four dedicated zone positions</span>
      </div>
      <div className="leader-grid">
        {TL_ZONE_SLOTS.map((slot) => {
          const leader = leaderForSlot(team, slot.key);
          const assignedLeader = leaderForSlot(team, slot.key, {
            includePTO: true,
          });
          const ptoGap = !leader && Boolean(assignedLeader?.pto);

          return (
            <div
              className={`leader-slot leader-zone-${slot.key}${
                leader ? " is-assigned" : ptoGap ? " is-pto-gap" : " is-open"
              }`}
              key={slot.key}
              aria-label={`${slot.label}, ${slot.position}, ${
                leader
                  ? leader.name
                  : ptoGap
                    ? "coverage needed because the assigned Team Leader is on PTO"
                    : "unassigned"
              }`}
            >
              <div className="leader-zone-copy">
                <strong>{slot.label}</strong>
                <span>{slot.position}</span>
              </div>
              {leader ? (
                <div className="leader-person">
                  <span className="leader-avatar" aria-hidden="true">
                    {initialsOf(leader.name) || "TL"}
                  </span>
                  <div>
                    <b>{leader.name}</b>
                    <small>On shift</small>
                  </div>
                </div>
              ) : ptoGap ? (
                <div className="leader-coverage-gap">
                  <b>Coverage needed</b>
                  <small>Assigned TL is on PTO</small>
                </div>
              ) : (
                <span className="leader-unassigned">Unassigned</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
