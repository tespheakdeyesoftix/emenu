<template>
    <ion-page>
      <AppBar>
        <div style="display: flex; align-items: center; gap:10px;padding: 0 !;">
           <Img v-if="emenu?.logo" style="width:40px;" :src="emenu?.logo" />
           <div>
   <span style="font-size: 15px;">
     {{ emenu?.emenu_app_name }} 
   </span>
           </div>
        </div>
      
      </AppBar>
  <div class="bg-white" style="display: flex; justify-content:space-between;padding: 10px;">
          {{t("Table")}} : {{ table?.tbl_number }}
  </div>
        <ion-content class="ion-padding" >
      
<div v-html="emenu?.welcome_description "></div>  
     <ComPromotionSlide :emenu="emenu" />
     <ComFilterMenuList :menu="emenu?.pos_menu_selections" />
     <ComMenuList v-for="m in emenu?.pos_menu_selections" :key="m.name" :menu="m" />
        </ion-content>
    </ion-page>

</template>
<script setup>
import {ref,onMounted,inject } from "vue"
import ComMenuList from "@/views/components/ComMenuList.vue"
import {useApp} from "@/hooks/useApp.js"
import ComPromotionSlide from "./components/ComPromotionSlide.vue";
import ComFilterMenuList from "./components/ComFilterMenuList.vue";
const {emenu,products,getMenu,getProducts} = useApp()
import {useSale} from "@/hooks/useSale.js"
const {saleDoc,orderDoc} = useSale()
const t = app.t;
const table = ref()
const socket = inject("$socket");


onMounted(async ()=>{
 const res =  await app.getValue("Tables Number",app.table_id, "tbl_number")
 if(res.data){
  
  table.value = res.data;

 }
  
  const l = await app.showLoading();
  await getMenu();
  await getProducts()
;
  await l.dismiss()

  const locattion = await app.utils.getGeoLocation()
 
})




</script>

