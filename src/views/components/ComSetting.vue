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
            <ion-select-option value="kh">ខ្មែរ</ion-select-option>
          </ion-select>
        </ion-item>
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
 import { languageOutline, settingsOutline } from 'ionicons/icons';
const currentLang = ref('kh')
const t = app.t;
import { getItem } from '@/services/storage-service';
onMounted(() => {
  if (getItem('lang')) {
    currentLang.value = getItem('lang')
  }
})
function onChange(){
localStorage.setItem('lang', currentLang.value)
window.location.reload()
}

</script>
