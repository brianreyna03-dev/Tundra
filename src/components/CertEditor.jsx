import { usedCategories } from "../lib/util.js";
import { TL_ZONE_SLOTS, isTeamLeader } from "../lib/teamLeaders.js";

function TeamLeaderZoneEditor({ person, team, actions }) {
  const occupiedByOther = new Map(
    team
      .filter(
        (candidate) =>
          candidate.id !== person.id &&
          isTeamLeader(candidate) &&
          candidate.tlZone
      )
      .map((candidate) => [candidate.tlZone, candidate.name])
  );

  return (
    <div className="certgroup tl-zone-certgroup">
      <div className="ghead">
        <span className="lbl">Team Leader Zone</span>
        {person.tlZone && (
          <button
            className="mini"
            onClick={() => actions.setTLZone(person.id, null)}
          >
            Clear
          </button>
        )}
      </div>
      <p className="certgroup-note">
        Choose one leadership position. A zone can only be assigned to one Team
        Leader at a time.
      </p>
      <div className="cgrid tl-zone-cert-grid">
        {TL_ZONE_SLOTS.map((slot) => {
          const checked = person.tlZone === slot.key;
          const assignedTo = occupiedByOther.get(slot.key);
          const disabled = Boolean(assignedTo);

          return (
            <label
              className={
                "cbox tl-zone-cert" +
                (checked ? " checked" : "") +
                (disabled ? " disabled" : "")
              }
              key={slot.key}
            >
              <input
                type="radio"
                name={`tl-zone-${person.id}`}
                checked={checked}
                disabled={disabled}
                onChange={() => actions.setTLZone(person.id, slot.key)}
              />
              <span>
                <strong>{slot.label}</strong>
                <small>
                  {assignedTo
                    ? `Assigned to ${assignedTo}`
                    : slot.position}
                </small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function CertEditor({ person, team, stations, actions }) {
  const cats = usedCategories(stations);
  const certSet = new Set(person.certs);
  const isTL = isTeamLeader(person);

  return (
    <div className="certs open">
      {isTL && (
        <TeamLeaderZoneEditor
          person={person}
          team={team}
          actions={actions}
        />
      )}

      {!stations.length ? (
        <p className="hint cert-empty-hint">
          Add stations before assigning process certifications.
        </p>
      ) : (
        cats.map((cat) => {
          const sts = stations.filter((s) => s.category === cat);
          if (!sts.length) return null;
          return (
            <div className="certgroup" key={cat}>
              <div className="ghead">
                <span className="lbl">{cat}</span>
                <button
                  className="mini"
                  onClick={() => actions.setCategoryCerts(person.id, cat, true)}
                >
                  All
                </button>
                <button
                  className="mini"
                  onClick={() => actions.setCategoryCerts(person.id, cat, false)}
                >
                  None
                </button>
              </div>
              <div className="cgrid">
                {sts.map((s) => {
                  const on = certSet.has(s.id);
                  return (
                    <label className={"cbox" + (on ? " checked" : "")} key={s.id}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => actions.toggleCert(person.id, s.id)}
                      />
                      {s.name}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
