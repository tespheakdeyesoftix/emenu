<template>
 <ion-card style="display: flex; align-items: center; border-radius: 20px; padding: 10px; margin-bottom: 10px;">
          <Img :src="data.photo" width="100" height="100" />

          <ion-card-content style="flex: 1;">
            <ion-card-title>{{ data.product_name }}</ion-card-title>
            <ion-card-subtitle>{{ data.portion }}</ion-card-subtitle>
            <h2 style="font-weight: bold; font-size: 24px;">$ {{ data.price || '0.00' }}</h2>
          </ion-card-content>

          <ion-card-content style="flex: 0.2; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; height: 100px;">
            <ion-icon :icon="trashOutline" style="font-size: 24px; color: #f44336; cursor: pointer;" @click="onRemoveProduct(index)" />
            <div style="display: flex; align-items: center; gap: 10px; font-size: 24px;">
              <ion-icon :disabled="data.quantity == 1" :icon="removeOutline" style="cursor: pointer;" @click="updateQuantity(-1)" />
              <span style="min-width: 20px; text-align: center;">{{ data.quantity }}</span>
              <ion-icon :icon="addOutline" color="success" style="cursor: pointer;" @click="updateQuantity(1)" />
            </div>
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
  props.data.quantity = props.data.quantity  + n 
}

</script>