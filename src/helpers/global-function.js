import { alertController, toastController,loadingController,modalController } from '@ionic/vue';
import i18n from '../../i18n'; // Import i18n config
import { getApi, getDoc,updateDoc,createDoc,getDocList, postApi,getValue  } from "@/services/api-service";
import * as utils from '@/helpers/utils';
import * as storageService from '@/services/storage-service';
import * as sale from '@/helpers/sale-action.js';

import { useApp } from '@/hooks/useApp';

import dayjs from 'dayjs';


 


// Ensure the namespace exists
globalThis.app = globalThis.app || {};




globalThis.app.apiUrl ="";



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



globalThis.app.openModal =  async function (props) {
  return await utils.openModal(props)
}

globalThis.app.onSelectDate =  async function(props=null){
 
  return await utils.selectDate(props)
}

globalThis.app.selectCustomer =  async function(){
  return await utils.selectCustomer( { title: "Select Customer", filters: [["is_customer", "=", 1], ["enabled", "=", 1]], validate_message: "Please select customer" })
}
globalThis.app.selectDriver =  async function(){
  return await utils.selectCustomer( { title: "Select Driver", filters: [["is_driver", "=", 1], ["enabled", "=", 1]], validate_message: "Please select driver" })
}

globalThis.app.onInputNumber =  async function(title = "Enter Number", required = true){
  return await utils.onInputNumber(title, required)
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


globalThis.app.openKeyboard  =  async function(title = "Enter your text", default_value,storage_key="") {
  return  await  utils.openKeyboard(title,default_value,storage_key)
}
 
globalThis.app.station_name  =  async function() {
  return await storageService.getItem("station_name")
}


globalThis.app.print_setting= {printer_name:"Cashier Printer", copy:1}

globalThis.app.setting = null
globalThis.app.setSetting  =    function(setting) {
  app.setting = setting;
}

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

 

 
//  sale action
globalThis.app.onEditBill = async function(data){
  return await sale.onEditBill(data);
}
globalThis.app.onSplitBill = async function(data){
  return await sale.onSplitBill(data);
}
globalThis.app.sale = sale;





// page state
globalThis.app.pageState = {}//will use json key:value for this property


