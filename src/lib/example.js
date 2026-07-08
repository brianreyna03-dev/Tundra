import { uid } from "./util.js";

// A ready-to-explore roster so the app is useful the moment it opens.
// Replace it with your own team on the Team and Stations tabs, or use
// "Reload example roster" in the ⋯ menu to bring it back.
export function exampleData() {
  const stations = [];
  for (let i = 1; i <= 12; i++)
    stations.push({
      id: uid(),
      name: "Unit Station " + String(i).padStart(2, "0"),
      category: "Unit Assembly",
    });
  for (let i = 1; i <= 6; i++)
    stations.push({
      id: uid(),
      name: "Sub-Assembly " + String(i).padStart(2, "0"),
      category: "Sub-Assembly",
    });
  for (let i = 1; i <= 4; i++)
    stations.push({
      id: uid(),
      name: "Material Route " + String(i).padStart(2, "0"),
      category: "Material Support",
    });

  const first = [
    "Alex",
    "Jordan",
    "Taylor",
    "Morgan",
    "Casey",
    "Riley",
    "Jamie",
    "Avery",
    "Quinn",
    "Cameron",
    "Drew",
    "Skyler",
    "Reese",
    "Parker",
    "Rowan",
    "Sage",
    "Emerson",
    "Finley",
    "Hayden",
    "Kai",
    "Logan",
    "Micah",
    "Nico",
    "Peyton",
  ];
  const last = [
    "Nguyen",
    "Patel",
    "Garcia",
    "Smith",
    "Johnson",
    "Lee",
    "Martinez",
    "Brown",
    "Davis",
    "Lopez",
    "Wilson",
    "Clark",
    "Walker",
    "Young",
    "Hall",
    "Allen",
    "King",
    "Wright",
    "Scott",
    "Green",
    "Baker",
    "Adams",
    "Turner",
    "Reed",
  ];
  const ptoIdx = new Set([3, 11, 18]);

  // seeded PRNG so the example roster is the same every time
  let seed = 7;
  const rnd = () =>
    (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const team = first.map((f, i) => ({
    id: uid(),
    name: f + " " + last[i],
    pto: ptoIdx.has(i),
    certs: [],
  }));

  const S = stations.length;
  team.forEach((p) => {
    const k = 6 + Math.floor(rnd() * 6);
    const order = [...Array(S).keys()].sort(() => rnd() - 0.5);
    const set = new Set();
    for (let j = 0; j < k; j++) set.add(stations[order[j]].id);
    p.certs = [...set];
  });

  // make sure every station has at least 4 certified people
  stations.forEach((st) => {
    let have = team.filter((p) => p.certs.includes(st.id)).length;
    while (have < 4) {
      const p = team[Math.floor(rnd() * team.length)];
      if (!p.certs.includes(st.id)) {
        p.certs.push(st.id);
        have++;
      }
    }
  });

  return { stations, team, schedule: null };
}
