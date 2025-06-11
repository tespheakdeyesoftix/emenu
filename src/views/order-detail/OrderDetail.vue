<template>
  <ion-page>
    <!-- {{ orderDoc.total_amount }} -->
    <ToolBar>
      {{ t("Your Order") }} - {{ table?.tbl_number }}
    </ToolBar>
    <ion-content>
    <div v-if="orderDoc.order_products.length>0" v-for="(p, index) in orderDoc.order_products" :key="index">
       <!-- {{ p }} -->
       <ComOrderProductCard :data="p" :index="index"/>
    </div>
    <div v-else style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 20px;">
        <img src="/assets/images/cart.svg" alt="No Orders"style="max-width: 200px; height: auto; margin-bottom: 20px;"/>
        <ion-text style="margin-bottom: 20px; font-size: 16px; color: #444;">
            {{ t("You don't have any orders yet. Please click the 'Order Now' button to place your food order.") }}
        </ion-text>
        
        <ion-button fill="outline" color="tertiary" @click="onOrderNow">
            {{ t('Order Now') }}
        </ion-button>
    </div>


    </ion-content>

    <ion-footer v-if="orderDoc.order_products.length>0 " slot="fixed">
      <ion-toolbar>
        <ion-row class="ion-align-items-center ion-justify-content-between" style="width: 100%; padding: 0 16px;">
          <ion-col size="6" v-if="orderDoc.total_amount">
            <div style="font-weight: bold; font-size: 18px;">Total:</div>
            <div style="font-size: 22px;"><ComCurrency :value="orderDoc?.total_amount || 0"/></div>
          </ion-col>
          <ion-col  class="ion-text-end">
            <ion-button color="success" expand="block" @click="onSubmitOrder">
              {{ t("Submit Order") }}
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup>
 
import ComCurrency from '@/components/public/ComCurrency.vue';
import ComOrderProductCard from '@/views/order-detail/ComOrderProductCard.vue';

import {useSale} from "@/hooks/useSale.js"
const t = app.t;
const {orderDoc,onSubmitOrder,socket} = useSale()
import {ref,onMounted,inject } from "vue"
const sk = inject('$socket')
const table = ref()
function onOrderNow(){
  app.ionRouter.navigate('/', 'forward', 'replace');
}


 onMounted(async ()=>{
  table.value =  ( await app.getValue("Tables Number",app.table_id, "tbl_number") ).data;
  socket.value = sk;
})

</script>