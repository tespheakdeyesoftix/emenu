import { defineStore } from "pinia";
import type { QrDesign, RestaurantTable, TableGroup } from "../types/qrDesign";
import type { BranchOption, MenuNode } from "../types/menu";
import { khmerError } from "../utils/khmer";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

async function request(path: string, init?: RequestInit) {
  const token = localStorage.getItem("mf_token");
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(khmerError(data.error));
  return data;
}

export const useQrDesignStore = defineStore("qr-designs", {
  state: () => ({
    designs: [] as QrDesign[],
    groups: [] as TableGroup[],
    tables: [] as RestaurantTable[],
    branches: [] as BranchOption[],
    menus: [] as MenuNode[],
    allowCategoryBrowsing: false,
    loading: false,
    loaded: false,
  }),
  getters: {
    activeBranches: (state) => state.branches.filter((branch) => branch.isActive),
    activeGroups: (state) =>
      state.groups.filter((group) => Boolean(group.isActive) && state.branches.some((branch) => branch.id === group.branchId && branch.isActive)),
    activeTables: (state) =>
      state.tables.filter(
        (table) => Boolean(table.isActive) && Boolean(table.groupIsActive) && state.branches.some((branch) => branch.id === table.branchId && branch.isActive),
      ),
  },
  actions: {
    async load(force = false) {
      if (this.loaded && !force) return;
      this.loading = true;
      try {
        const [designs, groups, tables, branches, menus] = await Promise.all([
          request("/api/admin/qr-designs"),
          request("/api/admin/table-groups"),
          request("/api/admin/tables"),
          request("/api/admin/branches"),
          request("/api/admin/menus"),
        ]);
        this.designs = designs.designs;
        this.groups = groups.groups;
        this.tables = tables.tables;
        this.branches = branches.branches;
        this.menus = menus.menus;
        this.allowCategoryBrowsing = designs.allowCategoryBrowsing === true;
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    async refreshCategoryBrowsing() {
      const { allowCategoryBrowsing } = await request("/api/admin/qr-designs?settings=1");
      this.allowCategoryBrowsing = allowCategoryBrowsing === true;
    },
    async createDesign(payload: Partial<QrDesign>) {
      const result = await request("/api/admin/qr-designs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await this.load(true);
      return result.id as string;
    },
    async updateDesign(design: QrDesign) {
      await request(`/api/admin/qr-designs/${design.id}`, {
        method: "PUT",
        body: JSON.stringify(design),
      });
      await this.load(true);
    },
    async duplicateDesign(id: string) {
      await request(`/api/admin/qr-designs/${id}/duplicate`, {
        method: "POST",
      });
      await this.load(true);
    },
    async setDefault(id: string) {
      await request(`/api/admin/qr-designs/${id}/default`, { method: "PATCH" });
      await this.load(true);
    },
    async deleteDesign(id: string) {
      await request(`/api/admin/qr-designs/${id}`, { method: "DELETE" });
      await this.load(true);
    },
    async addGroup(name: string, branchId: string) {
      await request("/api/admin/table-groups", {
        method: "POST",
        body: JSON.stringify({ name, branchId, sortOrder: this.groups.filter((group) => group.branchId === branchId).length }),
      });
      await this.load(true);
    },
    async updateGroup(group: TableGroup) {
      await request(`/api/admin/table-groups/${group.id}`, {
        method: "PUT",
        body: JSON.stringify(group),
      });
      await this.load(true);
    },
    async reorderGroups(groups: TableGroup[]) {
      await request("/api/admin/table-groups/reorder", {
        method: "PUT",
        body: JSON.stringify({
          items: groups.map((group, index) => ({
            id: group.id,
            sortOrder: index,
          })),
        }),
      });
      await this.load(true);
    },
    async archiveGroup(group: TableGroup) {
      await request(`/api/admin/table-groups/${group.id}`, {
        method: "DELETE",
      });
      await this.load(true);
    },
    async addTable(payload: Partial<RestaurantTable>) {
      await request("/api/admin/tables", {
        method: "POST",
        body: JSON.stringify({ ...payload, sortOrder: this.tables.length }),
      });
      await this.load(true);
    },
    async updateTable(table: RestaurantTable) {
      await request(`/api/admin/tables/${table.id}`, {
        method: "PUT",
        body: JSON.stringify(table),
      });
      await this.load(true);
    },
    async reorderTables(groupId: string, tables: RestaurantTable[]) {
      await request("/api/admin/tables/reorder", {
        method: "PUT",
        body: JSON.stringify({
          groupId,
          items: tables.map((table, index) => ({
            id: table.id,
            sortOrder: index,
          })),
        }),
      });
      await this.load(true);
    },
    async archiveTable(table: RestaurantTable) {
      await request(`/api/admin/tables/${table.id}`, { method: "DELETE" });
      await this.load(true);
    },
    async deleteTables(tableIds: string[], groupIds: string[], includeGroupTables: boolean) {
      const result = (await request("/api/admin/tables/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ tableIds, groupIds, includeGroupTables }),
      })) as {
        deletedTableIds: string[];
        deletedGroupIds: string[];
        keptTableCount: number;
        keptGroupCount: number;
      };
      const deletedTables = new Set(result.deletedTableIds);
      const deletedGroups = new Set(result.deletedGroupIds);
      this.tables = this.tables.filter(({ id }) => !deletedTables.has(id));

      const countsByGroup = new Map<string, { tableCount: number; activeTableCount: number }>();
      for (const table of this.tables) {
        const counts = countsByGroup.get(table.groupId) ?? { tableCount: 0, activeTableCount: 0 };
        counts.tableCount++;
        if (table.isActive) counts.activeTableCount++;
        countsByGroup.set(table.groupId, counts);
      }
      this.groups = this.groups
        .filter(({ id }) => !deletedGroups.has(id))
        .map((group) => ({
          ...group,
          tableCount: countsByGroup.get(group.id)?.tableCount ?? 0,
          activeTableCount: countsByGroup.get(group.id)?.activeTableCount ?? 0,
        }));
      return result;
    },
  },
});
