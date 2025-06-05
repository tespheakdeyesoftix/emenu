<template>
  <ion-page>
    <ToolBar>
      {{ t("Your Order") }}
    </ToolBar>
    <ion-content>
      <div v-for="(p, index) in orderDoc.order_products" :key="index">
        <!-- {{ p }} -->
        <ion-card style="display: flex; align-items: center; border-radius: 20px; padding: 10px; margin-bottom: 10px;">
          <Img :src="p.photo" width="100" height="100" />

          <ion-card-content style="flex: 1;">
            <ion-card-title>{{ p.product_name }}</ion-card-title>
            <ion-card-subtitle>{{ p.portion }}</ion-card-subtitle>
            <h2 style="font-weight: bold; font-size: 24px;">$ {{ p.price || '0.00' }}</h2>
          </ion-card-content>

          <ion-card-content style="flex: 0.2; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; height: 100px;">
            <ion-icon :icon="trashOutline" style="font-size: 24px; color: #f44336; cursor: pointer;" @click="deleteCart" />
            <div style="display: flex; align-items: center; gap: 10px; font-size: 24px;">
              <ion-icon :icon="removeOutline" style="cursor: pointer;" @click="decrease" />
              <span style="min-width: 20px; text-align: center;">{{ p.quantity }}</span>
              <ion-icon :icon="addOutline" color="success" style="cursor: pointer;" @click="increase" />
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>

    <ion-footer slot="fixed">
      <ion-toolbar>
        <ion-row class="ion-align-items-center ion-justify-content-between" style="width: 100%; padding: 0 16px;">
          <ion-col size="6">
            <div style="font-weight: bold; font-size: 18px;">Total:</div>
            <div style="font-size: 22px;">$ {{ total || '0.00' }}</div>
          </ion-col>
          <ion-col size="6" class="ion-text-end">
            <ion-button expand="block" @click="onSubmitOrder">
              {{ t("Submit Order") }}
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup>
  import { IonIcon } from '@ionic/vue';
  import { trashOutline,removeOutline,addOutline } from 'ionicons/icons';
  import Img from '@/components/public/Img.vue';

import {useSale} from "@/hooks/useSale.js"
const t = app.t;
const {orderDoc,onSubmitOrder} = useSale()
const showAlert = () =>{
    alert('Hello')
} 



</script>