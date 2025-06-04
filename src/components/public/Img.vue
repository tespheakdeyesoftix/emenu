<template>

      <img   :src="imgData" :width="width==0?undefined:width" :height="height==0?undefined:height"/>
  
  </template>
<script setup>
import { ref, onMounted } from 'vue';
import { CapacitorHttp } from '@capacitor/core';
import { isPlatform } from '@ionic/vue';
import { getPlatforms } from '@ionic/vue';
import { imageUrl } from '@/helpers/utils';
const props = defineProps({
  api_url:String,
  src:String,
  height:{
    type:Number,
    default:0
  },
  
  width:{
    type:Number,
    default:0
  },
})



const imgData = ref("/assets/placeholder.jpg");
const strCurrentProperty = window.storageService.getItem("current_property");
 
let serverUrl = props.api_url;
if (!serverUrl){
  if (strCurrentProperty){
  const currentProperty = JSON.parse(strCurrentProperty);
  serverUrl = currentProperty.api_url;
}
}

 
 
const getImage = async () => {
  
  if (props.src?.startsWith("https://") || props.src?.startsWith("http://") ){
        return props.src;
  }

  // check if image start with http or https
  if(isPlatform("mobileweb") || isPlatform("desktop") ){
    imgData.value= imageUrl(props.src);
    
    return
  } else if( 
    (isPlatform("android") && isPlatform("mobile")) ||
    (isPlatform("iphone") && isPlatform("ios") && isPlatform("mobile"))

    )
  {
    
    try {
    
    const response = await CapacitorHttp.request({
      method: 'GET',
      url: `${serverUrl}api/method/ice_factory_management_system.api.utils.image_resizer.resize_image?image_path=${props.src}&width=${props.width==0?150:props.width}&height=${props.height}`
    });

    if(response.status==200){
      
      imgData.value = response.data.message.image
    }
    
  } catch (err) {
     
  }
  }


 
};

// Load the image when component is mounted
onMounted(async () => {
  getImage()
});
</script>
 
