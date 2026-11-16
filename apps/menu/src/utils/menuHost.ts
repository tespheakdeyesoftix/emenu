const platformHostnames = new Set(
  (
    import.meta.env.VITE_PLATFORM_MENU_HOSTNAMES ||
    "angkor-emenu-menu.pages.dev,emenu.aagj7.com,localhost,127.0.0.1,[::1]"
  )
    .split(",")
    .map((hostname: string) => hostname.trim().toLowerCase())
    .filter(Boolean),
);

export function isCustomMenuHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return ![...platformHostnames].some(
    (platformHostname) =>
      normalized === platformHostname ||
      normalized.endsWith(`.${platformHostname}`),
  );
}
