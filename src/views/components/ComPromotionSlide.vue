<template>
         <swiper
          v-if="emenu" 
    :modules="[Autoplay, Pagination, Navigation]"
    :autoplay="{ delay: 3000, disableOnInteraction: false }"
    :pagination="{ clickable: true }"
    class="mySwiper"
  >
  
    <swiper-slide  v-for="(n,index) in emenu?.promotion" :key="'promotion_' + index">
      
      <Img style="width: 100%;" :src="n.photo" />
    
    </swiper-slide>
  </swiper>
</template>
<script setup>
const props = defineProps({
    emenu:Object
})
import { Autoplay, Pagination, Navigation } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
</script>