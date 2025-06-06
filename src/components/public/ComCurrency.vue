<template>
     {{ number }} {{ model }}
</template>
<script setup>
import { onMounted, ref, watch,toRef  } from 'vue';

const props = defineProps({
    value:Number,
    format:String
})
const number = ref("")

 const valueRef = toRef(props, 'value')

watch(valueRef, (newVal, oldVal) => {
   
    if(newVal!=oldVal){
       formatNumber()
    }
},{ deep: true })

async function formatNumber(){
      if(!app.setting.currency_format){
        // get from db
        if (!app.setting.default_currency){
                app.setting.default_currency= (await app.getSingleValue("ePOS Settings","currency")).data;
        }

        app.setting.currency_format = (await app.getValue("Currency",app.setting.default_currency,"custom_pos_currency_format")).data.custom_pos_currency_format;
        
        
    }
    
    number.value = app.utils.formatCurrency( props.value || 0,app.setting.currency_format)
}

onMounted(async ()=>{
  
  await  formatNumber();
})
</script>