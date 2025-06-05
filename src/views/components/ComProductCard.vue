<template >
    <ion-card class="ion-no-margin" style="margin-bottom: 20px; height: 220px;" button :routerLink="'/menu/' + data?.name">
         <Img :src="data?.photo" style="width: 100%;"/>
          <ion-card-header style="padding: 5px  ;">
            <ion-card-subtitle> {{ data.product_name_en }}</ion-card-subtitle>
        </ion-card-header>
    </ion-card>
    

</template>
<script setup>
    const props = defineProps({
        data:Object
    })
</script>