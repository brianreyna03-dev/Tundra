import CertEditor from "./CertEditor.jsx";
import { TL_ZONE_SLOTS, isTeamLeader } from "../lib/teamLeaders.js";

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
  const assignedZone = TL_ZONE_SLOTS.find(
    (slot) => slot.key === person.tlZone
  );

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
              {isTL && (
                <span className={assignedZone ? "role-badge zone-set" : "role-badge zone-open"}>
                  {assignedZone ? assignedZone.label : "Zone not assigned"}
                </span>
              )}
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
              actions.setTeamRole(person.id, nextRole);
              if (nextRole === "tl" && !isOpen) onToggleOpen();
            }}
          >
            <option value="member">Team Member</option>
            <option value="tl">Team Leader (TL)</option>
          </select>
        </label>

        <span className="person-role-note">
          {isTL
            ? assignedZone
              ? `${assignedZone.label} is assigned. Change the zone under Skills / Certs.`
              : "No zone assigned yet. Choose one under Skills / Certs."
            : "Eligible for certified station assignments."}
        </span>
      </div>

      {isOpen && (
        <CertEditor
          person={person}
          team={team}
          stations={stations}
          actions={actions}
        />
      )}
    </div>
  );
}
