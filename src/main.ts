import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';
import {setFrappeAppUrl} from "@/services/api-service.ts"

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

import "@/helpers/global-function.js"


/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';


/* Theme variables */
import './theme/variables.css';

import { 
  IonLabel, 
  IonChip, 
  IonPage,
  IonContent, 
  useIonRouter,
  IonRippleEffect,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle, 
  IonIcon ,
  IonButton,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonImg,
  IonSearchbar,
  IonList,
  IonItem,
  IonFab,
  IonFabButton,
  IonSegment,
  IonSegmentButton,
  IonSegmentView,
  IonRefresherContent,
  IonRefresher,
  IonProgressBar,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonFooter,
  IonModal,
  IonPopover,
  IonAvatar,
  IonDatetime,
  IonDatetimeButton,
  IonAccordionGroup,
  IonAccordion,
  IonText,
  IonInput,
  IonCol, 
  IonGrid, 
  IonRow ,
  IonTab,
  
  IonTabBar,
  IonTabButton,
  IonTabs
  
} from '@ionic/vue';


const app = createApp(App)
  .use(IonicVue)
  .use(router);

  app.component('ion-footer', IonFooter)
    app.component('ion-ripple-effect', IonRippleEffect)
    app.component('ion-infinite-scroll', IonInfiniteScroll)
    app.component('ion-infinite-scroll-content', IonInfiniteScrollContent)
    app.component('ion-card', IonCard)
    app.component('ion-card-title', IonCardTitle)
    app.component('ion-card-content', IonCardContent)
    app.component('ion-card-header', IonCardHeader)
    app.component('ion-card-subtitle', IonCardSubtitle)
    app.component('ion-page', IonPage)
    app.component('ion-content', IonContent)
    app.component('ion-icon',IonIcon)
    app.component('ion-chip',IonChip)
    app.component('ion-avatar',IonAvatar)
    app.component('ion-label',IonLabel)
    app.component('ion-button',IonButton)
    app.component('ion-buttons',IonButtons)
    app.component('ion-back-button',IonBackButton)
    app.component('ion-header',IonHeader)
    app.component('ion-toolbar',IonToolbar)
    app.component('ion-title',IonTitle)
    app.component('ion-img',IonImg)
    app.component('ion-searchbar',IonSearchbar)
    app.component('ion-list',IonList)
    app.component('ion-item',IonItem)
    app.component('ion-fab',IonFab)
    app.component('ion-fab-button',IonFabButton)
    app.component('ion-segment',IonSegment)
    app.component('ion-segment-button',IonSegmentButton)
    app.component('ion-segment-view',IonSegmentView)
    app.component('ion-refresher-content',IonRefresherContent)
    app.component('ion-refresher',IonRefresher)
    app.component('ion-progress-bar',IonProgressBar)
    app.component('ion-spinner',IonSpinner)
    app.component('ion-modal',IonModal)
    app.component('ion-popover',IonPopover)
    app.component('ion-datetime',IonDatetime)
    app.component('ion-datetime-button',IonDatetimeButton)
    app.component('ion-accordion-group',IonAccordionGroup)
    app.component('ion-accordion',IonAccordion)
    app.component('ion-text',IonText)
    app.component('ion-input',IonInput)
    app.component('ion-grid',IonGrid)
    app.component('ion-row',IonRow)
    app.component('ion-col',IonCol)
    app.component('ion-tab',IonTab)
    app.component('ion-tabs',IonTabs)
    app.component('ion-tab-bar',IonTabBar)
    app.component('ion-tab-button',IonTabButton)



    // TODO: get url from query string
  
    setFrappeAppUrl("http://192.168.10.19:1217")


router.isReady().then(() => {
  app.mount('#app');
});
