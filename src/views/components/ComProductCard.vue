<template >
    <ion-card class="ion-padding ion-no-margin" style="margin-bottom: 20px;" button :routerLink="'/menu/' + data?.name">
        <!-- {{ data?.name }} | {{ data.product_code }} | {{ data.product_name_en }} -->
          {{ data }}
         <Img :src="data?.photo" />
         {{ data.product_name_en }}
    </ion-card>
    

</template>
<script setup>
    const props = defineProps({
        data:Object
    })
</script>