import { useState } from "react";
import PersonCard from "./PersonCard.jsx";
import TeamLeaderStrip from "./TeamLeaderStrip.jsx";
import { TL_ZONE_SLOTS, isTeamLeader } from "../lib/teamLeaders.js";

export default function TeamView({ data, actions, openCertId, setOpenCertId }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");

  const leaders = data.team.filter(isTeamLeader);
  const hasLeaderCapacity = leaders.length < TL_ZONE_SLOTS.length;

  const add = () => {
    const value = name.trim();
    if (!value) return;
    if (role === "tl" && !hasLeaderCapacity) return;

    actions.addPerson(value, role);
    setName("");
  };

  const activeMembers = data.team.filter(
    (person) => !person.pto && !isTeamLeader(person)
  ).length;
  const activeLeaders = leaders.filter((person) => !person.pto).length;
  const onPto = data.team.filter((person) => person.pto).length;

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
            Add a Team Member or Team Leader. Assign a Team Leader to ZONE 1,
            either ZONE 2 position, or ZONE 3 from that person&apos;s Skills / Certs.
          </p>
        </div>
        <div className="addbar team-addbar">
          <input
            type="text"
            placeholder="Team member name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
          />
          <select
            aria-label="New person role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="member">Team Member</option>
            <option value="tl" disabled={!hasLeaderCapacity}>
              {hasLeaderCapacity
                ? "Team Leader (TL)"
                : "Team Leader — all 4 added"}
            </option>
          </select>
          <button
            className="btn"
            onClick={add}
            disabled={role === "tl" && !hasLeaderCapacity}
          >
            Add {role === "tl" ? "TL" : "Member"}
          </button>
        </div>
      </div>

      {data.team.length === 0 ? (
        <div className="empty">
          <div className="empty-symbol">TM</div>
          <div className="big">No team members loaded</div>
          <div>Add the Unit Plant roster above, then assign certifications.</div>
        </div>
      ) : (
        <div className="roster">
          {data.team.map((person) => (
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
          ))}
        </div>
      )}

      <p className="hint">
        Team leaders stay out of automatic station assignments. Open
        <b> Skills / Certs</b> to set or change a TL zone. A Team Leader marked
        <b> PTO</b> keeps the saved zone assignment but is hidden from zone
        coverage until returned to <b>On Shift</b>.
      </p>
    </>
  );
}
