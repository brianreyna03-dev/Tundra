import { useState } from "react";
import PersonCard from "./PersonCard.jsx";

export default function TeamView({ data, actions, openCertId, setOpenCertId }) {
  const [name, setName] = useState("");

  const add = () => {
    const value = name.trim();
    if (!value) return;
    actions.addPerson(value);
    setName("");
  };

  const active = data.team.filter((person) => !person.pto).length;
  const onPto = data.team.length - active;

  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-kicker">People & Qualifications</span>
          <h2>Unit Plant Team Members</h2>
          <p>Set today’s attendance and each team member’s certified processes.</p>
        </div>
        <div className="panel-summary" aria-label="Attendance summary">
          <span><b>{active}</b> active</span>
          <span><b>{onPto}</b> PTO</span>
        </div>
      </div>

      <div className="entry-panel">
        <div>
          <span className="lbl">Add Team Member</span>
          <p>New members begin active with no process certifications.</p>
        </div>
        <div className="addbar">
          <input
            type="text"
            placeholder="Team member name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
          />
          <button className="btn" onClick={add}>
            Add Member
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
        Set a team member to <b>PTO</b> to remove them from today’s coverage
        board. Certifications save automatically.
      </p>
    </>
  );
}
