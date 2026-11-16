<template>
    <div class="sticky-tabs bg-white"  >

    <div>
        <div>
            <ion-searchbar :placeholder="t('Search Product')"></ion-searchbar>
        </div>
          <div>
              <ion-item lines="none"  >
                
          <div class="category-tabs">
            <button
              v-for="(category, index) in menu"
              :key="index"
              :class="['tab-btn', selectedIndex === index ? 'active-filter' : '']"
              @click="selectTab(index,category?.menu)"
            >
              {{ category?.menu }}
            </button>
          </div>
        </ion-item>
          </div>
          
    </div>   
        </div>
</template>
<script setup>
const props = defineProps({
    menu:Object
})
import {ref,onMounted } from "vue"
import { IonSearchbar } from '@ionic/vue';

const t =app.t;

const selectedIndex = ref(0)

function selectTab(index, id) {
  selectedIndex.value = index;
 const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
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

.sticky-tabs {
padding-top: 5px;
padding-bottom: 5px;
  position: sticky;
  top:-20px;
  z-index: 99;
  margin: 0;
  
}
</style>