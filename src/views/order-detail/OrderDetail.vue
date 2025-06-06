<template>
  <ion-page>
    <ToolBar>
      {{ t("Your Order") }}
    </ToolBar>
    <ion-content>
      <div v-if="orderDoc.order_products.length>0" v-for="(p, index) in orderDoc.order_products" :key="index">
       
       <ComOrderProductCard :data="p" :index="index"/>
      </div>
      <div v-else>
          <ion-text>
            {{ t("You don't have any orders yet. Please click the 'Order Now' button to place your food order.") }}
          </ion-text>
          <ion-button color="danger" @click="onOrderNow">{{ t('Order Now') }}</ion-button>
      </div>

    </ion-content>

    <ion-footer slot="fixed">
      <ion-toolbar>
        <ion-row class="ion-align-items-center ion-justify-content-between" style="width: 100%; padding: 0 16px;">
          <ion-col size="6">
            <div style="font-weight: bold; font-size: 18px;">Total:</div>
            <div style="font-size: 22px;"><ComCurrency :value="orderDoc?.total_amount || 0"/></div>
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
 

  import ComOrderProductCard from '@/views/order-detail/ComOrderProductCard.vue';

import {useSale} from "@/hooks/useSale.js"
const t = app.t;
const {orderDoc,onSubmitOrder} = useSale()

function onOrderNow(){
  app.ionRouter.navigate('/', 'forward', 'replace');
}



</script>