<template>

    
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title><slot></slot></ion-title>
        <ion-buttons slot="end">
          <ComOrderCart/>
          <ComSetting />

          <slot name="end"></slot>
    </ion-buttons>
     
      </ion-toolbar>
    </ion-header>

</template>
<script setup lang="ts">
import {  IonButtons, IonTitle, IonMenuButton } from '@ionic/vue';
import ComOrderCart from '../components/ComOrderCart.vue';

import ComSetting from '../components/ComSetting.vue';

</script>
