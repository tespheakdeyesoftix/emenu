import { createRouter, createWebHistory, NavigationGuardNext, RouteLocationNormalized } from '@ionic/vue-router'
import {useApp} from "@/hooks/useApp.js"

const {canShowApp,isSessionExpired,isAppLoadReady,isInvalidQR} = useApp();
import { RouteRecordRaw } from 'vue-router';
 
const routes: Array<RouteRecordRaw> = [
  {
    path: '/:pathMatch(.*)*', // Catch-all
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  },
  {
    path: '/',
    component: () => import('@/views/Home.vue')
    // component: () => import('@/views/Home.vue')
  },
  {
    path: '/menu',
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
  
  },
  {
    path: '/invalid-qr',
    component: () => import('@/views/InvalidQR.vue')
  },
  {
    path: '/session-expired',
    component: () => import('@/views/SessionExpired.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // history: createWebHistory(import.meta.env.BASE_URL),
  routes
})



// ✅ Type-safe navigation guard
router.beforeEach(
  async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
    if (!isAppLoadReady.value) {
      // Poll until setup is done
      const waitForSetup = () =>
        new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (isAppLoadReady.value) {
              clearInterval(interval)
              resolve()
            }
          }, 100)
        })
      await waitForSetup()
    }
    

    
    if (!canShowApp.value === true && to.path !='/invalid-qr') {
     next("/invalid-qr")
    }
    else if (canShowApp.value === true && to.path =='/invalid-qr') {
      next("/")
    }
    else if (isSessionExpired.value === true && to.path !='/session-expired') {
      next("/session-expired")
    }
    else if (!isSessionExpired.value  && to.path ==='/session-expired') {
      next("/")
    } else if (to.path=="/" && isInvalidQR){
      next("/menu")
    }
    else if (to.path=="/" && !isInvalidQR){
      alert(55)
      next("/invalid-qr")
    }
    else {
      next()
    }
  }
)


export default router
