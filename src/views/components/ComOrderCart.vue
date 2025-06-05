<template>
     <ion-button shape="round" routerLink="/order">
        <ion-icon size="large" :icon="cartOutline"></ion-icon>
        
        <ion-badge color="danger">{{ orderDoc.order_products.reduce((sum, item) => sum + item.quantity, 0) }}</ion-badge>
    </ion-button>
</template>
<script setup>
import { cartOutline } from 'ionicons/icons';
import {useSale} from "@/hooks/useSale.js"
const {orderDoc} = useSale()

</script>