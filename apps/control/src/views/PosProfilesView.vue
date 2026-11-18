<template>
  <PageHeader :title="t('nav.posProfiles')">
    <Button variant="solid" size="lg"
      v-if="options"
      type="button"
      :disabled="store.isReadOnly || !options.branches.length"
      @click="editor = { profile: null }"
    >
      <template #prefix><Plus :size="16" /></template>{{ t("selling.newProfile") }}
    </Button>
  </PageHeader>
  <section class="card overflow-hidden" :aria-busy="loading">
    <LoadingText v-if="loading" :text="t('common.loading')" role="status" class="p-6" />
    <Alert v-else-if="error" theme="red" :title="error" class="m-4">
      <template #actions>
        <Button variant="subtle" size="lg" type="button" @click="load(page)">
          {{ t("common.tryAgain") }}
        </Button>
      </template>
    </Alert>
    <p v-else-if="!profiles.length" class="p-6 text-sm text-black/55">
      {{ t("selling.noProfiles") }}
    </p>
    <List divider="none" v-else class="divide-y divide-black/10">
      <ListRow
        v-for="profile in profiles"
        :key="profile.id"
        class="!flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <div>
          <h2 class="font-bold">{{ profile.name }}</h2>
          <p class="mt-1 text-sm text-black/60">
            {{ profile.branch_name }} ·
            {{ t(profile.is_active ? "selling.active" : "selling.inactive") }}
          </p>
          <p
            v-if="profile.pending_config"
            class="mt-1 text-xs font-semibold text-amber-800"
          >
            {{ t("selling.pendingProfile") }}
          </p>
        </div>
        <Button variant="subtle" size="lg"
          type="button"
          :disabled="store.isReadOnly || !options"
          @click="editor = { profile }"
        >
          {{ t("common.edit") }}
        </Button>
      </ListRow>
    </List>
    <div
      v-if="page > 1 || hasMore"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 p-4"
    >
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || page === 1"
        @click="load(page - 1)"
      >
        {{ t("pages.orders.previous") }}
      </Button>
      <span class="text-sm text-black/60">{{
        t("pages.orders.page", { page })
      }}</span>
      <Button variant="subtle" size="lg"
        type="button"
        :disabled="loading || !hasMore"
        @click="load(page + 1)"
      >
        {{ t("pages.orders.next") }}
      </Button>
    </div>
  </section>

  <PosProfileEditor
    v-if="editor && options"
    :profile="editor.profile"
    :options="options"
    @close="editor = null"
    @saved="profileSaved"
  />
</template>

<script setup lang="ts">
import { List, ListRow } from "frappe-ui/list";
import { LoadingText, Alert, Button } from "frappe-ui";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Plus } from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import PosProfileEditor from "../components/PosProfileEditor.vue";
import { useAdminStore } from "../stores/admin";
import type { PosProfile, PosProfileOptions } from "../types/posProfile";

const { t } = useI18n();
const store = useAdminStore();
const options = ref<PosProfileOptions>();
const profiles = ref<PosProfile[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(true);
const error = ref("");
const editor = ref<{ profile: PosProfile | null } | null>(null);

async function load(nextPage: number) {
  loading.value = true;
  error.value = "";
  try {
    const [list, choices] = await Promise.all([
      store.request(`/api/admin/pos/profiles?page=${nextPage}`),
      options.value ?? store.request("/api/admin/pos/profile-options"),
    ]);
    profiles.value = list.profiles;
    page.value = list.page;
    hasMore.value = list.has_more;
    options.value = choices;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : t("selling.loadFailed");
  } finally {
    loading.value = false;
  }
}

function profileSaved() {
  editor.value = null;
  store.notify(t("selling.profileSaved"));
  void load(page.value);
}

onMounted(() => load(1));
</script>
