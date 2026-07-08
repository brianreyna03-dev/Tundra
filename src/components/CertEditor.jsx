import { usedCategories } from "../lib/util.js";

export default function CertEditor({ person, stations, actions }) {
  const cats = usedCategories(stations);
  const certSet = new Set(person.certs);

  if (!stations.length) {
    return (
      <div className="certs open">
        <p className="hint">Add stations before assigning certifications.</p>
      </div>
    );
  }

  return (
    <div className="certs open">
      {cats.map((cat) => {
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
      })}
    </div>
  );
}
