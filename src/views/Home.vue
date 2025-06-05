<template>
    <ion-page>
      <AppBar>
          {{ t("Shop Name") }}
      </AppBar>
        <ion-content class="ion-padding">
          <ion-text>Hello worl</ion-text> 
            {{ emenu }}
          <ComMenuList v-for="m in emenu?.pos_menu_selections" :key="m.name" :menu="m" />
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted } from "vue"
import ComMenuList from "@/views/components/ComMenuList.vue"
import {useApp} from "@/hooks/useApp.js"
const {emenu,products,getMenu,getProducts} = useApp()
const t = app.t;
const data = ref()
onMounted(async ()=>{
  const l = await app.showLoading();
  await getMenu();
  await getProducts();
  await l.dismiss()

})

</script>