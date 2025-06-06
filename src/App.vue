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
import { onMounted } from 'vue';
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
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
    
    },
    (error) => {
      console.error("Error getting location:", error.message);
    }
  );
}

// get business branch from pos profile

const business_branch = await app.getBusinessBranch()

// get late long predefine
const res = await app.getValue("Business Branch",business_branch,["lat","long"])
app.predefinePosition = {lat:res.data.lat, long:res.data.long}


})
</script>
