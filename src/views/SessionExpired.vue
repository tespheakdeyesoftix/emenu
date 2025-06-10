<template>
    <ion-page>
        <ion-content class=" ion-text-center" >
            <div class="center-content">
                <div>
    <img style="width: 300px;" src="/assets/images/expired.png" />
    <h2 class="ion-margin-top">QR Session is expired.</h2>
    <p>Please scan the QR code again.</p>

   <ion-button expand="block" color="primary" @click="retryScan" class="ion-margin-top scan-button">
  <ion-icon :icon="scanOutline" slot="start"></ion-icon>
  Scan Again
</ion-button>

  </div>  
            </div>  

</ion-content>

    </ion-page>
</template>
<script setup>
import { scanOutline } from 'ionicons/icons';
</script>
<style scoped>
.center-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

</style>