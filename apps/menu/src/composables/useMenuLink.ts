import { useRoute, type LocationQueryRaw } from "vue-router";

export function useMenuLink() {
  const route = useRoute();
  return (path: string) => {
    const query: LocationQueryRaw = {};
    for (const key of ["branch", "menu", "table", "table_id"]) {
      if (key in route.query) query[key] = route.query[key];
    }
    return { path, query };
  };
}
