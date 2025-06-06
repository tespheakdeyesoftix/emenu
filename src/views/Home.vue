<template>
    <ion-page>
      <AppBar>
        <div style="display: flex; align-items: center; gap:10px;">
           <Img v-if="emenu?.logo" style="width:40px;" :src="emenu?.logo" />
           <div>
            <h5>
             {{ emenu?.emenu_app_name }} 
            </h5>
           </div>
           
        </div>
       
           
      </AppBar>

        <ion-content class="ion-padding">
          
<div v-html="emenu?.welcome_description "></div>  

     <ComPromotionSlide :emenu="emenu" />
     <ComFilterMenuList /> 
     <ComMenuList v-for="m in emenu?.pos_menu_selections" :key="m.name" :menu="m" />
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted } from "vue"
import ComMenuList from "@/views/components/ComMenuList.vue"
import {useApp} from "@/hooks/useApp.js"
import ComPromotionSlide from "./components/ComPromotionSlide.vue";
import ComFilterMenuList from "./components/ComFilterMenuList.vue";
const {emenu,products,getMenu,getProducts} = useApp()
const t = app.t;

onMounted(async ()=>{
  const l = await app.showLoading();
  await getMenu();
  await getProducts();
  await l.dismiss()

})

</script>

