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
const ionRouter = useIonRouter();
const route = useRoute();
app.t =  i18n.global.t;

app.setIonRouter(ionRouter)
app.setRoute(route)
app.setRouter(router)


</script>
