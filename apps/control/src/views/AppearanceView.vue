<template>
  <div>
    <PageHeader :title="$t('pages.appearance.title')">
      <div class="flex gap-2">
        <Button variant="subtle" size="lg" type="button" @click="resetDraft">
          <template #prefix><RotateCcw :size="16" /></template> Reset
        </Button>
        <Button
          variant="solid"
          size="lg"
          type="button"
          :disabled="saving || store.isReadOnly || !isValid"
          @click="publish"
        >
          <template #prefix
            ><Spinner v-if="saving" />
            <Save v-else :size="16"
          /></template>
          {{ saving ? "Publishing…" : "Publish theme" }}
        </Button>
      </div>
    </PageHeader>

    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div class="min-w-0 space-y-6">
        <SettingsTabs
          v-model="appearanceTab"
          :tabs="appearanceTabs"
          :label="$t('pages.appearance.tabs.label')"
        >
          <TabPanel
            :force-mount="true"
            value="style"
            class="space-y-6 data-[state=inactive]:hidden"
          >
            <section class="card p-5 sm:p-6">
              <div class="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 class="display m-0 text-xl font-extrabold">
                    Start with a style
                  </h2>
                  <p class="mb-0 mt-1 text-sm text-black/45">
                    Presets are fully editable after selection.
                  </p>
                </div>
                <Badge class="capitalize">{{ draft.mode }}</Badge>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <Button
                  v-for="preset in menuThemePresets"
                  :key="preset.id"
                  type="button"
                  class="admin-action-card"
                  size="lg"
                  :variant="draft.preset === preset.id ? 'subtle' : 'outline'"
                  :class="{
                    '!border-outline-gray-4': draft.preset === preset.id,
                  }"
                  :aria-pressed="draft.preset === preset.id"
                  @click="selectPreset(preset.theme)"
                >
                  <span
                    class="mb-3 flex h-14 overflow-hidden rounded-xl border border-black/[.06]"
                  >
                    <span
                      class="w-1/3"
                      :style="{ background: preset.theme.primaryColor }"
                    ></span>
                    <span
                      class="w-1/3"
                      :style="{ background: preset.theme.backgroundColor }"
                    ></span>
                    <span
                      class="w-1/3"
                      :style="{ background: preset.theme.surfaceColor }"
                    ></span>
                  </span>
                  <strong class="block text-sm">{{ preset.name }}</strong>
                  <span class="mt-1 block text-xs leading-5 text-black/45">{{
                    preset.description
                  }}</span>
                </Button>
              </div>
            </section>

            <section class="card p-5 sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="display m-0 text-xl font-extrabold">
                    Page background
                  </h2>
                  <p class="mb-0 mt-1 text-sm text-black/45">
                    Applied behind every page of your QR menu.
                  </p>
                </div>
                <Button
                  variant="subtle"
                  size="lg"
                  type="button"
                  class="!px-3 !py-2 text-xs"
                  @click="restoreBackground"
                >
                  Restore default
                </Button>
              </div>

              <TabButtons
                class="mt-5"
                :model-value="draft.backgroundType"
                :options="backgroundTypeOptions"
                aria-label="Background type"
                variant="subtle"
                fluid
                @update:model-value="selectBackgroundType"
              />

              <div v-if="draft.backgroundType === 'color'" class="mt-5">
                <p
                  class="m-0 rounded-2xl bg-cream p-4 text-sm leading-6 text-black/55"
                >
                  The Page background color from your brand palette will fill
                  the menu.
                </p>
              </div>

              <div v-else-if="draft.backgroundType === 'pattern'" class="mt-5">
                <div
                  v-for="group in patternGroups"
                  :key="group.id"
                  class="mt-5 first:mt-0"
                >
                  <h3 class="mb-3 mt-0 text-sm font-extrabold">
                    {{ group.label }}
                  </h3>
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Button
                      v-for="pattern in group.patterns"
                      :key="pattern.id"
                      type="button"
                      class="admin-action-card"
                      size="lg"
                      :variant="
                        draft.backgroundPattern === pattern.id
                          ? 'subtle'
                          : 'outline'
                      "
                      :class="{
                        '!border-outline-gray-4':
                          draft.backgroundPattern === pattern.id,
                      }"
                      :aria-pressed="draft.backgroundPattern === pattern.id"
                      @click="draft.backgroundPattern = pattern.id"
                    >
                      <span
                        class="pattern-swatch relative block h-20 overflow-hidden rounded-xl border border-black/[.06]"
                        :data-renderer="pattern.assetUrl ? 'cultural' : 'css'"
                        :style="patternPreviewStyle(pattern)"
                      ></span>
                      <span class="mt-2 block px-1 text-xs font-bold">
                        {{ pattern.name }}
                      </span>
                      <span
                        v-if="pattern.nameKm"
                        class="mt-0.5 block truncate px-1 text-[11px] text-black/45"
                      >
                        {{ pattern.nameKm }}
                      </span>
                    </Button>
                  </div>
                </div>
                <div class="mt-5 grid gap-5 sm:grid-cols-2">
                  <ColorField
                    label="Pattern color"
                    v-model="draft.backgroundPatternColor"
                  />
                  <RangeField
                    label="Pattern intensity"
                    v-model="draft.backgroundPatternOpacity"
                    :min="0"
                    :max="40"
                    suffix="%"
                  />
                </div>
              </div>

              <div v-else class="mt-5 space-y-5">
                <ImageUploader
                  v-model="backgroundImages"
                  label="Custom menu background"
                  profile="background"
                  preview="wide"
                  :max="1"
                />
                <p
                  v-if="!draft.backgroundImageMediaId"
                  class="m-0 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900"
                >
                  Upload an image before publishing this background.
                </p>
                <div class="grid gap-5 sm:grid-cols-2">
                  <ChoiceField
                    v-model="draft.backgroundImageFit"
                    label="Image layout"
                    :options="backgroundFitOptions"
                  />
                  <RangeField
                    label="Overlay strength"
                    v-model="draft.backgroundOverlayOpacity"
                    :min="0"
                    :max="90"
                    suffix="%"
                  />
                  <ColorField
                    label="Overlay color"
                    v-model="draft.backgroundOverlayColor"
                  />
                  <div
                    v-if="draft.backgroundImageFit === 'cover'"
                    class="space-y-4"
                  >
                    <RangeField
                      label="Horizontal focus"
                      v-model="draft.backgroundImagePositionX"
                      :min="0"
                      :max="100"
                      class="block"
                      suffix="%"
                    />
                    <RangeField
                      label="Vertical focus"
                      v-model="draft.backgroundImagePositionY"
                      :min="0"
                      :max="100"
                      class="block"
                      suffix="%"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section class="card p-5 sm:p-6">
              <h2 class="display m-0 text-xl font-extrabold">
                {{ t("pages.appearance.productPlaceholder.title") }}
              </h2>
              <p class="mb-5 mt-1 text-sm text-black/45">
                {{ t("pages.appearance.productPlaceholder.help") }}
              </p>
              <ImageUploader
                v-model="productPlaceholderImages"
                :label="t('pages.appearance.productPlaceholder.upload')"
                :max="1"
              />
            </section>

            <section class="card p-5 sm:p-6">
              <h2 class="display m-0 text-xl font-extrabold">Brand palette</h2>
              <p class="mb-5 mt-1 text-sm text-black/45">
                Use solid colors so text stays readable on every device.
              </p>
              <div class="grid gap-4 sm:grid-cols-2">
                <ColorField
                  v-for="field in colorFields"
                  :key="field.key"
                  :label="field.label"
                  v-model="draft[field.key]"
                />
              </div>
              <div
                class="mt-5 flex items-center gap-3 rounded-2xl p-4"
                :class="
                  contrastOk
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'bg-amber-50 text-amber-900'
                "
              >
                <component
                  :is="contrastOk ? CircleCheck : TriangleAlert"
                  :size="19"
                />
                <p class="m-0 text-sm font-bold">
                  Primary button contrast: {{ contrastRatio.toFixed(1) }}:1 ·
                  {{
                    contrastOk
                      ? "Accessible"
                      : "Choose a darker or lighter primary color"
                  }}
                </p>
              </div>
            </section>
          </TabPanel>

          <TabPanel
            :force-mount="true"
            value="typography"
            class="space-y-6 data-[state=inactive]:hidden"
          >
            <section class="card p-5 sm:p-6">
              <h2 class="display m-0 text-xl font-extrabold">
                Menu typography
              </h2>
              <p class="mb-5 mt-1 text-sm text-black/45">
                Set the color and phone-base size for the menu's main text
                roles. Larger screens scale automatically.
              </p>
              <div class="grid gap-4 sm:grid-cols-2">
                <div
                  v-for="field in typographyFields"
                  :key="field.colorKey"
                  class="rounded-2xl border border-black/[.07] p-4"
                >
                  <h3 class="m-0 text-sm font-extrabold">{{ field.label }}</h3>
                  <ColorField
                    class="mt-4 block"
                    label="Font color"
                    v-model="draft[field.colorKey]"
                  />
                  <RangeField
                    label="Font size"
                    v-model="draft[field.sizeKey]"
                    :min="field.min"
                    :max="field.max"
                    :step="1"
                    class="mt-4 block"
                    suffix="px"
                  />
                  <p
                    v-if="hasLowTypographyContrast(field)"
                    class="mb-0 mt-3 text-xs font-bold leading-5 text-amber-700"
                  >
                    Low contrast on its usual background. Consider a lighter or
                    darker color.
                  </p>
                </div>
              </div>
            </section>

            <section class="card p-5 sm:p-6">
              <h2 class="display m-0 text-xl font-extrabold">Menu prices</h2>
              <p class="mb-5 mt-1 text-sm text-black/45">
                Style the primary and converted prices independently.
              </p>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-2xl border border-black/[.07] p-4">
                  <h3 class="m-0 text-sm font-extrabold">Primary currency</h3>
                  <ColorField
                    class="mt-4 block"
                    label="Price color"
                    v-model="draft.primaryPriceColor"
                  />
                  <RangeField
                    label="Font size"
                    v-model="draft.primaryPriceFontSize"
                    :min="10"
                    :max="32"
                    :step="1"
                    class="mt-4 block"
                    suffix="px"
                  />
                </div>

                <div class="rounded-2xl border border-black/[.07] p-4">
                  <h3 class="m-0 text-sm font-extrabold">Secondary currency</h3>
                  <ColorField
                    class="mt-4 block"
                    label="Price color"
                    v-model="draft.secondaryPriceColor"
                  />
                  <RangeField
                    label="Font size"
                    v-model="draft.secondaryPriceFontSize"
                    :min="8"
                    :max="24"
                    :step="1"
                    class="mt-4 block"
                    suffix="px"
                  />
                </div>
              </div>
            </section>
          </TabPanel>

          <TabPanel
            as="section"
            :force-mount="true"
            value="layout"
            class="data-[state=inactive]:hidden card p-5 sm:p-6"
          >
            <h2 class="display m-0 text-xl font-extrabold">
              Typography and layout
            </h2>
            <div class="mt-5 grid gap-5 sm:grid-cols-2">
              <label
                ><span class="label">Heading font</span
                ><Select
                  size="lg"
                  variant="outline"
                  v-model="draft.headingFont"
                  :options="[...fonts]"
              /></label>
              <label
                ><span class="label">Body font</span
                ><Select
                  size="lg"
                  variant="outline"
                  v-model="draft.bodyFont"
                  :options="[...fonts]"
              /></label>
              <label class="block"
                ><span class="label">Khmer font</span>
                <Select
                  size="lg"
                  variant="outline"
                  v-model="draft.khmerFont"
                  :options="[...menuKhmerFonts]"
                />
              </label>
              <ChoiceField
                v-model="draft.cardStyle"
                label="Cards"
                :options="cardOptions"
              />
              <ChoiceField
                v-model="draft.cornerStyle"
                label="Corners"
                :options="cornerOptions"
              />
              <ChoiceField
                v-model="draft.imageRatio"
                label="Product images"
                :options="imageOptions"
              />
              <ChoiceField
                v-model="draft.defaultProductView"
                label="Default view"
                :options="viewOptions"
              />
              <ChoiceField
                v-model="draft.headerStyle"
                label="Header"
                :options="headerOptions"
              />
              <ChoiceField
                v-model="draft.categoryStyle"
                label="Categories"
                :options="categoryOptions"
              />
              <div
                class="rounded-2xl border border-black/[.07] p-4 sm:col-span-2"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="label !mb-1">
                      {{ $t("pages.appearance.cards.itemCode") }}
                    </p>
                    <p class="m-0 text-xs leading-5 text-black/45">
                      {{ $t("pages.appearance.cards.itemCodeHelp") }}
                    </p>
                  </div>
                  <label class="inline-flex cursor-pointer items-center gap-2">
                    <Checkbox
                      v-model="draft.showItemCode"
                      type="checkbox"
                      class="size-4 accent-black"
                    />
                    <span class="text-sm font-semibold">{{
                      $t("pages.appearance.cards.show")
                    }}</span>
                  </label>
                </div>
                <div
                  class="mt-4 grid gap-4 border-t border-black/[.06] pt-4 sm:grid-cols-2"
                  :class="!draft.showItemCode ? 'opacity-45' : ''"
                >
                  <ColorField
                    :label="$t('pages.appearance.cards.itemCodeColor')"
                    v-model="draft.itemCodeColor"
                    :disabled="!draft.showItemCode"
                  />
                  <RangeField
                    :label="$t('pages.appearance.cards.itemCodeSize')"
                    v-model="draft.itemCodeFontSize"
                    :min="8"
                    :max="18"
                    :step="1"
                    :disabled="!draft.showItemCode"
                    suffix="px"
                  />
                  <p
                    v-if="
                      draft.showItemCode &&
                      hasLowTypographyContrast(itemCodeTypographyField)
                    "
                    class="mb-0 text-xs font-bold leading-5 text-amber-700 sm:col-span-2"
                  >
                    {{ $t("pages.appearance.cards.itemCodeContrast") }}
                  </p>
                </div>
              </div>
              <div
                class="rounded-2xl border border-black/[.07] p-4 sm:col-span-2"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="label !mb-1">
                      {{ $t("pages.appearance.bottomNav.title") }}
                    </p>
                    <p class="m-0 text-xs leading-5 text-black/45">
                      {{ $t("pages.appearance.bottomNav.help") }}
                    </p>
                  </div>
                  <label class="inline-flex cursor-pointer items-center gap-2">
                    <Checkbox
                      v-model="draft.showBottomNav"
                      type="checkbox"
                      class="size-4 accent-black"
                    />
                    <span class="text-sm font-semibold">{{
                      $t("pages.appearance.cards.show")
                    }}</span>
                  </label>
                </div>
                <label
                  class="mt-4 flex items-start justify-between gap-4 rounded-xl bg-cream p-3"
                  :class="
                    !draft.showBottomNav ? 'cursor-not-allowed opacity-50' : ''
                  "
                >
                  <span>
                    <strong class="block text-sm">{{
                      $t("pages.appearance.bottomNav.showSearch")
                    }}</strong>
                    <span class="mt-1 block text-xs leading-5 text-black/45">{{
                      $t("pages.appearance.bottomNav.showSearchHelp")
                    }}</span>
                  </span>
                  <Checkbox
                    v-model="draft.showSearchNav"
                    type="checkbox"
                    class="mt-0.5 size-4 shrink-0 accent-black"
                    :disabled="!draft.showBottomNav"
                  />
                </label>
                <div class="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    v-for="option in bottomNavOptions"
                    :key="option.value"
                    type="button"
                    class="admin-action-card"
                    size="lg"
                    :variant="
                      draft.bottomNavStyle === option.value
                        ? 'subtle'
                        : 'outline'
                    "
                    :class="{
                      '!border-outline-gray-4':
                        draft.bottomNavStyle === option.value,
                    }"
                    :disabled="!draft.showBottomNav"
                    :aria-pressed="draft.bottomNavStyle === option.value"
                    @click="draft.bottomNavStyle = option.value"
                  >
                    <strong class="block text-sm">{{ option.label }}</strong>
                    <span class="mt-1 block text-xs leading-5 text-black/45">{{
                      option.description
                    }}</span>
                  </Button>
                </div>
                <div class="mt-4 grid gap-4 sm:grid-cols-3">
                  <ColorField
                    v-for="field in bottomNavColorFields"
                    :key="field.key"
                    :label="field.label"
                    v-model="draft[field.key]"
                    :disabled="!draft.showBottomNav"
                  />
                  <RangeField
                    label="Label font size"
                    v-model="draft.bottomNavFontSize"
                    :min="10"
                    :max="18"
                    :step="1"
                    :disabled="!draft.showBottomNav"
                    class="sm:col-span-3"
                    suffix="px"
                  />
                </div>
              </div>
            </div>
          </TabPanel>
        </SettingsTabs>
      </div>

      <aside class="top-[calc(var(--workspace-header-height,72px)+24px)] xl:sticky">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <p class="label mb-0">Live preview</p>
            <p class="m-0 text-xs text-black/40">Uses your current menu</p>
          </div>
          <div class="flex rounded-full bg-white p-1 shadow-sm">
            <Button
              variant="ghost"
              type="button"
              class="grid size-8 place-items-center rounded-full"
              :class="
                previewSize === 'phone' ? 'bg-ink text-white' : 'text-black/35'
              "
              aria-label="Phone preview"
              @click="previewSize = 'phone'"
            >
              <template #icon><Smartphone :size="15" /></template>
            </Button>
            <Button
              variant="ghost"
              type="button"
              class="grid size-8 place-items-center rounded-full"
              :class="
                previewSize === 'tablet' ? 'bg-ink text-white' : 'text-black/35'
              "
              aria-label="Tablet preview"
              @click="previewSize = 'tablet'"
            >
              <template #icon><Tablet :size="15" /></template>
            </Button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-[2rem] bg-[#dfe2da] p-3 sm:p-5">
          <div
            class="appearance-preview relative mx-auto min-h-[640px] overflow-hidden border-[6px] border-[#20221f] shadow-2xl transition-all"
            :class="
              previewSize === 'phone'
                ? 'max-w-[360px] rounded-[2rem]'
                : 'max-w-[620px] rounded-[1.5rem]'
            "
            :style="previewStyle"
            :data-pattern-renderer="
              draft.backgroundType === 'pattern' &&
              selectedPatternDefinition?.assetUrl
                ? 'cultural'
                : 'css'
            "
          >
            <div
              v-if="draft.headerStyle === 'banner'"
              class="h-28 bg-cover bg-center"
              :style="bannerStyle"
            ></div>
            <div
              class="p-4"
              :style="
                draft.headerStyle === 'solid'
                  ? { background: draft.primaryColor, color: onPrimary }
                  : undefined
              "
            >
              <div class="flex items-center gap-3">
                <BusinessLogo
                  :name="store.business.name"
                  :src="store.business.logoUrl"
                  class="size-12 rounded-xl text-sm"
                />
                <div class="min-w-0">
                  <strong
                    class="preview-heading block truncate"
                    :style="previewBusinessNameStyle"
                    >{{ store.business.name || "Your restaurant" }}</strong
                  ><span class="block truncate text-xs opacity-60">{{
                    store.business.address || "Your location"
                  }}</span>
                </div>
              </div>
              <p class="mb-0 mt-3 text-xs leading-5 opacity-70">
                {{
                  store.business.tagline ||
                  "A short message welcoming guests to your menu."
                }}
              </p>
            </div>
            <div
              class="flex gap-2 overflow-hidden px-4 py-3"
              :style="{ background: `${draft.surfaceColor}e8` }"
            >
              <span
                v-for="(category, index) in previewCategories"
                :key="category.id"
                class="whitespace-nowrap border-b-2 px-3 py-2 font-bold"
                :style="categoryChipStyle(index === 0)"
                >{{ category.nameKm || category.name }}</span
              >
            </div>
            <div class="px-4 pt-4">
              <strong
                class="preview-heading block leading-tight"
                :style="previewCategoryTitleStyle"
              >
                {{ previewCategoryTitle }}
              </strong>
            </div>
            <div
              class="grid gap-3 p-4"
              :class="draft.showBottomNav ? 'pb-28' : 'pb-4'"
              :style="{
                gridTemplateColumns:
                  draft.defaultProductView === 'grid'
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'minmax(0, 1fr)',
              }"
            >
              <article
                v-for="product in previewProducts"
                :key="product.id"
                class="overflow-hidden"
                :style="previewCardStyle"
              >
                <div
                  class="flex"
                  :class="
                    draft.defaultProductView === 'list' ? 'gap-3' : 'flex-col'
                  "
                >
                  <div
                    class="relative shrink-0"
                    :class="
                      draft.defaultProductView === 'list'
                        ? 'h-24 w-24'
                        : 'w-full'
                    "
                    :style="
                      draft.defaultProductView === 'grid'
                        ? imageStyle
                        : undefined
                    "
                  >
                    <FallbackImage
                      :src="product.imageUrl"
                      :fallback-src="productPlaceholderPreviewUrl"
                      alt=""
                      class="absolute inset-0 size-full object-cover"
                    >
                      <template #fallback>
                        <span
                          class="absolute inset-0 grid place-items-center opacity-30"
                          :style="{ background: draft.backgroundColor }"
                          aria-hidden="true"
                        >
                          <PackageOpen :size="24" />
                        </span>
                      </template>
                    </FallbackImage>
                  </div>
                  <div class="min-w-0 flex-1 p-3">
                    <small
                      v-if="draft.showItemCode && product.code"
                      class="mb-1 block truncate font-bold uppercase tracking-[.08em]"
                      :style="previewItemCodeStyle"
                    >
                      {{ product.code }}
                    </small>
                    <strong
                      class="preview-heading block truncate leading-tight"
                      :style="previewMenuItemTitleStyle"
                      >{{ product.nameKm || product.name }}</strong
                    ><span class="mt-2 block font-extrabold">
                      <span
                        class="block"
                        :style="{
                          color: draft.primaryPriceColor,
                          fontSize: `${draft.primaryPriceFontSize}px`,
                        }"
                        >{{ displayPrice(product.priceCents) }}</span
                      >
                      <small
                        v-if="store.business.showSecondaryCurrency"
                        class="mt-1 block font-semibold"
                        :style="{
                          color: draft.secondaryPriceColor,
                          fontSize: `${draft.secondaryPriceFontSize}px`,
                        }"
                      >
                        ≈ {{ displaySecondaryPrice(product.priceCents) }}
                      </small></span
                    >
                    <p
                      class="mb-0 mt-2 line-clamp-2 leading-5"
                      :style="previewDescriptionStyle"
                    >
                      {{
                        descriptionText(product.description) ||
                        "Freshly prepared with quality ingredients."
                      }}
                    </p>
                  </div>
                </div>
              </article>
              <article
                v-if="!previewProducts.length"
                class="col-span-full rounded-2xl p-8 text-center text-sm opacity-45"
                :style="{ background: draft.surfaceColor }"
              >
                Products will appear here.
              </article>
            </div>
            <div
              v-if="draft.showBottomNav"
              class="pointer-events-none absolute inset-x-0 bottom-0 z-10"
              :style="previewBottomNavOuterStyle"
            >
              <div
                class="grid"
                :style="{
                  ...previewBottomNavStyle,
                  gridTemplateColumns: `repeat(${previewNavItems.length}, minmax(0, 1fr))`,
                }"
              >
                <div
                  v-for="(item, index) in previewNavItems"
                  :key="item.label"
                  class="flex min-w-0 flex-col items-center gap-0.5 px-1 py-1.5 text-center"
                  :style="{
                    color:
                      index === 0
                        ? previewNavActiveColor
                        : previewMutedNavColor,
                    fontSize: `${draft.bottomNavFontSize}px`,
                  }"
                >
                  <span
                    class="grid size-7 place-items-center rounded-lg"
                    :style="previewBottomNavIconStyle(index === 0)"
                  >
                    <component :is="item.icon" :size="16" />
                  </span>
                  <small class="w-full truncate font-semibold leading-4">{{
                    item.label
                  }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import ColorField from "../components/ColorField.vue";
import RangeField from "../components/qr/RangeField.vue";
import { Badge, Button,
  Checkbox,
  Select,
  TabButtons,
  TabPanel,
  TextInput, Spinner } from "frappe-ui";
import { computed, defineComponent, h, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  CircleCheck,
  Heart,
  House,
  PackageOpen,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Smartphone,
  Tablet,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-vue-next";
import PageHeader from "../components/PageHeader.vue";
import BusinessLogo from "../components/BusinessLogo.vue";
import FallbackImage from "../../../../shared/FallbackImage.vue";
import { descriptionText } from "../../../../shared/descriptionText";
import {
  menuKhmerFontFamily,
  menuKhmerFonts,
} from "../../../../shared/menuFonts";
import ImageUploader from "../components/ImageUploader.vue";
import SettingsTabs from "../components/SettingsTabs.vue";
import { useAdminStore, type MediaImage } from "../stores/admin";
import {
  cloneMenuTheme,
  defaultMenuTheme,
  menuBackgroundPatterns,
  menuThemePresets,
  type MenuTheme,
} from "../types/menuTheme";
import { formatCurrency } from "../utils/currency";

const store = useAdminStore();
const { t } = useI18n();
const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
const draft = reactive<MenuTheme>(defaultMenuTheme());
const saving = ref(false);
const previewSize = ref<"phone" | "tablet">("phone");
const appearanceTab = ref<"style" | "typography" | "layout">("style");
const appearanceTabs = computed(() => [
  { id: "style", label: t("pages.appearance.tabs.style") },
  { id: "typography", label: t("pages.appearance.tabs.typography") },
  { id: "layout", label: t("pages.appearance.tabs.layout") },
]);
const backgroundTypeOptions: Array<{
  value: MenuTheme["backgroundType"];
  label: string;
}> = [
  { value: "color", label: "Color" },
  { value: "pattern", label: "Pattern" },
  { value: "image", label: "Image" },
];
type PatternDefinition = (typeof menuBackgroundPatterns)[number];
const patternGroups: Array<{
  id: PatternDefinition["group"];
  label: string;
  patterns: PatternDefinition[];
}> = [
  {
    id: "everyday",
    label: "Everyday patterns",
    patterns: menuBackgroundPatterns.filter(
      (pattern) => pattern.group === "everyday",
    ),
  },
  {
    id: "cultural",
    label: "Khmer festivals & culture",
    patterns: menuBackgroundPatterns.filter(
      (pattern) => pattern.group === "cultural",
    ),
  },
];
const selectedPatternDefinition = computed(() =>
  menuBackgroundPatterns.find(
    (pattern) => pattern.id === draft.backgroundPattern,
  ),
);
const fonts = [
  "Manrope",
  "DM Sans",
  "Noto Sans Khmer",
  "Noto Sans SC",
  "System UI",
];
const colorFields: Array<{
  key:
    | "primaryColor"
    | "accentColor"
    | "backgroundColor"
    | "surfaceColor"
    | "textColor";
  label: string;
}> = [
  { key: "primaryColor", label: "Brand / primary color" },
  { key: "accentColor", label: "Accent" },
  { key: "backgroundColor", label: "Page background" },
  { key: "surfaceColor", label: "Cards and surfaces" },
  { key: "textColor", label: "Text" },
];
type TypographyColorKey =
  | "businessNameColor"
  | "menuItemTitleColor"
  | "categoryTitleColor"
  | "categoryFilterColor"
  | "descriptionColor"
  | "itemCodeColor";
type TypographySizeKey =
  | "businessNameFontSize"
  | "menuItemTitleFontSize"
  | "categoryTitleFontSize"
  | "categoryFilterFontSize"
  | "descriptionFontSize"
  | "itemCodeFontSize";
type TypographyField = {
  label: string;
  colorKey: TypographyColorKey;
  sizeKey: TypographySizeKey;
  min: number;
  max: number;
  background: "header" | "page" | "surface";
};
const typographyFields: TypographyField[] = [
  {
    label: "Business name",
    colorKey: "businessNameColor",
    sizeKey: "businessNameFontSize",
    min: 18,
    max: 36,
    background: "header",
  },
  {
    label: "Menu-item name",
    colorKey: "menuItemTitleColor",
    sizeKey: "menuItemTitleFontSize",
    min: 12,
    max: 24,
    background: "surface",
  },
  {
    label: "Category / section title",
    colorKey: "categoryTitleColor",
    sizeKey: "categoryTitleFontSize",
    min: 20,
    max: 40,
    background: "page",
  },
  {
    label: "Category filter",
    colorKey: "categoryFilterColor",
    sizeKey: "categoryFilterFontSize",
    min: 10,
    max: 20,
    background: "surface",
  },
  {
    label: "Item description",
    colorKey: "descriptionColor",
    sizeKey: "descriptionFontSize",
    min: 11,
    max: 20,
    background: "surface",
  },
];
const itemCodeTypographyField: TypographyField = {
  label: "Item code",
  colorKey: "itemCodeColor",
  sizeKey: "itemCodeFontSize",
  min: 8,
  max: 18,
  background: "surface",
};
const cardOptions = [
  ["flat", "Flat"],
  ["bordered", "Bordered"],
  ["shadow", "Shadow"],
];
const cornerOptions = [
  ["square", "Square"],
  ["soft", "Soft"],
  ["rounded", "Rounded"],
];
const imageOptions = [
  ["square", "Square"],
  ["landscape", "Landscape"],
  ["portrait", "Portrait"],
];
const viewOptions = [
  ["grid", "Grid"],
  ["list", "List"],
];
const headerOptions = [
  ["banner", "Banner"],
  ["solid", "Brand color"],
  ["minimal", "Minimal"],
];
const categoryOptions = [
  ["pills", "Pills"],
  ["underline", "Underline"],
  ["images", "Image cards"],
];
const bottomNavOptions: Array<{
  value: MenuTheme["bottomNavStyle"];
  label: string;
  description: string;
}> = [
  {
    value: "simple",
    label: "Simple",
    description: "Flat, quiet, and separated by a fine top border.",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Full-width with a softly highlighted active item.",
  },
  {
    value: "floating",
    label: "Floating",
    description: "A raised rounded bar with space around the edges.",
  },
  {
    value: "glass",
    label: "Glassmorphism",
    description: "A translucent floating bar with background blur.",
  },
];
const bottomNavColorFields: Array<{
  key:
    "bottomNavBackgroundColor" | "bottomNavTextColor" | "bottomNavActiveColor";
  label: string;
}> = [
  { key: "bottomNavBackgroundColor", label: "Background" },
  { key: "bottomNavTextColor", label: "Text and icons" },
  { key: "bottomNavActiveColor", label: "Active item" },
];
const backgroundFitOptions = [
  ["cover", "Cover screen"],
  ["tile", "Repeat tile"],
];

const ChoiceField = defineComponent({
  props: {
    modelValue: { type: String, required: true },
    label: { type: String, required: true },
    options: { type: Array as () => string[][], required: true },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("label", [
        h("span", { class: "label" }, props.label),
        h(
          "select",
          {
            class: "input",
            value: props.modelValue,
            onChange: (event: Event) =>
              emit(
                "update:modelValue",
                (event.target as HTMLSelectElement).value,
              ),
          },
          props.options.map(([value, label]) => h("option", { value }, label)),
        ),
      ]);
  },
});

watch(
  () => store.business.menuTheme,
  (theme) =>
    Object.assign(
      draft,
      cloneMenuTheme(theme || defaultMenuTheme(store.business.themeColor)),
    ),
  { immediate: true, deep: true },
);
const hexRgb = (hex: string) => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) =>
    Number.parseInt(value.slice(index, index + 2), 16),
  );
};
const luminance = (hex: string) => {
  const channels = hexRgb(hex).map((value) => {
    const n = value / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const onPrimary = computed(() =>
  luminance(draft.primaryColor) > 0.42 ? "#111111" : "#ffffff",
);
const previewOnSurface = computed(() =>
  luminance(draft.bottomNavBackgroundColor) > 0.42 ? "#111111" : "#ffffff",
);
const previewMutedNavColor = computed(() => draft.bottomNavTextColor);
const previewNavActiveColor = computed(() => draft.bottomNavActiveColor);
const contrastRatio = computed(() => {
  const a = luminance(draft.primaryColor);
  const b = luminance(onPrimary.value);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
});
const contrastOk = computed(() => contrastRatio.value >= 4.5);
function hasLowTypographyContrast(field: TypographyField) {
  const foreground = draft[field.colorKey];
  if (!/^#[0-9a-f]{6}$/i.test(foreground)) return false;
  if (field.background === "header" && draft.headerStyle === "solid") {
    return false;
  }
  const background =
    field.background === "page"
      ? draft.backgroundColor
      : field.background === "header"
        ? draft.surfaceColor
        : draft.surfaceColor;
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const ratio =
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  return ratio < 4.5;
}
const isValid = computed(
  () =>
    colorFields.every(({ key }) => /^#[0-9a-f]{6}$/i.test(draft[key])) &&
    typographyFields.every(
      (field) =>
        /^#[0-9a-f]{6}$/i.test(draft[field.colorKey]) &&
        draft[field.sizeKey] >= field.min &&
        draft[field.sizeKey] <= field.max,
    ) &&
    /^#[0-9a-f]{6}$/i.test(draft.itemCodeColor) &&
    draft.itemCodeFontSize >= itemCodeTypographyField.min &&
    draft.itemCodeFontSize <= itemCodeTypographyField.max &&
    /^#[0-9a-f]{6}$/i.test(draft.backgroundPatternColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.backgroundOverlayColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.primaryPriceColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.secondaryPriceColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.bottomNavBackgroundColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.bottomNavTextColor) &&
    /^#[0-9a-f]{6}$/i.test(draft.bottomNavActiveColor) &&
    draft.bottomNavFontSize >= 10 &&
    draft.bottomNavFontSize <= 18 &&
    draft.primaryPriceFontSize >= 10 &&
    draft.primaryPriceFontSize <= 32 &&
    draft.secondaryPriceFontSize >= 8 &&
    draft.secondaryPriceFontSize <= 24 &&
    (draft.backgroundType !== "image" ||
      Boolean(draft.backgroundImageMediaId)) &&
    contrastOk.value,
);
const backgroundImages = computed<MediaImage[]>({
  get: () =>
    draft.backgroundImageMediaId && draft.backgroundImageUrl
      ? [
          {
            id: draft.backgroundImageMediaId,
            url: draft.backgroundImageUrl,
            filename: "Menu background",
          },
        ]
      : [],
  set: (images) => {
    draft.backgroundImageMediaId = images[0]?.id || "";
    draft.backgroundImageUrl = images[0]?.url || "";
  },
});
const productPlaceholderPreviewUrl = computed(() => {
  if (import.meta.env.DEV && draft.productPlaceholderMediaId)
    return `${apiBase.replace(/\/$/, "")}/media/${encodeURIComponent(draft.productPlaceholderMediaId)}`;
  return draft.productPlaceholderUrl;
});
const productPlaceholderImages = computed<MediaImage[]>({
  get: () =>
    draft.productPlaceholderMediaId && productPlaceholderPreviewUrl.value
      ? [
          {
            id: draft.productPlaceholderMediaId,
            url: productPlaceholderPreviewUrl.value,
            filename: t("pages.appearance.productPlaceholder.title"),
          },
        ]
      : [],
  set: ([image]) => {
    draft.productPlaceholderMediaId = image?.id || "";
    draft.productPlaceholderUrl = image?.url || "";
  },
});
const previewProducts = computed(() => store.products.slice(0, 4));
const previewCategories = computed(() =>
  store.categories.filter((item) => !item.parentId).slice(0, 4),
);
const previewCategoryTitle = computed(
  () =>
    previewCategories.value[0]?.nameKm ||
    previewCategories.value[0]?.name ||
    "Menu",
);
const previewNavItems = computed(() => [
  { label: "Home", icon: House },
  { label: "Menu", icon: UtensilsCrossed },
  ...(draft.showSearchNav ? [{ label: "Search", icon: Search }] : []),
  { label: "Saved", icon: Heart },
  ...(store.business.enableAddToOrder
    ? [{ label: "Order", icon: ShoppingBag }]
    : []),
]);
const previewBottomNavOuterStyle = computed(() => ({
  padding:
    draft.bottomNavStyle === "floating" || draft.bottomNavStyle === "glass"
      ? "0 10px 10px"
      : "0",
}));
const previewBottomNavStyle = computed(() => {
  const borderColor = hexRgba(previewOnSurface.value, 12);
  if (draft.bottomNavStyle === "simple") {
    return {
      background: draft.bottomNavBackgroundColor,
      borderTop: `1px solid ${borderColor}`,
      padding: "6px 8px 5px",
    };
  }
  if (draft.bottomNavStyle === "floating") {
    return {
      background: draft.bottomNavBackgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: "18px",
      boxShadow: "0 10px 28px rgba(0,0,0,.18)",
      padding: "5px 8px",
    };
  }
  if (draft.bottomNavStyle === "glass") {
    return {
      background: hexRgba(draft.bottomNavBackgroundColor, 72),
      border: `1px solid ${hexRgba(previewOnSurface.value, 16)}`,
      borderRadius: "18px",
      boxShadow: "0 10px 28px rgba(0,0,0,.16)",
      backdropFilter: "blur(14px)",
      padding: "5px 8px",
    };
  }
  return {
    background: hexRgba(draft.bottomNavBackgroundColor, 96),
    borderTop: `1px solid ${borderColor}`,
    boxShadow: "0 -5px 18px rgba(0,0,0,.08)",
    padding: "6px 8px 5px",
  };
});
function previewBottomNavIconStyle(active: boolean) {
  if (!active || draft.bottomNavStyle === "simple") return {};
  return { background: hexRgba(previewNavActiveColor.value, 12) };
}
const previewScaledSize = (size: number, tabletIncrease: number) =>
  `${size + (previewSize.value === "tablet" ? tabletIncrease : 0)}px`;
const previewBusinessNameStyle = computed(() => ({
  color:
    draft.headerStyle === "solid" ? onPrimary.value : draft.businessNameColor,
  fontSize: previewScaledSize(draft.businessNameFontSize, 6),
}));
const previewCategoryTitleStyle = computed(() => ({
  color: draft.categoryTitleColor,
  fontSize: previewScaledSize(draft.categoryTitleFontSize, 6),
}));
const previewMenuItemTitleStyle = computed(() => ({
  color: draft.menuItemTitleColor,
  fontSize: previewScaledSize(draft.menuItemTitleFontSize, 2),
}));
const previewItemCodeStyle = computed(() => ({
  color: draft.itemCodeColor,
  fontSize: `${draft.itemCodeFontSize}px`,
  opacity: 1,
}));
const previewDescriptionStyle = computed(() => ({
  color: draft.descriptionColor,
  fontSize: previewScaledSize(draft.descriptionFontSize, 1),
}));
const bannerStyle = computed(() => ({
  backgroundImage: store.banners[0]?.imageUrl
    ? `linear-gradient(#0002,#0002),url(${store.banners[0].imageUrl})`
    : `linear-gradient(135deg,${draft.primaryColor},${draft.accentColor})`,
}));
const previewStyle = computed(() => ({
  ...backgroundStyle(draft),
  ...culturalPatternVariables(
    selectedPatternDefinition.value,
    draft.backgroundPatternColor,
    draft.backgroundPatternOpacity,
  ),
  color: draft.textColor,
  fontFamily: fontStack(draft.bodyFont),
}));
const radius = computed(() =>
  draft.cornerStyle === "square"
    ? "0.25rem"
    : draft.cornerStyle === "soft"
      ? "0.85rem"
      : "1.4rem",
);
const previewCardStyle = computed(() => ({
  background: draft.surfaceColor,
  borderRadius: radius.value,
  border:
    draft.cardStyle === "bordered"
      ? `1px solid ${draft.textColor}20`
      : "1px solid transparent",
  boxShadow: draft.cardStyle === "shadow" ? "0 10px 24px #00000018" : "none",
}));
const imageStyle = computed(() => ({
  aspectRatio:
    draft.imageRatio === "square"
      ? "1"
      : draft.imageRatio === "portrait"
        ? "4 / 5"
        : "4 / 3",
}));
function categoryChipStyle(active: boolean) {
  const fontSize = previewScaledSize(draft.categoryFilterFontSize, 1);
  if (draft.categoryStyle === "underline") {
    return {
      color: active ? draft.primaryColor : draft.categoryFilterColor,
      borderBottomColor: active ? draft.primaryColor : "transparent",
      fontSize,
    };
  }
  return {
    color: active ? onPrimary.value : draft.categoryFilterColor,
    background: active ? draft.primaryColor : draft.surfaceColor,
    borderBottomColor: "transparent",
    borderRadius: draft.categoryStyle === "pills" ? "999px" : radius.value,
    fontSize,
  };
}
function fontStack(font: string) {
  const themeFont = font === "System UI" ? "system-ui" : `'${font}'`;
  return `${menuKhmerFontFamily(draft.khmerFont)}, ${themeFont}, sans-serif`;
}
function hexRgba(hex: string, opacity: number) {
  const [red, green, blue] = hexRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}
function patternStyle(
  pattern: MenuTheme["backgroundPattern"],
  color: string,
  opacity: number,
) {
  const ink = hexRgba(color, opacity);
  const faint = hexRgba(color, Math.max(1, opacity * 0.55));
  const styles: Partial<
    Record<
      MenuTheme["backgroundPattern"],
      { backgroundImage: string; backgroundSize: string }
    >
  > = {
    dots: {
      backgroundImage: `radial-gradient(circle, ${ink} 1.4px, transparent 1.6px)`,
      backgroundSize: "18px 18px",
    },
    waves: {
      backgroundImage: `radial-gradient(ellipse at 50% 100%, transparent 68%, ${ink} 70%, transparent 73%)`,
      backgroundSize: "34px 18px",
    },
    grid: {
      backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    },
    "khmer-diamond": {
      backgroundImage: `linear-gradient(45deg, transparent 43%, ${ink} 44%, ${ink} 47%, transparent 48%), linear-gradient(-45deg, transparent 43%, ${ink} 44%, ${ink} 47%, transparent 48%)`,
      backgroundSize: "32px 32px",
    },
    terrazzo: {
      backgroundImage: `radial-gradient(ellipse at 20% 30%, ${ink} 0 2px, transparent 3px), radial-gradient(ellipse at 75% 65%, ${faint} 0 3px, transparent 4px), radial-gradient(ellipse at 45% 85%, ${ink} 0 1.5px, transparent 2.5px)`,
      backgroundSize: "42px 42px",
    },
    paper: {
      backgroundImage: `linear-gradient(115deg, transparent 0 46%, ${faint} 47% 48%, transparent 49% 100%), radial-gradient(circle at 20% 30%, ${ink} 0 .7px, transparent 1px)`,
      backgroundSize: "28px 28px, 16px 16px",
    },
  };
  return styles[pattern] || {};
}
function backgroundStyle(theme: MenuTheme) {
  const base: Record<string, string> = {
    backgroundColor: theme.backgroundColor,
  };
  if (theme.backgroundType === "pattern") {
    return {
      ...base,
      ...patternStyle(
        theme.backgroundPattern,
        theme.backgroundPatternColor,
        theme.backgroundPatternOpacity,
      ),
    };
  }
  if (theme.backgroundType === "image" && theme.backgroundImageUrl) {
    return {
      ...base,
      backgroundImage: `linear-gradient(${hexRgba(theme.backgroundOverlayColor, theme.backgroundOverlayOpacity)}, ${hexRgba(theme.backgroundOverlayColor, theme.backgroundOverlayOpacity)}), url("${theme.backgroundImageUrl}")`,
      backgroundPosition: `${theme.backgroundImagePositionX}% ${theme.backgroundImagePositionY}%`,
      backgroundRepeat:
        theme.backgroundImageFit === "tile" ? "repeat" : "no-repeat",
      backgroundSize:
        theme.backgroundImageFit === "tile" ? "240px auto" : "cover",
    };
  }
  return base;
}
function culturalPatternVariables(
  pattern: PatternDefinition | undefined,
  color: string,
  opacity: number,
  scale = 1,
) {
  if (!pattern?.assetUrl) return {};
  return {
    "--preview-pattern-asset": `url("${pattern.assetUrl}")`,
    "--preview-pattern-color": color,
    "--preview-pattern-opacity": String(opacity / 100),
    "--preview-pattern-size": `${Math.round((pattern.tileSize || 128) * scale)}px`,
  };
}
function patternPreviewStyle(pattern: PatternDefinition) {
  return {
    backgroundColor: draft.backgroundColor,
    ...(pattern.assetUrl
      ? culturalPatternVariables(
          pattern,
          draft.backgroundPatternColor,
          Math.max(10, draft.backgroundPatternOpacity),
          0.62,
        )
      : patternStyle(
          pattern.id,
          draft.backgroundPatternColor,
          Math.max(10, draft.backgroundPatternOpacity),
        )),
  };
}
function selectPreset(theme: MenuTheme) {
  Object.assign(draft, cloneMenuTheme(theme), {
    khmerFont: draft.khmerFont,
    productPlaceholderMediaId: draft.productPlaceholderMediaId,
    productPlaceholderUrl: draft.productPlaceholderUrl,
  });
}
function selectBackgroundType(value: string | number) {
  const option = backgroundTypeOptions.find(
    ({ value: type }) => type === value,
  );
  if (option) setBackgroundType(option.value);
}

function setBackgroundType(type: MenuTheme["backgroundType"]) {
  if (type === "image" && !draft.backgroundImageMediaId) {
    draft.backgroundOverlayColor = draft.textColor;
  }
  draft.backgroundType = type;
}
function resetDraft() {
  Object.assign(
    draft,
    cloneMenuTheme(
      store.business.menuTheme || defaultMenuTheme(store.business.themeColor),
    ),
  );
}
function restoreBackground() {
  draft.backgroundType = "color";
  draft.backgroundPattern = "paper";
  draft.backgroundPatternColor = draft.primaryColor;
  draft.backgroundPatternOpacity = 8;
  draft.backgroundImageMediaId = "";
  draft.backgroundImageUrl = "";
  draft.backgroundImageFit = "cover";
  draft.backgroundImagePositionX = 50;
  draft.backgroundImagePositionY = 50;
  draft.backgroundOverlayColor = draft.textColor;
  draft.backgroundOverlayOpacity = 20;
}
function displayPrice(amount: number) {
  return formatCurrency(amount, store.business.currency);
}
function displaySecondaryPrice(amount: number) {
  return formatCurrency(
    amount * Number(store.business.secondaryExchangeRate || 0),
    store.business.secondaryCurrency,
  );
}
async function publish() {
  if (!isValid.value) return;
  saving.value = true;
  try {
    await store.saveMenuTheme(cloneMenuTheme(draft));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.appearance-preview {
  isolation: isolate;
  position: relative;
}
.appearance-preview[data-pattern-renderer="cultural"]::before,
.pattern-swatch[data-renderer="cultural"]::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background-color: var(--preview-pattern-color);
  opacity: var(--preview-pattern-opacity);
  -webkit-mask-image: var(--preview-pattern-asset);
  mask-image: var(--preview-pattern-asset);
  -webkit-mask-position: center top;
  mask-position: center top;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-size: var(--preview-pattern-size) var(--preview-pattern-size);
  mask-size: var(--preview-pattern-size) var(--preview-pattern-size);
}
.appearance-preview[data-pattern-renderer="cultural"]::before {
  z-index: -1;
}
.preview-heading {
  font-family: v-bind("fontStack(draft.headingFont)");
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
