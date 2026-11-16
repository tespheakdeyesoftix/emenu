<template>
  <div class="overflow-hidden bg-cream">
    <SiteNav />
    <main>
      <section
        class="relative isolate min-h-[820px] overflow-hidden bg-ink px-4 pb-16 pt-28 text-white sm:pt-36"
      >
        <img
          :src="angkorWatImage"
          alt=""
          aria-hidden="true"
          class="absolute inset-0 -z-20 size-full object-cover opacity-[.55]"
        />
        <div
          class="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/75 to-ink/40"
        ></div>
        <div
          class="absolute -left-32 top-24 size-80 rounded-full bg-primary/40 blur-3xl"
        ></div>
        <div
          class="absolute -right-20 bottom-0 size-96 rounded-full bg-secondary/25 blur-3xl"
        ></div>

        <div
          class="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[.85fr_1.15fr]"
        >
          <div class="relative z-10">
            <div
              class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur"
            >
              <span
                class="grid size-6 place-items-center rounded-full bg-secondary"
              >
                <Sparkles :size="12" />
              </span>
              អត្តសញ្ញាណពិសេស • បច្ចេកវិទ្យាទំនើប
            </div>
            <h1
              class="display m-0 max-w-2xl text-5xl font-extrabold leading-[1.2] tracking-[-.04em] sm:text-7xl"
            >
              ឃើញម្ហូបកាន់តែច្បាស់<br /><span class="text-sage"
                >ជ្រើសរើសកាន់តែងាយ</span
              >
            </h1>
            <p
              class="mb-0 mt-6 max-w-lg text-base leading-8 text-white/65 sm:text-lg"
            >
              បង្ហាញមុខម្ហូបរបស់អ្នកឱ្យកាន់តែទាក់ទាញ ជាមួយរូបភាពច្បាស់ៗ
              និងម៉ឺនុយស្កេនងាយប្រើ។
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <button
                class="btn-dark !bg-secondary hover:!bg-[#a53b13]"
                @click="auth.open('register')"
              >
                ចាប់ផ្ដើមឥតគិតថ្លៃ<ArrowUpRight :size="17" />
              </button>
              <a
                :href="demoMenuUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-light no-underline"
                aria-label="បើកមើលម៉ឺនុយគំរូ"
              >
                <Play :size="15" fill="currentColor" />មើលម៉ឺនុយគំរូ
              </a>
            </div>
            <div class="mt-8 flex items-center gap-4">
              <div class="flex -space-x-2">
                <img
                  v-for="(url, index) in avatars"
                  :key="url"
                  :src="url"
                  :alt="`អតិថិជនទី ${index + 1}`"
                  class="size-10 rounded-full border-2 border-ink object-cover"
                />
              </div>
              <div class="text-xs leading-5">
                <div class="font-bold">អាជីវកម្មជាង ១,២០០ កន្លែង</div>
                <div class="text-sage">★★★★★ ពេញចិត្ត ៤.៩</div>
              </div>
            </div>
          </div>

          <div id="demo" class="relative min-h-[560px] lg:min-h-[640px]">
            <img
              :src="showcaseImages[0].url"
              :alt="showcaseImages[0].alt"
              class="heritage-frame absolute right-0 top-0 h-[58%] w-[74%] rounded-t-[4rem] rounded-b-[2rem] object-cover"
            />
            <img
              :src="showcaseImages[1].url"
              :alt="showcaseImages[1].alt"
              class="heritage-frame absolute bottom-0 left-0 h-[48%] w-[60%] rounded-[2rem] border-8 border-ink object-cover"
            />
            <div
              class="absolute bottom-8 right-2 rounded-3xl bg-secondary p-4 text-white shadow-xl sm:bottom-12 sm:right-6"
            >
              <QrCode :size="42" />
              <div class="mt-2 text-[10px] font-bold">ស្កេនបានភ្លាម</div>
            </div>
            <div
              class="absolute left-2 top-14 rounded-2xl bg-white px-4 py-3 text-ink shadow-xl sm:left-8"
            >
              <div class="text-2xl font-extrabold">+២៨%</div>
              <div class="text-xs text-black/45">ការកុម្ម៉ង់បន្ថែម</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" class="heritage-surface bg-cream px-4 py-24">
        <div class="mx-auto max-w-6xl">
          <div
            class="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
          >
            <div>
              <p class="m-0 text-xs font-bold tracking-[.15em] text-secondary">
                រសជាតិ • សិល្បៈ • អត្តសញ្ញាណ
              </p>
              <h2
                class="display mb-0 mt-3 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl"
              >
                ម៉ឺនុយដែលមានអត្តសញ្ញាណ
              </h2>
            </div>
            <p class="m-0 max-w-xs text-sm leading-7 text-black/50">
              ងាយមើល ងាយជ្រើស ងាយកុម្ម៉ង់។
            </p>
          </div>

          <div
            class="grid auto-rows-[250px] gap-4 md:grid-cols-12 md:auto-rows-[230px]"
          >
            <article
              class="heritage-frame group relative overflow-hidden rounded-t-[4rem] rounded-b-[2rem] md:col-span-7 md:row-span-2"
            >
              <img
                :src="showcaseImages[2].url"
                :alt="showcaseImages[2].alt"
                class="size-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent"
              ></div>
              <div class="absolute bottom-0 p-6 text-white sm:p-8">
                <Image :size="24" />
                <h3 class="display mb-1 mt-3 text-2xl font-extrabold">
                  រូបភាពស្រស់ស្អាត ដូចរសជាតិពិត
                </h3>
                <p class="m-0 text-sm text-white/70">
                  ធ្វើឱ្យគ្រប់មុខម្ហូបគួរឱ្យចង់សាក។
                </p>
              </div>
            </article>

            <article
              class="group relative overflow-hidden rounded-t-[3rem] rounded-b-[1.5rem] border border-secondary/20 md:col-span-5"
            >
              <img
                :src="showcaseImages[3].url"
                :alt="showcaseImages[3].alt"
                class="size-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"
              ></div>
              <h3
                class="display absolute bottom-5 left-5 m-0 text-xl font-extrabold text-white"
              >
                កែប្រែបានភ្លាមៗ
              </h3>
            </article>

            <article
              class="relative overflow-hidden rounded-t-[3rem] rounded-b-[1.5rem] bg-primary p-6 text-white md:col-span-5"
            >
              <div
                class="absolute -bottom-16 -right-10 size-52 rounded-full bg-sage/20"
              ></div>
              <RefreshCw :size="30" />
              <h3 class="display mb-2 mt-16 text-xl font-extrabold">
                កូដតែមួយ ប្រើបានរហូត
              </h3>
              <p class="m-0 max-w-xs text-sm leading-6 text-white/60">
                ប្ដូរតម្លៃ ឬម្ហូបថ្មី ដោយមិនបោះពុម្ពឡើងវិញ។
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="how" class="relative bg-white px-4 py-24">
        <div class="mx-auto max-w-6xl">
          <div class="text-center">
            <p class="m-0 text-xs font-bold tracking-[.15em] text-secondary">
              ចាប់ផ្ដើមងាយៗ
            </p>
            <h2 class="display mb-0 mt-3 text-4xl font-extrabold">
              ៣ ជំហាន រួចរាល់
            </h2>
          </div>
          <div class="mt-12 grid gap-4 md:grid-cols-3">
            <article
              v-for="step in steps"
              :key="step.title"
              class="group relative min-h-[360px] overflow-hidden rounded-t-[3.5rem] rounded-b-[1.5rem] border border-secondary/20"
            >
              <img
                :src="step.image"
                :alt="step.alt"
                class="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent"
              ></div>
              <span
                class="display absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-white text-sm font-extrabold text-ink"
              >
                {{ step.number }}
              </span>
              <div class="absolute inset-x-0 bottom-0 p-6 text-white">
                <h3 class="display m-0 text-2xl font-extrabold">
                  {{ step.title }}
                </h3>
                <p class="mb-0 mt-2 text-sm text-white/65">{{ step.text }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing" class="relative bg-ink px-4 py-24 text-white">
        <div class="mx-auto max-w-6xl">
          <div>
            <p class="m-0 text-xs font-bold tracking-[.15em] text-sage">
              គម្រោង និងតម្លៃ
            </p>
            <h2
              class="display mb-4 mt-3 text-4xl font-extrabold leading-tight sm:text-5xl"
            >
              ជ្រើសរើសគម្រោងសម្រាប់អាជីវកម្មរបស់អ្នក
            </h2>
            <p class="max-w-sm text-sm leading-7 text-white/50">
              សម្រាប់ភោជនីយដ្ឋាន និងអាជីវកម្មគ្រប់ទំហំ។
            </p>
          </div>

          <p v-if="auth.plansLoading && !auth.plans.length" class="mt-8 text-white/70" role="status">
            កំពុងផ្ទុកគម្រោង…
          </p>
          <div v-else-if="auth.plansError" class="mt-8" role="alert">
            <p>{{ auth.plansError }}</p>
            <button type="button" class="btn-light" @click="auth.loadPlans">សាកល្បងម្តងទៀត</button>
          </div>
          <p v-else-if="!auth.plans.length" class="mt-8 text-white/70">មិនទាន់មានគម្រោងសម្រាប់ចុះឈ្មោះទេ។</p>
          <div v-else class="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="plan in auth.plans" :key="plan.id"
              class="heritage-frame relative flex flex-col overflow-hidden rounded-t-[4rem] rounded-b-[2rem] bg-primary p-7 text-white sm:p-10"
            >
              <div
                class="absolute -right-20 -top-20 size-64 rounded-full bg-sage/10"
              ></div>
              <h3 class="relative m-0 text-xl font-extrabold">{{ plan.name }}</h3>
              <p v-if="plan.description" class="relative mb-0 mt-2 text-sm text-white/70">{{ plan.description }}</p>
              <p class="display relative mb-0 mt-5 text-3xl font-extrabold">{{ publicPlanPrice(plan) }}</p>
              <p v-if="plan.amountMinor" class="relative mb-0 mt-2 text-xs font-bold text-white/70">សាកល្បងឥតគិតថ្លៃ ៣០ ថ្ងៃ</p>
              <div class="relative my-8 grid gap-3 text-sm text-white/80">
                <p v-for="limit in publicPlanLimits(plan)" :key="limit" class="m-0 font-bold">{{ limit }}</p>
                <p
                  v-for="item in plan.features"
                  :key="item"
                  class="m-0 flex items-center gap-2"
                >
                  <span
                    class="grid size-6 shrink-0 place-items-center rounded-full bg-white/10"
                  >
                    <Check :size="14" class="text-sage" />
                  </span>
                  {{ controlKm.nav[item] }}
                </p>
              </div>
              <button
                class="btn-light relative mt-auto w-full"
                @click="auth.open('register', plan.priceId)"
              >
                ចាប់ផ្ដើមឥឡូវនេះ<ArrowRight :size="17" />
              </button>
            </article>
          </div>
        </div>
      </section>

      <section class="relative overflow-hidden bg-secondary px-4 py-20">
        <img
          :src="showcaseImages[4].url"
          :alt="showcaseImages[4].alt"
          class="absolute inset-0 size-full object-cover opacity-20 mix-blend-multiply"
        />
        <div
          class="relative mx-auto flex max-w-4xl flex-col items-center text-center text-white"
        >
          <span
            class="grid size-16 place-items-center rounded-3xl bg-white text-secondary shadow-xl"
          >
            <QrCode :size="34" />
          </span>
          <h2 class="display mb-3 mt-6 text-4xl font-extrabold sm:text-5xl">
            ត្រៀមបង្ហាញមុខម្ហូបហើយឬនៅ?
          </h2>
          <p class="max-w-xl text-white/75">
            បង្កើតម៉ឺនុយដំបូងរបស់អ្នកថ្ងៃនេះ។
          </p>
          <button class="btn-light mt-5" @click="auth.open('register')">
            បង្កើតម៉ឺនុយឥតគិតថ្លៃ<ArrowRight :size="17" />
          </button>
        </div>
      </section>
    </main>

    <footer
      class="relative border-t border-secondary/25 bg-ink px-4 pb-8 pt-16 text-white"
    >
      <div
        class="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_.7fr_.9fr_.7fr]"
      >
        <div>
          <BrandLogo />
          <p class="mb-0 mt-5 max-w-sm text-sm leading-7 text-white/50">
            បង្កើតម៉ឺនុយស្កេនដ៏ស្រស់ស្អាត បង្ហាញមុខម្ហូបបានច្បាស់
            និងកែប្រែព័ត៌មានបានគ្រប់ពេល។
          </p>
        </div>

        <div>
          <h3 class="m-0 text-sm font-bold text-sage">ស្វែងយល់</h3>
          <nav class="mt-5 flex flex-col gap-3 text-sm text-white/50">
            <a href="#features" class="text-inherit no-underline">មុខងារ</a>
            <a href="#how" class="text-inherit no-underline">របៀបប្រើ</a>
            <a href="#pricing" class="text-inherit no-underline">តម្លៃ</a>
            <a :href="demoMenuUrl" class="text-inherit no-underline"
              >ម៉ឺនុយគំរូ</a
            >
          </nav>
        </div>

        <div>
          <h3 class="m-0 text-sm font-bold text-sage">អ្វីដែលអ្នកទទួលបាន</h3>
          <ul class="mt-5 list-none space-y-3 p-0 text-sm text-white/50">
            <li>គ្រប់គ្រងម៉ឺនុយ និងតម្លៃ</li>
            <li>គ្រប់គ្រងផ្ទាំងផ្សព្វផ្សាយ</li>
            <li>បន្លិចមុខម្ហូបពិសេស</li>
            <li>ទាញយកកូដស្កេន</li>
          </ul>
        </div>

        <div>
          <h3 class="m-0 text-sm font-bold text-sage">ព័ត៌មាន</h3>
          <nav class="mt-5 flex flex-col gap-3 text-sm text-white/50">
            <a href="#" class="text-inherit no-underline">ឯកជនភាព</a>
            <a href="#" class="text-inherit no-underline">លក្ខខណ្ឌ</a>
            <a href="#" class="text-inherit no-underline">ទំនាក់ទំនង</a>
            <button
              class="w-fit border-0 bg-transparent p-0 text-left text-inherit"
              @click="auth.open('login')"
            >
              ចូលគណនី
            </button>
          </nav>
        </div>
      </div>

      <div
        class="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="m-0">© ២០២៦ អង្គរ អ៊ីមេនុយ។ រក្សាសិទ្ធិគ្រប់យ៉ាង។</p>
        <p class="m-0">បង្កើតឡើងសម្រាប់អាជីវកម្មម្ហូបអាហារ។</p>
      </div>
    </footer>
    <AuthModal />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Image,
  Play,
  QrCode,
  RefreshCw,
  Sparkles,
} from "lucide-vue-next";
import AuthModal from "./components/AuthModal.vue";
import BrandLogo from "./components/BrandLogo.vue";
import SiteNav from "./components/SiteNav.vue";
import { useAuthStore } from "./stores/auth";
import { publicPlanLimits, publicPlanPrice } from "./utils/subscriptionPlans";
import controlKm from "../../control/src/locales/km.json";

const auth = useAuthStore();
onMounted(() => auth.loadPlans());
const menuBaseUrl = import.meta.env.VITE_MENU_URL || "http://localhost:5174";
const demoMenuUrl = `${menuBaseUrl.replace(/\/$/, "")}/emenu`;
const angkorWatImage =
  "https://images.unsplash.com/photo-1602642977157-b7c8b8003afd?auto=format&fit=crop&w=2000&q=85";

// Public placeholder photos. Replace these URLs with your own restaurant photos later.
const showcaseImages = [
  {
    url: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1400&q=85",
    alt: "ម្ហូបជាច្រើនមុខនៅលើតុ",
  },
  {
    url: "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=1000&q=85",
    alt: "មីជាមួយបន្លែស្រស់",
  },
  {
    url: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=85",
    alt: "ម្ហូបពណ៌ស្រស់ស្អាត",
  },
  {
    url: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1000&q=85",
    alt: "ម្ហូបចំហុយក្នុងចាន",
  },
  {
    url: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=80",
    alt: "បរិយាកាសភោជនីយដ្ឋាន",
  },
];

const avatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
];

const steps = [
  {
    number: "០១",
    title: "បង្កើតហាង",
    text: "ដាក់ឈ្មោះ និងពណ៌របស់អ្នក។",
    image: showcaseImages[4].url,
    alt: "តុអាហារនៅក្នុងភោជនីយដ្ឋាន",
  },
  {
    number: "០២",
    title: "បញ្ចូលម្ហូប",
    text: "បន្ថែមរូបភាព តម្លៃ និងប្រភេទ។",
    image: showcaseImages[2].url,
    alt: "ម្ហូបស្រស់ស្អាតសម្រាប់ម៉ឺនុយ",
  },
  {
    number: "០៣",
    title: "ចែករំលែកកូដ",
    text: "បោះពុម្ព ហើយដាក់លើតុបានភ្លាម។",
    image:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1000&q=85",
    alt: "អតិថិជនប្រើទូរស័ព្ទនៅហាង",
  },
];

</script>
