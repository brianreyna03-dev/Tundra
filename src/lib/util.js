// Small shared helpers used across the app.

// Default Unit Plant process groups. Any custom category already in the data
// continues to appear automatically.
export const CATS = ["Unit Assembly", "Sub-Assembly", "Material Support"];

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);

export function usedCategories(stations) {
  const order = [...CATS];
  stations.forEach((station) => {
    if (!order.includes(station.category)) order.push(station.category);
  });
  return order.filter((category) =>
    stations.some((station) => station.category === category)
  );
}

export function allCategories(stations) {
  const set = [...CATS];
  stations.forEach((station) => {
    if (!set.includes(station.category)) set.push(station.category);
  });
  return set;
}

export function nameFor(team, id) {
  const person = team.find((candidate) => candidate.id === id);
  return person ? person.name : "—";
}

export const todayStr = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
