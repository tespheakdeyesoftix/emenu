<template>   
  <div class="card-wrapper">   
<ion-chip v-if="priceRange && priceRange.min > 0" class="card-chip">
  <ion-label>
    <ComCurrency :value="priceRange.min" />
    <span v-if="priceRange.min !== priceRange.max"> → </span>
    <ComCurrency v-if="priceRange.min !== priceRange.max" :value="priceRange.max" />
  </ion-label>
</ion-chip>
    <ion-card class="product-card" button :routerLink="'/menu/' + data?.name"> 
     
      <Img :src="data?.photo" class="product-image" /> 
      <ion-card-header class="product-card-header">
        <ion-card-subtitle class="product-title">
          {{ data.product_name_en }}
        </ion-card-subtitle>
      </ion-card-header>
    </ion-card>
  </div>
</template>

<script setup>
import ComCurrency from '@/components/public/ComCurrency.vue'; 
import { computed } from 'vue';
const props = defineProps({
  data: Object
})
 
const priceRange = computed(() => {
  try {
    const prices = JSON.parse(props.data.prices || '[]');
    const validPrices = prices
      .map(p => p.price)
      .filter(price => typeof price === 'number' && price > 0);

    if (validPrices.length === 0) return null;

    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);

    return { min, max };
  } catch (err) {
    return null;
  }
});

// const prices = JSON.parse(data.value.prices)
 

</script>

<style scoped>
.card-wrapper {
  position: relative;
}

.card-chip {
  position: absolute;
  top: 2px; 
  right: 2px;
  z-index: 2;
  background: #ffffff;
  color: rgb(255, 0, 0);
  font-size: 14px; 
}

.product-card {
  height: 240px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  margin: 0;
}

.product-image {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.product-card-header {
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center; 
}

.product-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2; 
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis; 
}
</style>
