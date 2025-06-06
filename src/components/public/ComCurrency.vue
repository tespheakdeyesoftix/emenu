<template>
     {{ number }}
</template>
<script setup>
import { onMounted, ref } from 'vue';

 
const props = defineProps({
    value:Number,
    format:Boolean
})
const number = ref("")

onMounted(()=>{
    number.value = app.utils.formatCurrency( props.value || 0)
    
})
</script>