export function setIdSelected(ids: string[], id: string, selected: boolean) {
  if (!selected) return ids.filter((value) => value !== id);
  return ids.includes(id) ? ids : [...ids, id];
}
