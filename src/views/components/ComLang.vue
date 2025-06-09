<template>
  <ion-select
    v-model="currentLang"
    interface="popover"
    placeholder="Choose language"
  >
    <ion-select-option value="en">English</ion-select-option>
    <ion-select-option value="km">ខ្មែរ</ion-select-option>
  </ion-select>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const currentLang = ref('en')

// Load saved lang from localStorage
onMounted(() => {
  const saved = localStorage.getItem('lang')
  if (saved) currentLang.value = saved
})

// Watch and store changes
watch(currentLang, (newLang) => {
    alert(34)
  localStorage.setItem('lang', newLang)
})
</script>
