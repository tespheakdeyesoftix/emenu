import { alertController, toastController,loadingController,modalController } from '@ionic/vue';
import i18n from '../../i18n'; // Import i18n config
import { getApi, getSingleValue,getDoc,updateDoc,createDoc,getDocList, postApi,getValue  } from "@/services/api-service";
import * as utils from '@/helpers/utils';
import * as storageService from '@/services/storage-service';
import * as sale from '@/helpers/sale-action.js';

import { useApp } from '@/hooks/useApp';
import WebSocketPrinter from "@/helpers/websocket-printer.js"

import dayjs from 'dayjs';
 
globalThis.app = globalThis.app || {};


globalThis.app.printService = null

setTimeout(() => {
 
 app.printService =new WebSocketPrinter({
    url: app.setting.emenu.web_socket_print_url,
    onConnect: () => {
        console.log("Connected to printer");
    },
});
}, 1000);

// Ensure the namespace exists






globalThis.app.apiUrl ="";
globalThis.app.token ="";
globalThis.app.emenu ="";
globalThis.app.business_branch ="";
globalThis.app.pos_profile ="";
globalThis.app.table_id ="";
globalThis.app.session_id = "";
globalThis.app.utils = utils;








globalThis.app.storageService = storageService;
globalThis.app.t = null
globalThis.app.currentLanguage = storageService.getItem("lang") || "kh"

globalThis.app.language = [
  {
    lang: "en",
    icon: "/assets/en.svg",
    label: "English"
  },

  {
    lang: "kh",
    icon: "/assets/kh.svg",
    label: "ភាសារខ្មែរ"
  }
]


globalThis.app.getBusinessBranch = async function(){
  if(app.business_branch) return app.business_branch
  const res = await app.getValue("POS Profile", app.pos_profile, "business_branch")
  return res.data.business_branch
}

globalThis.app.openModal =  async function (props) {
  return await utils.openModal(props)
}

   


globalThis.app.getTimespanRange =  function(timespan){
 
  const dates =   utils.getTimespanRange(timespan)
  return {start_date:dayjs(dates.startDate).format("YYYY-MM-DD"),end_date:dayjs(dates.endDate).format("YYYY-MM-DD")}
}

globalThis.app.getRandomChar =  function(){
 
  return    utils.getRandomChar()
  
}



// api url 
globalThis.app.getDoc =  async function (DocType,DocName) {
  return await getDoc(DocType,DocName)
}
globalThis.app.getSingleValue =  async function (DocType,fieldname) {
  return await getSingleValue(DocType,fieldname)
}

globalThis.app.getValue =  async function (DocType,name,fields) {
  return await getValue(DocType,name,fields)
}

globalThis.app.createDoc =  async function (DocType,params) {
  return await createDoc(DocType,params)
}

globalThis.app.updateDoc =  async function (DocType,name,params) {
  return await updateDoc(DocType,name,params)
}

 
globalThis.app.getApi =  async function (api_url,param) {
  return await getApi(api_url,param)
}

 
globalThis.app.postApi =  async function (api_url,param) {
  return await postApi(api_url,param)
}

globalThis.app.getDocList =  async function (DocType,param) {
  return await getDocList(DocType,param)
}
globalThis.app.renameDoc =  async function (DocType,oldName,newName) {
  return await postApi("epos_restaurant_2023.api.api.rename_doc",{data:{doctype:DocType, old_name:oldName,new_name:newName}})
}

 
 
globalThis.app.showLoading = async function (message = 'Loading...') {
     return await utils.showLoading(message)
  }
 
globalThis.app.showConfirm = async function (message = 'Loading...') {
    const loading = await loadingController.create({
      message:app.t(message)
    });
  
    await loading.present();  
    return loading;  
  }
 

  globalThis.app.showSuccessMessage = async function (message){
    return await utils.showSuccessMessage(message)
  }
  globalThis.app.showSuccess = async function (message){
    const toast = await toastController.create({
        message: message,
        duration: 5000,
        position: "top",
        swipeGesture:"vertical",
        color: "success"
    });
    toast.present();
}
  globalThis.app.showWarning = async function (message){
    const toast = await toastController.create({
        message: message,
        duration: 5000,
        position: "top",
        swipeGesture:"vertical",
        color: "warning"
    });
    toast.present();
}

  
  
  globalThis.app.Confirm  =  async function ( title="Confirm", message="Are you sure you want to process this action?",options=[]) {
   
  let defaultButtons = [
      {
        text: app.t('Cancel'),
        role: 'cancel',
         
      },
      {
        text: app.t('OK'),
        role: 'confirm',
        cssClass: 'alert-button-confirm',
        
      },
    ]
    if(options.buttons){
      defaultButtons = options.buttons;
    }
    
    const al = await alertController.create({
        header: app.t(title),
        subHeader:options.subHeader || "",
        message: app.t(message),
        buttons: defaultButtons
      });
  
      await al.present();
        const { data, role } = await al.onWillDismiss();
        if (role=="confirm"){
           
            return true
        }
        return false
        
        
}


 
 
globalThis.app.station_name  =  async function() {
  return await storageService.getItem("station_name")
}


globalThis.app.print_setting= {printer_name:"Cashier Printer", copy:1}

globalThis.app.setting = {}//setting is dynamic set


globalThis.app.currentUser = null
globalThis.app.setCurrentUser  =    function(user) {
  app.currentUser= user
}

globalThis.app.outlet=null
globalThis.app.station_name="Pheakdey PC"
 

// router 
globalThis.app.ionRouter = null;
 globalThis.app.setIonRouter = function(router){
  
  globalThis.app.ionRouter =router; 
 }

//  route
globalThis.app.route = null;
 globalThis.app.setRoute = function(route){
 
  globalThis.app.route =route; 
 }
// vue router
globalThis.app.router = null;
 globalThis.app.setRouter = function(router){
  globalThis.app.router =router; 
 }



 globalThis.app.getDatebyTimestamp = function(timestamp){
  return utils.getDatebyTimestamp(timestamp)
 }

 globalThis.app.getServerReportDefaultFilter = function(filter){
  return utils.getServerReportDefaultFilter(filter)
 }
 
 globalThis.app.onConfirm = async function(title = "Confirm", message = "Are you sure you want to process this action?", options = {}){
  return await utils.onConfirm(title,message,options)
 }
 globalThis.app.showConfirm = async function(title = "Confirm", message = "Are you sure you want to process this action?", options = {}){
  return await utils.onConfirm(title,message,options)
 }
 globalThis.app.showWarningMessage = async function(title = "Confirm", message = "Are you sure you want to process this action?"){
  return await utils.onWarningMessage(title,message)
 }


 globalThis.app.addAuditTrail = async function(data){
  return await utils.addAuditTrail(data)
 }

globalThis.app.printReport = async function(param){
  // param ={
  //   printer_name:"",
  //   report_id,
  //   params:{

  //   },
  //   copy:1
  // }

  return await utils.printReport(param)
}

 
 
globalThis.app.sale = sale;





// page state
globalThis.app.pageState = {}//will use json key:value for this property


