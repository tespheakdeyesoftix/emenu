<template>
    <ion-page>
        <AppBar>
            {{ t("Order successfully") }}
        </AppBar>
        <ion-content color="success">
           <div style="width:100%;">
            <img style="border-bottom-right-radius:80px;border-bottom-left-radius:80px;" src="emenu/public/ordersuccess.gif" />
           </div>
            <div style="text-align: center;width:100%;border-bottom: 2px solid;color: white;">
                <h2>
                    <b>{{ t("Your order has been submitted sucessfully.") }}</b>
                    </h2>
   
            </div>
           <div style="display: flex; justify-content: center;margin-top: 10px;">
<ion-button color="light" @click="onContinueOrder">
  <ion-text class="ion-text-capitalize">{{ t("Continue Order") }}</ion-text>
</ion-button>


</div>

        </ion-content>
    </ion-page>
</template>
<script setup>
const t = app.t;
function onContinueOrder(){
    app.ionRouter.navigate('/', 'forward', 'replace');
}
</script>