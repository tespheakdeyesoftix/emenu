<template>
  <div class="space-y-4">
    <PageHeader :title="t('nav.menus')">
      <div class="flex flex-wrap justify-end gap-2">
        <Button variant="solid" size="lg"
          type="button"
          :disabled="loading || reordering || admin.isReadOnly"
          @click="open()"
        >
          <template #prefix><Plus :size="16" aria-hidden="true" /></template>{{ t("menus.new") }}
        </Button>
        <Button variant="subtle" size="lg"
          v-if="canEditProducts"
          type="button"
          :disabled="loading || productEditor?.productOpen"
          aria-haspopup="dialog"
          @click="productEditor?.openNewProduct()"
        >
          <template #prefix><Plus :size="16" aria-hidden="true" /></template>{{ t("menus.addProduct") }}
        </Button>
      </div>
    </PageHeader>
    <Alert v-if="error && !editing" theme="red" :title="error" />
    <div class="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside class="card min-w-0 p-3" :aria-busy="loading || reordering">
        <div class="flex items-center justify-between gap-2 px-2 pb-3 pt-1">
          <h2 class="display m-0 text-lg">{{ t("nav.menus") }}</h2>
          <Badge>{{ rows.length }}</Badge>
        </div>
        <DisclosureSection
          v-if="selectedMenu"
          :title="t('menus.productFilters')"
          icon="lucide-list-filter"
          initially-open
          class="mb-3 border-b border-outline-gray-1"
        >
          <template #label>
            {{ t("menus.productFilters") }}
            <span v-if="activeQuickFilterLabel" class="text-xs font-normal text-ink-gray-6 group-data-[state=open]:hidden">
              · {{ t(activeQuickFilterLabel) }}
            </span>
          </template>
          <div class="mt-1 space-y-1">
            <Button
              :variant="quickFilter === value ? 'solid' : 'ghost'"
              v-for="{ value, label, count, icon } in productFilters"
              :key="value"
              type="button"
              size="lg"
              class="w-full !justify-start !px-2 !text-sm"
              :aria-pressed="quickFilter === value"
              @click="quickFilter = value"
            >
              <component :is="icon" v-if="icon" :size="17" aria-hidden="true" />
              {{ t(label) }}
              <Badge v-if="productCounts" :class="quickFilter === value ? 'bg-white/10' : 'bg-black/[.06]'" class="ml-auto rounded-full px-2 py-0.5 text-xs">{{ productCounts[count] }}</Badge>
            </Button>
          </div>
        </DisclosureSection>
        <LoadingText v-if="loading && !rows.length" :text="t('common.loading')" role="status" class="p-2" />
        <p v-else-if="!rows.length" class="m-0 p-2 text-sm text-black/55">
          {{ t("menus.empty") }}
        </p>
        <div
          v-else
          class="max-h-[48vh] space-y-1 overflow-y-auto xl:max-h-[72vh]"
        >
          <MenuSidebarTree
            v-slot="{ menu, depth, active }"
            :children="children"
            :collapsed="collapsedMenus"
            :editable="!admin.isReadOnly"
            :busy="menuControlsBusy"
            @reorder="saveMenuOrder"
            @toggle="toggleMenu"

          >

            <Button
              type="button"
              :variant="selectedMenuId === menu.id ? 'solid' : 'ghost'"
              class="admin-row-button !h-auto min-w-0 flex-1 !shrink !justify-start !whitespace-normal !px-2 py-2 text-start"
              :aria-pressed="selectedMenuId === menu.id"
              :title="menuName(menu, locale)"
              @click="selectMenu(menu.id)"
            >
              <FallbackImage
                :src="menu.imageUrl"
                alt=""
                class="size-6 shrink-0 rounded-md object-cover"
              />
              <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <strong class="block text-sm leading-snug">{{
                  menuName(menu, locale)
                }}</strong>
                <small
                  v-if="!depth || menu.source === 'pos' || !active"
                  class="mt-0.5 block text-[11px] opacity-70"
                >
                  {{ [
                    !depth && t("menus.qrIdentityOnly"),
                    menu.source === "pos" && t("menus.posManaged"),
                    !active && t("menus.hidden"),
                  ].filter(Boolean).join(" · ") }}
                </small>
              </span>
            </Button>
            <MenuActionPopover
              v-if="!admin.isReadOnly"
              v-slot="{ close: closeActions }"
              compact
              :label="t('common.actionsFor', { name: menuName(menu, locale) })"
              :disabled="menuControlsBusy"
            >
              <Button variant="ghost" type="button" @click="closeActions(); open(menu)">
                <template #prefix><Pencil :size="14" aria-hidden="true" /></template>
                {{ t("menus.edit") }}
              </Button>
              <Button variant="ghost"
                v-if="menu.parentId || parentMenuIds.has(menu.id)"
                type="button"
                @click="closeActions(); requestProductMenuAction(menu, 'assign')"
              >
                <template #prefix><Plus :size="15" aria-hidden="true" /></template>
                {{ t("menus.assignProducts") }}
              </Button>
              <Button variant="ghost" type="button" @click="closeActions(); open(undefined, menu.id)">
                <template #prefix><FolderPlus :size="15" aria-hidden="true" /></template>
                {{ t("menus.submenu") }}
              </Button>
              <Button variant="ghost" type="button" @click="closeActions(); openMenuSort(menu.id)">
                <template #prefix><ListOrdered :size="16" aria-hidden="true" /></template>
                {{ t("menus.sortOrder") }}
              </Button>
              <Button variant="ghost"
                type="button"
                class="text-red-700"
                @click="closeActions(); requestMenuDelete(menu)"
              >
                <template #prefix><Trash2 :size="15" aria-hidden="true" /></template>
                {{ t("menus.delete") }}
              </Button>
            </MenuActionPopover>
          </MenuSidebarTree>
        </div>
      </aside>
      <MenuProductsPanel
        v-if="selectedMenu"
        :key="selectedMenu.id"
        ref="productsPanel"
        v-model:view-mode="viewMode"
        :menu="selectedMenu"
        :has-submenus="parentMenuIds.has(selectedMenu.id)"
        :categories="categories"
        :preview-url="previewUrl"
        :quick-filter="quickFilter"
        :can-edit-products="canEditProducts"
        @counts="productCounts = $event"
        @edit-product="openProductEditor"
        @sort-products="requestProductMenuAction($event, 'sort')"
      />
    </div>
    <ProductEditorDialog
      v-if="canEditProducts"
      ref="productEditor"
      :categories="categories"
      :initial-menu-id="initialProductMenuId"
      @saved="productsPanel?.refreshProducts()"
    />
    <SortMenusDialog
      v-if="sortGroup"
      :menus="sortGroup.menus"
      :selected-id="sortGroup.selectedId"
      :saving="reordering"
      :error="sortError"
      @close="sortGroup = null"
      @save="saveSortedMenus"
    />
    <ModalPanel
      :open="!!submenuPicker"
      :title="t(submenuPicker?.action === 'sort' ? 'menus.sortProductOrder' : 'menus.assignProducts')"
      @close="submenuPicker = null"
    >
      <form id="product-menu-target" @submit.prevent="chooseProductMenu">
        <label>
          <span class="label">{{ t("menus.chooseAssignmentSubmenu") }}</span>
          <Select
            size="lg"
            variant="outline"
            v-model="targetSubmenuId"
            required
            :options="[
              { label: t('menus.chooseAssignmentSubmenu'), value: '', disabled: true },
              ...submenuTargets.map(({ menu, depth }) => ({ label: '  '.repeat(depth - 1) + menuName(menu, locale), value: menu.id })),
            ]"
          />
        </label>
      </form>
      <template #footer>
        <Button variant="solid" size="lg" type="submit" form="product-menu-target" :disabled="!targetSubmenuId">
          {{ t(submenuPicker?.action === "sort" ? "menus.sortProductOrder" : "menus.chooseAssignmentProducts") }}
        </Button>
      </template>
    </ModalPanel>
    <ConfirmDialog
      :open="!!pendingDelete"
      :title="t('menus.delete')"
      :message="deleteMessage"
      :busy="deleting"
      :error="deleteError"
      @close="pendingDelete = null"
      @confirm="deleteMenu"
    />
    <ModalPanel
      :open="editing"
      :title="draft.id ? t('menus.edit') : t(draft.parentId ? 'menus.submenu' : 'menus.new')"
      :close-on-backdrop="!saving"
      @close="close"
    >
      <form id="menu-node-form" class="grid gap-4" @submit.prevent="save">
        <p v-if="editingPosMenu" class="m-0 text-sm text-black/60">{{ t("menus.editPosMenu") }}</p>
        <label v-if="!editingPosMenu && (!draft.id || draft.parentId)"
          ><span class="label">{{ t("menus.parent") }}</span>
          <Select
            size="lg"
            variant="outline"
            v-model="draft.parentId"
            :required="Boolean(draft.id && draft.parentId)"
            :options="[
              ...(!draft.id ? [{ label: t('menus.root'), value: '' }] : []),
              ...parents.map(({ menu, depth }) => ({ label: '  '.repeat(depth) + menuName(menu, locale), value: menu.id })),
            ]"
          />
        </label>
        <label
          ><span class="label">{{ t("menus.nameKm") }}</span
          ><TextInput size="lg" variant="outline" v-model.trim="draft.nameKm" maxlength="160"
        /></label>
        <label
          ><span class="label">{{ t("menus.nameEn") }}</span
          ><TextInput size="lg" variant="outline" v-model.trim="draft.nameEn" maxlength="160"
        /></label>
        <label
          ><span class="label">{{ t("menus.nameZh") }}</span
          ><TextInput size="lg" variant="outline" v-model.trim="draft.nameZh" maxlength="160"
        /></label>
        <label
          ><span class="label">{{ t("menus.slug") }}</span
          ><TextInput size="lg" variant="outline"
            v-model.trim="draft.slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxlength="80"
            :readonly="Boolean(draft.id)"
        /></label>
        <label
          ><span class="label">{{ t("menus.sort") }}</span
          ><TextInput size="lg" variant="outline"
            v-model.number="draft.sortOrder"
            type="number"
            min="0"
            required
        /></label>
        <ImageUploader v-model="photos" :label="t('menus.photo')" />
        <label class="flex items-center gap-2"
          ><Checkbox v-model="draft.isActive" type="checkbox" />{{
            t("menus.active")
          }}</label
        >
        <Alert v-if="error" theme="red" :title="error" />
      </form>
      <template #footer
        ><Button variant="solid" size="lg"
          type="submit"
          form="menu-node-form"
          :disabled="saving"
        >
          {{ t("menus.save") }}
        </Button></template
      >
    </ModalPanel>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "../components/PageHeader.vue";
import { Badge, Alert, LoadingText, Button, Checkbox, Select, TextInput } from "frappe-ui";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Eye,
  EyeOff,
  FolderPlus,
  ImageOff,
  ListOrdered,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-vue-next";
import { useRoute } from "vue-router";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ImageUploader from "../components/ImageUploader.vue";
import MenuActionPopover from "../components/MenuActionPopover.vue";
import MenuProductsPanel from "../components/MenuProductsPanel.vue";
import MenuSidebarTree from "../components/MenuSidebarTree.vue";
import DisclosureSection from "../components/DisclosureSection.vue";
import ModalPanel from "../components/ModalPanel.vue";
import ProductEditorDialog from "../components/ProductEditorDialog.vue";
import SortMenusDialog from "../components/SortMenusDialog.vue";
import {
  useAdminStore,
  type Category,
  type MediaImage,
  type Product,
  type ProductPriceEntry,
} from "../stores/admin";
import {
  menuChildren,
  menuLink,
  menuName,
  menuTree,
  type MenuNode,
  type MenuPlacement,
  type MenuProductCounts,
  type MenuProductFilter,
  type MenuTreeMove,
} from "../types/menu";

const { t, locale } = useI18n();
const admin = useAdminStore();
const route = useRoute();
const menus = ref<MenuNode[]>([]);
const categories = ref<Category[]>(admin.categories);
const productsPanel = ref<InstanceType<typeof MenuProductsPanel>>();
const productEditor = ref<InstanceType<typeof ProductEditorDialog>>();
const canEditProducts = computed(
  () => admin.canAccessPage("catalog") && !admin.isReadOnly,
);
const rows = computed(() => menuTree(menus.value));
const children = computed(() => menuChildren(menus.value));
type ProductMenuAction = "assign" | "sort";
const submenuPicker = ref<{ rootId: string; action: ProductMenuAction } | null>(null);
const targetSubmenuId = ref("");
const submenuTargets = computed(() => {
  if (!submenuPicker.value) return [];
  const branch = new Set([submenuPicker.value.rootId]);
  return rows.value.filter(({ menu }) => {
    if (!menu.parentId || !branch.has(menu.parentId)) return false;
    branch.add(menu.id);
    return true;
  });
});
const selectedMenuId = ref(
  typeof route.query.menuId === "string" ? route.query.menuId : "",
);
const selectedMenu = computed(() =>
  menus.value.find((menu) => menu.id === selectedMenuId.value),
);
const quickFilter = ref<MenuProductFilter | null>(null);
const productCounts = ref<MenuProductCounts>();
const productFilters = [
  { value: "all", label: "menus.allProducts", count: "all", icon: null },
  {
    value: "published",
    label: "menus.publishedProducts",
    count: "published",
    icon: Eye,
  },
  {
    value: "unpublished",
    label: "menus.unpublishedProduct",
    count: "unpublished",
    icon: EyeOff,
  },
  {
    value: "featured",
    label: "menus.featuredProducts",
    count: "featured",
    icon: Sparkles,
  },
  {
    value: "missing-photos",
    label: "menus.missingPhotos",
    count: "missingPhotos",
    icon: ImageOff,
  },
  {
    value: "unassigned-menu",
    label: "menus.unassignedMenu",
    count: "unassignedMenu",
    icon: Unlink,
  },
] as const;
const activeQuickFilterLabel = computed(
  () => productFilters.find(({ value }) => value === quickFilter.value)?.label,
);
watch(selectedMenuId, () => {
  quickFilter.value = null;
});
const initialProductMenuId = computed(() => {
  const menu = selectedMenu.value;
  return menu?.parentId && menu.source === "local" ? menu.id : undefined;
});
const collapsedMenus = reactive(new Set<string>());
const parentMenuIds = computed(
  () => new Set(menus.value.map(({ parentId }) => parentId)),
);
const viewMode = ref<"grid" | "list">("grid");
const previewUrl = computed(() => {
  let root = selectedMenu.value;
  while (root?.parentId)
    root = menus.value.find((menu) => menu.id === root?.parentId);
  return root?.isActive && admin.publicMenuUrl
    ? menuLink(admin.publicMenuUrl, "", root.slug).href
    : "";
});
const editing = ref(false);
const loading = ref(false);
const saving = ref(false);
const reordering = ref(false);
const sortGroup = ref<{ selectedId: string; menus: MenuNode[] } | null>(null);
const sortError = ref("");
const pendingDelete = ref<{ menu: MenuNode; includeSubmenus: boolean } | null>(null);
const deleting = ref(false);
const deleteError = ref("");
const menuControlsBusy = computed(
  () => loading.value || saving.value || reordering.value || editing.value || !!pendingDelete.value,
);
const deleteMessage = computed(() => {
  const target = pendingDelete.value;
  if (!target) return "";
  const { menu, includeSubmenus } = target;
  const name = menuName(menu, locale.value);
  return [
    t(includeSubmenus ? "menus.confirmDeleteBranch" : "menus.confirmDelete", { name }),
    t("menus.deleteKeepsProducts"),
    menu.source === "pos" && t("menus.deletePosMenu"),
    !menu.parentId && t("menus.deleteRootLinks"),
  ].filter(Boolean).join(" ");
});
const error = ref("");
const photos = ref<MediaImage[]>([]);
const draft = reactive({
  id: "",
  parentId: "",
  nameKm: "",
  nameEn: "",
  nameZh: "",
  slug: "",
  sortOrder: 0,
  isActive: true,
});
const editingPosMenu = computed(() => menus.value.some(
  ({ id, source }) => id === draft.id && source === "pos",
));
const parents = computed(() =>
  rows.value.filter(({ menu }) => {
    let parent: MenuNode | undefined = menu;
    while (parent) {
      if (parent.id === draft.id) return false;
      parent = menus.value.find((entry) => entry.id === parent?.parentId);
    }
    return true;
  }),
);

function toggleMenu(id: string) {
  if (collapsedMenus.has(id)) collapsedMenus.delete(id);
  else collapsedMenus.add(id);
}

function selectMenu(id: string) {
  if (id === selectedMenuId.value) productsPanel.value?.clearCategory();
  quickFilter.value = null;
  selectedMenuId.value = id;
}

async function openProductMenuAction(menuId: string, action: ProductMenuAction) {
  if (selectedMenuId.value !== menuId) selectMenu(menuId);
  revealSelectedMenu();
  await nextTick();
  if (selectedMenuId.value !== menuId) return;
  if (action === "sort") void productsPanel.value?.openOrder();
  else productsPanel.value?.openAssign();
}

function requestProductMenuAction(menu: MenuNode, action: ProductMenuAction) {
  if (menu.parentId) {
    void openProductMenuAction(menu.id, action);
    return;
  }
  targetSubmenuId.value = "";
  submenuPicker.value = { rootId: menu.id, action };
}

function chooseProductMenu() {
  const picker = submenuPicker.value;
  if (!picker || !submenuTargets.value.some(({ menu }) => menu.id === targetSubmenuId.value)) return;
  submenuPicker.value = null;
  void openProductMenuAction(targetSubmenuId.value, picker.action);
}

function openProductEditor(product: Product, priceEntries: ProductPriceEntry[]) {
  if (!productEditor.value?.productOpen)
    productEditor.value?.openEditProduct(product, priceEntries);
}

async function load(preferredMenuId?: string, revealSelection = true) {
  loading.value = true;
  try {
    const result = await admin.request("/api/admin/menus?includeCategories=1");
    menus.value = result.menus;
    categories.value = result.categories ?? [];
    const selection = preferredMenuId ?? selectedMenuId.value;
    selectedMenuId.value = menus.value.some((menu) => menu.id === selection)
      ? selection
      : (rows.value[0]?.menu.id ?? "");
    if (revealSelection) revealSelectedMenu();
  } catch (cause) {
    error.value = String(cause instanceof Error ? cause.message : cause);
  } finally {
    loading.value = false;
  }
}

function revealSelectedMenu() {
  let parentId = selectedMenu.value?.parentId;
  while (parentId) {
    collapsedMenus.delete(parentId);
    parentId = menus.value.find((menu) => menu.id === parentId)?.parentId;
  }
}

function openMenuSort(selectedId: string) {
  if (admin.isReadOnly || menuControlsBusy.value) return;
  sortError.value = "";
  sortGroup.value = { selectedId, menus: [...menus.value] };
}

async function saveSortedMenus(updates: MenuPlacement[]) {
  const group = sortGroup.value;
  if (!group || !updates.length || admin.isReadOnly || menuControlsBusy.value) return;
  reordering.value = true;
  sortError.value = "";
  error.value = "";
  try {
    const before = group.menus.map(({ id, parentId, sortOrder }) => ({ id, parentId, sortOrder }));
    await admin.request("/api/admin/menus/tree-order", {
      method: "PUT",
      body: JSON.stringify({ before, updates }),
    });
    const byId = new Map(updates.map((placement) => [placement.id, placement]));
    menus.value = menus.value.map((menu) => ({ ...menu, ...byId.get(menu.id) }))
      .sort((first, second) => first.sortOrder - second.sortOrder);
    sortGroup.value = null;
    await load();
    if (before.some(({ id, parentId }) => byId.has(id) && byId.get(id)?.parentId !== parentId))
      void productsPanel.value?.refreshProducts();
  } catch (cause) {
    sortError.value = cause instanceof Error ? cause.message : String(cause);
    await load(undefined, false);
  } finally {
    reordering.value = false;
  }
}

async function saveMenuOrder(
  parentId: string | null,
  menuIds: string[],
  move?: MenuTreeMove,
) {
  if (admin.isReadOnly || menuControlsBusy.value)
    return;

  reordering.value = true;
  error.value = "";
  const previousMenus = menus.value;
  const collapsedDestination = move && parentId && collapsedMenus.delete(parentId);
  const positions = new Map(menuIds.map((id, index) => [id, index]));
  menus.value = menus.value
    .map((menu) => {
      const sortOrder = positions.get(menu.id);
      return sortOrder === undefined ? menu : { ...menu, parentId, sortOrder };
    })
    .sort((first, second) => first.sortOrder - second.sortOrder);

  try {
    await admin.request("/api/admin/menus/reorder", {
      method: "PUT",
      body: JSON.stringify({ parentId, menuIds, move }),
    });
    await load(undefined, false);
    if (move) void productsPanel.value?.refreshProducts();
  } catch (cause) {
    menus.value = previousMenus;
    if (collapsedDestination && parentId) collapsedMenus.add(parentId);
    await load(undefined, false);
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    reordering.value = false;
  }
}

function requestMenuDelete(menu: MenuNode) {
  if (admin.isReadOnly || menuControlsBusy.value) return;
  deleteError.value = "";
  pendingDelete.value = { menu, includeSubmenus: parentMenuIds.value.has(menu.id) };
}

async function deleteMenu() {
  const target = pendingDelete.value;
  if (!target || deleting.value || admin.isReadOnly) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    const { deletedIds } = await admin.request(
      `/api/admin/menus/${target.menu.id}${target.includeSubmenus ? "?includeSubmenus=1" : ""}`,
      { method: "DELETE" },
    ) as { deletedIds: string[] };
    const removed = new Set(deletedIds);
    const selectedWasDeleted = removed.has(selectedMenuId.value);
    const selection = selectedWasDeleted ? target.menu.parentId ?? "" : selectedMenuId.value;
    menus.value = menus.value.filter(({ id }) => !removed.has(id));
    for (const id of removed) collapsedMenus.delete(id);
    selectedMenuId.value = selection || rows.value[0]?.menu.id || "";
    pendingDelete.value = null;
    await load();
    if (!selectedWasDeleted) void productsPanel.value?.refreshProducts();
    admin.notify(t("menus.deleted"));
  } catch (cause) {
    deleteError.value = cause instanceof Error ? cause.message : String(cause);
    await load(undefined, false);
  } finally {
    deleting.value = false;
  }
}

function open(menu?: MenuNode, parentId = "") {
  Object.assign(draft, {
    id: menu?.id ?? "",
    parentId: menu?.parentId ?? parentId,
    nameKm: menu?.nameKm ?? "",
    nameEn: menu?.nameEn ?? "",
    nameZh: menu?.nameZh ?? "",
    slug: menu?.slug ?? "",
    sortOrder: menu?.sortOrder ?? 0,
    isActive: menu ? Boolean(menu.isActive) : true,
  });
  photos.value = menu && (menu.imageMediaId || menu.imageUrl)
    ? [{ id: menu.imageMediaId ?? "", url: menu.imageUrl }]
    : [];
  error.value = "";
  editing.value = true;
}
function close() {
  if (saving.value) return;
  editing.value = false;
  error.value = "";
}
async function save() {
  saving.value = true;
  error.value = "";
  try {
    const result = await admin.request(
      `/api/admin/menus${draft.id ? `/${draft.id}` : ""}`,
      {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify({
          ...draft,
          imageMediaId: photos.value[0]?.id ?? null,
        }),
      },
    );
    editing.value = false;
    await load(result.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}
onMounted(() => void load());
</script>
