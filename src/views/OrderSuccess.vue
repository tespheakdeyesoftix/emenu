<template>
    <ion-page>
        <ToolBar>
            {{ t("Order successfully") }}
        </ToolBar>
        <ion-content>
            {{ t("Your order has been submitted sucessfully.") }}
            
            <ion-button  @click="onContinueOrder" >
                {{ t("Continue Order") }}
            </ion-button>
        </ion-content>
    </ion-page>
</template>
<script setup>
const t = app.t;
function onContinueOrder(){
    app.ionRouter.navigate('/', 'forward', 'replace');
}
</script>