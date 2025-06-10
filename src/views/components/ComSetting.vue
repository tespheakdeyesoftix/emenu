<template>
  <!-- Settings icon button -->
  <ion-icon id="popover-button" :icon="settingsOutline" size="large"></ion-icon>

  <!-- Popover with language selector -->
  <ion-popover trigger="popover-button" :dismiss-on-select="false">
    <ion-content>
      <ion-list>
        <ion-item lines="none">
          <ion-icon :icon="languageOutline" slot="start"></ion-icon>
          <ion-select @ionChange="onChange" v-model="currentLang"  
          placeholder="Select a Language">
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
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
 import { logoIonic, languageOutline, settingsOutline } from 'ionicons/icons';
const currentLang = ref('en')
const t = app.t;
// Load saved lang from localStorage
onMounted(() => {
  if (localStorage.getItem('lang')) {
    currentLang.value = localStorage.getItem('lang')
  }
})

watch(currentLang, (newLang) => {
  localStorage.setItem('lang', newLang)
})
</script>
