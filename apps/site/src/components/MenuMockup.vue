<template>
  <div
    class="relative mx-auto w-[280px] rounded-[2.7rem] border-[7px] border-ink bg-white p-2 shadow-[0_30px_90px_rgba(8,42,32,.4)] sm:w-[310px]"
  >
    <div
      class="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink"
    ></div>
    <div class="overflow-hidden rounded-[2rem] bg-[#faf8f2]">
      <div class="relative h-48">
        <img
          src="https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=700&q=90"
          alt="ម្ហូបប្រចាំហាង"
          class="size-full object-cover"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"
        ></div>
        <span
          class="absolute bottom-4 left-4 rounded-full bg-secondary px-2 py-1 text-[8px] font-extrabold text-white"
        >
          ជម្រើសថ្ងៃនេះ
        </span>
      </div>
      <div class="p-4">
        <div class="mb-1 flex items-center justify-between gap-2">
          <h3 class="display m-0 text-base font-extrabold">បាយសាច់គោឡុកឡាក់</h3>
          <span class="shrink-0 font-bold text-secondary">១៥,០០០៛</span>
        </div>
        <p class="m-0 text-[10px] leading-4 text-black/45">
          សាច់គោទន់ៗ បន្លែស្រស់ និងទឹកជ្រលក់រសជាតិពិសេស។
        </p>
        <div class="my-4 flex gap-2">
          <span
            v-for="tag in ['សាច់គោ', 'ស្រស់', 'ពេញនិយម']"
            :key="tag"
            class="rounded-full bg-[#eeece4] px-2 py-1 text-[8px] font-bold"
          >
            {{ tag }}
          </span>
        </div>
        <button
          class="w-full rounded-full bg-primary py-3 text-xs font-bold text-white"
        >
          បន្ថែមការកុម្ម៉ង់
        </button>
      </div>
    </div>
  </div>
</template>
