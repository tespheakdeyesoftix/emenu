import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
 

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    component: () => import('@/views/Home.vue')
    // component: () => import('@/views/Home.vue')
  },
  {
    path: '/menu/:name',
    component: () => import('@/views/product-detail/ProductDetail.vue')
  },
  {
    path: '/order',
    component: () => import('@/views/order-detail/OrderDetail.vue')
  },
  {
    path: '/order-success',
    component: () => import('@/views/OrderSuccess.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
