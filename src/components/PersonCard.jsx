import CertEditor from "./CertEditor.jsx";
import {
  TL_ZONE_SLOTS,
  firstOpenLeaderSlot,
  isTeamLeader,
} from "../lib/teamLeaders.js";

export default function PersonCard({
  person,
  team,
  stations,
  isOpen,
  onToggleOpen,
  actions,
}) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const isTL = isTeamLeader(person);
  const firstOpen = firstOpenLeaderSlot(team, person.id);
  const occupiedByOther = new Set(
    team
      .filter(
        (candidate) =>
          candidate.id !== person.id && isTeamLeader(candidate)
      )
      .map((candidate) => candidate.tlZone)
      .filter(Boolean)
  );
  const hasLeaderCapacity = isTL || Boolean(firstOpen);

  return (
    <div
      className={
        "pcard" +
        (person.pto ? " person-pto" : "") +
        (isTL ? " person-tl" : "")
      }
    >
      <div className="row">
        <div className="person-identity">
          <div className="avatar" aria-hidden="true">{initials || "TM"}</div>
          <div>
            <div className="pname">{person.name}</div>
            <div className="person-meta">
              <span className={person.pto ? "attendance pto" : "attendance active"}>
                {person.pto ? "PTO" : "On Shift"}
              </span>
              <span className={isTL ? "role-badge tl" : "role-badge"}>
                {isTL ? "Team Leader" : "Team Member"}
              </span>
              <span className="certcount">
                {person.certs.length} certified process
                {person.certs.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>
        </div>

        <div className="actions">
          <span className="toggle" role="group" aria-label={`${person.name} attendance`}>
            <button
              className={person.pto ? "" : "on-here"}
              onClick={() => actions.setPTO(person.id, false)}
            >
              On Shift
            </button>
            <button
              className={person.pto ? "on-pto" : ""}
              onClick={() => actions.setPTO(person.id, true)}
            >
              PTO
            </button>
          </span>
          <button className="btn ghost sm" onClick={onToggleOpen}>
            {isOpen ? "Close Skills" : "Skills / Certs"}
          </button>
          <button
            className="xbtn"
            title="Remove team member"
            aria-label={`Remove ${person.name}`}
            onClick={() => actions.removePerson(person.id)}
          >
            ×
          </button>
        </div>
      </div>

      <div className="person-role-controls">
        <label>
          <span>Team role</span>
          <select
            value={isTL ? "tl" : "member"}
            onChange={(event) => {
              const nextRole = event.target.value;
              actions.setTeamRole(
                person.id,
                nextRole,
                nextRole === "tl"
                  ? person.tlZone || firstOpen
                  : null
              );
            }}
          >
            <option value="member">Team Member</option>
            <option value="tl" disabled={!hasLeaderCapacity}>
              {hasLeaderCapacity
                ? "Team Leader (TL)"
                : "Team Leader — all 4 assigned"}
            </option>
          </select>
        </label>

        {isTL && (
          <label>
            <span>TL zone position</span>
            <select
              value={person.tlZone || ""}
              onChange={(event) =>
                actions.setTLZone(person.id, event.target.value || null)
              }
            >
              <option value="" disabled>
                Select a zone position
              </option>
              {TL_ZONE_SLOTS.map((slot) => (
                <option
                  key={slot.key}
                  value={slot.key}
                  disabled={
                    slot.key !== person.tlZone && occupiedByOther.has(slot.key)
                  }
                >
                  {slot.label} — {slot.position}
                  {occupiedByOther.has(slot.key) && slot.key !== person.tlZone
                    ? " (assigned)"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className="person-role-note">
          {isTL
            ? "Reserved for leadership coverage; not placed on a station by the scheduler."
            : "Eligible for certified station assignments."}
        </span>
      </div>

      {isOpen && (
        <CertEditor person={person} stations={stations} actions={actions} />
      )}
    </div>
  );
}
