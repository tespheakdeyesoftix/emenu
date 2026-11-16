<template>
  <div>
    <PageHeader
      :eyebrow="$t('pages.business.eyebrow')"
      :title="$t('pages.business.title')"
      :description="$t('pages.business.description')"
      ><button type="submit" form="business-profile-form" class="btn-primary">
        <Save :size="17" />{{ $t("pages.business.save") }}
      </button></PageHeader
    >
    <SettingsTabs
      v-model="businessTab"
      :tabs="businessTabs"
      :label="$t('pages.business.tabs.label')"
      id-prefix="business-settings"
    />
    <div class="grid gap-5 xl:grid-cols-[1fr_360px]">
      <form
        id="business-profile-form"
        class="card p-6 lg:p-8"
        novalidate
        @submit.prevent="saveBusiness"
      >
        <section
          v-show="businessTab === 'profile'"
          id="business-settings-panel-profile"
          role="tabpanel"
          aria-labelledby="business-settings-tab-profile"
          data-business-tab="profile"
          class="grid gap-5 md:grid-cols-2"
        >
          <div class="md:col-span-2">
            <span class="label">ឡូហ្គោភោជនីយដ្ឋាន</span>
            <div
              class="flex flex-col gap-4 rounded-2xl border border-black/[.08] p-4 sm:flex-row sm:items-center"
            >
              <BusinessLogo
                :name="store.business.name"
                :src="store.business.logoUrl"
                alt="មើលឡូហ្គោភោជនីយដ្ឋានជាមុន"
                class="size-20 rounded-2xl text-xl"
              />
              <div class="min-w-0 flex-1">
                <div class="font-bold">បង្ហោះឡូហ្គោភោជនីយដ្ឋានរបស់អ្នក</div>
                <p class="mb-3 mt-1 text-xs leading-5 text-black/45">
                  JPG, PNG ឬ WebP។ រូបភាពនឹងត្រូវកែទំហំទទឹងអតិបរមា 500 px
                  និងបង្រួមមកប្រហែល 100–200 KB មុនពេលបង្ហោះ។
                </p>
                <div class="flex flex-wrap gap-2">
                  <label
                    class="btn-soft cursor-pointer"
                    :class="
                      logoUploading ? 'pointer-events-none opacity-60' : ''
                    "
                  >
                    <ImageUp :size="16" />
                    {{
                      logoUploading ? "កំពុងកែសម្រួល និងបង្ហោះ…" : "ជ្រើសឡូហ្គោ"
                    }}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      class="hidden"
                      @change="uploadLogo"
                    />
                  </label>
                  <button
                    v-if="store.business.logoUrl"
                    type="button"
                    class="btn-soft text-red-600"
                    @click="removeLogo"
                  >
                    <Trash2 :size="16" />លុប
                  </button>
                </div>
                <p
                  v-if="logoError"
                  class="mb-0 mt-2 text-xs font-bold text-red-600"
                >
                  {{ logoError }}
                </p>
              </div>
            </div>
          </div>
          <label class="md:col-span-2"
            ><span class="label">ឈ្មោះអាជីវកម្ម</span
            ><input v-model="store.business.name" class="input" /></label
          ><label class="md:col-span-2"
            ><span class="label">ពាក្យស្លោក</span
            ><input v-model="store.business.tagline" class="input" /></label
          ><label class="md:col-span-2"
            ><span class="label">អំពីអាជីវកម្មរបស់អ្នក</span
            ><textarea
              v-model="store.business.description"
              rows="4"
              class="input resize-none"
            ></textarea>
          </label>
          <fieldset class="md:col-span-2 rounded-3xl bg-cream p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <p class="label !mb-1">លេខទំនាក់ទំនង</p>
                <p class="m-0 text-xs text-black/45">
                  បន្ថែមលេខទូរសព្ទដែលភ្ញៀវអាចហៅបាន។
                </p>
              </div>
              <button type="button" class="btn-soft" @click="addContact">
                <Plus :size="15" />បន្ថែមលេខ
              </button>
            </div>
            <div
              v-if="!store.business.contactNumbers.length"
              class="rounded-2xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-black/40"
            >
              មិនទាន់មានលេខទំនាក់ទំនងទេ។
            </div>
            <div
              v-for="(contact, index) in store.business.contactNumbers"
              :key="index"
              class="mb-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]"
            >
              <input
                v-model="contact.label"
                class="input"
                placeholder="ចម្បង"
                maxlength="30"
              />
              <input
                v-model="contact.number"
                class="input"
                placeholder="+855 12 345 678"
                maxlength="40"
              />
              <button
                type="button"
                class="btn-soft !px-3 text-red-600"
                aria-label="លុបលេខទំនាក់ទំនង"
                @click="store.business.contactNumbers.splice(index, 1)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </fieldset>
          <label
            ><span class="label">អ៊ីមែល</span
            ><input
              v-model="store.business.email"
              type="email"
              class="input"
              placeholder="hello@restaurant.com"
          /></label>
          <label
            ><span class="label">គេហទំព័រ</span
            ><input
              v-model="store.business.websiteUrl"
              type="url"
              class="input"
              placeholder="https://restaurant.com"
          /></label>
          <label class="md:col-span-2"
            ><span class="label">អាសយដ្ឋាន</span
            ><input v-model="store.business.address" class="input"
          /></label>
        </section>

        <section
          v-show="businessTab === 'public'"
          id="business-settings-panel-public"
          role="tabpanel"
          aria-labelledby="business-settings-tab-public"
          data-business-tab="public"
          class="grid gap-5 md:grid-cols-2"
        >
          <fieldset class="md:col-span-2 rounded-3xl bg-cream p-5">
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <p class="label !mb-1">
                  {{ $t("pages.business.locations.title") }}
                </p>
                <p class="m-0 max-w-2xl text-xs leading-5 text-black/45">
                  {{ $t("pages.business.locations.description") }}
                </p>
              </div>
              <button
                type="button"
                class="btn-soft shrink-0"
                :disabled="store.business.locations.length >= 20"
                @click="addLocation"
              >
                <Plus :size="15" />{{ $t("pages.business.locations.add") }}
              </button>
            </div>

            <div
              v-if="!store.business.locations.length"
              class="rounded-2xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-black/40"
            >
              {{ $t("pages.business.locations.empty") }}
            </div>

            <div
              v-for="(location, index) in store.business.locations"
              :key="index"
              class="mb-3 rounded-2xl border border-black/[.07] bg-white p-4 last:mb-0"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <strong class="text-sm">{{
                  $t("pages.business.locations.branch", { number: index + 1 })
                }}</strong>
                <div class="flex items-center gap-2">
                  <label
                    class="flex cursor-pointer items-center gap-2 rounded-full bg-cream px-3 py-2 text-xs font-bold"
                  >
                    <input
                      v-model="location.showInMenu"
                      type="checkbox"
                      class="size-4 accent-black"
                    />
                    {{ $t("pages.business.locations.showInMenu") }}
                  </label>
                  <button
                    type="button"
                    class="grid size-9 place-items-center rounded-xl text-red-600 transition hover:bg-red-50"
                    :aria-label="
                      $t('pages.business.locations.remove', {
                        number: index + 1,
                      })
                    "
                    @click="removeLocation(index)"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <label>
                  <span class="label">{{
                    $t("pages.business.locations.label")
                  }}</span>
                  <input
                    v-model.trim="location.label"
                    class="input"
                    maxlength="80"
                    required
                    :placeholder="
                      $t('pages.business.locations.labelPlaceholder')
                    "
                  />
                </label>
                <label>
                  <span class="label">{{
                    $t("pages.business.locations.address")
                  }}</span>
                  <input
                    v-model.trim="location.address"
                    class="input"
                    maxlength="240"
                    :placeholder="
                      $t('pages.business.locations.addressPlaceholder')
                    "
                  />
                </label>
                <label class="sm:col-span-2">
                  <span class="label">{{
                    $t("pages.business.locations.mapUrl")
                  }}</span>
                  <input
                    v-model.trim="location.mapUrl"
                    type="url"
                    class="input"
                    required
                    placeholder="https://maps.google.com/..."
                  />
                  <small class="mt-2 block text-xs text-black/45">{{
                    $t("pages.business.locations.mapHelp")
                  }}</small>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset
            class="md:col-span-2 rounded-3xl border border-black/[.07] p-5"
          >
            <legend class="label">ព័ត៌មានក្រោមឈ្មោះអាជីវកម្ម</legend>
            <p class="mb-4 mt-0 text-xs leading-5 text-black/45">
              ជ្រើសព័ត៌មានដែលត្រូវបង្ហាញនៅផ្នែកខាងលើនៃម៉ឺនុយ QR។
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label
                v-for="option in headerDisplayOptions"
                :key="option.key"
                class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
              >
                <input
                  v-model="store.business[option.key]"
                  type="checkbox"
                  class="mt-0.5 size-4 accent-black"
                />
                <span>
                  {{ option.label }}
                  <small class="mt-1 block font-medium leading-5 text-black/45">
                    {{ option.description }}
                  </small>
                </span>
              </label>
            </div>

            <div
              v-if="store.business.showHeaderWifi"
              class="mt-4 grid gap-4 rounded-2xl bg-cream p-4 sm:grid-cols-2"
            >
              <label>
                <span class="label">ឈ្មោះ Wi-Fi (SSID)</span>
                <input
                  v-model.trim="store.business.wifiSsid"
                  class="input"
                  maxlength="64"
                  required
                  placeholder="Restaurant Wi-Fi"
                />
              </label>
              <label>
                <span class="label">សុវត្ថិភាព</span>
                <select v-model="store.business.wifiSecurity" class="input">
                  <option value="wpa">WPA / WPA2</option>
                  <option value="open">Open network</option>
                </select>
              </label>
              <label
                v-if="store.business.wifiSecurity === 'wpa'"
                class="sm:col-span-2"
              >
                <span class="label">ពាក្យសម្ងាត់ Wi-Fi</span>
                <input
                  v-model="store.business.wifiPassword"
                  class="input"
                  maxlength="128"
                  required
                  autocomplete="off"
                  placeholder="Wi-Fi password"
                />
                <small class="mt-2 block text-xs leading-5 text-amber-700">
                  ពាក្យសម្ងាត់នេះនឹងបង្ហាញជាសាធារណៈលើម៉ឺនុយ QR។
                </small>
              </label>
            </div>
          </fieldset>

          <fieldset
            class="md:col-span-2 rounded-3xl border border-black/[.07] p-5"
          >
            <legend class="label">ម៉ោងបើកអាជីវកម្ម</legend>
            <label
              class="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
            >
              <input
                v-model="store.business.showBusinessHours"
                type="checkbox"
                class="mt-0.5 size-4 accent-black"
              />
              <span>
                {{ $t("pages.business.hours.showInMenu") }}
                <small class="mt-1 block font-medium leading-5 text-black/45">
                  {{ $t("pages.business.hours.showInMenuHelp") }}
                </small>
              </span>
            </label>
            <div class="space-y-2">
              <div
                v-for="hours in store.business.businessHours"
                :key="hours.day"
                class="grid grid-cols-[90px_1fr] items-center gap-3 rounded-2xl bg-cream p-3 sm:grid-cols-[110px_110px_1fr_1fr]"
              >
                <strong class="text-sm">{{ dayNames[hours.day] }}</strong>
                <label class="flex items-center gap-2 text-xs font-bold"
                  ><input
                    v-model="hours.enabled"
                    type="checkbox"
                    class="size-4 accent-black"
                  />{{ hours.enabled ? "បើក" : "បិទ" }}</label
                >
                <input
                  v-model="hours.open"
                  type="time"
                  class="input"
                  :disabled="!hours.enabled"
                  aria-label="ម៉ោងបើក"
                />
                <input
                  v-model="hours.close"
                  type="time"
                  class="input"
                  :disabled="!hours.enabled"
                  aria-label="ម៉ោងបិទ"
                />
              </div>
            </div>
          </fieldset>

          <fieldset class="md:col-span-2 rounded-3xl bg-cream p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <p class="label !mb-1">បណ្ដាញសង្គម</p>
                <p class="m-0 text-xs text-black/45">
                  ភ្ជាប់ភ្ញៀវទៅគណនីបណ្ដាញសង្គមផ្លូវការរបស់អ្នក។
                </p>
              </div>
              <button type="button" class="btn-soft" @click="addSocial">
                <Plus :size="15" />បន្ថែមតំណ
              </button>
            </div>
            <div
              v-if="!store.business.socialLinks.length"
              class="rounded-2xl border border-dashed border-black/10 bg-white p-5 text-center text-sm text-black/40"
            >
              មិនទាន់មានតំណបណ្ដាញសង្គមទេ។
            </div>
            <div
              v-for="(social, index) in store.business.socialLinks"
              :key="index"
              class="mb-2 grid gap-2 sm:grid-cols-[150px_1fr_auto]"
            >
              <select v-model="social.platform" class="input">
                <option v-for="platform in socialPlatforms" :key="platform">
                  {{ platform }}
                </option>
              </select>
              <input
                v-model="social.url"
                type="url"
                class="input"
                placeholder="https://..."
              />
              <button
                type="button"
                class="btn-soft !px-3 text-red-600"
                aria-label="លុបតំណបណ្ដាញសង្គម"
                @click="store.business.socialLinks.splice(index, 1)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </fieldset>
        </section>

        <section
          v-show="businessTab === 'menu'"
          id="business-settings-panel-menu"
          role="tabpanel"
          aria-labelledby="business-settings-tab-menu"
          data-business-tab="menu"
          class="grid gap-5 md:grid-cols-2"
        >
          <fieldset
            class="md:col-span-2 rounded-3xl border border-black/[.07] p-5"
          >
            <legend class="label">ការកំណត់តម្លៃម៉ឺនុយ</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <label
                ><span class="label">របៀបកំណត់តម្លៃ</span
                ><select v-model="store.business.pricingMode" class="input">
                  <option value="automatic">កាលវិភាគស្វ័យប្រវត្តិ</option>
                  <option value="manual">កំណត់ដោយដៃ</option>
                </select></label
              >
              <label
                ><span class="label">{{
                  store.business.pricingMode === "automatic"
                    ? "បញ្ជីតម្លៃបម្រុង"
                    : "បញ្ជីតម្លៃកំពុងប្រើ"
                }}</span
                ><select
                  v-model="store.business.defaultPriceListId"
                  class="input"
                >
                  <option
                    v-for="list in store.priceLists.filter(
                      (item) => !item.isArchived,
                    )"
                    :key="list.id"
                    :value="list.id"
                  >
                    {{ displayPriceListName(list.name) }}
                  </option>
                </select></label
              >
              <label
                ><span class="label">តំបន់ម៉ោងអាជីវកម្ម</span
                ><input
                  v-model.trim="store.business.timezone"
                  list="timezone-options"
                  class="input"
                  placeholder="Asia/Phnom_Penh" /><datalist
                  id="timezone-options"
                >
                  <option
                    v-for="zone in timezoneOptions"
                    :key="zone"
                    :value="zone"
                  /></datalist
              ></label>
              <div class="rounded-2xl bg-cream p-4">
                <span class="label">កំពុងប្រើបច្ចុប្បន្ន</span>
                <strong>{{ activePricingName }}</strong>
                <p class="mb-0 mt-1 text-xs text-black/45">
                  នេះជាបញ្ជីតម្លៃដែលកំពុងបង្ហាញលើម៉ឺនុយ QR។
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset
            class="md:col-span-2 rounded-3xl border border-black/[.07] p-5"
          >
            <legend class="label">រូបិយប័ណ្ណសម្រាប់ម៉ឺនុយ</legend>
            <div class="grid gap-4 sm:grid-cols-2">
              <label>
                <span class="label">រូបិយប័ណ្ណចម្បង</span>
                <select
                  :value="store.business.currency"
                  class="input"
                  @change="changePrimaryCurrency"
                >
                  <option value="KHR">KHR · រៀលខ្មែរ</option>
                  <option value="USD">USD · ដុល្លារអាមេរិក</option>
                </select>
              </label>
              <label>
                <span class="label">រូបិយប័ណ្ណទីពីរ</span>
                <select
                  v-model="store.business.secondaryCurrency"
                  class="input"
                >
                  <option
                    value="KHR"
                    :disabled="store.business.currency === 'KHR'"
                  >
                    KHR · រៀលខ្មែរ
                  </option>
                  <option
                    value="USD"
                    :disabled="store.business.currency === 'USD'"
                  >
                    USD · ដុល្លារអាមេរិក
                  </option>
                </select>
              </label>
              <label>
                <span class="label">
                  អត្រាប្តូរ · 1 {{ store.business.currency }} = ?
                  {{ store.business.secondaryCurrency }}
                </span>
                <input
                  v-model.number="store.business.secondaryExchangeRate"
                  type="number"
                  min="0.000000001"
                  max="1000000000"
                  step="any"
                  required
                  class="input"
                  :placeholder="
                    store.business.currency === 'KHR' ? '0.00025' : '4000'
                  "
                />
                <small class="mt-2 block text-xs leading-5 text-black/45">
                  អត្រានេះប្រើសម្រាប់គណនាតម្លៃទីពីរប៉ុណ្ណោះ ហើយមិនបង្ហាញលើម៉ឺនុយ
                  QR ទេ។
                </small>
              </label>
              <div class="rounded-2xl bg-cream p-4">
                <span class="label">មើលតម្លៃគំរូ</span>
                <strong class="block text-lg">{{
                  primaryCurrencyPreview
                }}</strong>
                <span class="mt-1 block text-sm font-bold text-black/45">
                  ≈ {{ secondaryCurrencyPreview }}
                </span>
              </div>
              <label
                class="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
              >
                <input
                  v-model="store.business.showSecondaryCurrency"
                  type="checkbox"
                  class="mt-0.5 size-4 accent-black"
                />
                <span>
                  បង្ហាញតម្លៃទាំងពីរលើម៉ឺនុយ QR
                  <small class="mt-1 block font-medium text-black/45">
                    តម្លៃចម្បងនៅតែប្រើសម្រាប់ការគណនា និងការបញ្ជាទិញ។
                  </small>
                </span>
              </label>
            </div>
            <p class="mb-0 mt-4 text-xs leading-5 text-amber-700">
              ការប្តូររូបិយប័ណ្ណចម្បងមិនបម្លែងតម្លៃមុខម្ហូបដែលមានស្រាប់ទេ។
            </p>
          </fieldset>

          <fieldset
            class="md:col-span-2 rounded-3xl border border-black/[.07] p-5"
          >
            <legend class="label">ការកម្មង់តាមម៉ឺនុយ QR</legend>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-4 text-sm font-bold"
            >
              <input
                v-model="store.business.enableAddToOrder"
                type="checkbox"
                class="mt-0.5 size-4 accent-black"
              />
              <span>
                Enable Add to order
                <small class="mt-1 block font-medium leading-5 text-black/45">
                  បង្ហាញប៊ូតុង + លើមុខម្ហូប និងផ្ទាំង My Order លើម៉ឺនុយ QR។
                </small>
              </span>
            </label>
          </fieldset>
          <fieldset class="md:col-span-2">
            <legend class="label">ភាសាម៉ឺនុយ</legend>
            <p class="mb-3 mt-0 text-xs leading-5 text-black/45">
              ភាសាខ្មែរជាភាសាចម្បង និងមិនអាចលុបបានទេ។
              ជ្រើសភាសាបន្ថែមដែលម៉ឺនុយរបស់អ្នកប្រើ។
            </p>
            <div class="grid gap-3 sm:grid-cols-3">
              <label
                class="flex items-center gap-3 rounded-2xl border border-black/[.08] bg-cream p-4 text-sm font-bold"
              >
                <input type="checkbox" checked disabled class="size-4" />
                <span>ខ្មែរ</span>
                <span class="ml-auto text-[10px] text-emerald-700">ចម្បង</span>
              </label>
              <label
                class="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/[.08] p-4 text-sm font-bold"
              >
                <input
                  v-model="store.business.enableEn"
                  type="checkbox"
                  class="size-4 accent-black"
                />
                English · អង់គ្លេស
              </label>
              <label
                class="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/[.08] p-4 text-sm font-bold"
              >
                <input
                  v-model="store.business.enableZh"
                  type="checkbox"
                  class="size-4 accent-black"
                />
                中文 · ចិន
              </label>
            </div>
          </fieldset>
        </section>
      </form>
      <aside class="space-y-5">
        <div class="card p-5">
          <p class="label">URL ម៉ឺនុយសាធារណៈ</p>
          <div class="flex rounded-2xl bg-cream p-2 pl-4">
            <span class="min-w-0 flex-1 truncate py-2 text-sm">{{
              store.publicMenuUrl
            }}</span
            ><button
              type="button"
              aria-label="ចម្លង URL ម៉ឺនុយសាធារណៈ"
              class="grid size-9 place-items-center rounded-xl bg-white"
              @click="store.copyMenuUrl(store.publicMenuUrl)"
            >
              <Copy :size="16" />
            </button>
          </div>
          <p class="mb-0 mt-3 text-xs leading-5 text-black/40">
            ការប្តូរ URL នៅពេលក្រោយអាចធ្វើឱ្យកូដ QR ដែលបានបោះពុម្ពមិនដំណើរការ។
          </p>
        </div>
        <div class="card overflow-hidden">
          <div
            class="h-32 bg-cover bg-center"
            style="
              background-image: url(&quot;https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80&quot;);
            "
          ></div>
          <div class="p-5">
            <div class="flex items-center gap-3">
              <BusinessLogo
                :name="store.business.name"
                :src="store.business.logoUrl"
                class="size-11 rounded-2xl text-sm"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-semibold">
                  {{ store.business.name || "ឈ្មោះអាជីវកម្ម" }}
                </div>
                <a
                  v-if="previewMapLink"
                  :href="previewMapLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-black/50 transition hover:text-ink"
                >
                  <MapPin :size="14" class="shrink-0" />
                  <span class="truncate">{{ previewLocationText }}</span>
                </a>
              </div>
            </div>

            <div
              v-if="previewContacts.length || previewWifiText"
              class="no-scrollbar mt-3 flex items-center gap-3 overflow-x-auto whitespace-nowrap"
            >
              <a
                v-for="contact in previewContacts"
                :key="`${contact.label}-${contact.number}`"
                :href="`tel:${phoneHref(contact.number)}`"
                class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-black/50 hover:text-ink"
              >
                <Phone :size="14" />{{ contact.number }}
              </a>
              <span
                v-if="previewWifiText"
                class="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-black/50"
              >
                <Wifi :size="14" />{{ previewWifiText }}
              </span>
            </div>

            <div
              v-if="previewSocials.length"
              class="mt-3 flex flex-wrap gap-1.5"
            >
              <a
                v-for="social in previewSocials"
                :key="`${social.platform}-${social.url}`"
                :href="social.url"
                target="_blank"
                rel="noopener noreferrer"
                class="grid size-8 place-items-center rounded-full bg-cream text-ink transition hover:bg-ink hover:text-white"
                :aria-label="social.platform"
                :title="social.platform"
              >
                <component
                  :is="previewSocialIcon(social.platform)"
                  :size="15"
                />
              </a>
            </div>

            <p
              v-if="
                store.business.showHeaderTagline &&
                store.business.tagline.trim()
              "
              class="mb-0 mt-3 text-sm leading-6 text-black/50"
            >
              {{ store.business.tagline }}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Copy,
  Facebook,
  ImageUp,
  Instagram,
  Link2,
  MapPin,
  Plus,
  Save,
  Send,
  Trash2,
  Twitter,
  Wifi,
  Youtube,
  Phone,
} from "lucide-vue-next";
import TikTokIcon from "../components/icons/TikTokIcon.vue";
import BusinessLogo from "../components/BusinessLogo.vue";
import PageHeader from "../components/PageHeader.vue";
import SettingsTabs from "../components/SettingsTabs.vue";
import { useAdminStore } from "../stores/admin";
import { formatCurrency } from "../utils/currency";
const store = useAdminStore();
const { t } = useI18n();
type BusinessTab = "profile" | "public" | "menu";
const businessTab = ref<BusinessTab>("profile");
const businessTabs = computed(() => [
  { id: "profile", label: t("pages.business.tabs.profile") },
  { id: "public", label: t("pages.business.tabs.public") },
  { id: "menu", label: t("pages.business.tabs.menu") },
]);
const logoUploading = ref(false);
const logoError = ref("");

async function saveBusiness(event: Event) {
  const form = event.currentTarget as HTMLFormElement;
  if (!form.checkValidity()) {
    const invalidControl = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input:invalid, select:invalid, textarea:invalid");
    const panel = invalidControl?.closest<HTMLElement>("[data-business-tab]");
    const invalidTab = panel?.dataset.businessTab;
    if (
      invalidTab === "profile" ||
      invalidTab === "public" ||
      invalidTab === "menu"
    ) {
      businessTab.value = invalidTab;
    }
    await nextTick();
    invalidControl?.focus();
    invalidControl?.reportValidity();
    return;
  }

  await store.saveBusiness();
}
const timezoneOptions = [
  "Asia/Phnom_Penh",
  "Asia/Bangkok",
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "UTC",
];
const headerDisplayOptions = [
  {
    key: "showHeaderLocation",
    label: "ទីតាំង",
    description: "បង្ហាញឈ្មោះទីតាំងខ្លី និងតំណផែនទី។",
  },
  {
    key: "showHeaderPhones",
    label: "លេខទូរសព្ទ",
    description: "បង្ហាញលេខទំនាក់ទំនងទាំងអស់សម្រាប់ចុចហៅ។",
  },
  {
    key: "showHeaderWifi",
    label: "Wi-Fi",
    description: "បង្ហាញពាក្យសម្ងាត់ និង QR សម្រាប់ភ្ជាប់ Wi-Fi។",
  },
  {
    key: "showHeaderSocials",
    label: "បណ្ដាញសង្គម",
    description: "បង្ហាញតំណបណ្ដាញសង្គមជារូបតំណាង។",
  },
  {
    key: "showHeaderTagline",
    label: "ពាក្យស្លោក",
    description: "បង្ហាញពាក្យស្លោករបស់អាជីវកម្ម។",
  },
] as const;
const previewLocation = computed(() =>
  store.business.locations.find(
    (location) =>
      location.showInMenu &&
      (safePreviewUrl(location.mapUrl) || location.address.trim()),
  ),
);
const previewMapLink = computed(() => {
  if (!store.business.showHeaderLocation) return "";
  const location = previewLocation.value;
  const savedMapUrl = safePreviewUrl(location?.mapUrl || "");
  if (savedMapUrl) return savedMapUrl;
  const address = location?.address.trim() || store.business.address.trim();
  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";
});
const previewLocationText = computed(
  () =>
    previewLocation.value?.label.trim() ||
    previewLocation.value?.address.trim() ||
    store.business.mapLabel.trim() ||
    store.business.address.trim() ||
    "បើកផែនទី",
);
const previewContacts = computed(() =>
  store.business.showHeaderPhones
    ? store.business.contactNumbers.filter((contact) => contact.number.trim())
    : [],
);
const previewWifiText = computed(() => {
  if (!store.business.showHeaderWifi || !store.business.wifiSsid.trim())
    return "";
  return store.business.wifiSecurity === "open"
    ? "បណ្ដាញបើកចំហ"
    : store.business.wifiPassword.trim();
});
const previewSocials = computed(() =>
  store.business.showHeaderSocials
    ? store.business.socialLinks
        .map((social) => ({
          ...social,
          url: safePreviewUrl(social.url),
        }))
        .filter((social) => social.url)
    : [],
);
const displayPriceListName = (name?: string) =>
  !name || name === "Normal Rate" ? "តម្លៃធម្មតា" : name;
const activePricingName = computed(() =>
  displayPriceListName(
    store.priceLists.find((list) => list.id === store.activePriceListId)?.name,
  ),
);
const currencyPreviewAmount = computed(() =>
  store.business.currency === "USD" ? 10 : 10000,
);
const primaryCurrencyPreview = computed(() =>
  formatCurrency(currencyPreviewAmount.value, store.business.currency),
);
const secondaryCurrencyPreview = computed(() =>
  formatCurrency(
    currencyPreviewAmount.value *
      Number(store.business.secondaryExchangeRate || 0),
    store.business.secondaryCurrency,
  ),
);
const dayNames = [
  "អាទិត្យ",
  "ចន្ទ",
  "អង្គារ",
  "ពុធ",
  "ព្រហស្បតិ៍",
  "សុក្រ",
  "សៅរ៍",
];
const socialPlatforms = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Telegram",
  "YouTube",
  "X",
  "ផ្សេងទៀត",
];

function safePreviewUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function addLocation() {
  if (store.business.locations.length >= 20) return;
  store.business.locations.push({
    label: "",
    address: "",
    mapUrl: "",
    showInMenu: true,
  });
}

function removeLocation(index: number) {
  store.business.locations.splice(index, 1);
}

function phoneHref(number: string) {
  return number.replace(/[^+\d]/g, "");
}

function previewSocialIcon(platform: string) {
  if (platform === "Facebook") return Facebook;
  if (platform === "Instagram") return Instagram;
  if (platform === "TikTok") return TikTokIcon;
  if (platform === "Telegram") return Send;
  if (platform === "YouTube") return Youtube;
  if (platform === "X") return Twitter;
  return Link2;
}

function addContact() {
  if (store.business.contactNumbers.length < 10)
    store.business.contactNumbers.push({ label: "ចម្បង", number: "" });
}

function addSocial() {
  if (store.business.socialLinks.length < 10)
    store.business.socialLinks.push({ platform: "Facebook", url: "" });
}

function changePrimaryCurrency(event: Event) {
  const nextCurrency = (event.target as HTMLSelectElement).value as
    "USD" | "KHR";
  const previousCurrency = store.business.currency;
  const previousRate = Number(store.business.secondaryExchangeRate);
  store.business.currency = nextCurrency;
  if (store.business.secondaryCurrency === nextCurrency) {
    store.business.secondaryCurrency = previousCurrency;
    if (Number.isFinite(previousRate) && previousRate > 0) {
      store.business.secondaryExchangeRate = Number(
        (1 / previousRate).toPrecision(10),
      );
    }
  }
}

async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  logoUploading.value = true;
  logoError.value = "";
  try {
    const uploaded = await store.uploadMedia(file);
    store.business.logoMediaId = uploaded.id;
    store.business.logoUrl = uploaded.url;
  } catch (error) {
    logoError.value =
      error instanceof Error ? error.message : "មិនអាចបង្ហោះឡូហ្គោបានទេ។";
  } finally {
    logoUploading.value = false;
    input.value = "";
  }
}

function removeLogo() {
  store.business.logoMediaId = "";
  store.business.logoUrl = "";
  logoError.value = "";
}
</script>
