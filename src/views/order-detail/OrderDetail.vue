<template>
    <ion-page>
        <ToolBar>
        {{ t("Your Order") }}
    </ToolBar>
    <ion-content>
{{ orderDoc }}

<ion-button @click="onSubmitOrder">
    {{ t("Submit Order") }}
</ion-button>
    </ion-content>
    </ion-page>
    
</template>
<script setup>
const t = app.t;
import {useSale} from "@/hooks/useSale.js"
const {orderDoc,onSubmitOrder} = useSale()

</script>