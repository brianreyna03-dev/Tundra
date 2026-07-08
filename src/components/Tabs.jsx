const items = [
  { id: "board", label: "Coverage Board", shortLabel: "Board" },
  { id: "team", label: "Team Members", shortLabel: "Team" },
  { id: "stations", label: "Unit Processes", shortLabel: "Processes" },
  { id: "coverage", label: "Certifications", shortLabel: "Certs" },
];

export default function Tabs({ tab, setTab, team, stations }) {
  const totalCerts = team.reduce((sum, person) => sum + person.certs.length, 0);
  const counts = {
    team: team.length,
    stations: stations.length,
    coverage: totalCerts,
  };

  return (
    <nav className="tabs" aria-label="Unit Plant sections">
      <div className="wrap tabs-inner">
        {items.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            <span className="tab-label-full">{item.label}</span>
            <span className="tab-label-short">{item.shortLabel}</span>
            {counts[item.id] !== undefined && (
              <span className="tab-count">{counts[item.id]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
