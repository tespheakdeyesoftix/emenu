<template>

    
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title><slot></slot></ion-title>
        <ion-buttons slot="end">
          <ComOrderCart/>
         <div class="custom-select-wrapper">
  
    <ion-select
      v-model="currentLang"
      interface="popover"
      @ionChange="changeLanguage"
      class="hidden-select"
      style="margin-left: 10px;"
      :value="currentLang"
    >
      <ion-select-option value="en">Englist</ion-select-option>
      <ion-select-option value="km">ខ្មែរ</ion-select-option>
    </ion-select>
  </div>

          <slot name="end"></slot>
    </ion-buttons>
     
      </ion-toolbar>
    </ion-header>

</template>
<script setup lang="ts">
import {  IonButtons, IonTitle, IonMenuButton } from '@ionic/vue';
import ComOrderCart from '../components/ComOrderCart.vue';
import { ref } from 'vue'
const currentLang = ref('en')
const open = ref(false)
function changeLanguage(event) {
  const lang = event.detail.value
  currentLang.value = lang
  localStorage.setItem('lang', lang)
}
 function getFlag(lang) {
  alert(34)
  return lang === 'km'
    ? 'https://cdn-icons-png.flaticon.com/512/323/323313.png' // Cambodia flag
    : 'https://cdn-icons-png.flaticon.com/512/330/330425.png' // US flag
}
</script>
