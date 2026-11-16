<template>
  <div>
    <header class="mb-4">
      <h1 class="display m-0 text-2xl">{{ t("pages.catalog.title") }}</h1>
    </header>
    <div
      class="sticky top-[76px] z-10 -mx-5 mb-4 border-y border-black/[.06] bg-[#f4f5f0]/95 px-5 py-3 shadow-[0_10px_30px_rgba(24,32,28,.06)] backdrop-blur-xl xl:hidden"
    >
      <div class="relative">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
          :size="17"
        />
        <input
          v-model="query"
          type="search"
          class="input !rounded-xl !py-2.5 !pl-10 !text-left !text-sm"
          placeholder="ស្វែងរកមុខម្ហូប..."
          aria-label="ស្វែងរកមុខម្ហូប"
        />
      </div>
      <div class="mt-2.5 flex items-center gap-2">
        <span class="mr-auto whitespace-nowrap text-xs font-bold text-black/40">
          {{ store.catalogPagination.total }} មុខ
        </span>
        <button
          type="button"
          class="relative inline-flex min-h-11 min-w-11 max-w-[8.5rem] items-center justify-center gap-2 rounded-full border px-3 text-xs font-bold transition"
          :class="
            hasActiveFilter
              ? 'border-ink bg-ink text-white'
              : 'border-black/[.08] bg-white text-ink'
          "
          :aria-label="`តម្រង៖ ${activeFilterLabel}`"
          @click="mobileFiltersOpen = true"
        >
          <SlidersHorizontal :size="17" class="shrink-0" aria-hidden="true" />
          <span class="hidden truncate min-[370px]:inline">{{
            activeFilterLabel
          }}</span>
          <span
            v-if="hasActiveFilter"
            class="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-[#f4f5f0] bg-mint"
          />
        </button>
        <MenuActionPopover v-if="!store.isReadOnly" v-slot="{ close }" :label="t('common.moreActions')">
          <button type="button" @click="close(); openCategoryManager()">
            <FolderPlus :size="16" aria-hidden="true" />{{ t("pages.catalog.categoryManager.manage") }}
          </button>
          <button type="button" @click="close(); openSortProducts()">
            <ListOrdered :size="16" aria-hidden="true" />{{ t("menus.orderProducts") }}
          </button>
          <button type="button" @click="close(); openBulkEdit()">
            <PencilLine :size="16" aria-hidden="true" />{{ t("pages.catalog.bulkEdit.title") }}
          </button>
          <button v-if="canStartBulkDelete" type="button" class="text-red-700" @click="close(); bulkDeleteSelecting = true">
            <Trash2 :size="16" aria-hidden="true" />{{ t("bulkProductDelete.action") }}
          </button>
        </MenuActionPopover>
        <button
          v-if="!store.isReadOnly"
          type="button"
          class="btn-primary min-h-11 min-w-11 shrink-0 !px-3 min-[460px]:!px-4"
          :aria-label="t('menus.addProduct')"
          @click="openNewProduct"
        >
          <Plus :size="18" aria-hidden="true" />
          <span class="hidden min-[460px]:inline">{{ t("menus.addProduct") }}</span>
        </button>
      </div>
    </div>

    <div class="card mb-5 hidden flex-wrap items-center gap-3 p-3 xl:flex">
      <div class="relative w-full sm:w-72">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
          :size="15"
        /><input
          v-model="query"
          class="input !rounded-xl !py-2.5 !pl-9 !text-left !text-xs"
          placeholder="ស្វែងរកជាភាសាខ្មែរ អង់គ្លេស ឬចិន..."
        />
      </div>
      <select
        v-model="category"
        class="input !w-auto max-w-64"
        :aria-label="t('pages.catalog.categoryFilterLabel')"
        @change="quickFilter = 'all'"
      >
        <option value="">គ្រប់ប្រភេទ</option>
        <option
          v-for="{ item, depth } in categoryRows"
          :key="item.id"
          :value="item.id"
        >
          {{ "\u00a0\u00a0".repeat(depth) }}{{ item.nameKm || item.name }} /
          {{ item.nameEn }}
        </option>
      </select>
      <span class="px-3 text-sm font-bold text-black/35"
        >{{ store.catalogPagination.total }} មុខ</span
      >
      <div class="ml-auto flex flex-wrap justify-end gap-2">
        <MenuActionPopover v-slot="{ close }" :label="t('common.moreActions')">
          <div class="p-2">
            <p class="label !mb-2">តម្រៀបបញ្ជីមុខម្ហូប</p>
            <div class="space-y-2">
              <select
                v-model="sortBy"
                class="input"
                aria-label="តម្រៀបមុខម្ហូបតាម"
              >
                <option
                  v-for="option in catalogSortOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <select
                v-model="sortDirection"
                class="input"
                aria-label="ទិសតម្រៀប"
              >
                <option value="asc">ឡើង (A–Z / ចាស់–ថ្មី)</option>
                <option value="desc">ចុះ (Z–A / ថ្មី–ចាស់)</option>
              </select>
            </div>
          </div>
          <template v-if="!store.isReadOnly">
            <hr class="my-1 border-black/[.08]" />
            <button type="button" @click="close(); openNewCategory()">
              <FolderPlus :size="16" aria-hidden="true" />{{ t("pages.catalog.categoryManager.add") }}
            </button>
            <button type="button" @click="close(); openSortCategories()">
              <ArrowUpDown :size="16" aria-hidden="true" />{{ t("pages.catalog.categoryManager.reorder") }}
            </button>
            <button type="button" @click="close(); openSortProducts()">
              <ListOrdered :size="16" aria-hidden="true" />{{ t("menus.orderProducts") }}
            </button>
            <button type="button" @click="close(); openBulkEdit()">
              <PencilLine :size="16" aria-hidden="true" />{{ t("pages.catalog.bulkEdit.title") }}
            </button>
            <button v-if="canStartBulkDelete" type="button" class="text-red-700" @click="close(); bulkDeleteSelecting = true">
              <Trash2 :size="16" aria-hidden="true" />{{ t("bulkProductDelete.action") }}
            </button>
          </template>
        </MenuActionPopover>
        <button v-if="!store.isReadOnly" type="button" class="btn-primary" @click="openNewProduct">
          <Plus :size="16" aria-hidden="true" />{{ t("menus.addProduct") }}
        </button>
      </div>
    </div>

    <div class="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside class="card hidden min-w-0 p-3 xl:block">
        <div class="mb-3 flex items-center justify-between px-2">
          <div>
            <h2 class="display m-0 text-lg font-extrabold">ប្រភេទ</h2>
            <p class="m-0 text-[11px] font-bold text-black/35">
              ភាសាខ្មែរ · EN · 中文
            </p>
          </div>
          <button
            v-if="!store.isReadOnly"
            type="button"
            class="grid size-8 place-items-center rounded-full bg-cream"
            :aria-label="t('pages.catalog.categoryManager.add')"
            @click="openNewCategory()"
          >
            <Plus :size="15" />
          </button>
        </div>
        <button
          class="mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'all' && !category
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          @click="showAllProducts"
        >
          មុខម្ហូបទាំងអស់
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="
              quickFilter === 'all' && !category
                ? 'bg-white/10'
                : 'bg-black/[.06]'
            "
            >{{ store.catalogCounts.all }}</span
          >
        </button>
        <button
          class="mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'published'
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          @click="showPublishedProducts"
        >
          <Eye :size="17" />បានផ្សាយ
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="
              quickFilter === 'published' ? 'bg-white/10' : 'bg-black/[.06]'
            "
            >{{ store.catalogCounts.published }}</span
          >
        </button>
        <button
          class="mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'unpublished'
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          @click="showUnpublishedProducts"
        >
          <EyeOff :size="17" />មិនបានផ្សាយ
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="
              quickFilter === 'unpublished' ? 'bg-white/10' : 'bg-black/[.06]'
            "
            >{{ store.catalogCounts.unpublished }}</span
          >
        </button>
        <button
          class="mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'featured'
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          @click="showFeaturedProducts"
        >
          <Sparkles :size="17" />មុខម្ហូបពិសេស
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="
              quickFilter === 'featured' ? 'bg-white/10' : 'bg-black/[.06]'
            "
            >{{ store.catalogCounts.featured }}</span
          >
        </button>
        <button
          class="mb-3 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'missing-photos'
              ? 'bg-ink text-white'
              : 'text-black/55 hover:bg-cream'
          "
          @click="showMissingPhotos"
        >
          <ImageOff :size="17" />មិនទាន់មានរូបថត
          <span
            class="ml-auto rounded-full px-2 py-0.5 text-xs"
            :class="
              quickFilter === 'missing-photos'
                ? 'bg-white/10'
                : 'bg-black/[.06]'
            "
            >{{ store.catalogCounts.missingPhotos }}</span
          >
        </button>
        <CatalogCategoryFilters
          :rows="visibleCategoryRows"
          :counts="categoryFilterCounts"
          :selected-id="category"
          :enable-en="store.business.enableEn"
          :enable-zh="store.business.enableZh"
          :editable="!store.isReadOnly"
          @select="showCategory"
          @toggle="toggleCategory"
          @edit="openEditCategory"
          @add-subcategory="openNewCategory"
          @delete="requestDeleteCategory"
        />
      </aside>

      <section
        class="relative min-w-0 space-y-3 transition-opacity"
        :class="catalogBusy ? 'pointer-events-none opacity-55' : ''"
      >
        <BulkProductDeleteActions
          v-if="!store.isReadOnly"
          hide-trigger
          v-model:selecting="bulkDeleteSelecting"
          v-model:selected-ids="bulkDeleteIds"
          :page-product-ids="filtered.map(({ id }) => id)"
          :scope-key="JSON.stringify(catalogFilters)"
          :fetch-matches="() => store.fetchMatchingCatalogProductIds(catalogFilters)"
          :disabled="catalogBusy || !!catalogError"
          @saved="refreshAfterProductDelete"
        />
        <div
          v-if="catalogBusy"
          class="card grid min-h-80 place-items-center"
        >
          <span
            class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold shadow-lg"
          >
            <LoaderCircle :size="15" class="animate-spin" />កំពុងផ្ទុក…
          </span>
        </div>
        <div
          v-if="catalogError"
          class="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {{ catalogError }}
        </div>
        <article
          v-for="product in filtered"
          :key="product.id"
          class="card flex items-start gap-3 p-3 sm:items-center sm:gap-4 sm:p-4"
        >
          <FallbackImage
            :src="product.imageUrl || product.images?.[0]?.url"
            alt=""
            loading="lazy"
            decoding="async"
            class="size-16 shrink-0 rounded-xl bg-cream object-cover sm:size-24 sm:rounded-2xl"
          >
            <template #fallback>
              <span
                class="grid size-16 shrink-0 place-items-center rounded-xl bg-cream text-black/25 sm:size-24 sm:rounded-2xl"
              >
                <PackageOpen :size="24" aria-hidden="true" />
              </span>
            </template>
          </FallbackImage>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex min-w-0 items-start gap-2">
              <label v-if="bulkDeleteSelecting && !store.isReadOnly" class="grid size-6 shrink-0 place-items-center">
                <input
                  v-model="bulkDeleteIds"
                  type="checkbox"
                  :value="product.id"
                  class="size-4 accent-red-600"
                  :aria-label="t('bulkProductDelete.selectProduct', { name: product.nameKm || product.name })"
                />
              </label>
              <h3
                class="m-0 min-w-0 font-bold leading-snug [overflow-wrap:anywhere]"
              >
                {{ product.nameKm || product.name }}
              </h3>
              <span
                v-if="product.isFeatured"
                class="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[10px] font-extrabold"
                >ពិសេស</span
              >
            </div>
            <p
              v-if="store.business.enableEn"
              class="m-0 text-xs font-medium text-black/55 [overflow-wrap:anywhere]"
            >
              EN: {{ product.nameEn || product.nameKm || product.name }}
            </p>
            <p
              v-if="store.business.enableZh"
              class="mb-2 mt-0 text-xs text-black/55 [overflow-wrap:anywhere]"
            >
              中文: {{ product.nameZh || product.nameKm || product.name }}
            </p>
            <div
              class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-black/35"
            >
              <span>{{ categoryName(product.categoryId) }}</span
              ><template v-if="product.code"
                ><span>·</span><span>{{ product.code }}</span></template
              >
              ><span>·</span
              ><span
                >{{
                  product.images?.length || (product.imageUrl ? 1 : 0)
                }}
                រូបថត</span
              >
              <template v-if="productTimestamp(product)">
                <span>·</span>
                <span
                  class="inline-flex items-center gap-1"
                  :title="absoluteProductTime(product)"
                >
                  <Clock3 :size="11" />{{ productTimeAgo(product) }}
                </span>
              </template>
            </div>
            <div
              class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden"
            >
              <strong class="display text-sm font-extrabold">
                {{ money(product.priceCents) }}
                <small v-if="product.unit" class="font-medium text-black/40">
                  / {{ product.unit }}
                </small>
              </strong>
              <span
                class="text-[11px] font-bold"
                :class="
                  product.isAvailable !== 0 && product.isAvailable !== false
                    ? 'text-emerald-600'
                    : 'text-black/35'
                "
              >
                {{
                  product.isAvailable !== 0 && product.isAvailable !== false
                    ? "● បានផ្សាយ"
                    : "○ បានលាក់"
                }}
              </span>
            </div>
          </div>
          <div class="hidden text-right sm:block">
            <div class="display text-lg font-extrabold">
              {{ money(product.priceCents) }}
              <small v-if="product.unit" class="font-medium text-black/40">
                / {{ product.unit }}
              </small>
            </div>
            <span
              class="text-xs font-bold"
              :class="
                product.isAvailable !== 0 && product.isAvailable !== false
                  ? 'text-emerald-600'
                  : 'text-black/35'
              "
            >
              {{
                product.isAvailable !== 0 && product.isAvailable !== false
                  ? "● បានផ្សាយ"
                  : "○ បានលាក់"
              }}
            </span>
          </div>
          <MenuActionPopover
            v-if="!store.isReadOnly && !bulkDeleteSelecting"
            v-slot="{ close }"
            compact
            :label="t('common.actionsFor', { name: product.nameKm || product.name })"
          >
            <button type="button" @click="close(); openEditProduct(product)">
              <Pencil :size="16" aria-hidden="true" />{{ t("common.edit") }}
            </button>
            <button type="button" class="text-red-700" @click="close(); requestDeleteProduct(product)">
              <Trash2 :size="16" aria-hidden="true" />{{ t("common.delete") }}
            </button>
          </MenuActionPopover>
        </article>
        <div
          v-if="!catalogBusy && !filtered.length"
          class="card py-16 text-center"
        >
          <PackageOpen class="mx-auto text-black/20" :size="44" />
          <h3>រកមិនឃើញមុខម្ហូប</h3>
          <p class="text-sm text-black/40">
            សូមសាកល្បងពាក្យស្វែងរក ឬប្រភេទផ្សេង។
          </p>
        </div>
        <div
          v-if="
            store.catalogPagination.total > store.catalogPagination.pageSize
          "
          class="card flex flex-col items-center justify-between gap-3 p-4 sm:flex-row"
        >
          <p class="m-0 text-xs font-bold text-black/45">
            បង្ហាញ {{ pageStart }}–{{ pageEnd }} ក្នុងចំណោម
            {{ store.catalogPagination.total }} មុខ
          </p>
          <div class="flex items-center gap-2">
            <button
              class="btn-soft"
              :disabled="currentPage <= 1 || catalogBusy"
              @click="loadPage(currentPage - 1)"
            >
              <ChevronLeft :size="16" />មុន
            </button>
            <span class="px-2 text-xs font-bold text-black/45">
              ទំព័រ {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              class="btn-soft"
              :disabled="currentPage >= totalPages || catalogBusy"
              @click="loadPage(currentPage + 1)"
            >
              បន្ទាប់<ChevronRight :size="16" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <ModalPanel
      :open="mobileFiltersOpen"
      title="តម្រង និងតម្រៀបមុខម្ហូប"
      @close="mobileFiltersOpen = false"
    >
      <div class="space-y-2">
        <p class="label !mb-2">តម្រៀបបញ្ជីមុខម្ហូប</p>
        <select v-model="sortBy" class="input" aria-label="តម្រៀបមុខម្ហូបតាម">
          <option
            v-for="option in catalogSortOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <select v-model="sortDirection" class="input" aria-label="ទិសតម្រៀប">
          <option value="asc">ឡើង (A–Z / ចាស់–ថ្មី)</option>
          <option value="desc">ចុះ (Z–A / ថ្មី–ចាស់)</option>
        </select>
      </div>

      <div class="mt-7 space-y-2">
        <p class="label !mb-2">ស្ថានភាពមុខម្ហូប</p>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'all' && !category
              ? 'bg-ink text-white'
              : 'bg-cream text-ink'
          "
          @click="applyMobileQuickFilter('all')"
        >
          <PackageOpen :size="18" />មុខម្ហូបទាំងអស់
          <span class="ml-auto text-xs opacity-65">{{
            store.catalogCounts.all
          }}</span>
          <Check v-if="quickFilter === 'all' && !category" :size="18" />
        </button>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'published'
              ? 'bg-ink text-white'
              : 'bg-cream text-ink'
          "
          @click="applyMobileQuickFilter('published')"
        >
          <Eye :size="18" />បានផ្សាយ
          <span class="ml-auto text-xs opacity-65">{{
            store.catalogCounts.published
          }}</span>
          <Check v-if="quickFilter === 'published'" :size="18" />
        </button>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'unpublished'
              ? 'bg-ink text-white'
              : 'bg-cream text-ink'
          "
          @click="applyMobileQuickFilter('unpublished')"
        >
          <EyeOff :size="18" />មិនបានផ្សាយ
          <span class="ml-auto text-xs opacity-65">{{
            store.catalogCounts.unpublished
          }}</span>
          <Check v-if="quickFilter === 'unpublished'" :size="18" />
        </button>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'featured'
              ? 'bg-ink text-white'
              : 'bg-cream text-ink'
          "
          @click="applyMobileQuickFilter('featured')"
        >
          <Sparkles :size="18" />មុខម្ហូបពិសេស
          <span class="ml-auto text-xs opacity-65">{{
            store.catalogCounts.featured
          }}</span>
          <Check v-if="quickFilter === 'featured'" :size="18" />
        </button>
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition"
          :class="
            quickFilter === 'missing-photos'
              ? 'bg-ink text-white'
              : 'bg-cream text-ink'
          "
          @click="applyMobileQuickFilter('missing-photos')"
        >
          <ImageOff :size="18" />មិនទាន់មានរូបថត
          <span class="ml-auto text-xs opacity-65">{{
            store.catalogCounts.missingPhotos
          }}</span>
          <Check v-if="quickFilter === 'missing-photos'" :size="18" />
        </button>
      </div>

      <div class="mt-7 space-y-2">
        <div class="mb-2 flex min-h-11 items-center justify-between gap-3">
          <p class="label !mb-0">ប្រភេទមុខម្ហូប</p>
          <button
            type="button"
            class="min-h-11 rounded-full px-3 text-xs font-extrabold text-ink hover:bg-cream"
            @click="openCategoryManagerFromFilters"
          >
            {{ t("pages.catalog.categoryManager.manageShort") }}
          </button>
        </div>
        <CatalogCategoryFilters
          :rows="visibleCategoryRows"
          :counts="categoryFilterCounts"
          :selected-id="category"
          :enable-en="store.business.enableEn"
          :enable-zh="store.business.enableZh"
          @select="applyMobileCategoryFilter"
          @toggle="toggleCategory"
        />
      </div>

      <template v-if="hasActiveFilter" #footer>
        <button
          type="button"
          class="btn-soft min-h-11 w-full"
          @click="clearMobileFilter"
        >
          សម្អាតតម្រង
        </button>
      </template>
    </ModalPanel>

    <ManageCategoriesDialog
      :open="categoryManagerOpen"
      :categories="store.categories"
      :counts="store.catalogCounts.byCategory"
      :enable-en="store.business.enableEn"
      :enable-zh="store.business.enableZh"
      :saving-category-id="categoryVisibilitySavingId"
      :error="categoryManagerError"
      @close="closeCategoryManager"
      @add="openNewCategory"
      @edit="openEditCategory"
      @reorder="openSortCategories"
      @toggle="toggleCategoryVisibility"
    />

    <ModalPanel
      :open="categoryOpen"
      :close-on-backdrop="false"
      mobile-fullscreen
      :title="editingCategoryId ? 'កែសម្រួលប្រភេទ' : t(subcategoryParentId ? 'pages.catalog.categoryManager.addSubcategory' : 'pages.catalog.categoryManager.add')"
      @close="!saving && closeCategory()"
    >
      <form
        id="catalog-category-form"
        class="space-y-4"
        @submit.prevent="saveCategory"
      >
        <label
          ><span class="label">ឈ្មោះប្រភេទ · ខ្មែរ</span
          ><input
            v-model="newCategory.nameKm"
            class="input"
            required
            lang="km"
            placeholder="ឧ. ប៊ឺហ្គឺ"
        /></label>
        <label v-if="store.business.enableEn"
          ><span class="label">ឈ្មោះប្រភេទ · អង់គ្លេស </span
          ><input
            v-model="newCategory.nameEn"
            class="input"
            placeholder="e.g. Burgers"
          /><small class="mt-1 block text-xs text-black/40"
            >ទុកទទេ ដើម្បីប្រើឈ្មោះខ្មែរ។</small
          ></label
        >
        <label v-if="store.business.enableZh"
          ><span class="label">ឈ្មោះប្រភេទ · ចិន </span
          ><input
            v-model="newCategory.nameZh"
            class="input"
            lang="zh"
            placeholder="例如：汉堡"
          /><small class="mt-1 block text-xs text-black/40"
            >ទុកទទេ ដើម្បីប្រើឈ្មោះខ្មែរ។</small
          ></label
        >
        <label
          ><span class="label">ប្រភេទមេ </span
          ><select v-model="newCategory.parentId" class="input" :disabled="!!subcategoryParentId">
            <option value="">ប្រភេទកម្រិតលើ</option>
            <option
              v-for="item in availableParentCategories"
              :key="item.id"
              :value="item.id"
            >
              {{ item.nameKm || item.name }}
              <template v-if="store.business.enableEn && item.nameEn">
                / {{ item.nameEn }}</template
              >
            </option>
          </select></label
        >
        <label
          ><span class="label">លំដាប់បង្ហាញ</span
          ><input
            v-model.number="newCategory.sortOrder"
            type="number"
            min="0"
            step="1"
            class="input"
        /></label>
        <ImageUploader
          v-model="newCategory.images"
          v-model:primary-id="newCategory.imageMediaId"
          label="រូបថតប្រភេទ "
          :max="1"
        />
        <label
          class="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
        >
          <input
            v-model="newCategory.isActive"
            type="checkbox"
            class="size-4 accent-black"
          />
          <span>
            បង្ហាញប្រភេទនេះលើម៉ឺនុយ QR
            <small class="mt-1 block font-medium text-black/45">
              ការបិទជម្រើសនេះនឹងលាក់ប្រភេទរង និងមុខម្ហូបរបស់វាផងដែរ។
            </small>
          </span>
        </label>
        <section
          v-if="editingCategoryId"
          class="rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <h3 class="m-0 text-sm font-extrabold text-red-950">
            {{ t("pages.catalog.categoryManager.deleteSection") }}
          </h3>
          <p class="mb-3 mt-1 text-xs leading-5 text-red-900/65">
            {{ categoryDeleteHelp }}
          </p>
          <button
            type="button"
            class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200 disabled:text-red-800/50"
            :disabled="!canDeleteEditingCategory || saving || deletingCategory"
            @click="editingCategory && requestDeleteCategory(editingCategory)"
          >
            <Trash2 :size="16" />
            {{ t("pages.catalog.categoryManager.deleteAction") }}
          </button>
        </section>
        <p v-if="formError" class="m-0 text-xs font-bold text-red-600">
          {{ formError }}
        </p>
      </form>

      <template #footer>
        <button
          type="submit"
          form="catalog-category-form"
          class="btn-primary w-full"
          :disabled="saving"
        >
          {{
            saving
              ? "កំពុងរក្សាទុក…"
              : editingCategoryId
                ? "រក្សាទុកប្រភេទ"
                : "បង្កើតប្រភេទ"
          }}
        </button>
      </template>
    </ModalPanel>

    <ProductEditorDialog
      ref="productEditor"
      :categories="store.categories"
      :initial-menu-id="route.query.assignToMenu === '1' ? menuReturnId || undefined : undefined"
      @close="returnToMenu"
      @saved="handleProductSaved"
    />

    <BulkEditProductsDialog
      :open="bulkEditOpen"
      :products="bulkEditProducts"
      :categories="store.categories"
      :enable-en="store.business.enableEn"
      :enable-zh="store.business.enableZh"
      :loading="bulkEditLoading"
      :saving="bulkEditSaving"
      :error="bulkEditError"
      @close="closeBulkEdit"
      @save="saveBulkEdit"
      @dirty-change="bulkEditDirty = $event"
    />

    <SortCategoriesDialog
      :open="sortCategoriesOpen"
      :categories="store.categories"
      :saving="sortSaving"
      :error="sortError"
      @close="closeSortDialogs"
      @save="saveCategoryOrder"
    />
    <SortProductsDialog
      :open="sortProductsOpen"
      :categories="store.categories"
      :products="sortableProducts"
      :saving="sortSaving"
      :error="sortError"
      @close="closeSortDialogs"
      @save="saveProductOrder"
    />
    <ConfirmDialog
      :open="Boolean(categoryToDelete)"
      :title="t('pages.catalog.categoryManager.deleteConfirmTitle')"
      :message="
        t('pages.catalog.categoryManager.deleteConfirmMessage', {
          name: categoryToDelete?.nameKm || categoryToDelete?.name || '',
        })
      "
      :confirm-label="t('pages.catalog.categoryManager.deleteAction')"
      :busy="deletingCategory"
      :error="categoryDeleteError"
      @close="closeDeleteCategory"
      @confirm="confirmDeleteCategory"
    />
    <ConfirmDialog
      :open="Boolean(productToDelete)"
      title="លុបមុខម្ហូបនេះមែនទេ?"
      :message="`លុប ${productToDelete?.nameKm || productToDelete?.name || 'មុខម្ហូបនេះ'} ជាអចិន្ត្រៃយ៍មែនទេ? វានឹងបាត់ពីម៉ឺនុយ QR សាធារណៈ។`"
      confirm-label="លុបមុខម្ហូប"
      :busy="deletingProduct"
      :error="deleteError"
      @close="closeDeleteProduct"
      @confirm="confirmDeleteProduct"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  FolderPlus,
  Plus,
  Search,
  Trash2,
  PackageOpen,
  Pencil,
  ArrowUpDown,
  ListOrdered,
  Sparkles,
  ImageOff,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Check,
  SlidersHorizontal,
  PencilLine,
  Clock3,
} from "lucide-vue-next";
import ModalPanel from "../components/ModalPanel.vue";
import MenuActionPopover from "../components/MenuActionPopover.vue";
import ProductEditorDialog from "../components/ProductEditorDialog.vue";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import ImageUploader from "../components/ImageUploader.vue";
import SortCategoriesDialog from "../components/SortCategoriesDialog.vue";
import ManageCategoriesDialog from "../components/ManageCategoriesDialog.vue";
import CatalogCategoryFilters from "../components/CatalogCategoryFilters.vue";
import SortProductsDialog from "../components/SortProductsDialog.vue";
import BulkEditProductsDialog from "../components/BulkEditProductsDialog.vue";
import BulkProductDeleteActions from "../components/BulkProductDeleteActions.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import {
  useAdminStore,
  type Category,
  type CatalogSort,
  type CatalogSortDirection,
  type MediaImage,
  type BulkProductInfoUpdate,
  type Product,
  type SortOrderItem,
} from "../stores/admin";
import { formatCurrency } from "../utils/currency";

const store = useAdminStore();
store.catalogLoading = true;
const route = useRoute();
const router = useRouter();
const menuReturnId = computed(() =>
  store.canAccessPage("menus") &&
  typeof route.query.addProductFromMenu === "string"
    ? route.query.addProductFromMenu
    : null,
);
const menuReturnRoute = computed(() => {
  const menuId = menuReturnId.value;
  return menuId === null
    ? null
    : { name: "menus", query: menuId ? { menuId } : {} };
});
const { locale, t } = useI18n();
const relativeNow = ref(Date.now());
let relativeTimeTimer = 0;
const query = ref("");
const category = ref("");
const expandedCategoryIds = reactive(new Set<string>());
const sortBy = ref<CatalogSort>("sort-order");
const sortDirection = ref<CatalogSortDirection>("asc");
const catalogSortStorageKey = computed(
  () =>
    `angkor_emenu_catalog_sort:${store.business.id || store.business.slug || "default"}`,
);
const catalogSortValues = new Set<CatalogSort>([
  "sort-order",
  "name-km",
  "name-en",
  "name-zh",
  "created-at",
  "updated-at",
]);

function isAvailableCatalogSort(value: unknown): value is CatalogSort {
  if (!catalogSortValues.has(value as CatalogSort)) return false;
  if (value === "name-en") return Boolean(store.business.enableEn);
  if (value === "name-zh") return Boolean(store.business.enableZh);
  return true;
}

function restoreCatalogSort() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(catalogSortStorageKey.value) || "null",
    ) as { sortBy?: unknown; sortDirection?: unknown } | null;
    sortBy.value = isAvailableCatalogSort(saved?.sortBy)
      ? saved.sortBy
      : "sort-order";
    sortDirection.value =
      saved?.sortDirection === "asc" || saved?.sortDirection === "desc"
        ? saved.sortDirection
        : "asc";
  } catch {
    sortBy.value = "sort-order";
    sortDirection.value = "asc";
  }
}

function persistCatalogSort() {
  try {
    localStorage.setItem(
      catalogSortStorageKey.value,
      JSON.stringify({
        sortBy: sortBy.value,
        sortDirection: sortDirection.value,
      }),
    );
  } catch {
    // Sorting still works when browser storage is unavailable.
  }
}
restoreCatalogSort();
type CatalogQuickFilter =
  "all" | "published" | "unpublished" | "featured" | "missing-photos";
const quickFilter = ref<CatalogQuickFilter>("all");
const mobileFiltersOpen = ref(false);
const categoryManagerOpen = ref(false);
const categoryManagerError = ref("");
const categoryVisibilitySavingId = ref("");
const categoryOpen = ref(false);
const productEditor = ref<InstanceType<typeof ProductEditorDialog>>();
const bulkEditOpen = ref(false);
const bulkEditLoading = ref(false);
const bulkEditSaving = ref(false);
const bulkEditError = ref("");
const bulkEditProducts = ref<Product[]>([]);
const bulkEditDirty = ref(false);
const bulkDeleteSelecting = ref(false);
const bulkDeleteIds = ref<string[]>([]);
const sortCategoriesOpen = ref(false);
const sortProductsOpen = ref(false);
const saving = ref(false);
const sortSaving = ref(false);
const formError = ref("");
const sortError = ref("");
const editingCategoryId = ref("");
const subcategoryParentId = ref("");
const categoryToDelete = ref<Category | null>(null);
const deletingCategory = ref(false);
const categoryDeleteError = ref("");
const productToDelete = ref<Product | null>(null);
const deletingProduct = ref(false);
const deleteError = ref("");
const catalogError = ref("");
const sortableProducts = ref<Product[]>([]);
const newCategory = reactive({
  nameKm: "",
  nameEn: "",
  nameZh: "",
  parentId: "",
  imageMediaId: "",
  images: [] as MediaImage[],
  sortOrder: 0,
  isActive: true,
});
const searchPending = ref(false);
const catalogBusy = computed(() => searchPending.value || store.catalogLoading);
const filtered = computed(() => catalogBusy.value ? [] : store.products);
const canStartBulkDelete = computed(
  () => !bulkDeleteSelecting.value && filtered.value.length > 0 && !catalogError.value,
);
const catalogSortOptions = computed<{ value: CatalogSort; label: string }[]>(
  () => [
    { value: "sort-order", label: "លំដាប់ (sort_order)" },
    { value: "name-km", label: "ឈ្មោះមុខម្ហូប · ខ្មែរ" },
    ...(store.business.enableEn
      ? [{ value: "name-en" as const, label: "ឈ្មោះមុខម្ហូប · English" }]
      : []),
    ...(store.business.enableZh
      ? [{ value: "name-zh" as const, label: "ឈ្មោះមុខម្ហូប · 中文" }]
      : []),
    { value: "created-at", label: "កាលបរិច្ឆេទបង្កើត" },
    { value: "updated-at", label: "កែប្រែចុងក្រោយ" },
  ],
);
const currentPage = computed(() => store.catalogPagination.page);
const totalPages = computed(() =>
  Math.max(
    1,
    Math.ceil(store.catalogPagination.total / store.catalogPagination.pageSize),
  ),
);
const pageStart = computed(() =>
  store.catalogPagination.total
    ? (currentPage.value - 1) * store.catalogPagination.pageSize + 1
    : 0,
);
const pageEnd = computed(() =>
  Math.min(
    currentPage.value * store.catalogPagination.pageSize,
    store.catalogPagination.total,
  ),
);
const hasActiveFilter = computed(
  () => Boolean(category.value) || quickFilter.value !== "all",
);
const activeFilterLabel = computed(() => {
  if (category.value) {
    const selectedCategory = store.categories.find(
      (item) => item.id === category.value,
    );
    return selectedCategory?.nameKm || selectedCategory?.name || "ប្រភេទ";
  }
  const labels: Record<CatalogQuickFilter, string> = {
    all: "តម្រង",
    published: "បានផ្សាយ",
    unpublished: "មិនបានផ្សាយ",
    featured: "មុខម្ហូបពិសេស",
    "missing-photos": "គ្មានរូបថត",
  };
  return labels[quickFilter.value];
});
const editingCategory = computed(() => store.categories.find(({ id }) => id === editingCategoryId.value));
const availableParentCategories = computed(() => {
  const parents = store.topCategories.filter(({ id }) => id !== editingCategoryId.value);
  const currentParentId = subcategoryParentId.value || editingCategory.value?.parentId;
  const nestedParent = store.categories.find(({ id, parentId }) => id === currentParentId && parentId);
  return nestedParent ? [...parents, nestedParent] : parents;
});
const editingCategoryProductCount = computed(() =>
  editingCategoryId.value
    ? Number(store.catalogCounts.byCategory[editingCategoryId.value] || 0)
    : 0,
);
const editingCategoryChildCount = computed(() =>
  editingCategoryId.value
    ? store.categories.filter(
        (item) => item.parentId === editingCategoryId.value,
      ).length
    : 0,
);
const canDeleteEditingCategory = computed(
  () =>
    Boolean(editingCategoryId.value) &&
    editingCategoryProductCount.value === 0 &&
    editingCategoryChildCount.value === 0,
);
const categoryDeleteHelp = computed(() => {
  if (canDeleteEditingCategory.value)
    return t("pages.catalog.categoryManager.deleteReady");
  if (
    editingCategoryProductCount.value > 0 &&
    editingCategoryChildCount.value > 0
  )
    return t("pages.catalog.categoryManager.deleteBlockedBoth", {
      products: editingCategoryProductCount.value,
      children: editingCategoryChildCount.value,
    });
  if (editingCategoryProductCount.value > 0)
    return t("pages.catalog.categoryManager.deleteBlockedProducts", {
      count: editingCategoryProductCount.value,
    });
  return t("pages.catalog.categoryManager.deleteBlockedChildren", {
    count: editingCategoryChildCount.value,
  });
});
const categoryName = (id: string) =>
  store.categories.find((x) => x.id === id)?.nameKm || "មិនទាន់ដាក់ប្រភេទ";
const categoryRows = computed(() => {
  const childrenByParent = new Map<string, Category[]>();
  for (const item of store.categories) {
    if (!item.parentId) continue;
    const siblings = childrenByParent.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort(
      (a, b) =>
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        (a.nameKm || a.name).localeCompare(b.nameKm || b.name),
    );
  }

  const rows: {
    item: Category;
    depth: number;
    visible: boolean;
    hasChildren: boolean;
    expanded: boolean;
  }[] = [];
  function append(items: Category[], depth: number, visible: boolean) {
    for (const item of items) {
      const children = childrenByParent.get(item.id) ?? [];
      const expanded = expandedCategoryIds.has(item.id);
      rows.push({
        item,
        depth,
        visible,
        hasChildren: children.length > 0,
        expanded,
      });
      append(children, depth + 1, visible && expanded);
    }
  }
  append(store.topCategories, 0, true);
  return rows;
});
const visibleCategoryRows = computed(() =>
  categoryRows.value.filter((row) => row.visible),
);
const categoryFilterCounts = computed(() => {
  const counts = { ...store.catalogCounts.byCategory };
  const rows = categoryRows.value;
  // Visit descendants before their parents so each subtotal is added once.
  for (let index = rows.length - 1; index >= 0; index--) {
    const { item } = rows[index];
    if (!item.parentId) continue;
    counts[item.parentId] = (counts[item.parentId] || 0) + (counts[item.id] || 0);
  }
  return counts;
});
const money = (amount: number) =>
  formatCurrency(amount, store.business.currency);
const relativeTimeFormatter = computed(
  () =>
    new Intl.RelativeTimeFormat(locale.value === "km" ? "km-KH" : "en", {
      numeric: "auto",
    }),
);

function productTimestamp(product: Product) {
  return product.createdAt || product.updatedAt || "";
}

function parseProductTimestamp(product: Product) {
  const value = productTimestamp(product);
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function productTimeAgo(product: Product) {
  const date = parseProductTimestamp(product);
  if (!date) return "";
  const seconds = (date.getTime() - relativeNow.value) / 1000;
  const absoluteSeconds = Math.abs(seconds);
  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;
  if (absoluteSeconds < 60) {
    value = Math.round(seconds);
    unit = "second";
  } else if (absoluteSeconds < 3600) {
    value = Math.round(seconds / 60);
    unit = "minute";
  } else if (absoluteSeconds < 86400) {
    value = Math.round(seconds / 3600);
    unit = "hour";
  } else if (absoluteSeconds < 2_592_000) {
    value = Math.round(seconds / 86400);
    unit = "day";
  } else if (absoluteSeconds < 31_536_000) {
    value = Math.round(seconds / 2_592_000);
    unit = "month";
  } else {
    value = Math.round(seconds / 31_536_000);
    unit = "year";
  }
  return relativeTimeFormatter.value.format(value, unit);
}

function absoluteProductTime(product: Product) {
  const date = parseProductTimestamp(product);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale.value === "km" ? "km-KH" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function showAllProducts() {
  category.value = "";
  quickFilter.value = "all";
}

function showFeaturedProducts() {
  category.value = "";
  quickFilter.value = "featured";
}

function showPublishedProducts() {
  category.value = "";
  quickFilter.value = "published";
}

function showUnpublishedProducts() {
  category.value = "";
  quickFilter.value = "unpublished";
}

function showMissingPhotos() {
  category.value = "";
  quickFilter.value = "missing-photos";
}

function showCategory(categoryId: string) {
  category.value = categoryId;
  quickFilter.value = "all";
}

function toggleCategory(categoryId: string) {
  if (expandedCategoryIds.has(categoryId))
    expandedCategoryIds.delete(categoryId);
  else expandedCategoryIds.add(categoryId);
}

function applyMobileQuickFilter(filter: CatalogQuickFilter) {
  category.value = "";
  quickFilter.value = filter;
  mobileFiltersOpen.value = false;
}

function applyMobileCategoryFilter(categoryId: string) {
  showCategory(categoryId);
  mobileFiltersOpen.value = false;
}

function clearMobileFilter() {
  showAllProducts();
  mobileFiltersOpen.value = false;
}

function openCategoryManager() {
  categoryManagerError.value = "";
  categoryManagerOpen.value = true;
}

function openCategoryManagerFromFilters() {
  mobileFiltersOpen.value = false;
  openCategoryManager();
}

function closeCategoryManager() {
  if (categoryVisibilitySavingId.value) return;
  categoryManagerOpen.value = false;
  categoryManagerError.value = "";
}

async function toggleCategoryVisibility(item: Category, isActive: boolean) {
  if (categoryVisibilitySavingId.value) return;
  categoryVisibilitySavingId.value = item.id;
  categoryManagerError.value = "";
  try {
    await store.updateCategory(item.id, {
      ...item,
      nameKm: item.nameKm || item.name,
      nameEn: item.nameEn || item.nameKm || item.name,
      nameZh: item.nameZh || item.nameKm || item.name,
      parentId: item.parentId || "",
      imageMediaId: item.imageMediaId || "",
      sortOrder: Number(item.sortOrder ?? 0),
      isActive,
    });
    await loadPage(currentPage.value);
  } catch (error) {
    categoryManagerError.value =
      error instanceof Error
        ? error.message
        : t("pages.catalog.categoryManager.visibilityError");
  } finally {
    categoryVisibilitySavingId.value = "";
  }
}

async function openBulkEdit() {
  bulkEditOpen.value = true;
  bulkEditLoading.value = true;
  bulkEditError.value = "";
  bulkEditProducts.value = [];
  try {
    bulkEditProducts.value = await store.fetchAllProducts();
  } catch (error) {
    bulkEditError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចផ្ទុកមុខម្ហូបសម្រាប់កែសម្រួលបានទេ។";
  } finally {
    bulkEditLoading.value = false;
  }
}

function closeBulkEdit() {
  if (bulkEditSaving.value) return;
  bulkEditOpen.value = false;
  bulkEditError.value = "";
  bulkEditProducts.value = [];
  bulkEditDirty.value = false;
}

async function saveBulkEdit(items: BulkProductInfoUpdate[]) {
  bulkEditSaving.value = true;
  bulkEditError.value = "";
  try {
    await store.bulkUpdateProductInfo(items);
    bulkEditOpen.value = false;
    bulkEditProducts.value = [];
    bulkEditDirty.value = false;
    await loadPage(currentPage.value);
  } catch (error) {
    bulkEditError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចរក្សាទុកការកែសម្រួលបានទេ។";
  } finally {
    bulkEditSaving.value = false;
  }
}

onBeforeRouteLeave(() => {
  if (!bulkEditOpen.value || bulkEditSaving.value || !bulkEditDirty.value)
    return true;
  return window.confirm(t("pages.catalog.bulkEdit.unsavedMessage"));
});

const catalogFilters = computed(() => ({
  query: query.value,
  categoryId: category.value,
  filter: quickFilter.value,
}));

async function loadPage(page = 1) {
  window.clearTimeout(searchTimer);
  searchPending.value = false;
  catalogError.value = "";
  try {
    await store.loadCatalogProducts({
      page,
      pageSize: 50,
      ...catalogFilters.value,
      sortBy: sortBy.value,
      sortDirection: sortDirection.value,
    });
  } catch (error) {
    catalogError.value =
      error instanceof Error ? error.message : "មិនអាចផ្ទុកមុខម្ហូបបានទេ។";
  }
}

let searchTimer = 0;
let catalogMounted = false;
watch(query, () => {
  if (!catalogMounted) return;
  searchPending.value = true;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => void loadPage(1), 300);
});
watch([category, quickFilter, sortBy, sortDirection], () => {
  if (catalogMounted) void loadPage(1);
});
watch([sortBy, sortDirection], persistCatalogSort, { flush: "sync" });
onMounted(() => {
  catalogMounted = true;
  relativeTimeTimer = window.setInterval(() => {
    relativeNow.value = Date.now();
  }, 60_000);
  void loadPage(1).then(() => {
    if (catalogMounted && menuReturnRoute.value && !productEditor.value?.productOpen)
      openNewProduct();
  });
});
onBeforeUnmount(() => {
  catalogMounted = false;
  window.clearTimeout(searchTimer);
  window.clearInterval(relativeTimeTimer);
});

watch(
  () => route.query.filter,
  (filter) => {
    if (filter === "missing-photos") showMissingPhotos();
    else if (filter === "published") showPublishedProducts();
    else if (filter === "unpublished") showUnpublishedProducts();
    else if (quickFilter.value !== "all") quickFilter.value = "all";
  },
  { immediate: true },
);

function resetCategory() {
  editingCategoryId.value = "";
  subcategoryParentId.value = "";
  Object.assign(newCategory, {
    nameKm: "",
    nameEn: "",
    nameZh: "",
    parentId: "",
    imageMediaId: "",
    images: [],
    sortOrder: 0,
    isActive: true,
  });
}
function openNewProduct() {
  if (!store.isReadOnly) productEditor.value?.openNewProduct();
}
function openEditProduct(item: Product) {
  if (!store.isReadOnly) productEditor.value?.openEditProduct(item, store.priceEntries);
}
function returnToMenu() {
  if (menuReturnRoute.value) void router.replace(menuReturnRoute.value);
}
function handleProductSaved(wasEditing: boolean, keepOpen: boolean) {
  if (menuReturnRoute.value && !keepOpen) returnToMenu();
  else void loadPage(wasEditing ? currentPage.value : 1);
}

function openNewCategory(parent?: Category) {
  if (store.isReadOnly || saving.value) return;
  resetCategory();
  subcategoryParentId.value = parent?.id ?? "";
  newCategory.parentId = subcategoryParentId.value;
  formError.value = "";
  categoryOpen.value = true;
}
function openEditCategory(item: Category) {
  if (store.isReadOnly || saving.value) return;
  subcategoryParentId.value = "";
  editingCategoryId.value = item.id;
  Object.assign(newCategory, {
    nameKm: item.nameKm || item.name,
    nameEn: item.nameEn || "",
    nameZh: item.nameZh || "",
    parentId: item.parentId || "",
    imageMediaId: item.imageMediaId || "",
    sortOrder: Number(item.sortOrder ?? 0),
    isActive: item.isActive !== 0 && item.isActive !== false,
    images:
      item.imageMediaId && item.imageUrl
        ? [{ id: item.imageMediaId, url: item.imageUrl }]
        : [],
  });
  formError.value = "";
  categoryOpen.value = true;
}
function requestDeleteCategory(item: Category) {
  if (store.isReadOnly || saving.value || deletingCategory.value ||
      store.catalogCounts.byCategory[item.id] > 0 ||
      store.categories.some(({ parentId }) => parentId === item.id)) return;
  categoryToDelete.value = item;
  categoryDeleteError.value = "";
}

function closeDeleteCategory() {
  if (deletingCategory.value) return;
  categoryToDelete.value = null;
  categoryDeleteError.value = "";
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value || deletingCategory.value || store.isReadOnly) return;
  deletingCategory.value = true;
  categoryDeleteError.value = "";
  const categoryId = categoryToDelete.value.id;
  try {
    await store.remove("categories", categoryId);
    if (category.value === categoryId) category.value = "";
    expandedCategoryIds.delete(categoryId);
    categoryToDelete.value = null;
    if (editingCategoryId.value === categoryId) closeCategory();
    await loadPage(currentPage.value);
  } catch (error) {
    categoryDeleteError.value =
      error instanceof Error
        ? error.message
        : t("pages.catalog.categoryManager.deleteError");
  } finally {
    deletingCategory.value = false;
  }
}

function requestDeleteProduct(item: Product) {
  productToDelete.value = item;
  deleteError.value = "";
}

function closeDeleteProduct() {
  if (deletingProduct.value) return;
  productToDelete.value = null;
  deleteError.value = "";
}

async function confirmDeleteProduct() {
  if (!productToDelete.value || deletingProduct.value) return;
  deletingProduct.value = true;
  deleteError.value = "";
  try {
    await store.remove("products", productToDelete.value.id);
    productToDelete.value = null;
    await refreshAfterProductDelete();
  } catch (error) {
    deleteError.value =
      error instanceof Error ? error.message : "មិនអាចលុបមុខម្ហូបបានទេ";
  } finally {
    deletingProduct.value = false;
  }
}

async function refreshAfterProductDelete() {
  await loadPage(currentPage.value);
  if (currentPage.value > totalPages.value)
    await loadPage(totalPages.value);
}
function closeCategory() {
  categoryOpen.value = false;
  formError.value = "";
  resetCategory();
}
function openSortCategories() {
  sortError.value = "";
  sortCategoriesOpen.value = true;
}
async function openSortProducts() {
  sortError.value = "";
  sortSaving.value = true;
  try {
    sortableProducts.value = await store.fetchAllProducts();
    sortProductsOpen.value = true;
  } catch (error) {
    catalogError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចផ្ទុកមុខម្ហូបសម្រាប់រៀបលំដាប់បានទេ។";
  } finally {
    sortSaving.value = false;
  }
}
function closeSortDialogs() {
  if (sortSaving.value) return;
  sortCategoriesOpen.value = false;
  sortProductsOpen.value = false;
  sortError.value = "";
  sortableProducts.value = [];
}
async function saveCategoryOrder(items: SortOrderItem[]) {
  sortSaving.value = true;
  sortError.value = "";
  try {
    await store.reorderCategories(items);
    sortCategoriesOpen.value = false;
    sortProductsOpen.value = false;
  } catch (error) {
    sortError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចរក្សាទុកលំដាប់ប្រភេទបានទេ";
  } finally {
    sortSaving.value = false;
  }
}
async function saveProductOrder(categoryId: string, items: SortOrderItem[]) {
  sortSaving.value = true;
  sortError.value = "";
  try {
    await store.reorderProducts(categoryId, items);
    sortCategoriesOpen.value = false;
    sortProductsOpen.value = false;
    sortableProducts.value = [];
    await loadPage(currentPage.value);
  } catch (error) {
    sortError.value =
      error instanceof Error
        ? error.message
        : "មិនអាចរក្សាទុកលំដាប់មុខម្ហូបបានទេ";
  } finally {
    sortSaving.value = false;
  }
}
async function saveCategory() {
  if (saving.value || store.isReadOnly) return;
  saving.value = true;
  formError.value = "";
  try {
    const payload = {
      ...newCategory,
      name: newCategory.nameKm,
      nameEn: newCategory.nameEn.trim() || newCategory.nameKm.trim(),
      nameZh: newCategory.nameZh.trim() || newCategory.nameKm.trim(),
      imageUrl: newCategory.images[0]?.url || "",
    };
    if (editingCategoryId.value)
      await store.updateCategory(editingCategoryId.value, payload);
    else {
      await store.addCategory(payload);
      if (subcategoryParentId.value) expandedCategoryIds.add(subcategoryParentId.value);
    }
    closeCategory();
    await loadPage(currentPage.value);
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "មិនអាចរក្សាទុកប្រភេទបានទេ";
  } finally {
    saving.value = false;
  }
}
</script>
