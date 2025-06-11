

import io from 'socket.io-client';


let socket = io("https://anluak.posbooking.com:442", { path: '/socketserver/socket.io' });

export default socket;
