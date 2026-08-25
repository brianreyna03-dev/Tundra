import { useState } from "react";
import PersonCard from "./PersonCard.jsx";
import TeamLeaderStrip from "./TeamLeaderStrip.jsx";
import { isTeamLeader } from "../lib/teamLeaders.js";

export default function TeamView({ data, actions, openCertId, setOpenCertId }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [nameError, setNameError] = useState("");

  const leaders = data.team.filter(isTeamLeader);
  const members = data.team.filter((person) => !isTeamLeader(person));
  const hasAssignedLeaderZones = leaders.some((person) => person.tlZone);

  const add = () => {
    const value = name.trim().replace(/\s+/g, " ");
    if (!value) return;

    const duplicate = data.team.some(
      (person) =>
        person.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
        value.toLocaleLowerCase()
    );

    if (duplicate) {
      setNameError("That name is already on the team.");
      return;
    }

    actions.addPerson(value, role);
    setName("");
    setNameError("");
  };

  const clearAllLeaderZones = () => {
    if (!hasAssignedLeaderZones) return;

    const confirmed = window.confirm(
      "Clear all Team Leader zone assignments? Team Leaders and certifications will stay in place."
    );

    if (confirmed) actions.clearTLZones();
  };

  const activeMembers = members.filter((person) => !person.pto).length;
  const activeLeaders = leaders.filter((person) => !person.pto).length;
  const onPto = data.team.filter((person) => person.pto).length;

  const renderPerson = (person) => (
    <PersonCard
      key={person.id}
      person={person}
      team={data.team}
      stations={data.stations}
      isOpen={openCertId === person.id}
      onToggleOpen={() =>
        setOpenCertId(openCertId === person.id ? null : person.id)
      }
      actions={actions}
    />
  );

  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-kicker">People & Qualifications</span>
          <h2>Unit Plant Team Members</h2>
          <p>
            Set attendance, choose each person&apos;s role, and manage process
            certifications and team-leader zones under Skills / Certs.
          </p>
        </div>
        <div className="panel-summary" aria-label="Attendance summary">
          <span><b>{activeMembers}</b> active members</span>
          <span><b>{activeLeaders}</b> active TLs</span>
          <span><b>{onPto}</b> PTO</span>
        </div>
      </div>

      <TeamLeaderStrip team={data.team} />

      <div className="entry-panel">
        <div>
          <span className="lbl">Add Team Member</span>
          <p>
            Add as many Team Members or Team Leaders as needed. Four zone positions
            can be assigned from each Team Leader&apos;s Skills / Certs.
          </p>
        </div>
        <div className="addbar team-addbar">
          <input
            type="text"
            placeholder="Team member name"
            value={name}
            aria-invalid={nameError ? "true" : "false"}
            aria-describedby={nameError ? "team-name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && add()}
          />
          <select
            aria-label="New person role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="member">Team Member</option>
            <option value="tl">Team Leader (TL)</option>
          </select>
          <button
            className="btn"
            onClick={add}
          >
            Add {role === "tl" ? "TL" : "Member"}
          </button>
          {nameError && (
            <div id="team-name-error" className="duplicate-name-error" role="alert">
              {nameError}
            </div>
          )}
        </div>
      </div>

      <section className="roster-section leader-roster-section" aria-labelledby="team-leaders-heading">
        <div className="roster-section-head">
          <div>
            <span className="section-kicker">Leadership Roster</span>
            <h3 id="team-leaders-heading">Team Leaders</h3>
            <p>{leaders.length} team leader{leaders.length === 1 ? "" : "s"}</p>
          </div>
          <button
            className="btn ghost sm clear-zones-btn"
            type="button"
            disabled={!hasAssignedLeaderZones}
            onClick={clearAllLeaderZones}
            title={
              hasAssignedLeaderZones
                ? "Clear every Team Leader zone assignment"
                : "No Team Leader zones are currently assigned"
            }
          >
            Clear All Zones
          </button>
        </div>

        {leaders.length === 0 ? (
          <div className="roster-empty">
            No Team Leaders added yet. Add one above or change a Team Member&apos;s role.
          </div>
        ) : (
          <div className="roster roster-leaders">{leaders.map(renderPerson)}</div>
        )}
      </section>

      <section className="roster-section" aria-labelledby="team-members-heading">
        <div className="roster-section-head">
          <div>
            <span className="section-kicker">Production Roster</span>
            <h3 id="team-members-heading">Team Members</h3>
            <p>{members.length} team member{members.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="roster-empty">
            No Team Members added yet. Add one above or change a Team Leader&apos;s role.
          </div>
        ) : (
          <div className="roster">{members.map(renderPerson)}</div>
        )}
      </section>

      <p className="hint">
        Team leaders stay out of automatic station assignments. Any number of TLs
        can be added, while only four can hold zone positions at one time. Open
        <b> Skills / Certs</b> to set or change a TL zone. A Team Leader marked
        <b> PTO</b> keeps the saved zone assignment but is hidden from zone
        coverage until returned to <b>On Shift</b>.
      </p>
    </>
  );
}
