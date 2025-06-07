<template>
  <!-- {{ data }} -->
<ion-card
  style="display: flex; flex-direction: column; border-radius: 20px; padding: 8px;"
  class="ion-margin"
  button
>
  <div style="display: flex; align-items: center;">
    <Img :src="data.photo" width="100" height="100" style="object-fit: cover; border-radius: 20px;" />

    <ion-card-content
      style="flex: 1; min-width: 0;"
      class="ion-no-padding ion-margin-start"
    >
      <ion-card-title class="Cardtitle">
        {{ data.product_name }}
        <span v-if="data.modifiers"> - {{ data.modifiers }}</span>
      </ion-card-title>

      <ion-card-subtitle class="CardSubtitle" >
        {{ data.portion }}
      </ion-card-subtitle>

      <h2 style="font-weight: bold; font-size: 24px;">
        <ComCurrency :value="data.total_amount" />
      </h2>
    </ion-card-content>

    <ion-card-content
      class="ion-no-padding"
      style="flex: 0.2; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; height: 100px;"
    >
      <ion-icon
        :icon="trashOutline"
        style="font-size: 24px; color: #f44336; cursor: pointer;"
        @click="onRemoveProduct(index)"
      />
      <div style="display: flex; align-items: center; gap: 10px; font-size: 24px;">
        <ion-icon
          :disabled="data.quantity == 1"
          :icon="removeOutline"
          style="cursor: pointer;"
          @click="updateQuantity(-1)"
        />
        <span style="min-width: 20px; text-align: center;">{{ data.quantity }}</span>
        <ion-icon
          :icon="addOutline"
          color="success"
          style="cursor: pointer;"
          @click="updateQuantity(1)"
        />
      </div>
    </ion-card-content>
  </div>

  <ion-card-content class="ion-padding-top ion-no-padding" v-if="data.note">
    <small style="color: #888;">📝Note : {{ data.note }}</small>
  </ion-card-content>
</ion-card>

  
</template>

<script setup >
import { trashOutline,removeOutline,addOutline } from 'ionicons/icons';
import {useSale} from "@/hooks/useSale.js"

const {onRemoveProduct} = useSale()

const props  =defineProps({
    data:Object,
    index:Number
})

function updateQuantity (n){
  props.data.quantity = Math.max(1, props.data.quantity + n);
  props.data.sub_total = (props.data.quantity * props.data.price) + (props.data.quantity * props.data.modifier_price)
  props.data.total_amount = props.data.sub_total ;
}

</script>

<style scoped>
.Cardtitle{
  font-size: 15px;
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.CardSubtitle{
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}
</style>