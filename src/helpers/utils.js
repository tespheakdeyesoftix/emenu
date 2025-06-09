import { alertController, toastController, loadingController, modalController } from '@ionic/vue';


import dayjs from 'dayjs';

export function getRandomChar() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomIndex = Math.floor(Math.random() * chars.length);
    return chars[randomIndex];
  }


import { useApp } from '@/hooks/useApp';



export function imageUrl(imageUrl, baseUrl = "") {
 
    if (imageUrl?.startsWith("https://") || imageUrl?.startsWith("http://")) {
        return imageUrl;
    }
    if (baseUrl !== "") {
        return baseUrl + imageUrl;
    }
 
        return app.api_url + imageUrl;
   
}

export function getTimespanRange(timespan) {
  const now = new Date();
  const startOfDay = d => new Date(d.setHours(0, 0, 0, 0));
  const endOfDay = d => new Date(d.setHours(23, 59, 59, 999));
  const addDays = (d, n) => new Date(d.setDate(d.getDate() + n));
  const start = new Date(now);
  const end = new Date(now);

  const getQuarterRange = (date) => {
    const quarter = Math.floor(date.getMonth() / 3);
    const start = new Date(date.getFullYear(), quarter * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { startDate: startOfDay(start), endDate: endOfDay(end) };
  };

  switch (timespan) {
    case "Today":
      
      return { startDate: startOfDay(start), endDate: endOfDay(end) };
    case "Yesterday":
      return {
        startDate: startOfDay(addDays(start, -1)),
        endDate: endOfDay(addDays(end, -1)),
      };
    case "Tomorrow":
      return {
        startDate: startOfDay(addDays(start, 1)),
        endDate: endOfDay(addDays(end, 1)),
      };
    case "This Week": {
      const day = now.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: startOfDay(monday), endDate: endOfDay(sunday) };
    }
    case "Last Week": {
      const current = new Date();
      const day = current.getDay();
      const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
      const lastMonday = new Date(current.setDate(diffToMonday - 7));
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { startDate: startOfDay(lastMonday), endDate: endOfDay(lastSunday) };
    }
    case "Next Week": {
      const current = new Date();
      const day = current.getDay();
      const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
      const nextMonday = new Date(current.setDate(diffToMonday + 7));
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      return { startDate: startOfDay(nextMonday), endDate: endOfDay(nextSunday) };
    }
    case "This Month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay) };
    }
    case "Last Month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay) };
    }
    case "Next Month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay) };
    }
    case "This Quarter":
      return getQuarterRange(new Date());
    case "Last Quarter": {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const lastQuarterStartMonth = (currentQuarter - 1 + 4) % 4 * 3;
      const lastQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const start = new Date(lastQuarterYear, lastQuarterStartMonth, 1);
      const end = new Date(lastQuarterYear, lastQuarterStartMonth + 3, 0);
      return { startDate: startOfDay(start), endDate: endOfDay(end) };
    }
    case "This Year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { startDate: startOfDay(start), endDate: endOfDay(end) };
    }
    case "Last Year": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { startDate: startOfDay(start), endDate: endOfDay(end) };
    }
    default:
      return null;
  }
}

export async function showWarning(message) {

    const toast = await toastController.create({
        message: message,
        duration: 5000,
        position: "top",
        swipeGesture: "vertical",
        color: "warning"
    });
    toast.present();
}

export function getAvatarLetter(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length > 1) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0][0].toUpperCase();
}

export function getGreetingMessage() {
    const hours = new Date().getHours();
    if (hours < 12) {
        return "Good Morning!";
    } else if (hours < 18) {
        return "Good Afternoon!";
    } else {
        return "Good Evening!";
    }
}

export function stripHtmlTags(text) {
    return text?.replace(/<[^>]*>/g, '');
}

export const getRandomColor = () => {
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
};


export async function showToast(message, color = "") {
    const toast = await toastController.create({
        message: stripHtmlTags(message),
        duration: 5000,
        position: "top",
        swipeGesture: "vertical",
        color: color
    });
    toast.present();
}

export async function showLoading(message = "Loading") {
    const loading = await loadingController.create({
        message: app.t(message)
    });

    await loading.present();
    return loading;
}
 
 
  
export async function openModal(props) {
    if (!props.title) {
        props.title = "Select";
    }

    if (!props.cssClass) {
        props.cssClass = "desktop-modal";
    }

    const modal = await modalController.create({ ...props });

    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm') {
        return data;
    }
    return false;
}
 

export async function onConfirm(title = "Confirm", message = "Are you sure you want to process this action?", options = {}) {
    let defaultButtons = [
        {
            text: app.t('OK'),
            role: 'confirm',
            cssClass: 'alert-button-confirm'
        },
        {
            text: app.t('Cancel'),
            role: 'cancel'
        },
        
    ];

    if (options.buttons) {
        defaultButtons = options.buttons;
    }

    const al = await alertController.create({
        header: app.t(title),
        subHeader:app.t(message)  ,
        buttons: defaultButtons
    });

    await al.present();
    const { role } = await al.onWillDismiss();
    return role === 'confirm';
}


export async function onWarningMessage(title = "Confirm", message = "Are you sure you want to process this action?") {
    let defaultButtons = [
        {
            text: app.t('OK'),
            role: 'confirm',
            cssClass: 'alert-button-warning'
        }
        
    ];



    const al = await alertController.create({
        header: app.t(title),
        subHeader:app.t(message)  ,
        buttons: defaultButtons,
        cssClass:"warning-alert"
    });

    await al.present();
    const { role } = await al.onWillDismiss();
    return role === 'confirm';
}

export async function showSuccessMessage(title = "Confirm") {
    let defaultButtons = [
        {
            text: app.t('OK'),
            role: 'confirm',
            cssClass: 'alert-button-confirm-success'
        }
        
    ];



    const al = await alertController.create({
        header: app.t(title),
        buttons: defaultButtons,
        cssClass:"success-alert"
    });

    await al.present();
    const { role } = await al.onWillDismiss();
    return role === 'confirm';
}


export function getDatebyTimestamp(timestamp) {
    const format = "YYYY-MM-DD";
    const today = dayjs();
    const current = dayjs();

    switch (timestamp) {
        case "today":
            return today.format(format);
        case "previous_working_day":
            return current.subtract(1, "day").format(format);
        case "start_mtd":
            return current.startOf("month").format(format);
        case "end_mtd":
            return current.endOf("month").format(format);
        case "start_current_mtd":
            return today.startOf("month").format(format);
        case "end_current_mtd":
            return today.endOf("month").format(format);
        case "start_ytd":
            return current.startOf("year").format(format);
        case "end_ytd":
            return current.endOf("year").format(format);
        default:
            return today.format(format);
    }
}

export function getServerReportDefaultFilter(filter) {
  let fitlers = []
    Object.entries(filter).forEach(([key, value]) => {
        if (
            [
                "current_working_date",
                "today",
                "start_mtd",
                "end_mtd",
                "start_current_mtd",
                "end_current_mtd",
                "start_ytd",
                "end_ytd"
            ].includes(value)
        ) {
          fitlers.push({name:key,values:[ getDatebyTimestamp(value)]})
          
        }else if (value=="current_outlet"){
          fitlers.push({name:key,values:[app.setting.outlet]})
        }else {
          fitlers.push({name:key,values:[value]})
        }

        
    });

    return fitlers;
}


export async function addAuditTrail (data){
    
    const auditDoc = {
        doctype:"Audit Trail Log",
        outlet:app.outlet,
        station: app.storageService.getItem("station_name"),
        posting_date : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        ...data
      }
    app.createDoc("Audit Trail Log",auditDoc)

      
} 



// eletron print

export async  function printReport(data) {
    if (!data.params) data.params = {}
    data.params.username =  [app.currentUser.name];
    data.params.printed_by = [app.currentUser.user_info.employee_name];


  

    if( window.electron?.ipcRenderer){
        const printParams = {
            reportId: data.report_id || app.print_setting.invoice_id, //"38355e72-b148-41a2-a321-261cc04f3eb0", //
            parameters: data.params ,
            printerName: data.printer_name || app.print_setting.printer_name,
            copy: Number(data.copy) || 1
          }
      window.electron.ipcRenderer.invoke('print', printParams).then(res => {
          if (res.success) {
            window.showSuccess(app.t('Printed successfully'));
          } else {
            window.showError(app.t('Printing fail. Please try again'));
          }
        });
    }
  }


  
export async function getMeta(doctype) {

  const existingDoctype = metas.value.find(r => r.name == doctype);

  if (existingDoctype) {

    return existingDoctype
  }

  const response = await getApi("ice_factory_management_system.api.utils.get_meta", {
    doctype: doctype
  });

  if (response.data) {
    metas.value.push(response.data);
    return response.data;
  }


}


export async function getDoctypeDefaultFields(docType) {
  let fields = ["name"]
  const meta = await getMeta(docType)
  if (meta.image_field) {
    fields.push(meta.image_field)
  }

  if (meta.title_field) {
    fields.push(meta.title_field)
  }

  if (meta.search_fields) {
    fields = [...fields, ...meta.search_fields.split(",").map((item) => item.trim())];
  }

  return [...new Set(fields)];

}


export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


export function getGeoLocation(){
  if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      return {lat:latitude, long:longitude}
    },
    (error) => {
      console.error("Error getting location:", error.message);
    }
  );
}
}

export function isWithinRange(currentPosition, predefinePosition, rangeInMeters) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (value) => (value * Math.PI) / 180;

  const lat1 = currentPosition.lat;
  const lon1 = currentPosition.long;
  const lat2 = predefinePosition.lat;
  const lon2 = predefinePosition.long;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  
  return distance <= rangeInMeters;
}

export async function getOrderRange(){
    if((app.setting.emenu.online_order_range || 0) > 0) return app.setting.emenu.online_order_range;
    
    const res =  await app.getValue("eMenu",app.emenu, "online_order_range");
    if(res.data){
      app.setting.emenu.online_order_range = res.data.online_order_range
      return res.data.online_order_range
    }
     
}


export function formatCurrency(value, format="$#,##0.00") {
  const hasDollar = format.includes('$');
  const hasRiel = format.includes('៛');

  // Extract format decimal part
  const decimalPart = (format.split('.')[1] || '').replace(/[^0#]/g, '');
  const minDecimal = decimalPart.replace(/[^0]/g, '').length; // count '0's
  const maxDecimal = decimalPart.length; // total length of 0s and #s

  let numberFormatted = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: minDecimal,
    maximumFractionDigits: maxDecimal,
    useGrouping: true,
  });

  // Remove optional trailing zeros
  if (maxDecimal > minDecimal) {
    numberFormatted = numberFormatted.replace(/(\.\d*?[1-9])0+$/, '$1'); // trim trailing zeros
    numberFormatted = numberFormatted.replace(/\.0+$/, '.00'); // ensure required .00 stays
  }

  if (hasDollar) {
    return `$ ${numberFormatted}`;
  } else if (hasRiel) {
    return `${numberFormatted} ៛`;
  } else {
    return numberFormatted;
  }
}
