<template>
    <ion-page>
        <ion-header>
    <ion-toolbar>
      <ion-title>Header</ion-title>
    </ion-toolbar>
  </ion-header>
        <ion-content class="ion-padding">
          
          <ComMenuList v-for="m in emenu?.pos_menu_selections" :key="m.name" :menu="m" />
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted } from "vue"
import ComMenuList from "@/views/components/ComMenuList.vue"
import {useApp} from "@/hooks/useApp.js"
const {emenu,products,getMenu,getProducts} = useApp()

const data = ref()
onMounted(async ()=>{
  const l = await app.showLoading();
  await getMenu();
  await getProducts();
  await l.dismiss()

})
</script>