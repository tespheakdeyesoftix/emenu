export function businessInitials(name?: string | null) {
  return (
    (name?.trim() || "Angkor eMenu")
      .split(/[\s_-]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => [...word][0].toUpperCase())
      .join("") || "AE"
  );
}
