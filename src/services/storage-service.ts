// NOTE 
// we use this because in the furture we may check plateform specific like ios or android, 
export  function setItem(key:string,value:any) {
    localStorage.setItem(key,value)
}


export  function getItem(key:string) {
    return localStorage.getItem(key)
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

 
  