<template>
    <ion-page>
      <AppBar>
        <Img  :src="emenu" />
         {{ emenu?.emenu_app_name }}
         {{ emenu?.photo }}
          
      </AppBar>
<div v-html="emenu?.welcome_description ">   </div>  
        <ion-content class="ion-padding">
          <swiper
    :modules="[Autoplay, Pagination, Navigation]"
    :autoplay="{ delay: 3000, disableOnInteraction: false }"
    :pagination="{ clickable: true }"
    class="mySwiper"
  >
    <swiper-slide  v-if="emenu" v-for="n in emenu.promotion" :key="n"><Img style="width: 100%;" :src="n.photo" /></swiper-slide>
  </swiper>
       
          <ion-searchbar placeholder="Search Product" ></ion-searchbar>
         <ion-item lines="none">
            <div class="category-tabs">
            <button
              v-for="(category, index) in categories"
              :key="index"
              :class="['tab-btn', selectedIndex === index ? 'active' : '']"
              @click="selectTab(index)"
            >
              {{ category }}
            </button>
          </div>
        </ion-item>
          <ComMenuList v-for="m in emenu?.pos_menu_selections" :key="m.name" :menu="m" />
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted } from "vue"
import ComMenuList from "@/views/components/ComMenuList.vue"
import { IonSearchbar } from '@ionic/vue';
import {useApp} from "@/hooks/useApp.js"
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

import { Autoplay, Pagination, Navigation } from 'swiper/modules'
const {emenu,products,getMenu,getProducts} = useApp()
const t = app.t;
const data = ref()
onMounted(async ()=>{
  const l = await app.showLoading();
  await getMenu();
  await getProducts();
  await l.dismiss()

})
const categories = [
  'ទាំងអស់​',
  'ជម្រើសសាច់អាំង',
  'ជម្រើសាច់ស៊ុប',
  'គ្រឿងសមុទ្រ',
  'ឈុតបន្លែពិសេស',
  'គ្រឿងបន្ថែម'
]
const selectedIndex = ref(0)

function selectTab(index) {
  selectedIndex.value = index
}
</script>

<style scoped>
.category-tabs {
  display: flex;
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: 10px;
  gap: 5px;
   scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.tab-btn {
  border: 1px solid #f5f5f5;
  background-color: #fff;
  color: #333;
  padding: 10px 16px;
  border-radius: 25px;
  font-size: 14px;
 
  transition: 0.3s;
}

.tab-btn.active {
  background-color: #d0021b;  
  color: white;
 
}
</style>