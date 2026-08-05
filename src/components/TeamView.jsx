import { useMemo, useState } from "react";
import PersonCard from "./PersonCard.jsx";
import TeamLeaderStrip from "./TeamLeaderStrip.jsx";
import {
  TL_ZONE_SLOTS,
  firstOpenLeaderSlot,
  isTeamLeader,
} from "../lib/teamLeaders.js";

export default function TeamView({ data, actions, openCertId, setOpenCertId }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [tlZone, setTlZone] = useState("");

  const openLeaderSlots = useMemo(() => {
    const occupied = new Set(
      data.team
        .filter(isTeamLeader)
        .map((person) => person.tlZone)
        .filter(Boolean)
    );
    return TL_ZONE_SLOTS.filter((slot) => !occupied.has(slot.key));
  }, [data.team]);

  const selectedLeaderZone =
    role === "tl"
      ? tlZone || openLeaderSlots[0]?.key || ""
      : "";

  const add = () => {
    const value = name.trim();
    if (!value) return;
    if (role === "tl" && !selectedLeaderZone) return;
    actions.addPerson(value, role, selectedLeaderZone || null);
    setName("");
    if (role === "tl") {
      const nextZone = firstOpenLeaderSlot([
        ...data.team,
        {
          id: "pending",
          name: value,
          role: "tl",
          tlZone: selectedLeaderZone,
        },
      ]);
      setTlZone(nextZone || "");
    }
  };

  const activeMembers = data.team.filter(
    (person) => !person.pto && !isTeamLeader(person)
  ).length;
  const leaders = data.team.filter(isTeamLeader);
  const activeLeaders = leaders.filter((person) => !person.pto).length;
  const onPto = data.team.filter((person) => person.pto).length;

  return (
    <>
      <div className="panel-head">
        <div>
          <span className="section-kicker">People & Qualifications</span>
          <h2>Unit Plant Team Members</h2>
          <p>
            Set attendance, assign four team-leader zone positions, and manage
            process certifications.
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
            Choose Team Member or Team Leader. Team leaders occupy one of four
            dedicated zone positions.
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
            onChange={(event) => {
              const nextRole = event.target.value;
              setRole(nextRole);
              if (nextRole === "tl") {
                setTlZone(openLeaderSlots[0]?.key || "");
              } else {
                setTlZone("");
              }
            }}
          >
            <option value="member">Team Member</option>
            <option value="tl" disabled={!openLeaderSlots.length}>
              {openLeaderSlots.length
                ? "Team Leader (TL)"
                : "Team Leader — all 4 assigned"}
            </option>
          </select>
          {role === "tl" && (
            <select
              aria-label="New team leader zone"
              value={selectedLeaderZone}
              onChange={(event) => setTlZone(event.target.value)}
            >
              {openLeaderSlots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label} — {slot.position}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn"
            onClick={add}
            disabled={role === "tl" && !selectedLeaderZone}
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
        Team leaders stay out of automatic station assignments and appear in
        their zone position on the floor map. Set anyone to <b>PTO</b> to mark
        them out for today.
      </p>
    </>
  );
}
