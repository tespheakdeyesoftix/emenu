<template>
    <!-- {{ data }} -->
    <ion-grid>
        <ion-row>
            <ion-col size="6" size-lg="3"  v-for="(p,index) in data" :key="index">
                <ComProductCard :data="p" /> 
            </ion-col>
        </ion-row>
    </ion-grid>
    
</template>
<script setup>
const props = defineProps({
    data:Object

})
import ComProductCard from "@/views/components/ComProductCard.vue"
</script>