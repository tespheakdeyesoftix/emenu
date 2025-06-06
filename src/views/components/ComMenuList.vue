<template>
    <div :id="menu.menu">
        <ion-text>
        <h1>{{ menu.menu }}</h1>
    </ion-text>

    <div>
        <ComProcutList :data="products?.filter(x=>x.pos_menu == menu.menu)" />
    </div>
     
    </div>
   
</template>
<script setup>
const props = defineProps({
    menu:Object
})

import {useApp} from "@/hooks/useApp.js"
const { products} = useApp()



import ComProcutList from "@/views/components/ComProcutList.vue"
</script>