<template>
    <ion-page>
        <ToolBar>
            {{ t("Product Detail") }}
        </ToolBar>
        <ion-content>
            detail product menu 
            {{ data }}
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted} from "vue"
const t = app.t;
const data =ref()
onMounted(async ()=>{
    const l = await app.showLoading()
    const res = await app.getDoc("Temp Product Menu",app.route.params.name);
    if (res.data){
        data.value = res.data
    }
    await l.dismiss()
    
})
</script>