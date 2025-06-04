<template>
    <ion-page>
        <ion-header>
    <ion-toolbar>
      <ion-title>Header</ion-title>
    </ion-toolbar>
  </ion-header>
        <ion-content class="ion-padding">
          {{ data }}
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted } from "vue"
const data = ref()
onMounted(async ()=>{
  const res = await app.getDoc("eMenu",app.route.query.menu)
   data.value = res.data;

})
</script>