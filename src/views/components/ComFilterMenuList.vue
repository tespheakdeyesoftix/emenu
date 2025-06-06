<template>
               <ion-searchbar placeholder="Search Product"></ion-searchbar>
            <ion-item lines="none" class="sticky-tabs">
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
</template>
<script setup>
import {ref,onMounted } from "vue"
import { IonSearchbar } from '@ionic/vue';
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
ion-searchbar {
  position: sticky;
  top: 0;
  z-index: 100;
  
}

.sticky-tabs {
  position: sticky;
  top: 56px; /* Height of the searchbar; adjust if needed */
  z-index: 99;
  
}
</style>