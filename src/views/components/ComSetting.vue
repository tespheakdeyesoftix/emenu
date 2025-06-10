<template>
  <!-- Settings icon button -->
  <ion-icon id="popover-button" :icon="settingsOutline" size="large"></ion-icon>

  <!-- Popover with language selector -->
  <ion-popover trigger="popover-button" :dismiss-on-select="false">
    <ion-content>
      <ion-list>
        <ion-item lines="none">
          <ion-icon :icon="languageOutline" slot="start"></ion-icon>
          {{ currentLang }}
          <ion-select @ionChange="onLangChange" :value="currentLang" v-model="currentLang">
            <ion-select-option value="en">English</ion-select-option>
            <ion-select-option value="km">ខ្មែរ</ion-select-option>
          </ion-select>
        </ion-item>

     

        <ion-item button detail="false">Option 2</ion-item>
      </ion-list>
    </ion-content>
  </ion-popover>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
 import { logoIonic, languageOutline, settingsOutline } from 'ionicons/icons';
const currentLang = ref('en')
function onLangChange(event) {
 
}
const t = app.t;
// Load saved lang from localStorage
onMounted(() => {
  const saved = localStorage.getItem('lang')
  if (saved) currentLang.value = saved
})

// Watch and store changes
watch(currentLang, (newLang) => {
  
  localStorage.setItem('lang', newLang)
})
</script>
