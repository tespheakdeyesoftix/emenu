<template>
  <ion-app>
  
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import i18n from '../i18n'; 
import router from './router';

import { useIonRouter } from '@ionic/vue';
import { useRoute } from 'vue-router';
import {getItem} from '@/services/storage-service';
import { onMounted,inject } from 'vue';
const ionRouter = useIonRouter();
const route = useRoute();
app.t =  i18n.global.t;
app.setIonRouter(ionRouter)
app.setRoute(route)
app.setRouter(router)
app.currentLanguage = getItem("lang") || "kh";

onMounted(async ()=>{

   if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        
        await app.storageService.setItem("locationStatus","allowed")
        app.setting.currentLocation = {lat:position.coords.latitude, long: position.coords.longitude}
      
      },
      async (error) => {
        console.error("Error getting location:", error.message);
      //  / await app.storageService.setItem("locationStatus","block")
      }
    );
}


// get business branch from pos profile

const business_branch = await app.getBusinessBranch()

// get late long predefine
const res = await app.getValue("Business Branch",business_branch,["lat","long"])
app.predefinePosition = {lat:res.data.lat, long:res.data.long}


  const interval = setInterval(async () => {
             
              // clearInterval(interval)
            app.setting.currentLocation = await app.utils.getGeoLocation()
          
          }, 1000*60*5)



})


 
</script>
