<template>
        <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button v-if="!showBack"  ></ion-back-button>
          <ion-button v-else color="medium" @click="cancel">{{t("Cancel")}}</ion-button>
          <slot name="start"></slot>
        </ion-buttons>
        <ion-title><slot></slot></ion-title>
        <ion-buttons slot="end">
          <slot name="end"></slot>
    </ion-buttons>
      </ion-toolbar>
    </ion-header>
</template>
<script setup>
const t = app.t;
const props = defineProps({
  showBack:{
    type:Boolean,
    default:false
  }
})
 
</script>

