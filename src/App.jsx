import { useState, useEffect, useRef, useCallback } from "react";

// --- DATA ---------------------------------------------------------------------

const DELIVERIES = [];

const DRIVERS = [
  { id:"M-01", name:"Juan Mojica",          avatar:"JM", phone:"8091000001", zone:"DN Norte",   status:"active",  vehicle:"Moto",      deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:true  },
  { id:"M-02", name:"Juan Elias Rodriguez", avatar:"JE", phone:"8091000002", zone:"DN Sur",     status:"active",  vehicle:"Moto",      deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:true  },
  { id:"M-03", name:"Omalis Reyes",         avatar:"OR", phone:"8091000003", zone:"DN Este",    status:"active",  vehicle:"Carro",     deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:true  },
  { id:"M-04", name:"Carlos Alfredo",       avatar:"CA", phone:"8091000004", zone:"DN Oeste",   status:"active",  vehicle:"Moto",      deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:true  },
  { id:"M-05", name:"Eriberto Reynoso",     avatar:"ER", phone:"8091000005", zone:"Santiago",   status:"offline", vehicle:"Furgoneta", deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:false },
  { id:"M-06", name:"Douglas Santiago",     avatar:"DS", phone:"8091000006", zone:"DN Central", status:"active",  vehicle:"Moto",      deliveries:0, success:0, rating:0, activeRoute:null, today:0, online:true  },
];

const CLIENTS = [];

const ROUTES = [];

const ANALYTICS_DATA = {
  weekly:    [88, 102, 114, 97, 123, 118, 128],
  monthly:   [320, 410, 395, 480, 520, 490, 560, 610, 580, 640, 700, 128],
  cancelled: [8, 5, 10, 7, 4, 6, 3],
  avgTime:   [42, 38, 44, 36, 39, 35, 33],
  zones:     [{zone:"Centro",pct:28,color:"#3b82f6"},{zone:"Salamanca",pct:22,color:"#10b981"},{zone:"Retiro",pct:18,color:"#f59e0b"},{zone:"Lavapiés",pct:14,color:"#8b5cf6"},{zone:"Malasaña",pct:10,color:"#ef4444"},{zone:"Otros",pct:8,color:"#374151"}],
  drivers:   [],
};

// --- MENSAJEROS (MUTABLE via Admin) ------------------------------------------
const DEFAULT_MENSAJEROS = [
  { id:"M-01", name:"JUAN MOJICA",          initials:"JM", phone:"8091000001", color:"#3b82f6", active:true },
  { id:"M-02", name:"JUAN ELIAS RODRIGUEZ", initials:"JE", phone:"8091000002", color:"#3b82f6", active:true },
  { id:"M-03", name:"OMALIS REYES",         initials:"OR", phone:"8091000003", color:"#3b82f6", active:true },
  { id:"M-04", name:"CARLOS ALFREDO",       initials:"CA", phone:"8091000004", color:"#3b82f6", active:true },
  { id:"M-05", name:"ERIBERTO REYNOSO",     initials:"ER", phone:"8091000005", color:"#3b82f6", active:true },
  { id:"M-06", name:"DOUGLAS SANTIAGO",     initials:"DS", phone:"8091000006", color:"#3b82f6", active:true },
];

const USERS = [
  { id:"U-01", name:"Admin Rap Drive",         email:"admin@rapdrive.do",     password:"Rapcargo2026@", role:"admin",  avatar:"AD", zone:"Todas",      color:"#3b82f6" },
  { id:"U-02", name:"JUAN MOJICA",             email:"jmojica@rapdrive.do",   password:"driver123",     role:"driver", avatar:"JM", zone:"DN Norte",   color:"#10b981", driverId:"M-01" },
  { id:"U-03", name:"JUAN ELIAS RODRIGUEZ",    email:"jelias@rapdrive.do",    password:"driver123",     role:"driver", avatar:"JE", zone:"DN Sur",     color:"#10b981", driverId:"M-02" },
  { id:"U-04", name:"OMALIS REYES",            email:"oreyes@rapdrive.do",    password:"driver123",     role:"driver", avatar:"OR", zone:"DN Este",    color:"#10b981", driverId:"M-03" },
  { id:"U-05", name:"CARLOS ALFREDO",          email:"calfredo@rapdrive.do",  password:"driver123",     role:"driver", avatar:"CA", zone:"DN Oeste",   color:"#10b981", driverId:"M-04" },
  { id:"U-06", name:"DOUGLAS SANTIAGO",        email:"dsantiago@rapdrive.do", password:"driver123",     role:"driver", avatar:"DS", zone:"DN Central", color:"#10b981", driverId:"M-06" },
  { id:"U-07", name:"ERIBERTO REYNOSO",        email:"ereynoso@rapdrive.do",  password:"driver123",     role:"driver", avatar:"ER", zone:"Santiago",   color:"#10b981", driverId:"M-05" },
];

const ROLE_CONFIG = {
  admin:  { label:"Administrador", color:"#3b82f6", canSeeAnalytics:true, canManageDrivers:true, canDeleteDeliveries:true, canExport:true  },
  driver: { label:"Mensajero",     color:"#10b981", canSeeAnalytics:false,canManageDrivers:false,canDeleteDeliveries:false,canExport:false },
};

// --- PERSISTENT STORE (in-memory - compatible con entorno de artefacto) -------
// ─── FIREBASE REALTIME DATABASE ─────────────────────────────────────────────
// Puente real entre navegadores distintos (Chrome admin ↔ Brave mensajero)
// ⚠️  IMPORTANTE: Reemplaza esta URL con la de tu Firebase Realtime Database
// Pasos: console.firebase.google.com → Nuevo proyecto → Realtime Database → Crear → Copiar URL
// La URL tiene este formato: https://TU-PROYECTO-default-rtdb.firebaseio.com
// En las Reglas de Firebase pon: { "rules": { ".read": true, ".write": true } }
const FB_URL = "https://rapdrive-default-rtdb.firebaseio.com";

const FB = {
  // Escribe un nodo en Firebase
  set: async (path, data) => {
    try {
      await fetch(`${FB_URL}/${path}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch(e) { console.warn("FB.set error", e); }
  },
  // Lee un nodo de Firebase
  get: async (path) => {
    try {
      const r = await fetch(`${FB_URL}/${path}.json`);
      return r.ok ? await r.json() : null;
    } catch(e) { return null; }
  },
  // Escucha cambios en tiempo real con SSE (Server-Sent Events)
  listen: (path, cb) => {
    try {
      const es = new EventSource(`${FB_URL}/${path}.json`);
      es.addEventListener("put", (e) => {
        try { const d = JSON.parse(e.data); if (d && d.data !== undefined) cb(d.data); } catch(_) {}
      });
      es.addEventListener("patch", (e) => {
        try { const d = JSON.parse(e.data); if (d && d.data) cb(d.data); } catch(_) {}
      });
      return () => es.close();
    } catch(e) { return () => {}; }
  },
};

// LS: memoria local + Firebase como puente cross-browser
const _memStore = { routes: {}, chats: {}, mens: null, pendingRoutes: {} };
const LS = {
  getRoutes: () => ({ ..._memStore.routes }),
  setRoute:  (id, r) => {
    _memStore.routes[id] = r;
    FB.set(`routes/${id}`, r);
  },
  getChats:  () => ({ ..._memStore.chats }),
  setChat:   (id, c) => {
    _memStore.chats[id] = c;
    FB.set(`chats/${id}`, c);
  },
  getMens:   () => _memStore.mens ? [..._memStore.mens] : DEFAULT_MENSAJEROS,
  setMens:   (m) => { _memStore.mens = m; FB.set("mens", m); },
  // Cola de rutas pendientes por mensajero (array ordenado por sentAt)
  getPending:    (id)  => _memStore.pendingRoutes[id] || [],
  setPending:    (id, arr) => { _memStore.pendingRoutes[id] = arr; FB.set(`pendingRoutes/${id}`, arr); },
  getAllPending:  ()    => ({ ..._memStore.pendingRoutes }),
  // Ubicaciones en tiempo real de mensajeros
  setLocation: (driverId, loc) => {
    if (!window.__rdLocations) window.__rdLocations = {};
    window.__rdLocations[driverId] = loc;
    FB.set(`locations/${driverId}`, loc);
  },
  getLocations: () => window.__rdLocations || {},
};

if (typeof window !== "undefined") {
  window.__rdRouteStore    = LS.getRoutes();
  window.__rdChatStore     = LS.getChats();
  window.__rdMensajeros    = LS.getMens();
  // Reconstruir pendingRoutes desde localStorage individual de cada mensajero
  // (evitar que _memStore traiga rutas completadas de Firebase)
  window.__rdPendingRoutes = (() => {
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("rdQueue_")) {
          const driverId = k.replace("rdQueue_", "");
          const q = JSON.parse(localStorage.getItem(k) || "[]");
          if (Array.isArray(q)) result[driverId] = q;
        }
      }
    } catch(e) {}
    return result;
  })();

  // ── CARGA INICIAL DESDE FIREBASE ─────────────────────────────────────────
  FB.get("routes").then(data => {
    if (data) { _memStore.routes = data; window.__rdRouteStore = data; }
  });
  FB.get("chats").then(data => {
    if (data) { _memStore.chats = data; window.__rdChatStore = data; }
  });
  // NO sobreescribir pendingRoutes desde Firebase globalmente —
  // cada mensajero gestiona su cola desde localStorage (fuente de verdad local).
  // Firebase solo se usa para que el admin ENVÍE rutas nuevas.
  // Cargar mensajeros y usuarios desde Firebase (persisten mensajeros nuevos creados por admin)
  FB.get("mens").then(data => {
    if (data && Array.isArray(data)) { _memStore.mens = data; window.__rdMensajeros = data; }
  });
  // Cargar nodo alternativo mensajeros/ (copia individual por id)
  FB.get("mensajeros").then(data => {
    if (data && typeof data === "object") {
      const fromFB = Object.values(data).filter(Boolean);
      if (fromFB.length > 0) {
        const current = _memStore.mens || DEFAULT_MENSAJEROS;
        const merged = [...current];
        fromFB.forEach(m => { if (m.id && !merged.find(x => x.id === m.id)) merged.push(m); });
        _memStore.mens = merged;
        window.__rdMensajeros = merged;
      }
    }
  });
  FB.get("users").then(data => {
    if (data && typeof data === "object") {
      Object.values(data).forEach(u => {
        if (u && u.id && !USERS.find(x => x.id === u.id)) USERS.push(u);
      });
    }
  });
  FB.get("mens_users").then(data => {
    if (data && typeof data === "object") {
      Object.values(data).forEach(u => {
        if (u && u.id && !USERS.find(x => x.id === u.id)) USERS.push(u);
      });
    }
  });
}

const STATUS = {
  on_route:  {label:"En ruta",   color:"#3b82f6", bg:"rgba(59,130,246,0.12)"},
  delivered: {label:"Entregado", color:"#10b981", bg:"rgba(16,185,129,0.12)"},
  cancelled: {label:"Cancelado", color:"#ef4444", bg:"rgba(239,68,68,0.12)" },
  pending:   {label:"Pendiente", color:"#f59e0b", bg:"rgba(245,158,11,0.12)"},
  active:    {label:"Activo",    color:"#10b981", bg:"rgba(16,185,129,0.12)"},
  inactive:  {label:"Inactivo",  color:"#6b7280", bg:"rgba(107,114,128,0.12)"},
  new:       {label:"Nuevo",     color:"#8b5cf6", bg:"rgba(139,92,246,0.12)"},
  offline:   {label:"Offline",   color:"#374151", bg:"rgba(55,65,81,0.12)"  },
  break:     {label:"Descanso",  color:"#f59e0b", bg:"rgba(245,158,11,0.12)"},
  delayed:   {label:"Demorada",  color:"#ef4444", bg:"rgba(239,68,68,0.12)" },
};
const PRIORITY = {urgent:{label:"URGENTE",color:"#ef4444"},high:{label:"ALTA",color:"#f97316"},normal:{label:"NORMAL",color:"#2d4a60"}};

// --- SHARED UI ----------------------------------------------------------------

const Avatar = ({i,size=30,color="#3b82f6"}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color}28,${color}14)`,border:`1.5px solid ${color}38`,display:"flex",alignItems:"center",justifyContent:"center",color,fontSize:size*0.33,fontWeight:700,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{i}</div>
);

const Badge = ({status}) => {
  const s=STATUS[status]||STATUS.pending;
  return <div style={{display:"inline-flex",alignItems:"center",gap:5,background:s.bg,borderRadius:7,padding:"3px 9px"}}><div style={{width:5,height:5,borderRadius:"50%",background:s.color,boxShadow:["on_route","active"].includes(status)?`0 0 6px ${s.color}`:"none"}}/><span style={{fontSize:10.5,color:s.color,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.3px"}}>{s.label}</span></div>;
};

const Spark = ({data,color}) => {
  const max=Math.max(...data),min=Math.min(...data);
  const pts=data.map((v,i)=>{const x=(i/(data.length-1))*60,y=18-((v-min)/(max-min||1))*16;return `${x},${y}`;}).join(" ");
  return <svg width="60" height="20"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/></svg>;
};

const KPI = ({label,value,sub,spark,color,delay="0ms"}) => (
  <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",flex:1,animation:"fadeUp 0.5s ease both",animationDelay:delay,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,right:0,width:70,height:70,borderRadius:"0 16px 0 70px",background:`${color}07`}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
      <span style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase"}}>{label}</span>
      <Spark data={spark} color={color}/>
    </div>
    <div style={{fontSize:32,fontWeight:800,color:"#f1f5f9",fontFamily:"'Syne',sans-serif",letterSpacing:"-1px",lineHeight:1}}>{value}</div>
    <div style={{fontSize:11,color,marginTop:5,fontWeight:500}}>{sub}</div>
    <div style={{marginTop:12,height:2,background:"#131f30",borderRadius:2}}>
      <div style={{height:2,background:`linear-gradient(90deg,${color},${color}30)`,borderRadius:2,width:sub.includes("+")||sub.includes("↑")?"68%":"40%",transition:"width 1s"}}/>
    </div>
  </div>
);

// --- MAP ----------------------------------------------------------------------

const MapCanvas = ({selected,pins:cPins,routeLines}) => {
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(p=>p+1),1400);return ()=>clearInterval(t);},[]);
  const pins=cPins||DELIVERIES.map(d=>({x:d.lat,y:d.lng,status:d.status,id:d.id}));
  return (
    <div style={{position:"relative",width:"100%",height:"100%",background:"#080e16",overflow:"hidden"}}>
      <svg width="100%" height="100%" viewBox="0 0 520 260" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="mg2" cx="45%" cy="55%" r="55%"><stop offset="0%" stopColor="#111d2e"/><stop offset="100%" stopColor="#080e16"/></radialGradient>
          <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="520" height="260" fill="url(#mg2)"/>
        {["M20 75 L500 75","M20 135 L500 135","M20 190 L500 190","M20 240 L500 240","M55 0 L55 260","M135 0 L135 260","M215 0 L215 260","M305 0 L305 260","M395 0 L395 260","M465 0 L465 260"].map((d,i)=><path key={i} d={d} stroke="#131f30" strokeWidth="5" fill="none" opacity="0.8"/>)}
        {["M0 110 Q125 105 195 125 Q298 150 418 120 L520 115","M85 0 Q98 75 138 135 Q175 195 168 260","M258 0 Q268 58 288 112 Q308 168 298 260"].map((d,i)=><path key={i} d={d} stroke="#1a2d44" strokeWidth="9" fill="none"/>)}
        {routeLines?routeLines.map((rl,i)=><path key={i} d={rl.d} stroke={rl.color} strokeWidth="2.5" fill="none" strokeDasharray="6 3" opacity="0.85" filter="url(#glow2)"/>):<path d="M128 218 Q140 198 148 162 Q162 142 198 138 Q246 126 258 112" stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeDasharray="6 3" opacity="0.85" filter="url(#glow2)"/>}
        {pins.map(pin=>{const s=STATUS[pin.status]||STATUS.pending;const isSel=selected===pin.id;const alive=["on_route","active"].includes(pin.status);return(<g key={pin.id} transform={`translate(${pin.x},${pin.y})`}>{alive&&<circle r={11+(tick%2)*5} fill={s.color} opacity={0.12}/>}{isSel&&<circle r="14" fill={s.color} opacity="0.22"/>}<circle r="7" fill={s.color} stroke={isSel?"white":"#080e16"} strokeWidth={isSel?"2":"1.5"} style={{filter:alive?`drop-shadow(0 0 7px ${s.color})`:"none"}}/><circle r="2.5" fill="white" opacity="0.9"/></g>);})}
        <text x="148" y="102" fill="#1e3550" fontSize="10" fontFamily="'Syne',sans-serif" fontWeight="800" letterSpacing="3">SANTO DOMINGO</text>
        <text x="22" y="252" fill="#1e3550" fontSize="7.5" fontFamily="'Syne',sans-serif">© RAP DRIVE MAPS</text>
      </svg>
      <div style={{position:"absolute",top:0,left:0,right:0,height:50,background:"linear-gradient(to bottom,#080e16,transparent)"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(to top,#080e16,transparent)"}}/>
      <div style={{position:"absolute",top:13,right:14,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"pulse 2s infinite"}}/>
        <span style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>LIVE</span>
      </div>
    </div>
  );
};

// --- PAGE: DASHBOARD ----------------------------------------------------------

const PageDashboard = () => {
  const mapRef = useRef(null);
  const gMapRef = useRef(null);
  const [searchVal, setSearchVal] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null); // { address, plusCode, lat, lng }
  const [mapReady, setMapReady] = useState(false);
  const searchRef = useRef(null);
  const markerRef = useRef(null);
  const infoRef   = useRef(null);
  const inputRef  = useRef(null);

  // ── LIVE DRIVER LOCATIONS ────────────────────────────────────
  const [liveLocations, setLiveLocations] = useState({}); // { driverId: loc }
  const driverMarkersRef = useRef({});  // { driverId: { marker, circle, label } }
  const infoWindowRef    = useRef(null);

  // Motor SVG icon for each driver
  const makeDriverSvg = (initials, isOnline) => {
    const color = isOnline ? "#3b82f6" : "#374151";
    const glow  = isOnline ? "rgba(59,130,246,0.4)" : "rgba(55,65,81,0.3)";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <radialGradient id="dg" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stop-color="${isOnline?"#93c5fd":"#6b7280"}"/>
          <stop offset="100%" stop-color="${color}"/>
        </radialGradient>
        <filter id="dglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="${isOnline?3:1.5}" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${isOnline ? `<circle cx="26" cy="26" r="25" fill="${glow}" filter="url(#dglow)"/>` : ""}
      <circle cx="26" cy="26" r="20" fill="url(#dg)" stroke="white" stroke-width="2.5"/>
      <text x="26" y="22" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="900" fill="white" font-family="-apple-system,sans-serif">${initials}</text>
      <text x="26" y="35" text-anchor="middle" font-size="14" font-family="-apple-system,sans-serif">🏍</text>
    </svg>`;
  };

  // Listen to all driver locations from Firebase
  useEffect(() => {
    // Initial load
    FB.get("locations").then(data => {
      if (data && typeof data === "object") {
        setLiveLocations(data);
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });
    // Real-time updates via SSE
    const unsub = FB.listen("locations", (data) => {
      if (data && typeof data === "object") {
        setLiveLocations(prev => ({ ...prev, ...data }));
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });
    // Polling backup every 5s
    const t = setInterval(() => {
      FB.get("locations").then(data => {
        if (data && typeof data === "object") {
          setLiveLocations(prev => ({ ...prev, ...data }));
        }
      });
    }, 5000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  // Update driver markers on map when locations change
  useEffect(() => {
    if (!gMapRef.current || !window.google) return;
    const mensajeros = window.__rdMensajeros || DEFAULT_MENSAJEROS;

    Object.entries(liveLocations).forEach(([driverId, loc]) => {
      if (!loc || !loc.lat || !loc.lng) return;
      const pos = { lat: loc.lat, lng: loc.lng };
      const isOnline = loc.online !== false && (Date.now() - (loc.ts||0)) < 120000; // online si actualizó en <2min
      const mens = mensajeros.find(m => m.id === driverId);
      const initials = mens?.initials || driverId.slice(-2).toUpperCase();

      if (driverMarkersRef.current[driverId]) {
        // Update existing marker position
        const { marker, circle } = driverMarkersRef.current[driverId];
        marker.setPosition(pos);
        if (circle) {
          circle.setCenter(pos);
          circle.setRadius(loc.accuracy || 30);
        }
        // Update icon if online status changed
        const svg = makeDriverSvg(initials, isOnline);
        marker.setIcon({
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new window.google.maps.Size(52, 52),
          anchor: new window.google.maps.Point(26, 26),
        });
      } else {
        // Create new marker
        const svg = makeDriverSvg(initials, isOnline);
        const marker = new window.google.maps.Marker({
          map: gMapRef.current,
          position: pos,
          zIndex: 9999,
          title: loc.driverName || driverId,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            scaledSize: new window.google.maps.Size(52, 52),
            anchor: new window.google.maps.Point(26, 26),
          },
        });
        // Accuracy circle
        const circle = new window.google.maps.Circle({
          map: gMapRef.current,
          center: pos,
          radius: loc.accuracy || 30,
          fillColor: "#3b82f6",
          fillOpacity: 0.06,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.2,
          strokeWeight: 1,
          zIndex: 100,
        });
        // Click to show info
        marker.addListener("click", () => {
          if (!infoWindowRef.current) {
            infoWindowRef.current = new window.google.maps.InfoWindow();
          }
          const mins = Math.round((Date.now() - (loc.ts||0)) / 60000);
          const timeAgo = mins === 0 ? "ahora mismo" : mins === 1 ? "hace 1 min" : `hace ${mins} min`;
          infoWindowRef.current.setContent(`
            <div style="font-family:-apple-system,sans-serif;padding:4px 6px;min-width:160px">
              <div style="font-weight:800;font-size:13px;margin-bottom:3px">${loc.driverName||driverId}</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:2px">🕐 Actualizado ${timeAgo}</div>
              ${loc.routeName ? `<div style="font-size:11px;color:#3b82f6">📦 ${loc.routeName}</div>` : ""}
              ${loc.accuracy ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px">Precisión: ±${loc.accuracy}m</div>` : ""}
              <div style="font-size:10px;color:#9ca3af">${loc.lat?.toFixed(5)}, ${loc.lng?.toFixed(5)}</div>
            </div>
          `);
          infoWindowRef.current.open({ map: gMapRef.current, anchor: marker });
        });
        driverMarkersRef.current[driverId] = { marker, circle };
      }
    });
  }, [liveLocations, mapReady]); // eslint-disable-line

  // Load Google Maps and init map
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (gMapRef.current || !mapRef.current) return;
      gMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 18.4861, lng: -69.9312 },
        zoom: 13,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        streetViewControl: true,
        streetViewControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        fullscreenControl: true,
        styles: [
          {elementType:"geometry",stylers:[{color:"#0d1420"}]},
          {elementType:"labels.text.stroke",stylers:[{color:"#0d1420"}]},
          {elementType:"labels.text.fill",stylers:[{color:"#2d4a60"}]},
          {featureType:"road",elementType:"geometry",stylers:[{color:"#131f30"}]},
          {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#1a2d44"}]},
          {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#1e3550"}]},
          {featureType:"road",elementType:"labels.text.fill",stylers:[{color:"#4b5563"}]},
          {featureType:"water",elementType:"geometry",stylers:[{color:"#060b10"}]},
          {featureType:"poi",stylers:[{visibility:"off"}]},
          {featureType:"transit",stylers:[{visibility:"off"}]},
          {featureType:"landscape",elementType:"geometry",stylers:[{color:"#080e16"}]},
          {featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#1e2d3d"}]},
          {featureType:"administrative",elementType:"labels.text.fill",stylers:[{color:"#2d4a60"}]},
        ],
      });

      // Autocomplete on the search input
      if (inputRef.current) {
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "DO" },
          fields: ["formatted_address","geometry","plus_code","name"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.geometry) return;
          const loc = place.geometry.location;
          const lat = loc.lat(), lng = loc.lng();
          const plusCode = place.plus_code?.global_code || place.plus_code?.compound_code || "—";
          const addr = place.formatted_address || place.name || "";
          setResult({ address: addr, plusCode, lat: lat.toFixed(6), lng: lng.toFixed(6) });
          gMapRef.current.panTo({ lat, lng });
          gMapRef.current.setZoom(17);
          // Drop marker
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new window.google.maps.Marker({
            map: gMapRef.current,
            position: { lat, lng },
            animation: window.google.maps.Animation.DROP,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2.5,
            },
          });
        });
        searchRef.current = ac;
      }
      setMapReady(true);
    });
  }, []);

  // Manual geocode search (for typed queries without autocomplete pick)
  const handleSearch = async () => {
    const q = searchVal.trim();
    if (!q || !window.google) return;
    setSearching(true);
    setResult(null);
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await new Promise((ok, fail) =>
        geocoder.geocode({ address: q + ", República Dominicana", region: "DO" }, (r, s) =>
          s === "OK" ? ok(r) : fail(s))
      );
      if (res && res[0]) {
        const top = res[0];
        const loc = top.geometry.location;
        const lat = loc.lat(), lng = loc.lng();
        // Fetch Plus Code via reverse geocode
        const revRes = await new Promise((ok2, fail2) =>
          geocoder.geocode({ location: { lat, lng } }, (r2, s2) => s2 === "OK" ? ok2(r2) : fail2(s2))
        );
        let plusCode = "—";
        if (revRes) {
          const pcComp = revRes[0]?.address_components?.find(c => c.types.includes("plus_code"));
          plusCode = pcComp?.long_name || revRes[0]?.plus_code?.global_code || "—";
        }
        setResult({ address: top.formatted_address, plusCode, lat: lat.toFixed(6), lng: lng.toFixed(6) });
        gMapRef.current.panTo({ lat, lng });
        gMapRef.current.setZoom(17);
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new window.google.maps.Marker({
          map: gMapRef.current,
          position: { lat, lng },
          animation: window.google.maps.Animation.DROP,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor:"#3b82f6", fillOpacity:1, strokeColor:"white", strokeWeight:2.5 },
        });
      }
    } catch(e) {
      setResult({ error: "No se encontró la dirección. Intenta ser más específico." });
    }
    setSearching(false);
  };

  const copyText = (txt) => {
    navigator.clipboard?.writeText(txt).catch(() => {});
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
      {/* Search bar overlay */}
      <div style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)", zIndex:10, width:"min(560px,90%)" }}>
        <div style={{ background:"rgba(6,11,16,0.95)", border:"1px solid #1e2d3d", borderRadius:14, boxShadow:"0 8px 40px rgba(0,0,0,0.7)", backdropFilter:"blur(12px)", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={inputRef}
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Buscar dirección en Rep. Dominicana..."
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#f1f5f9", fontSize:13, fontFamily:"'Inter',sans-serif", caretColor:"#3b82f6" }}
            />
            {searchVal && (
              <button onClick={() => { setSearchVal(""); setResult(null); if(markerRef.current) markerRef.current.setMap(null); }}
                style={{ background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:15, padding:2, lineHeight:1 }}>✕</button>
            )}
            <button onClick={handleSearch} disabled={searching || !searchVal.trim()}
              style={{ background:"#3b82f6", border:"none", borderRadius:9, padding:"7px 14px", color:"white", fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", opacity: searching||!searchVal.trim() ? 0.5 : 1, transition:"opacity .15s" }}>
              {searching ? "..." : "Buscar"}
            </button>
          </div>

          {/* Result card */}
          {result && (
            <div style={{ borderTop:"1px solid #131f30", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
              {result.error ? (
                <div style={{ fontSize:12, color:"#ef4444" }}>⚠ {result.error}</div>
              ) : (
                <>
                  <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5 }}>{result.address}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {[
                      { label:"Plus Code", value: result.plusCode, icon:"📍" },
                      { label:"Coordenadas", value: `${result.lat}, ${result.lng}`, icon:"🌐" },
                    ].map(item => (
                      <button key={item.label} onClick={() => copyText(item.value)}
                        title="Copiar"
                        style={{ display:"flex", alignItems:"center", gap:6, background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:8, padding:"6px 10px", cursor:"pointer", transition:"border-color .15s", flex:1 }}>
                        <span style={{ fontSize:13 }}>{item.icon}</span>
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontSize:9, color:"#2d4a60", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1px" }}>{item.label.toUpperCase()}</div>
                          <div style={{ fontSize:11, color:"#60a5fa", fontFamily:"'DM Mono',monospace", fontWeight:600, marginTop:1 }}>{item.value}</div>
                        </div>
                        <svg style={{ marginLeft:"auto", flexShrink:0 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Google Map full screen */}
      <div ref={mapRef} style={{ flex:1, width:"100%", height:"100%" }}/>

      {/* Hint when no result */}
      {!mapReady && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#060b10", color:"#1e3550", fontSize:13, fontFamily:"'Syne',sans-serif" }}>
          Cargando mapa...
        </div>
      )}

      {/* ── Live drivers panel (bottom-left overlay) ── */}
      {Object.keys(liveLocations).length > 0 && (
        <div style={{
          position:"absolute", bottom:16, left:14,
          background:"rgba(6,11,16,0.92)",
          border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:14, padding:"10px 12px",
          backdropFilter:"blur(16px)",
          minWidth:180, maxWidth:240,
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize:9, fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1.5px", color:"rgba(255,255,255,0.3)", marginBottom:8 }}>
            MENSAJEROS EN CAMPO
          </div>
          {Object.entries(liveLocations).map(([driverId, loc]) => {
            if (!loc || !loc.lat) return null;
            const isOnline = loc.online !== false && (Date.now() - (loc.ts||0)) < 120000;
            const mens = (window.__rdMensajeros || DEFAULT_MENSAJEROS).find(m => m.id === driverId);
            const name = loc.driverName || mens?.name || driverId;
            const mins = Math.round((Date.now() - (loc.ts||0)) / 60000);
            const timeStr = mins === 0 ? "ahora" : `${mins}m`;
            return (
              <div key={driverId}
                onClick={() => {
                  if (gMapRef.current && loc.lat) {
                    gMapRef.current.panTo({ lat: loc.lat, lng: loc.lng });
                    gMapRef.current.setZoom(16);
                  }
                }}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer", transition:"background .1s" }}>
                {/* Status dot */}
                <div style={{
                  width:8, height:8, borderRadius:"50%", flexShrink:0,
                  background: isOnline ? "#22c55e" : "#374151",
                  boxShadow: isOnline ? "0 0 6px #22c55e" : "none",
                  animation: isOnline ? "pulse 2s infinite" : "none",
                }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color: isOnline?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.35)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {name.split(" ")[0]}
                  </div>
                  {loc.routeName && (
                    <div style={{ fontSize:9, color:"rgba(59,130,246,0.7)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{loc.routeName}</div>
                  )}
                </div>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{timeStr}</span>
                {/* Arrow to pan */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            );
          })}
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", marginTop:6, textAlign:"center" }}>
            Toca un mensajero para centrar el mapa
          </div>
        </div>
      )}
    </div>
  );
};

// --- PAGE: ROUTES -------------------------------------------------------------

const PageRoutes = () => {
  // Lee de routeHistory (todas las rutas) Y de routes (rutas activas con progreso actualizado)
  const [allRouteHistory, setAllRouteHistory] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [filterDriver, setFilterDriver]   = useState("all");
  const [filterDate,   setFilterDate]     = useState("");
  const [stopSearch,   setStopSearch]     = useState("");
  const mapRef  = useRef(null);
  const gMapRef = useRef(null);
  const markersRef = useRef([]);

  const mergeAndSet = (histData, activeData) => {
    // Combinar historial completo con rutas activas (que tienen driverStatus actualizado)
    const byId = {};
    // Primero poner historial
    if (histData && typeof histData === "object") {
      Object.values(histData).filter(Boolean).forEach(r => { if(r.routeId) byId[r.routeId] = r; });
    }
    // Luego sobreescribir con activas (tienen el progreso más reciente)
    if (activeData && typeof activeData === "object") {
      Object.values(activeData).filter(Boolean).forEach(r => {
        if(r.routeId) byId[r.routeId] = r; // misma ruta: actualizar con progreso
        else if(r.driverId) byId[r.driverId+"_"+r.sentAt] = r; // rutas sin routeId (legado)
      });
    }
    const arr = Object.values(byId).filter(Boolean).sort((a,b)=> new Date(b.sentAt||0) - new Date(a.sentAt||0));
    setAllRouteHistory(arr);
  };

  useEffect(() => {
    const load = async () => {
      const [histData, activeData] = await Promise.all([
        FB.get("routeHistory"),
        FB.get("routes"),
      ]);
      if (activeData) { _memStore.routes = activeData; window.__rdRouteStore = activeData; }
      mergeAndSet(histData, activeData);
    };
    load();
    // El listener del App notifica cuando hay cambios en routes (activas)
    window.__rdOnRoutesUpdated = (activeData) => {
      FB.get("routeHistory").then(histData => mergeAndSet(histData, activeData));
    };
    const t = setInterval(load, 5000);
    return () => { clearInterval(t); delete window.__rdOnRoutesUpdated; };
  }, []);

  // Build map when route selected
  useEffect(() => {
    if (!selectedRoute) return;
    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;
      if (!gMapRef.current) {
        gMapRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 18.4861, lng: -69.9312 },
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
          styles: [
            {elementType:"geometry",stylers:[{color:"#0d1420"}]},
            {elementType:"labels.text.fill",stylers:[{color:"#2d4a60"}]},
            {elementType:"labels.text.stroke",stylers:[{color:"#0d1420"}]},
            {featureType:"road",elementType:"geometry",stylers:[{color:"#131f30"}]},
            {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#1e3550"}]},
            {featureType:"water",elementType:"geometry",stylers:[{color:"#060b10"}]},
            {featureType:"poi",stylers:[{visibility:"off"}]},
            {featureType:"transit",stylers:[{visibility:"off"}]},
            {featureType:"landscape",elementType:"geometry",stylers:[{color:"#080e16"}]},
          ],
        });
      }

      // Clear old markers
      markersRef.current.forEach(m => { try { m.setMap(null); } catch(e){} });
      markersRef.current = [];

      const stops = (selectedRoute.stops || []).filter(s => s.lat && s.lng);
      if (!stops.length) return;

      const bounds = new window.google.maps.LatLngBounds();

      // Draw polyline
      const ordered = stops.filter(s=>s.stopNum).sort((a,b)=>a.stopNum-b.stopNum);
      if (ordered.length > 1) {
        const line = new window.google.maps.Polyline({
          map: gMapRef.current,
          path: [{ lat: DEPOT.lat, lng: DEPOT.lng }, ...ordered.map(s=>({lat:s.lat,lng:s.lng}))],
          strokeColor: "#3b82f6",
          strokeOpacity: 0.5,
          strokeWeight: 2,
        });
        markersRef.current.push(line);
      }

      // Drop markers per stop
      stops.forEach(stop => {
        const isDone    = stop.driverStatus === "delivered";
        const isProb    = stop.driverStatus === "problema";
        const color     = isDone ? "#10b981" : isProb ? "#ef4444" : "#f59e0b";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
          <defs>
            <filter id="sh" x="-40%" y="-20%" width="180%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.4"/>
            </filter>
          </defs>
          <g filter="url(#sh)">
            <path d="M9,${isDone?16:14} Q16,28 16,28 Q16,28 23,${isDone?16:14}Z" fill="${color}" opacity="${isDone?0.7:1}"/>
            <circle cx="16" cy="${isDone?13:11}" r="${isDone?11:10}" fill="${color}" opacity="${isDone?0.75:1}" stroke="white" stroke-width="2"/>
          </g>
          <text x="16" y="${isDone?17:15}" text-anchor="middle" dominant-baseline="central"
            font-size="${String(stop.stopNum||"?").length>2?7:10}" font-weight="800" fill="white" font-family="sans-serif">${stop.stopNum||"?"}</text>
          ${isDone ? `<circle cx="24" cy="5" r="6" fill="#059669" stroke="white" stroke-width="1.5"/>
          <path d="M21,5 l2,2 4,-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` : ""}
        </svg>`;
        const marker = new window.google.maps.Marker({
          map: gMapRef.current,
          position: { lat: stop.lat, lng: stop.lng },
          title: `#${stop.stopNum} ${stop.client||""}`,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 16),
          },
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: stop.lat, lng: stop.lng });
      });

      gMapRef.current.fitBounds(bounds, { top:40, right:20, bottom:20, left:20 });
    });
  }, [selectedRoute]);

  const allDrivers = [...new Set(allRouteHistory.map(r => r.driverName).filter(Boolean))];
  const filtered = allRouteHistory.filter(r => {
    const driverOk = filterDriver === "all" || r.driverName === filterDriver;
    const dateOk = !filterDate || (r.sentAt && r.sentAt.slice(0,10) === filterDate);
    return driverOk && dateOk;
  });

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-DO", { day:"2-digit", month:"short", year:"numeric" }) + " · " + d.toLocaleTimeString("es-DO", { hour:"2-digit", minute:"2-digit" });
  };

  const routeStats = (r) => {
    const stops = r.stops || [];
    const delivered = stops.filter(s => s.driverStatus === "delivered").length;
    const problems  = stops.filter(s => s.driverStatus === "problema").length;
    const pending   = stops.filter(s => s.driverStatus === "pending" || s.driverStatus === "en_ruta").length;
    return { total: stops.length, delivered, problems, pending };
  };

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden", background:"#060b10" }}>

      {/* LEFT: route list */}
      <div style={{ width:380, borderRight:"1px solid #0d1420", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
        {/* Header */}
        <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid #0d1420", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1.5px" }}>HISTORIAL DE RUTAS</div>
            <div style={{ fontSize:10, color:"#2d4a60", fontFamily:"'Syne',sans-serif" }}>{filtered.length} ruta{filtered.length!==1?"s":""}</div>
          </div>
          {/* Driver filter */}
          <select value={filterDriver} onChange={e=>setFilterDriver(e.target.value)}
            style={{ width:"100%", background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:8, padding:"7px 10px", color:"#94a3b8", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", cursor:"pointer", marginBottom:8 }}>
            <option value="all">Todos los mensajeros</option>
            {allDrivers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {/* Date filter */}
          <div style={{ position:"relative" }}>
            <input
              type="date"
              value={filterDate}
              onChange={e=>setFilterDate(e.target.value)}
              style={{ width:"100%", background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:8, padding:"7px 10px 7px 32px", color: filterDate?"#94a3b8":"#374151", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", cursor:"pointer", colorScheme:"dark" }}
            />
            <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {filterDate && (
              <button onClick={()=>setFilterDate("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px" }}>✕</button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflow:"auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding:"40px 20px", textAlign:"center", color:"#2d4a60" }}>
              <div style={{ fontSize:32, marginBottom:10, opacity:0.5 }}>🗺️</div>
              <div style={{ fontSize:13, fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#374151" }}>Sin historial</div>
              <div style={{ fontSize:11, marginTop:6, color:"#2d4a60" }}>Las rutas enviadas aparecerán aquí</div>
            </div>
          ) : filtered.map((route, i) => {
            const stats = routeStats(route);
            const isSel = selectedRoute?.sentAt === route.sentAt && selectedRoute?.driverId === route.driverId;
            return (
              <div key={`${route.driverId}-${route.sentAt}-${i}`}
                onClick={() => { setSelectedRoute(isSel ? null : route); setStopSearch(""); }}
                style={{
                  padding:"16px 18px 14px",
                  borderBottom:"1px solid #0d1420",
                  background: isSel ? "#091527" : "transparent",
                  borderLeft: `3px solid ${isSel ? "#3b82f6" : "transparent"}`,
                  cursor:"pointer", transition:"background .12s, border-color .12s",
                  animation:`slideIn .3s ${Math.min(i,15)*30}ms ease both`,
                }}>

                {/* Route name */}
                <div style={{ fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:800, color: isSel ? "#e2e8f0" : "#94a3b8", marginBottom:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.2px" }}>
                  {route.routeName || "Ruta sin nombre"}
                </div>

                {/* Mensajero */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:"#0d1b2a", border:"1px solid #1e3550", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span style={{ fontSize:12, color:"#60a5fa", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>{route.driverName || "—"}</span>
                </div>

                {/* Fecha */}
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:11 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  <span style={{ fontSize:11, color:"#374151", fontFamily:"'Inter',sans-serif" }}>{fmtDate(route.sentAt)}</span>
                </div>

                {/* Stats pills */}
                <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"4px 10px", borderRadius:7, background:"rgba(16,185,129,0.12)", color:"#10b981", display:"flex", alignItems:"center", gap:5, border:"1px solid rgba(16,185,129,0.15)" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {stats.delivered} entregados
                  </div>
                  {stats.problems > 0 && (
                    <div style={{ fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"4px 10px", borderRadius:7, background:"rgba(239,68,68,0.12)", color:"#ef4444", display:"flex", alignItems:"center", gap:5, border:"1px solid rgba(239,68,68,0.15)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                      {stats.problems} problema{stats.problems !== 1 ? "s" : ""}
                    </div>
                  )}
                  {stats.pending > 0 && (
                    <div style={{ fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"4px 10px", borderRadius:7, background:"rgba(245,158,11,0.12)", color:"#f59e0b", display:"flex", alignItems:"center", gap:5, border:"1px solid rgba(245,158,11,0.15)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {stats.pending} pendientes
                    </div>
                  )}
                  <div style={{ fontSize:11, color:"#2d4a60", marginLeft:"auto", fontFamily:"'Inter',sans-serif", whiteSpace:"nowrap" }}>
                    {stats.total} paradas{route.km ? ` · ${route.km} km` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: map + stop list */}
      {selectedRoute ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Map */}
          <div style={{ flex:"0 0 55%", position:"relative" }}>
            <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>
            {/* Overlay info */}
            <div style={{ position:"absolute", top:14, left:14, background:"rgba(6,11,16,0.92)", border:"1px solid #1e2d3d", borderRadius:12, padding:"10px 14px", backdropFilter:"blur(8px)" }}>
              <div style={{ fontSize:13, fontFamily:"'Syne',sans-serif", fontWeight:800, color:"#f1f5f9", marginBottom:3 }}>{selectedRoute.routeName || "Ruta"}</div>
              <div style={{ fontSize:11, color:"#4b5563" }}>{selectedRoute.driverName} · {fmtDate(selectedRoute.sentAt)}</div>
              {(() => { const s = routeStats(selectedRoute); return (
                <div style={{ display:"flex", gap:10, marginTop:7 }}>
                  {[["✓",s.delivered,"#10b981"],["⚠",s.problems,"#ef4444"],["○",s.pending,"#f59e0b"],["📍",s.total,"#3b82f6"]].map(([ic,val,c])=>val>0||ic==="📍"?(
                    <div key={ic} style={{ fontSize:10, color:c, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>{ic} {val}</div>
                  ):null)}
                  {selectedRoute.km && <div style={{ fontSize:10, color:"#2d4a60" }}>· {selectedRoute.km} km</div>}
                </div>
              ); })()}
            </div>
            <button onClick={() => setSelectedRoute(null)}
              style={{ position:"absolute", top:14, right:14, width:30, height:30, borderRadius:8, background:"rgba(6,11,16,0.88)", border:"1px solid #1e2d3d", color:"#4b5563", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✕</button>
          </div>

          {/* Stop list */}
          <div style={{ flex:1, overflow:"auto", borderTop:"1px solid #0d1420" }}>
            {/* Buscador de paquetes */}
            <div style={{ padding:"10px 14px", borderBottom:"1px solid #0d1420", flexShrink:0, background:"#060b10" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:8, padding:"6px 11px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  value={stopSearch}
                  onChange={e=>setStopSearch(e.target.value)}
                  placeholder="Buscar cliente, dirección, tracking..."
                  style={{ border:"none", background:"transparent", outline:"none", color:"#cbd5e1", fontSize:11, fontFamily:"'Inter',sans-serif", width:"100%", caretColor:"#3b82f6" }}
                />
                {stopSearch && <button onClick={()=>setStopSearch("")} style={{ background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:12, padding:"0 2px" }}>✕</button>}
              </div>
            </div>
            {(() => {
              const q = stopSearch.toLowerCase().trim();
              const visibleStops = (selectedRoute.stops||[])
                .sort((a,b)=>(a.stopNum||99)-(b.stopNum||99))
                .filter(s => !q ||
                  (s.client||"").toLowerCase().includes(q) ||
                  (s.displayAddr||s.rawAddr||"").toLowerCase().includes(q) ||
                  (s.tracking||"").toLowerCase().includes(q) ||
                  (s.phone||"").toLowerCase().includes(q)
                );
              if (visibleStops.length === 0) return (
                <div style={{ padding:"30px", textAlign:"center", color:"#374151", fontSize:12 }}>
                  Sin resultados para "{stopSearch}"
                </div>
              );
              return visibleStops.map((stop, i) => {
                const isDone = stop.driverStatus === "delivered";
                const isProb = stop.driverStatus === "problema";
                const c = isDone ? "#10b981" : isProb ? "#ef4444" : "#f59e0b";
                return (
                  <div key={stop.id||i} style={{ display:"flex", gap:12, padding:"10px 16px", borderBottom:"1px solid #080e16", alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:7, background:`${c}18`, border:`1.5px solid ${c}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontFamily:"'Syne',sans-serif", fontWeight:700, color:c, flexShrink:0, marginTop:1, position:"relative" }}>
                      {stop.stopNum || i+1}
                      {isDone && <div style={{ position:"absolute", top:-4, right:-4, width:10, height:10, borderRadius:"50%", background:"#10b981", border:"1.5px solid #060e1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"white", fontWeight:900 }}>✓</div>}
                      {isProb && <div style={{ position:"absolute", top:-4, right:-4, width:10, height:10, borderRadius:"50%", background:"#ef4444", border:"1.5px solid #060e1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"white", fontWeight:900 }}>!</div>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Cliente primero, dirección debajo */}
                      <div style={{ fontSize:12.5, fontWeight:700, color: isDone?"#10b981": isProb?"#ef4444":"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>
                        {stop.client || "—"}
                        {stop.phone && <span style={{ fontSize:11, color:"#4b5563", fontWeight:400 }}> · {stop.phone}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"#4b5563", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {stop.displayAddr || stop.rawAddr || "Sin dirección"}
                      </div>
                      {stop.tracking && <div style={{ fontSize:10, color:"#2d4a60", marginTop:2 }}>#{stop.tracking}</div>}
                      {stop.deliveredAt && <div style={{ fontSize:10, color:"#10b981", marginTop:2 }}>Entregado {stop.deliveredAt}</div>}
                      {stop.issue && stop.driverStatus === "problema" && <div style={{ fontSize:10, color:"#ef4444", marginTop:2 }}>⚠ {stop.issue}</div>}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, color:"#2d4a60" }}>
          <div style={{ fontSize:44, opacity:0.3 }}>👈</div>
          <div style={{ fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#374151" }}>Selecciona una ruta</div>
          <div style={{ fontSize:12, color:"#2d4a60" }}>para ver el mapa y las paradas</div>
        </div>
      )}
    </div>
  );
};


// --- PAGE: DRIVERS ------------------------------------------------------------

const PageDrivers = ({ drivers, setDrivers }) => {
  const [selDriver,setSelDriver]=useState(null);
  const [search,setSearch]=useState("");
  const [showAddDriver,setShowAddDriver]=useState(false);
  const [drvForm,setDrvForm]=useState({name:"",phone:"",vehicle:"Moto",zone:""});
  const driver=drivers.find(d=>d.id===selDriver);
  const filtered=drivers.filter(d=>!search||[d.name,d.zone,d.vehicle].some(s=>s&&s.toLowerCase().includes(search.toLowerCase())));
  const driverRoute=driver?ROUTES.find(r=>r.id===driver.activeRoute):null;
  const inp2={background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",width:"100%"};
  const addDriver=()=>{
    if(!drvForm.name.trim())return;
    const av=drvForm.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newId="M"+Date.now();
    setDrivers(p=>[...p,{id:newId,avatar:av,...drvForm,name:drvForm.name.trim(),status:"active",deliveries:0,success:0,rating:0,activeRoute:null,today:0,online:true}]);
    setDrvForm({name:"",phone:"",vehicle:"Moto",zone:""});
    setShowAddDriver(false);
  };
  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 22px 12px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}><div><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>CONDUCTORES</span><span style={{fontSize:11,color:"#2d4a60",marginLeft:10}}>{drivers.filter(d=>d.online).length} en línea</span></div><div style={{display:"flex",gap:8}}><div style={{display:"flex",alignItems:"center",gap:7,background:"#0a1019",border:"1px solid #131f30",borderRadius:9,padding:"6px 12px"}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar conductor..." style={{border:"none",background:"transparent",outline:"none",color:"#cbd5e1",fontSize:11,fontFamily:"'Inter',sans-serif",width:150,caretColor:"#3b82f6"}}/></div><button onClick={()=>setShowAddDriver(true)} style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",borderRadius:9,padding:"7px 14px",color:"white",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",letterSpacing:"0.8px",boxShadow:"0 4px 20px #3b82f630"}}>+ CONDUCTOR</button></div></div>
        <div style={{display:"flex",gap:12,padding:"14px 22px 0",flexShrink:0}}>
          <KPI label="Total"    value={drivers.length}                              sub="registrados"     color="#3b82f6" spark={[4,5,5,6,6,7,7,8,8,8]}  delay="0ms"/>
          <KPI label="En línea" value={drivers.filter(d=>d.online).length}          sub="↑ ahora mismo"   color="#10b981" spark={[3,4,4,5,5,6,6,6,6,6]}  delay="60ms"/>
          <KPI label="Descanso" value={drivers.filter(d=>d.status==="break").length} sub="pausa activa"    color="#f59e0b" spark={[1,2,1,1,2,1,1,2,1,1]}  delay="120ms"/>
          <KPI label="Offline"  value={drivers.filter(d=>!d.online).length}          sub="no disponibles"  color="#ef4444" spark={[2,2,3,2,2,2,2,2,2,2]}  delay="180ms"/>
        </div>
        <div style={{flex:1,overflow:"auto",padding:"14px 22px 18px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>{filtered.map((d,i)=>{const s=STATUS[d.status]||STATUS.offline;const isSel=selDriver===d.id;return(<div key={d.id} className="si" onClick={()=>setSelDriver(isSel?null:d.id)} style={{background:isSel?"#091527":"linear-gradient(135deg,#0d1420,#0a1019)",border:`1px solid ${isSel?"#1e3550":"#131f30"}`,borderRadius:14,padding:"16px",cursor:"pointer",transition:"all .15s",animation:`fadeUp .4s ${i*40}ms ease both`,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,right:0,width:60,height:60,borderRadius:"0 14px 0 60px",background:`${s.color}06`}}/><div style={{position:"absolute",top:12,right:12}}><div style={{width:8,height:8,borderRadius:"50%",background:d.online?"#10b981":"#374151",boxShadow:d.online?"0 0 6px #10b981":"none"}}/></div><div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}><Avatar i={d.avatar} size={42} color={s.color}/><div><div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.3px"}}>{d.name}</div><div style={{fontSize:10,color:"#2d4a60",marginTop:2}}>{d.zone} · {d.vehicle.split("·")[0].trim()}</div></div></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Badge status={d.status}/><span style={{fontSize:11,color:"#f59e0b",fontFamily:"'Syne',sans-serif",fontWeight:700}}>★ {d.rating}</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{[["HOY",d.today,"entregas","#3b82f6"],["TOTAL",d.deliveries,"hist.","#64748b"],["TASA",d.success+"%","éxito","#10b981"]].map(([l,v,s2,c])=><div key={l} style={{background:"#060b10",borderRadius:8,padding:"7px 8px",border:"1px solid #0d1420"}}><div style={{fontSize:8.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:2}}>{l}</div><div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#2d4a60"}}>{s2}</div></div>)}</div>{d.activeRoute&&<div style={{marginTop:10,padding:"6px 10px",background:"#060b10",border:"1px solid #0d1420",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:9.5,color:"#2d4a60"}}>Ruta activa</span><span style={{fontSize:9.5,color:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{d.activeRoute}</span></div>}</div>);})}</div></div>
      </div>
      {driver&&<aside style={{width:275,borderLeft:"1px solid #0d1420",display:"flex",flexDirection:"column",background:"#060b10",flexShrink:0,overflow:"hidden",animation:"slideIn .2s ease"}}><div style={{padding:"16px 16px 12px",borderBottom:"1px solid #0d1420"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>PERFIL CONDUCTOR</span><button onClick={()=>setSelDriver(null)} style={{width:24,height:24,borderRadius:6,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✕</button></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:14}}><Avatar i={driver.avatar} size={56} color={STATUS[driver.status]?.color||"#3b82f6"}/><div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginTop:10}}>{driver.name}</div><div style={{fontSize:11,color:"#2d4a60",marginTop:2}}>{driver.vehicle}</div><div style={{marginTop:8}}><Badge status={driver.status}/></div></div><div style={{background:"#0a1019",border:"1px solid #0d1420",borderRadius:12,padding:"12px 14px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px"}}>RENDIMIENTO</span><span style={{fontSize:11,color:"#f59e0b",fontFamily:"'Syne',sans-serif",fontWeight:700}}>★ {driver.rating}</span></div>{[["Tasa de éxito",driver.success,"#10b981"],["Entregas hoy",Math.round(driver.today/18*100),"#3b82f6"],["Puntualidad",driver.success-3,"#f59e0b"]].map(([l,v,c])=><div key={l} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"#4b5563"}}>{l}</span><span style={{fontSize:10,color:c,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{v}%</span></div><div style={{height:3,background:"#131f30",borderRadius:3}}><div style={{height:3,background:`linear-gradient(90deg,${c},${c}55)`,borderRadius:3,width:`${v}%`,transition:"width 1s"}}/></div></div>)}</div><div style={{display:"flex",gap:7,marginBottom:10}}>{[["📞","Llamar"],["💬","Mensaje"],["📍","Ubicar"]].map(([ic,l])=><button key={l} className="ab" style={{flex:1,padding:"8px 0",borderRadius:9,border:"1px solid #131f30",background:"transparent",color:"#4b5563",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .1s"}}>{ic} {l}</button>)}</div></div><div style={{flex:1,overflow:"auto",padding:"10px 14px"}}>{driverRoute?(<><div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:10}}>RUTA ACTIVA · {driverRoute.id}</div><div style={{background:"#0a1019",border:`1px solid ${driverRoute.color}33`,borderRadius:12,padding:"12px 14px",marginBottom:10}}><div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginBottom:6}}>{driverRoute.name}</div><div style={{height:4,background:"#131f30",borderRadius:4,marginBottom:6}}><div style={{height:4,background:`linear-gradient(90deg,${driverRoute.color},${driverRoute.color}55)`,borderRadius:4,width:`${driverRoute.progress}%`}}/></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:driverRoute.color,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{driverRoute.progress}% · {driverRoute.done}/{driverRoute.stops}</span><span style={{fontSize:11,color:"#2d4a60"}}>ETA {driverRoute.eta}</span></div></div><div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:8}}>PRÓXIMAS PARADAS</div>{driverRoute.stops_list.filter(s=>s.status!=="delivered").slice(0,4).map((stop,i)=><div key={stop.n} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid #0a1019"}}><div style={{width:22,height:22,borderRadius:"50%",background:"#0a1019",border:`1.5px solid ${stop.status==="on_route"?"#3b82f6":"#1e2d3d"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,flexShrink:0}}>{stop.n}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:11.5,color:stop.status==="on_route"?"#e2e8f0":"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stop.address}</div><div style={{fontSize:10,color:"#2d4a60",marginTop:1}}>{stop.client} · {stop.time}</div></div>{stop.status==="on_route"&&<Badge status="on_route"/>}</div>)}</>):(<div style={{padding:"30px 0",textAlign:"center",color:"#2d4a60",fontSize:13}}>Sin ruta activa</div>)}</div></aside>}
    {/* Modal agregar conductor */}
    {showAddDriver&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowAddDriver(false);}}>
      <div style={{width:400,background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:18,padding:"24px",boxShadow:"0 40px 80px rgba(0,0,0,0.9)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Nuevo Mensajero</div>
          <button onClick={()=>setShowAddDriver(false)} style={{width:26,height:26,borderRadius:7,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input value={drvForm.name} onChange={e=>setDrvForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo *" style={inp2}/>
          <input value={drvForm.phone} onChange={e=>setDrvForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono (ej: 8091234567)" style={inp2}/>
          <select value={drvForm.vehicle} onChange={e=>setDrvForm(p=>({...p,vehicle:e.target.value}))} style={{...inp2,cursor:"pointer"}}>
            <option>Moto</option><option>Carro</option><option>Furgoneta</option><option>Bicicleta</option>
          </select>
          <input value={drvForm.zone} onChange={e=>setDrvForm(p=>({...p,zone:e.target.value}))} placeholder="Zona (ej: DN Norte, Santiago)" style={inp2}/>
          <button onClick={addDriver} disabled={!drvForm.name.trim()} style={{padding:"11px",borderRadius:10,border:"none",background:drvForm.name.trim()?"linear-gradient(135deg,#1d4ed8,#3b82f6)":"#131f30",color:drvForm.name.trim()?"white":"#374151",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:drvForm.name.trim()?"pointer":"not-allowed",marginTop:4,boxShadow:drvForm.name.trim()?"0 4px 16px #3b82f630":"none"}}>
            + Agregar mensajero
          </button>
        </div>
      </div>
    </div>}
    </div>
  );
};

// --- PAGE: CLIENTS ------------------------------------------------------------

const PageClients = ({ clients, setClients }) => {
  const [selClient, setSelClient] = useState(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"",phone:"",zone:"",notes:""});
  const client = clients.find(c=>c.id===selClient);
  const filtered = clients.filter(c=>!search||[c.name,c.phone,c.zone].some(s=>s&&s.toLowerCase().includes(search.toLowerCase())));
  const inp = {background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",width:"100%"};
  const addClient = () => {
    if (!form.name.trim()) return;
    const initials = form.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    setClients(p=>[...p,{id:"CL-"+Date.now(),avatar:initials,...form,name:form.name.trim(),status:"active",deliveries:0,lastDelivery:"—",spend:"$0",rating:0}]);
    setForm({name:"",phone:"",zone:"",notes:""});
    setShowAdd(false);
  };
  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 22px 12px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>CLIENTES</span><span style={{fontSize:11,color:"#2d4a60",marginLeft:10}}>{clients.length} registrados</span></div>
          <div style={{display:"flex",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7,background:"#0a1019",border:"1px solid #131f30",borderRadius:9,padding:"6px 12px"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..." style={{border:"none",background:"transparent",outline:"none",color:"#cbd5e1",fontSize:11,fontFamily:"'Inter',sans-serif",width:150,caretColor:"#3b82f6"}}/>
            </div>
            <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",borderRadius:9,padding:"7px 14px",color:"white",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",letterSpacing:"0.8px",boxShadow:"0 4px 20px #3b82f630"}}>+ CLIENTE</button>
          </div>
        </div>
        {clients.length === 0 ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:"#2d4a60"}}>
            <div style={{fontSize:48}}>👥</div>
            <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#374151"}}>Sin clientes aún</div>
            <div style={{fontSize:13,color:"#2d4a60",marginBottom:8}}>Agrega tus primeros clientes para comenzar</div>
            <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",borderRadius:10,padding:"10px 22px",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px #3b82f630"}}>+ Agregar primer cliente</button>
          </div>
        ) : (
          <div style={{flex:1,overflow:"auto",borderRadius:13,margin:"14px 22px",border:"1px solid #0d1420"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:"1px solid #0d1420",background:"#060b10"}}>{["Cliente","Teléfono","Zona","Entregas","Notas",""].map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.3px"}}>{h}</th>)}</tr></thead>
              <tbody>{filtered.map((cl,i)=>{const isSel=selClient===cl.id;return(<tr key={cl.id} className="tr" onClick={()=>setSelClient(isSel?null:cl.id)} style={{borderBottom:"1px solid #080e16",background:isSel?"#091527":"transparent",transition:"background .1s",cursor:"pointer"}}>
                <td style={{padding:"10px 13px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar i={cl.avatar} size={28} color="#3b82f6"/><span style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{cl.name}</span></div></td>
                <td style={{padding:"10px 13px"}}><a href={"tel:"+cl.phone} onClick={e=>e.stopPropagation()} style={{fontSize:12,color:"#3b82f6",textDecoration:"none"}}>{cl.phone}</a></td>
                <td style={{padding:"10px 13px"}}><span style={{fontSize:11,color:"#4b5563"}}>{cl.zone||"—"}</span></td>
                <td style={{padding:"10px 13px"}}><span style={{fontSize:12,color:"#4b5563"}}>{cl.deliveries}</span></td>
                <td style={{padding:"10px 13px"}}><span style={{fontSize:11,color:"#374151",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cl.notes||"—"}</span></td>
                <td style={{padding:"10px 13px"}}><div style={{display:"flex",gap:5}}>
                  {cl.phone&&<button onClick={e=>{e.stopPropagation();window.open("https://wa.me/1"+cl.phone.replace(/[^0-9]/g,""),"_blank");}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid rgba(37,211,102,0.25)",background:"rgba(37,211,102,0.07)",color:"#25d366",fontSize:10,cursor:"pointer",fontWeight:700}}>💬 WA</button>}
                  <button onClick={e=>{e.stopPropagation();setClients(p=>p.filter(x=>x.id!==cl.id));if(selClient===cl.id)setSelClient(null);}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid rgba(239,68,68,0.2)",background:"transparent",color:"#ef4444",fontSize:10,cursor:"pointer"}}>✕</button>
                </div></td>
              </tr>);})}</tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal agregar cliente */}
      {showAdd&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
        <div style={{width:400,background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:18,padding:"24px",boxShadow:"0 40px 80px rgba(0,0,0,0.9)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Nuevo Cliente</div>
            <button onClick={()=>setShowAdd(false)} style={{width:26,height:26,borderRadius:7,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo *" style={inp}/>
            <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono (ej: 8091234567)" style={inp}/>
            <input value={form.zone} onChange={e=>setForm(p=>({...p,zone:e.target.value}))} placeholder="Zona / Sector" style={inp}/>
            <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas o referencia de entrega" style={inp}/>
            <button onClick={addClient} disabled={!form.name.trim()} style={{padding:"11px",borderRadius:10,border:"none",background:form.name.trim()?"linear-gradient(135deg,#1d4ed8,#3b82f6)":"#131f30",color:form.name.trim()?"white":"#374151",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:form.name.trim()?"pointer":"not-allowed",marginTop:4,boxShadow:form.name.trim()?"0 4px 16px #3b82f630":"none"}}>
              + Agregar cliente
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
};

// --- PAGE: ANALYTICS

// --- PAGE: ANALYTICS ----------------------------------------------------------

const LineChart = ({data,color,width=380,height=100,label}) => {
  const max=Math.max(...data),min=Math.min(...data);
  const pts=data.map((v,i)=>{const x=20+(i/(data.length-1))*(width-40),y=(height-20)-((v-min)/(max-min||1))*(height-40)+10;return{x,y,v};});
  const path="M "+pts.map(p=>`${p.x} ${p.y}`).join(" L ");
  const area="M "+pts[0].x+" "+(height-10)+" L "+pts.map(p=>`${p.x} ${p.y}`).join(" L ")+" L "+pts[pts.length-1].x+" "+(height-10)+" Z";
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{display:"block"}}>
      <defs>
        <linearGradient id={`ag${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#ag${color.replace("#","")})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={color} opacity="0.8"/>
          <title>{label} {p.v}</title>
        </g>
      ))}
      {[0,Math.round((max+min)/2),max].map((v,i)=>(
        <text key={i} x="2" y={i===0?height-8:i===1?height/2:12} fontSize="8" fill="#2d4a60" fontFamily="'Syne',sans-serif">{v}</text>
      ))}
    </svg>
  );
};

const BarChart = ({data,colors,labels,height=90}) => {
  const max=Math.max(...data);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height}}>
      {data.map((v,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:9,color:colors?colors[i]:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{v}</span>
          <div style={{width:"100%",borderRadius:"4px 4px 0 0",background:`linear-gradient(to top,${colors?colors[i]:"#3b82f6"},${colors?colors[i]:"#3b82f6"}88)`,height:`${(v/max)*70}px`,transition:"height 1s ease",minHeight:4}}/>
          {labels&&<span style={{fontSize:8,color:"#2d4a60",fontFamily:"'Inter',sans-serif",textAlign:"center",whiteSpace:"nowrap"}}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
};

const DonutSlice = ({pct,offset,color,total=100}) => {
  const r=36,c=40,circ=2*Math.PI*r;
  const dash=(pct/total)*circ;
  return <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset*(circ/100)} strokeLinecap="round" style={{transition:"stroke-dasharray 1s ease"}}/>;
};

const PageAnalytics = () => {
  const [period,setPeriod]=useState("weekly");
  const data=period==="weekly"?ANALYTICS_DATA.weekly:ANALYTICS_DATA.monthly;
  const weekDays=["L","M","X","J","V","S","D"];
  const months=["E","F","M","A","M","J","J","A","S","O","N","D"];
  const labels=period==="weekly"?weekDays:months;
  // Pre-compute cumulative offsets to avoid mutation during render
  const zoneOffsets = ANALYTICS_DATA.zones.reduce((acc, z, i) => {
    acc.push(i === 0 ? 0 : acc[i-1] + ANALYTICS_DATA.zones[i-1].pct);
    return acc;
  }, []);

  return (
    <div style={{flex:1,overflow:"auto",padding:"18px 22px"}}>
      {/* Period toggle */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
        <span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>ANALÍTICAS</span>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          {[{id:"weekly",label:"Semana"},{id:"monthly",label:"Mes"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{padding:"4px 12px",borderRadius:7,border:`1px solid ${period===p.id?"#1e3550":"#0d1420"}`,background:period===p.id?"#0a1828":"transparent",color:period===p.id?"#60a5fa":"#2d4a60",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <KPI label="Total entregas"  value={data.reduce((a,b)=>a+b,0)}  sub="+18% vs periodo ant." color="#3b82f6" spark={data.slice(-6)} delay="0ms"/>
        <KPI label="Tasa éxito"      value="91.4%"                        sub="↑ 2.1% esta semana"   color="#10b981" spark={[88,89,90,91,91,92]}       delay="60ms"/>
        <KPI label="Tiempo medio"    value="37 min"                       sub="↓ 5 min optimizado"   color="#f59e0b" spark={ANALYTICS_DATA.avgTime}    delay="120ms"/>
        <KPI label="Cancelaciones"   value={ANALYTICS_DATA.cancelled.reduce((a,b)=>a+b,0)}  sub="↓ 30% vs anterior" color="#ef4444" spark={ANALYTICS_DATA.cancelled} delay="180ms"/>
      </div>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:14}}>
        {/* Deliveries chart */}
        <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",animation:"fadeUp .5s ease both"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase"}}>Entregas por {period==="weekly"?"día":"mes"}</div>
              <div style={{fontSize:24,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginTop:4}}>{data[data.length-1]} <span style={{fontSize:13,color:"#3b82f6"}}>hoy</span></div>
            </div>
          </div>
          <LineChart data={data} color="#3b82f6" height={110} label="Entregas:"/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingLeft:16,paddingRight:4}}>
            {labels.map((l,i)=><span key={i} style={{fontSize:8.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:600}}>{l}</span>)}
          </div>
        </div>

        {/* Donut - zones */}
        <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",animation:"fadeUp .5s .1s ease both"}}>
          <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:14}}>Entregas por zona</div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{flexShrink:0}}>
              <circle cx="40" cy="40" r="36" fill="none" stroke="#131f30" strokeWidth="10"/>
              {ANALYTICS_DATA.zones.map((z,i)=>(
                <DonutSlice key={i} pct={z.pct} offset={zoneOffsets[i]} color={z.color}/>
              ))}
              <text x="40" y="44" textAnchor="middle" fontSize="11" fontFamily="'Syne',sans-serif" fontWeight="800" fill="#f1f5f9">{ANALYTICS_DATA.zones[0].pct}%</text>
            </svg>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              {ANALYTICS_DATA.zones.map(z=>(
                <div key={z.zone} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:z.color,flexShrink:0}}/>
                  <span style={{fontSize:10,color:"#64748b",flex:1}}>{z.zone}</span>
                  <span style={{fontSize:10,color:z.color,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{z.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Cancellations */}
        <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",animation:"fadeUp .5s .2s ease both"}}>
          <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:4}}>Cancelaciones diarias</div>
          <div style={{fontSize:22,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#ef4444",marginBottom:14}}>{ANALYTICS_DATA.cancelled.reduce((a,b)=>a+b,0)} <span style={{fontSize:11,color:"#4b5563"}}>esta semana</span></div>
          <BarChart data={ANALYTICS_DATA.cancelled} colors={ANALYTICS_DATA.cancelled.map(()=>"#ef4444")} labels={weekDays} height={100}/>
        </div>

        {/* Drivers performance */}
        <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",animation:"fadeUp .5s .3s ease both"}}>
          <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:14}}>Rendimiento conductores</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {ANALYTICS_DATA.drivers.map((d,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"#64748b",width:52,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                <div style={{flex:1,height:4,background:"#131f30",borderRadius:4}}>
                  <div style={{height:4,background:`linear-gradient(90deg,${d.color},${d.color}66)`,borderRadius:4,width:`${d.rate}%`,transition:"width 1s"}}/>
                </div>
                <span style={{fontSize:10,color:d.color,fontFamily:"'Syne',sans-serif",fontWeight:700,width:32,textAlign:"right"}}>{d.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PAGE: SETTINGS -----------------------------------------------------------


const PageSettings = ({ mensajeros, setMensajeros, currentUser, role, rc }) => {
  const [activeTab, setActiveTab] = useState("mensajeros");
  const [fbUrl, setFbUrl]         = useState(FB_URL);
  const [fbSaved, setFbSaved]     = useState(false);
  const [depot, setDepot]         = useState({ lat: DEPOT.lat, lng: DEPOT.lng, label: DEPOT.label });
  const [depotSaved, setDepotSaved] = useState(false);
  const [passwords, setPasswords]   = useState(() =>
    USERS.filter(u => u.role === "driver").map(u => ({ id: u.id, name: u.name, email: u.email, newPwd: "", confirm: "", saved: false, error: "" }))
  );
  const [notifSettings, setNotifSettings] = useState({
    onRouteAssigned: true,
    onDelivered: true,
    onProblem: true,
    onDriverOnline: false,
    soundEnabled: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const tabs = role === "admin" ? [
    { id:"mensajeros", label:"Mensajeros" },
    { id:"passwords",  label:"Contraseñas" },
    { id:"depot",      label:"Base / DEPOT" },
    { id:"firebase",   label:"Firebase" },
    { id:"notif",      label:"Notificaciones" },
    { id:"account",    label:"Mi cuenta" },
  ] : [
    { id:"account", label:"Mi cuenta" },
  ];

  const tabBtn = (t) => (
    <button key={t.id} onClick={() => setActiveTab(t.id)}
      style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${activeTab===t.id?"#1e3550":"#0d1420"}`, background:activeTab===t.id?"#0a1828":"transparent", color:activeTab===t.id?"#60a5fa":"#2d4a60", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap" }}>
      {t.label}
    </button>
  );

  const card = (children, mb=14) => (
    <div style={{ background:"#0a1019", border:"1px solid #131f30", borderRadius:12, padding:"18px 20px", marginBottom:mb }}>
      {children}
    </div>
  );

  const sectionTitle = (txt) => (
    <div style={{ fontSize:10, color:"#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1.5px", marginBottom:14 }}>{txt}</div>
  );

  const inp = { background:"#060b10", border:"1px solid #1e2d3d", borderRadius:9, padding:"9px 12px", color:"#e2e8f0", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", width:"100%", boxSizing:"border-box" };

  const saveBtn = (onClick, saved, label="Guardar") => (
    <button onClick={onClick}
      style={{ padding:"8px 16px", borderRadius:8, border:"none", background: saved?"#10b98120":"linear-gradient(135deg,#1d4ed8,#3b82f6)", color: saved?"#10b981":"white", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", transition:"all .3s", boxShadow: saved?"none":"0 4px 16px #3b82f630" }}>
      {saved ? "✓ Guardado" : label}
    </button>
  );

  return (
    <div style={{ flex:1, overflow:"auto", padding:"20px 24px", background:"#060b10" }}>
      <div style={{ maxWidth:700 }}>

        {/* Profile header */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, padding:"14px 18px", background:"#0a1019", border:"1px solid #131f30", borderRadius:12 }}>
          <div style={{ width:42, height:42, borderRadius:11, background:"#131f30", border:"1px solid #1e2d3d", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:"#94a3b8" }}>{currentUser.avatar}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#e2e8f0" }}>{currentUser.name}</div>
            <div style={{ fontSize:11, color:"#374151", marginTop:2 }}>{currentUser.email} · <span style={{ color:rc.color }}>{rc.label}</span></div>
          </div>
          <button onClick={() => { if(window.__rdLogout) window.__rdLogout(); }}
            style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #1e2d3d", background:"transparent", color:"#4b5563", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:600, cursor:"pointer" }}>
            Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
          {tabs.map(tabBtn)}
        </div>

        {/* ── TAB: MENSAJEROS ── */}
        {activeTab === "mensajeros" && role === "admin" && (
          <MensajeroManager mensajeros={mensajeros} setMensajeros={setMensajeros}/>
        )}

        {/* ── TAB: CONTRASEÑAS ── */}
        {activeTab === "passwords" && role === "admin" && card(
          <>
            {sectionTitle("CAMBIAR CONTRASEÑAS DE MENSAJEROS")}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {passwords.map((p, i) => (
                <div key={p.id} style={{ padding:"14px", background:"#060b10", border:"1px solid #0d1420", borderRadius:10 }}>
                  <div style={{ fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#94a3b8", marginBottom:10 }}>{p.name} <span style={{ fontSize:10, color:"#374151", fontWeight:400 }}>· {p.email}</span></div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>NUEVA CONTRASEÑA</div>
                      <input type="password" value={p.newPwd} placeholder="••••••••"
                        onChange={e => setPasswords(prev => prev.map((x,j) => j===i ? {...x, newPwd:e.target.value, error:"", saved:false} : x))}
                        style={inp}/>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>CONFIRMAR</div>
                      <input type="password" value={p.confirm} placeholder="••••••••"
                        onChange={e => setPasswords(prev => prev.map((x,j) => j===i ? {...x, confirm:e.target.value, error:"", saved:false} : x))}
                        style={inp}/>
                    </div>
                  </div>
                  {p.error && <div style={{ fontSize:11, color:"#ef4444", marginBottom:8 }}>⚠ {p.error}</div>}
                  <button onClick={() => {
                    if (p.newPwd.length < 6) { setPasswords(prev => prev.map((x,j) => j===i ? {...x, error:"Mínimo 6 caracteres"} : x)); return; }
                    if (p.newPwd !== p.confirm) { setPasswords(prev => prev.map((x,j) => j===i ? {...x, error:"Las contraseñas no coinciden"} : x)); return; }
                    const u = USERS.find(u => u.id === p.id);
                    if (u) u.password = p.newPwd;
                    setPasswords(prev => prev.map((x,j) => j===i ? {...x, saved:true, newPwd:"", confirm:""} : x));
                    setTimeout(() => setPasswords(prev => prev.map((x,j) => j===i ? {...x, saved:false} : x)), 3000);
                  }}
                    style={{ padding:"7px 14px", borderRadius:8, border:"none", background:p.saved?"#10b98120":"#1e2d3d", color:p.saved?"#10b981":"#94a3b8", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", transition:"all .2s" }}>
                    {p.saved ? "✓ Actualizado" : "Actualizar contraseña"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB: DEPOT ── */}
        {activeTab === "depot" && role === "admin" && card(
          <>
            {sectionTitle("BASE DE OPERACIONES (DEPOT)")}
            <div style={{ fontSize:12, color:"#4b5563", marginBottom:14 }}>El motor de rutas parte desde aquí para calcular el orden óptimo de paradas.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>LATITUD</div>
                <input value={depot.lat} onChange={e => setDepot(d=>({...d, lat:e.target.value}))} style={inp} placeholder="18.523..."/>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>LONGITUD</div>
                <input value={depot.lng} onChange={e => setDepot(d=>({...d, lng:e.target.value}))} style={inp} placeholder="-69.983..."/>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>NOMBRE DEL LUGAR</div>
              <input value={depot.label} onChange={e => setDepot(d=>({...d, label:e.target.value}))} style={inp} placeholder="Ej: Almacén Principal"/>
            </div>
            <div style={{ padding:"10px 12px", background:"#060b10", border:"1px solid #0d1420", borderRadius:8, marginBottom:14, fontSize:11, color:"#374151" }}>
              💡 Obtén las coordenadas exactas desde el <strong style={{color:"#60a5fa"}}>Dashboard → busca tu almacén</strong> y copia las coordenadas.
            </div>
            {saveBtn(() => {
              const lat = parseFloat(depot.lat), lng = parseFloat(depot.lng);
              if (isNaN(lat)||isNaN(lng)) return;
              DEPOT.lat = lat; DEPOT.lng = lng; DEPOT.label = depot.label;
              setDepotSaved(true);
              setTimeout(() => setDepotSaved(false), 3000);
            }, depotSaved)}
          </>
        )}

        {/* ── TAB: FIREBASE ── */}
        {activeTab === "firebase" && role === "admin" && card(
          <>
            {sectionTitle("CONFIGURACIÓN FIREBASE")}
            <div style={{ fontSize:12, color:"#4b5563", marginBottom:14, lineHeight:1.6 }}>
              Firebase sincroniza las rutas entre el panel admin y los mensajeros en tiempo real. Crea un proyecto en <span style={{color:"#60a5fa"}}>console.firebase.google.com</span> → Realtime Database → y pega la URL aquí.
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>URL DEL PROYECTO</div>
              <input value={fbUrl} onChange={e => { setFbUrl(e.target.value); setFbSaved(false); }} style={inp} placeholder="https://tu-proyecto-default-rtdb.firebaseio.com"/>
            </div>
            <div style={{ padding:"10px 12px", background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, marginBottom:14, fontSize:11, color:"#f59e0b" }}>
              ⚠ En las Reglas de Firebase activa lectura/escritura pública temporalmente: {'{ "rules": { ".read": true, ".write": true } }'}
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {saveBtn(() => {
                // Update FB_URL at runtime
                window.__rdFbUrl = fbUrl;
                setFbSaved(true);
                setTimeout(() => setFbSaved(false), 3000);
              }, fbSaved)}
              <button onClick={async () => {
                try {
                  const r = await fetch(`${fbUrl}/.json`);
                  alert(r.ok ? "✅ Conexión exitosa con Firebase" : "❌ Error: " + r.status);
                } catch(e) { alert("❌ No se pudo conectar: " + e.message); }
              }} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #1e2d3d", background:"transparent", color:"#4b5563", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:600, cursor:"pointer" }}>
                Probar conexión
              </button>
            </div>
          </>
        )}

        {/* ── TAB: NOTIFICACIONES ── */}
        {activeTab === "notif" && role === "admin" && card(
          <>
            {sectionTitle("CONFIGURACIÓN DE NOTIFICACIONES")}
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {[
                { key:"onRouteAssigned", label:"Ruta asignada a mensajero",     desc:"Al enviar una ruta nueva" },
                { key:"onDelivered",     label:"Entrega completada",             desc:"Cuando un mensajero marca entregado" },
                { key:"onProblem",       label:"Problema reportado",             desc:"Cuando hay incidencia en una parada" },
                { key:"onDriverOnline",  label:"Mensajero se conecta",           desc:"Al iniciar turno" },
                { key:"soundEnabled",    label:"Sonido de notificaciones",       desc:"Reproducir tono al recibir alertas" },
              ].map(item => (
                <div key={item.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:"1px solid #0d1420" }}>
                  <div>
                    <div style={{ fontSize:12, color:"#94a3b8", fontWeight:500 }}>{item.label}</div>
                    <div style={{ fontSize:11, color:"#374151", marginTop:2 }}>{item.desc}</div>
                  </div>
                  <button onClick={() => { setNotifSettings(n=>({...n,[item.key]:!n[item.key]})); setNotifSaved(false); }}
                    style={{ width:44, height:24, borderRadius:12, border:"none", background:notifSettings[item.key]?"#3b82f6":"#1e2d3d", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", background:"white", position:"absolute", top:3, transition:"left .2s", left:notifSettings[item.key]?23:3, boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14 }}>
              {saveBtn(() => { setNotifSaved(true); setTimeout(()=>setNotifSaved(false),3000); }, notifSaved)}
            </div>
          </>
        )}

        {/* ── TAB: CUENTA ── */}
        {activeTab === "account" && card(
          <>
            {sectionTitle("MI CUENTA")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>NOMBRE</div>
                <input defaultValue={currentUser.name} style={inp} readOnly/>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#2d4a60", marginBottom:5, fontFamily:"'Syne',sans-serif", fontWeight:600, letterSpacing:"1px" }}>CORREO</div>
                <input defaultValue={currentUser.email} style={inp} readOnly/>
              </div>
            </div>
            <div style={{ padding:"10px 12px", background:"#060b10", border:"1px solid #0d1420", borderRadius:8, fontSize:11, color:"#374151", marginBottom:14 }}>
              Para cambiar tu correo o contraseña, contacta al administrador del sistema.
            </div>
            <button onClick={() => { if(window.__rdLogout) window.__rdLogout(); }}
              style={{ padding:"9px 18px", borderRadius:9, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.06)", color:"#ef4444", fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer" }}>
              Cerrar sesión
            </button>
          </>
        )}

      </div>
    </div>
  );
};


// --- PHASE 4: NOTIFICATIONS ENGINE -------------------------------------------

const LIVE_EVENTS_SEED = [];
// Los eventos se generan en tiempo real desde acciones reales:
// - Ruta enviada al mensajero
// - Entrega marcada como completada (desde DriverPanel vía Firebase)
// - Problema reportado por mensajero

// --- NOTIFICATION TOAST -------------------------------------------------------

const Toast = ({notif, onDismiss}) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(()=>{
    const t1=setTimeout(()=>setVisible(true),10);
    const t2=setTimeout(()=>{ setLeaving(true); setTimeout(onDismiss,350); },4500);
    return ()=>{ clearTimeout(t1); clearTimeout(t2); };
  },[]);
  return (
    <div style={{
      background:"linear-gradient(135deg,#0d1420ee,#0a1019ee)",
      backdropFilter:"blur(12px)",
      border:`1px solid ${notif.color}44`,
      borderLeft:`3px solid ${notif.color}`,
      borderRadius:12, padding:"12px 14px",
      display:"flex", alignItems:"flex-start", gap:10,
      boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${notif.color}15`,
      cursor:"pointer", width:300,
      transform: leaving?"translateX(320px)":visible?"translateX(0)":"translateX(320px)",
      opacity: leaving?0:visible?1:0,
      transition:"transform .35s cubic-bezier(.4,0,.2,1), opacity .35s ease",
    }} onClick={()=>{ setLeaving(true); setTimeout(onDismiss,350); }}>
      <div style={{width:28,height:28,borderRadius:8,background:`${notif.color}18`,border:`1px solid ${notif.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:notif.color,flexShrink:0}}>{notif.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",marginBottom:3}}>{notif.title}</div>
        <div style={{fontSize:11,color:"#4b5563",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{notif.body}</div>
      </div>
      <div style={{fontSize:10,color:"#1e3550",flexShrink:0}}>ahora</div>
    </div>
  );
};

// --- NOTIFICATION PANEL -------------------------------------------------------

const NotifPanel = ({events, onMarkAll, onMarkEvent, onClose}) => (
  <div style={{
    position:"fixed",top:56,right:8,width:340,
    background:"linear-gradient(135deg,#0d1420,#0a1019)",
    border:"1px solid #131f30", borderRadius:16,
    boxShadow:"0 20px 60px rgba(0,0,0,0.7)",
    zIndex:1000, overflow:"hidden",
    animation:"slideDown .2s cubic-bezier(.4,0,.2,1)",
  }}>
  <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div style={{padding:"14px 16px 10px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",letterSpacing:"0.5px"}}>Notificaciones</span>
        <span style={{background:"rgba(59,130,246,0.15)",color:"#60a5fa",borderRadius:6,padding:"2px 7px",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{events.filter(e=>!e.read).length} nuevas</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={onMarkAll} style={{fontSize:10,color:"#2d4a60",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,padding:"3px 6px",borderRadius:5,transition:"color .1s"}}>Marcar todas</button>
        <button onClick={onClose} style={{width:22,height:22,borderRadius:6,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
    </div>
    <div style={{maxHeight:420,overflow:"auto"}}>
      {events.map((ev)=>(
        <div key={ev.id} onClick={()=>onMarkEvent&&onMarkEvent(ev.id)} style={{
          padding:"11px 16px", borderBottom:"1px solid #080e16",
          background:ev.read?"transparent":"rgba(59,130,246,0.04)",
          display:"flex",alignItems:"flex-start",gap:10,
          transition:"background .1s",cursor:"pointer",
        }}>
          <div style={{width:30,height:30,borderRadius:8,background:`${ev.color}15`,border:`1px solid ${ev.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:ev.color,flexShrink:0,marginTop:1}}>{ev.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
              <span style={{fontSize:11.5,fontFamily:"'Syne',sans-serif",fontWeight:700,color:ev.read?"#94a3b8":"#e2e8f0"}}>{ev.title}</span>
              {!ev.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#3b82f6",boxShadow:"0 0 6px #3b82f6",flexShrink:0,marginTop:3}}/>}
            </div>
            <div style={{fontSize:11,color:"#4b5563",lineHeight:1.4}}>{ev.body}</div>
            <div style={{fontSize:10,color:"#1e3550",marginTop:4,fontFamily:"'Syne',sans-serif"}}>{ev.time}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{padding:"10px 16px",borderTop:"1px solid #0d1420",textAlign:"center"}}>
      <span style={{fontSize:11,color:"#2d4a60",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600}}>Ver historial completo →</span>
    </div>
  </div>
);

// --- NEW DELIVERY MODAL (3-step wizard) ---------------------------------------

const ModalNewDelivery = ({onClose, onCreated}) => {
  const [step, setStep] = useState(1);
  const [newDeliveryId] = useState(() => `RD-${Math.floor(1100 + Math.random() * 900)}`);
  const [form, setForm] = useState({
    client:"", address:"", zone:"Centro", priority:"normal",
    driver:"", notes:"", weight:"", size:"pequeño",
    phone:"", email:"", scheduled:"ahora",
  });
  const [creating, setCreating] = useState(false);
  const [done, setDone]     = useState(false);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleCreate = () => {
    setCreating(true);
    setTimeout(()=>{ setCreating(false); setDone(true); setTimeout(()=>{ onCreated(form); onClose(); },1800); },1400);
  };

  const inputStyle = {
    width:"100%", background:"#0a1019", border:"1px solid #1e2d3d",
    borderRadius:9, padding:"9px 12px", color:"#e2e8f0",
    fontSize:12, fontFamily:"'Inter',sans-serif",
    outline:"none", caretColor:"#3b82f6", transition:"border .15s",
  };
  const selectStyle = {...inputStyle, cursor:"pointer"};
  const labelStyle  = {fontSize:10, color:"#2d4a60", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1px", marginBottom:5, display:"block"};

  const steps = ["Destinatario","Paquete y ruta","Confirmar"];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s ease"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}} select option{background:#0d1420;color:#e2e8f0}`}</style>
      <div style={{width:480,background:"linear-gradient(145deg,#0d1420,#0a1019)",border:"1px solid #1e2d3d",borderRadius:20,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.8)",animation:"popIn .25s cubic-bezier(.4,0,.2,1)"}}>

        {/* Modal header */}
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Nueva Entrega</div>
            <div style={{fontSize:11,color:"#2d4a60",marginTop:2}}>Paso {step} de 3 · {steps[step-1]}</div>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid #1e2d3d",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* Step progress */}
        <div style={{display:"flex",gap:0,padding:"0 22px",marginTop:16,marginBottom:18}}>
          {steps.map((s,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:i===0?"flex-start":i===2?"flex-end":"center"}}>
              <div style={{display:"flex",alignItems:"center",width:"100%",justifyContent:i===0?"flex-start":i===2?"flex-end":"center"}}>
                {i>0&&<div style={{flex:1,height:2,background:step>i?"#3b82f6":"#131f30",transition:"background .4s"}}/>}
                <div style={{width:26,height:26,borderRadius:"50%",background:step>i?"#3b82f6":step===i+1?"#1d4ed8":"#0d1420",border:`2px solid ${step>=i+1?"#3b82f6":"#1e2d3d"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,color:step>=i+1?"white":"#2d4a60",transition:"all .3s",flexShrink:0,zIndex:1}}>
                  {step>i+1?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:i+1}
                </div>
                {i<2&&<div style={{flex:1,height:2,background:step>i+1?"#3b82f6":"#131f30",transition:"background .4s"}}/>}
              </div>
              <span style={{fontSize:9,color:step===i+1?"#60a5fa":"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,marginTop:5,letterSpacing:"0.5px"}}>{s.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={{padding:"0 22px 22px",minHeight:280}}>

          {/* STEP 1 - Destinatario */}
          {step===1 && !done && (
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeUp .3s ease"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={labelStyle}>NOMBRE CLIENTE</label>
                  <input value={form.client} onChange={e=>set("client",e.target.value)} placeholder="Ej: María García" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>TELÉFONO</label>
                  <input value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+34 6XX XXX XXX" style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>EMAIL (opcional)</label>
                <input value={form.email} onChange={e=>set("email",e.target.value)} placeholder="cliente@email.com" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>DIRECCIÓN DE ENTREGA</label>
                <input value={form.address} onChange={e=>set("address",e.target.value)} placeholder="Calle, número, piso..." style={inputStyle}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={labelStyle}>ZONA</label>
                  <select value={form.zone} onChange={e=>set("zone",e.target.value)} style={selectStyle}>
                    {["Mirador Norte","Mirador Sur","Naco","Piantini","Evaristo Morales","Gazcue","Bella Vista","30 de Mayo","Ciudad Colonial","Los Prados","Arroyo Hondo","Los Cacicazgos","Los Millones","Alma Rosa","Cristo Rey"].map(z=><option key={z}>{z}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>PRIORIDAD</label>
                  <select value={form.priority} onChange={e=>set("priority",e.target.value)} style={selectStyle}>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 - Paquete & Ruta */}
          {step===2 && !done && (
            <div style={{display:"flex",flexDirection:"column",gap:14,animation:"fadeUp .3s ease"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={labelStyle}>TAMAÑO DEL PAQUETE</label>
                  <div style={{display:"flex",gap:6}}>
                    {["pequeño","mediano","grande"].map(s=>(
                      <button key={s} onClick={()=>set("size",s)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${form.size===s?"#3b82f6":"#1e2d3d"}`,background:form.size===s?"#0a1828":"transparent",color:form.size===s?"#60a5fa":"#374151",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .15s",textTransform:"capitalize"}}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>PESO (kg)</label>
                  <input value={form.weight} onChange={e=>set("weight",e.target.value)} placeholder="0.0" type="number" style={inputStyle}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>ASIGNAR CONDUCTOR</label>
                <select value={form.driver} onChange={e=>set("driver",e.target.value)} style={selectStyle}>
                  <option value="">— Auto-asignar (recomendado) —</option>
                  {DRIVERS.filter(d=>d.online).map(d=><option key={d.id} value={d.name}>{d.name} · {d.zone} · {d.today} entregas hoy</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>PROGRAMAR ENTREGA</label>
                <div style={{display:"flex",gap:6}}>
                  {["ahora","esta tarde","mañana AM","mañana PM"].map(s=>(
                    <button key={s} onClick={()=>set("scheduled",s)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${form.scheduled===s?"#3b82f6":"#1e2d3d"}`,background:form.scheduled===s?"#0a1828":"transparent",color:form.scheduled===s?"#60a5fa":"#374151",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>NOTAS INTERNAS (opcional)</label>
                <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Instrucciones especiales, código portero, etc." rows={3} style={{...inputStyle,resize:"none",lineHeight:1.5}}/>
              </div>
            </div>
          )}

          {/* STEP 3 - Confirm / Done */}
          {step===3 && !done && !creating && (
            <div style={{animation:"fadeUp .3s ease"}}>
              <div style={{background:"#0a1019",border:"1px solid #131f30",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:10}}>RESUMEN DE ENTREGA</div>
                {[
                  ["Cliente",    form.client||"—"],
                  ["Teléfono",   form.phone||"—"],
                  ["Dirección",  form.address||"—"],
                  ["Zona",       form.zone],
                  ["Prioridad",  form.priority.toUpperCase()],
                  ["Paquete",    `${form.size} ${form.weight?`· ${form.weight}kg`:""}`],
                  ["Conductor",  form.driver||"Auto-asignar"],
                  ["Programado", form.scheduled],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #0d1420"}}>
                    <span style={{fontSize:11,color:"#4b5563"}}>{k}</span>
                    <span style={{fontSize:11,fontFamily:k==="Prioridad"?"'Syne',sans-serif":"'Inter',sans-serif",fontWeight:k==="Prioridad"?700:400,color:k==="Prioridad"?{urgent:"#ef4444",high:"#f97316",normal:"#4b5563"}[form.priority]:"#cbd5e1"}}>{v}</span>
                  </div>
                ))}
                {form.notes&&<div style={{marginTop:8,padding:"8px 10px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:8}}><span style={{fontSize:11,color:"#a16207"}}>📝 {form.notes}</span></div>}
              </div>
            </div>
          )}

          {/* Creating animation */}
          {creating && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:200,gap:16,animation:"fadeUp .3s ease"}}>
              <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px #3b82f640",animation:"pulse 1s infinite"}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/></svg>
              </div>
              <div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9"}}>Creando entrega...</div>
              <div style={{fontSize:11,color:"#2d4a60"}}>Asignando conductor óptimo</div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:200,gap:14,animation:"fadeUp .3s ease"}}>
              <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(16,185,129,0.15)",border:"2px solid #10b981",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px #10b98140"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>¡Entrega creada!</div>
              <div style={{fontSize:11,color:"#10b981"}}>{newDeliveryId} · {form.driver||"Conductor auto-asignado"}</div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        {!creating && !done && (
          <div style={{padding:"14px 22px",borderTop:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={()=>step>1?setStep(s=>s-1):onClose()} style={{padding:"8px 18px",borderRadius:9,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .1s"}}>
              {step===1?"Cancelar":"← Atrás"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif"}}>{step}/3</span>
              <button
                onClick={()=>step<3?setStep(s=>s+1):handleCreate()}
                disabled={step===1&&(!form.client||!form.address)}
                style={{padding:"8px 20px",borderRadius:9,border:"none",background:step===1&&(!form.client||!form.address)?"#0d1420":"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:step===1&&(!form.client||!form.address)?"#1e3550":"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:step===1&&(!form.client||!form.address)?"not-allowed":"pointer",boxShadow:step===1&&(!form.client||!form.address)?"none":"0 4px 16px #3b82f630",transition:"all .15s",letterSpacing:"0.5px"}}>
                {step<3?"Siguiente →":"✓ Crear entrega"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- LIVE ACTIVITY FEED (floating panel) -------------------------------------

const ActivityFeed = ({events, onClose}) => (
  <div style={{position:"fixed",bottom:16,right:8,width:300,maxHeight:420,background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.7)",zIndex:900,display:"flex",flexDirection:"column",overflow:"hidden",animation:"slideUp .25s cubic-bezier(.4,0,.2,1)"}}>
  <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <div style={{padding:"12px 14px 10px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981",animation:"pulse 2s infinite"}}/>
        <span style={{fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",letterSpacing:"0.5px"}}>Actividad en vivo</span>
      </div>
      <button onClick={onClose} style={{width:20,height:20,borderRadius:5,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
    </div>
    <div style={{overflow:"auto",flex:1}}>
      {events.map((ev)=>(
        <div key={ev.id} style={{padding:"9px 14px",borderBottom:"1px solid #080e16",display:"flex",alignItems:"flex-start",gap:9,background:ev.isNew?"rgba(59,130,246,0.05)":"transparent",animation:ev.isNew?`slideIn .4s ease both`:"none"}}>
          <div style={{width:26,height:26,borderRadius:7,background:`${ev.color}14`,border:`1px solid ${ev.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:ev.color,flexShrink:0}}>{ev.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,color:ev.isNew?"#e2e8f0":"#94a3b8",marginBottom:2}}>{ev.title}</div>
            <div style={{fontSize:10.5,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.body}</div>
            <div style={{fontSize:9.5,color:"#1e3550",marginTop:3,fontFamily:"'Syne',sans-serif"}}>{ev.time}</div>
          </div>
          {ev.isNew&&<div style={{width:6,height:6,borderRadius:"50%",background:"#3b82f6",boxShadow:"0 0 5px #3b82f6",flexShrink:0,marginTop:5}}/>}
        </div>
      ))}
    </div>
  </div>
);


// --- PHASE 5: GLOBAL SEARCH (CMD+K) ------------------------------------------

const GlobalSearch = ({ onClose, onNavigate }) => {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  const results = q.trim().length < 1 ? [] : [
    ...DELIVERIES.filter(d =>
      [d.id, d.client, d.driver, d.address, d.zone].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(d => ({ type: "delivery", icon: "📦", label: d.id, sub: `${d.client} · ${d.address}`, status: d.status, data: d })),
    ...DRIVERS.filter(d =>
      [d.name, d.zone, d.vehicle].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(d => ({ type: "driver", icon: "🚗", label: d.name, sub: `${d.zone} · ${d.vehicle.split("·")[0].trim()}`, status: d.status, data: d })),
    ...CLIENTS.filter(c =>
      [c.name, c.zone, c.email].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(c => ({ type: "client", icon: "👤", label: c.name, sub: `${c.zone} · ${c.email}`, status: c.status, data: c })),
    ...ROUTES.filter(r =>
      [r.id, r.name, r.driver].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(r => ({ type: "route", icon: "◈", label: r.name, sub: `${r.driver} · ${r.stops} paradas · ${r.progress}%`, status: r.status, data: r })),
  ].slice(0, 10);

  const quickActions = [
    { icon: "＋", label: "Nueva entrega",    action: () => { onNavigate("modal"); onClose(); } },
    { icon: "▦",  label: "Dashboard",        action: () => { onNavigate("dashboard"); onClose(); } },
    { icon: "◈",  label: "Ver rutas",        action: () => { onNavigate("routes"); onClose(); } },
      ];

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s+1, (results.length||quickActions.length)-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
    if (e.key === "Escape")    onClose();
    if (e.key === "Enter") {
      if (results.length > 0) {
        const r = results[sel];
        const navMap = { delivery:"dashboard", driver:"drivers", route:"routes" };
        onNavigate(navMap[r.type] || "dashboard");
        onClose();
      } else if (quickActions[sel]) {
        quickActions[sel].action();
      }
    }
  };

  const typeLabelMap = { delivery:"Entrega", driver:"Conductor", client:"Cliente", route:"Ruta" };

  return (
    <div
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",zIndex:5000,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80,animation:"fadeIn .15s ease" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}
    >
      <div style={{ width:560,background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:18,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.9)",animation:"popIn .2s cubic-bezier(.4,0,.2,1)" }}>
        {/* Search input */}
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 18px",borderBottom:"1px solid #0d1420" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            ref={inputRef}
            value={q} onChange={e => { setQ(e.target.value); setSel(0); }}
            onKeyDown={handleKey}
            placeholder="Buscar entregas, conductores, clientes, rutas..."
            style={{ flex:1,border:"none",background:"transparent",outline:"none",color:"#f1f5f9",fontSize:15,fontFamily:"'Inter',sans-serif",caretColor:"#3b82f6" }}
          />
          {q && <button onClick={()=>setQ("")} style={{ border:"none",background:"none",color:"#374151",cursor:"pointer",fontSize:13,padding:"2px 4px" }}>✕</button>}
          <div style={{ background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>ESC</div>
        </div>

        {/* Results or quick actions */}
        <div style={{ maxHeight:380, overflow:"auto" }}>
          {results.length > 0 ? (
            <>
              <div style={{ padding:"8px 18px 4px",fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px" }}>RESULTADOS - {results.length}</div>
              {results.map((r,i) => {
                const s = STATUS[r.status] || STATUS.pending;
                return (
                  <div key={i}
                    onClick={() => { const nm={delivery:"dashboard",driver:"drivers",client:"clients",route:"routes"}; onNavigate(nm[r.type]||"dashboard"); onClose(); }}
                    style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 18px",background:sel===i?"#0a1828":"transparent",cursor:"pointer",borderBottom:"1px solid #080e16",transition:"background .1s" }}
                    onMouseEnter={() => setSel(i)}
                  >
                    <div style={{ width:34,height:34,borderRadius:9,background:`${s.color}14`,border:`1px solid ${s.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0 }}>{r.icon}</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9" }}>{r.label}</span>
                        <span style={{ fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,background:"#0d1420",borderRadius:4,padding:"1px 6px",letterSpacing:"0.8px" }}>{typeLabelMap[r.type]}</span>
                      </div>
                      <div style={{ fontSize:11,color:"#4b5563",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.sub}</div>
                    </div>
                    <div style={{ display:"inline-flex",alignItems:"center",gap:5,background:s.bg,borderRadius:7,padding:"3px 9px",flexShrink:0 }}>
                      <div style={{ width:5,height:5,borderRadius:"50%",background:s.color }}/>
                      <span style={{ fontSize:10,color:s.color,fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ padding:"8px 18px 4px",fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px" }}>ACCIONES RÁPIDAS</div>
              {quickActions.map((a,i) => (
                <div key={i} onClick={a.action}
                  style={{ display:"flex",alignItems:"center",gap:12,padding:"11px 18px",background:sel===i?"#0a1828":"transparent",cursor:"pointer",borderBottom:"1px solid #080e16",transition:"background .1s" }}
                  onMouseEnter={() => setSel(i)}
                >
                  <div style={{ width:34,height:34,borderRadius:9,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#3b82f6",flexShrink:0 }}>{a.icon}</div>
                  <span style={{ fontSize:13,color:"#cbd5e1",fontFamily:"'Syne',sans-serif",fontWeight:600 }}>{a.label}</span>
                  <div style={{ marginLeft:"auto",background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>↵</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div style={{ padding:"10px 18px",borderTop:"1px solid #0d1420",display:"flex",gap:16 }}>
          {[["↑↓","Navegar"],["↵","Seleccionar"],["Esc","Cerrar"]].map(([k,l]) => (
            <div key={k} style={{ display:"flex",alignItems:"center",gap:5 }}>
              <div style={{ background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:5,padding:"2px 7px",fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{k}</div>
              <span style={{ fontSize:10,color:"#1e3550" }}>{l}</span>
            </div>
          ))}
          <div style={{ marginLeft:"auto",fontSize:10,color:"#1e3550" }}>
            {DELIVERIES.length + DRIVERS.length + CLIENTS.length + ROUTES.length} registros indexados
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PHASE 5: DELIVERY DETAIL MODAL ------------------------------------------

const DELIVERY_TIMELINE = {
  "RD-1027": [
    { time:"13:00", label:"Pedido creado",         detail:"Sistema · prioridad alta",          done:true,  icon:"＋" },
    { time:"13:05", label:"Asignado a conductor",  detail:"Juan Morales · Furgoneta",          done:true,  icon:"◎" },
    { time:"13:18", label:"Recogida en almacén",   detail:"Almacén Norte · confirmado",        done:true,  icon:"⬆" },
    { time:"13:31", label:"En ruta",               detail:"Salida hacia Calle Alta, 45",       done:true,  icon:"→" },
    { time:"~13:45",label:"Llegada estimada",      detail:"ETA 12 min · tráfico moderado",     done:false, icon:"📍", active:true },
    { time:"—",     label:"Entrega al cliente",    detail:"Confirmación pendiente",            done:false, icon:"✓" },
  ],
  "RD-1022": [
    { time:"11:00", label:"Pedido creado",         detail:"Sistema · prioridad normal",        done:true,  icon:"＋" },
    { time:"11:08", label:"Asignado a conductor",  detail:"Andrés Gil · Moto",                 done:true,  icon:"◎" },
    { time:"11:15", label:"Recogida en almacén",   detail:"Almacén Centro · confirmado",       done:true,  icon:"⬆" },
    { time:"11:22", label:"En ruta",               detail:"Salida hacia Av. Partido, 12",      done:true,  icon:"→" },
    { time:"11:45", label:"Entregado",             detail:"Ana Torres firmó recepción",        done:true,  icon:"✓" },
  ],
  "RD-1016": [
    { time:"12:00", label:"Pedido creado",         detail:"Sistema · prioridad normal",        done:true,  icon:"＋" },
    { time:"12:05", label:"Asignado a conductor",  detail:"Einar Kovač · Moto",                done:true,  icon:"◎" },
    { time:"12:20", label:"En ruta",               detail:"Salida hacia Pl. Central, 28",      done:true,  icon:"→" },
    { time:"12:48", label:"Intento fallido",       detail:"Cliente no disponible",             done:true,  icon:"⚠",  warn:true },
    { time:"13:02", label:"Cancelado",             detail:"Sin respuesta tras 2 intentos",     done:true,  icon:"✕",  error:true },
  ],
};

const DeliveryDetail = ({ delivery, onClose }) => {
  const d = delivery;
  const s = STATUS[d.status];
  const p = PRIORITY[d.priority];
  const driver = DRIVERS.find(dr => dr.name === d.driver);
  const client = CLIENTS.find(cl => cl.name === d.client);
  const timeline = DELIVERY_TIMELINE[d.id] || [
    { time:"—", label:"Pedido creado",   detail:"Sistema",          done:true,  icon:"＋" },
    { time:"—", label:"En proceso",      detail:"Sin más datos",     done:false, icon:"◎", active:true },
  ];

  return (
    <div
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(5px)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s ease" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}
    >
      <div style={{ width:620,maxHeight:"88vh",background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:20,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",animation:"popIn .2s cubic-bezier(.4,0,.2,1)" }}>

        {/* Header */}
        <div style={{ padding:"18px 22px 14px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0 }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
              <span style={{ fontSize:18,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.5px" }}>{d.id}</span>
              <div style={{ display:"inline-flex",alignItems:"center",gap:5,background:s.bg,borderRadius:7,padding:"4px 10px" }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:s.color,boxShadow:d.status==="on_route"?`0 0 6px ${s.color}`:"none" }}/>
                <span style={{ fontSize:11,color:s.color,fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{s.label}</span>
              </div>
              <span style={{ fontSize:9,color:p.color,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px" }}>{p.label}</span>
            </div>
            <div style={{ fontSize:12,color:"#4b5563" }}>{d.address} · {d.zone}</div>
          </div>
          <div style={{ display:"flex",gap:6 }}>
            <button style={{ padding:"7px 14px",borderRadius:9,border:"1px solid #1e3550",background:"#0a1828",color:"#60a5fa",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer" }}>Editar</button>
            <button onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1,overflow:"auto" }}>
          {/* Info grid */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"16px 22px" }}>

            {/* Driver card */}
            <div style={{ background:"#0a1019",border:"1px solid #131f30",borderRadius:13,padding:"14px 16px" }}>
              <div style={{ fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:12 }}>CONDUCTOR</div>
              {driver ? (
                <>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                    <div style={{ width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${STATUS[driver.status]?.color||"#3b82f6"}22,${STATUS[driver.status]?.color||"#3b82f6"}11)`,border:`1.5px solid ${STATUS[driver.status]?.color||"#3b82f6"}33`,display:"flex",alignItems:"center",justifyContent:"center",color:STATUS[driver.status]?.color||"#3b82f6",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{driver.avatar}</div>
                    <div>
                      <div style={{ fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9" }}>{driver.name}</div>
                      <div style={{ fontSize:10,color:"#4b5563",marginTop:2 }}>{driver.phone}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:6 }}>
                    <div style={{ flex:1,background:"#060b10",borderRadius:8,padding:"8px 10px",border:"1px solid #0d1420",textAlign:"center" }}>
                      <div style={{ fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#10b981" }}>★{driver.rating}</div>
                      <div style={{ fontSize:9,color:"#2d4a60" }}>rating</div>
                    </div>
                    <div style={{ flex:1,background:"#060b10",borderRadius:8,padding:"8px 10px",border:"1px solid #0d1420",textAlign:"center" }}>
                      <div style={{ fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#3b82f6" }}>{driver.success}%</div>
                      <div style={{ fontSize:9,color:"#2d4a60" }}>éxito</div>
                    </div>
                    <div style={{ flex:1,background:"#060b10",borderRadius:8,padding:"8px 10px",border:"1px solid #0d1420",textAlign:"center" }}>
                      <div style={{ fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f59e0b" }}>{driver.today}</div>
                      <div style={{ fontSize:9,color:"#2d4a60" }}>hoy</div>
                    </div>
                  </div>
                </>
              ) : <div style={{ color:"#374151",fontSize:12 }}>Sin conductor asignado</div>}
            </div>

            {/* Client card */}
            <div style={{ background:"#0a1019",border:"1px solid #131f30",borderRadius:13,padding:"14px 16px" }}>
              <div style={{ fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:12 }}>DESTINATARIO</div>
              {client ? (
                <>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
                    <div style={{ width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${STATUS[client.status]?.color||"#3b82f6"}22,${STATUS[client.status]?.color||"#3b82f6"}11)`,border:`1.5px solid ${STATUS[client.status]?.color||"#3b82f6"}33`,display:"flex",alignItems:"center",justifyContent:"center",color:STATUS[client.status]?.color||"#3b82f6",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{client.avatar}</div>
                    <div>
                      <div style={{ fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9" }}>{client.name}</div>
                      <div style={{ fontSize:10,color:"#4b5563",marginTop:2 }}>{client.phone}</div>
                    </div>
                  </div>
                  <div style={{ fontSize:11,color:"#374151",background:"#060b10",borderRadius:8,padding:"8px 10px",border:"1px solid #0d1420",lineHeight:1.5 }}>
                    📍 {d.address}<br/>
                    {client.notes && <span style={{ color:"#6b7280" }}>📝 {client.notes}</span>}
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize:13,color:"#e2e8f0",marginBottom:6 }}>{d.client}</div>
                  <div style={{ fontSize:11,color:"#374151" }}>📍 {d.address}</div>
                </div>
              )}
            </div>
          </div>

          {/* ETA bar (if active) */}
          {d.status === "on_route" && (
            <div style={{ margin:"0 22px 16px",background:"linear-gradient(135deg,rgba(59,130,246,0.1),rgba(59,130,246,0.05))",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:14 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",display:"flex",alignItems:"center",justifyContent:"center",color:"#3b82f6",fontSize:16,animation:"pulse 2s infinite" }}>→</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#60a5fa" }}>En camino · ETA {d.eta}</div>
                <div style={{ fontSize:11,color:"#4b5563",marginTop:3 }}>Conductor en ruta · última actualización hace 2 min</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#3b82f6" }}>{d.eta}</div>
                <div style={{ fontSize:9,color:"#2d4a60" }}>tiempo restante</div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ padding:"0 22px 20px" }}>
            <div style={{ fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:14 }}>TRACKING TIMELINE</div>
            {timeline.map((ev, i) => {
              const c = ev.error?"#ef4444":ev.warn?"#f59e0b":ev.active?"#3b82f6":ev.done?"#10b981":"#2d4a60";
              return (
                <div key={i} style={{ display:"flex",gap:0,animation:`slideIn .3s ${i*60}ms ease both` }}>
                  {/* Line */}
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",width:36,flexShrink:0 }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:ev.done||ev.active?`${c}18`:"#0a1019",border:`2px solid ${ev.done||ev.active?c:"#1e2d3d"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,zIndex:1,boxShadow:ev.active?`0 0 12px ${c}55`:"none",transition:"all .3s" }}>
                      {ev.done && !ev.active ? (
                        ev.error ? <span style={{ fontSize:10,color:c }}>✕</span> :
                        ev.warn  ? <span style={{ fontSize:10,color:c }}>⚠</span> :
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : ev.active ? (
                        <div style={{ width:9,height:9,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`,animation:"pulse 1.5s infinite" }}/>
                      ) : (
                        <span style={{ fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{i+1}</span>
                      )}
                    </div>
                    {i < timeline.length-1 && (
                      <div style={{ width:2,flex:1,minHeight:18,background:ev.done&&!ev.active?`linear-gradient(${c}66,${(timeline[i+1].error?"#ef4444":timeline[i+1].warn?"#f59e0b":timeline[i+1].done?"#10b981":"#1e2d3d")}44)`:"#131f30" }}/>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1,paddingBottom:16,paddingLeft:12,paddingTop:2 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontSize:12.5,fontFamily:"'Syne',sans-serif",fontWeight:700,color:ev.active?"#e2e8f0":ev.done?"#94a3b8":"#4b5563" }}>{ev.label}</div>
                        <div style={{ fontSize:11,color:ev.active?"#4b5563":"#2d4a60",marginTop:3 }}>{ev.detail}</div>
                      </div>
                      <span style={{ fontSize:10,color:ev.active?c:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:ev.active?700:400,marginLeft:8,flexShrink:0 }}>{ev.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action footer */}
        <div style={{ padding:"12px 22px",borderTop:"1px solid #0d1420",display:"flex",gap:8,flexShrink:0 }}>
          {d.status==="on_route" && [
            {l:"📞 Llamar conductor",  c:"#131f30", tc:"#4b5563", fn:()=>{ const dr=DRIVERS.find(x=>x.name===d.driver); if(dr?.phone) window.open("tel:"+dr.phone.replace(/\s/g,"")); }},
            {l:"⚠ Reportar problema",  c:"rgba(245,158,11,0.1)", tc:"#f59e0b", bc:"rgba(245,158,11,0.2)", fn:()=>alert("Problema reportado para "+d.id)},
            {l:"✓ Marcar entregado",   c:"rgba(16,185,129,0.1)", tc:"#10b981",  bc:"rgba(16,185,129,0.2)", fn:()=>alert("Marcado como entregado: "+d.id)},
          ].map(b => (
            <button key={b.l} onClick={b.fn} className="ab" style={{ flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${b.bc||b.c}`,background:b.c,color:b.tc,fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .1s" }}>{b.l}</button>
          ))}
          {d.status==="cancelled" && (
            <button style={{ flex:1,padding:"9px 0",borderRadius:10,border:"1px solid #1e3550",background:"#0a1828",color:"#60a5fa",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer" }}>↺ Reactivar entrega</button>
          )}
          {d.status==="pending" && (
            <button style={{ flex:1,padding:"9px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"white",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px #3b82f630" }}>▶ Iniciar entrega</button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- FASE 2: PANEL DEL MENSAJERO ----------------------------------------------

// Almacén global en memoria - inicializado después de que DEFAULT_MENSAJEROS esté definido (ver bloque más abajo)

// -- Login del mensajero -------------------------------------------------------
const DriverLoginScreen = ({ mensajeros, onLogin }) => {
  const [selId,  setSelId]  = useState("");
  const [error,  setError]  = useState("");
  const [loading,setLoading]= useState(false);

  const handleLogin = () => {
    if (!selId) { setError("Selecciona tu nombre"); return; }
    setLoading(true);
    setTimeout(() => {
      const m = mensajeros.find(x => x.id === selId);
      if (!m) { setError("Mensajero no encontrado"); setLoading(false); return; }
      onLogin({ ...m, role:"driver" });
    }, 700);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#f4f5f7",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        @keyframes dlFU{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
      <div style={{ width:360,animation:"dlFU .5s ease",padding:"0 16px" }}>
        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ width:52,height:52,borderRadius:16,background:"white",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="black"/><path d="M2 17l10 5 10-5" stroke="black" strokeWidth="2.2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="black" strokeWidth="2.2" strokeLinecap="round" opacity="0.4"/></svg>
          </div>
          <div style={{ fontSize:22,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"white",letterSpacing:"-0.5px" }}>Rap Drive</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:3,fontWeight:500,fontFamily:"'DM Sans',sans-serif",letterSpacing:"1.5px" }}>PANEL MENSAJERO</div>
        </div>
        <div style={{ background:"#111",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"24px",boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize:15,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"white",marginBottom:16 }}>¿Quién eres?</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:18 }}>
            {mensajeros.filter(m=>m.active).map(m => (
              <button key={m.id} onClick={()=>{setSelId(m.id);setError("");}}
                style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`1.5px solid ${selId===m.id?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.07)"}`,background:selId===m.id?"rgba(255,255,255,0.08)":"transparent",cursor:"pointer",transition:"all .15s",width:"100%" }}>
                <div style={{ width:34,height:34,borderRadius:10,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:selId===m.id?"white":"rgba(255,255,255,0.35)",fontFamily:"'DM Sans',sans-serif",fontWeight:700,flexShrink:0 }}>{m.initials||m.name.slice(0,2).toUpperCase()}</div>
                <div style={{ textAlign:"left",flex:1 }}>
                  <div style={{ fontSize:13,color:selId===m.id?"white":"rgba(255,255,255,0.6)",fontWeight:600,fontFamily:"'DM Sans',sans-serif" }}>{m.name}</div>
                  <div style={{ fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:1,fontFamily:"'DM Sans',sans-serif" }}>{m.phone||"Sin teléfono"}</div>
                </div>
                {selId===m.id && <div style={{ width:18,height:18,borderRadius:"50%",background:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
              </button>
            ))}
          </div>
          {error && <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"8px 12px",marginBottom:14,fontSize:12,color:"rgba(255,255,255,0.5)",fontFamily:"'DM Sans',sans-serif" }}>⚠ {error}</div>}
          <button onClick={handleLogin} disabled={!selId||loading}
            style={{ width:"100%",padding:"13px",borderRadius:12,border:"none",background:selId&&!loading?"white":"rgba(255,255,255,0.06)",color:selId&&!loading?"black":"rgba(255,255,255,0.2)",fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:700,cursor:selId&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s" }}>
            {loading?<><div style={{ width:14,height:14,borderRadius:"50%",border:"2px solid rgba(0,0,0,0.2)",borderTopColor:"black",animation:"spin .8s linear infinite" }}/>Entrando...</>:"Iniciar turno →"}
          </button>
        </div>
        <div style={{ textAlign:"center",marginTop:14,fontSize:11,color:"rgba(255,255,255,0.15)",fontFamily:"'DM Sans',sans-serif" }}>Rap Drive · Santo Domingo, RD</div>
      </div>
    </div>
  );
};

// -- Panel principal del mensajero - CIRCUIT DESIGN ---------------------------
const DriverPanel = ({ driver, mensajeros, onLogout, globalRoutes, onUpdateRoute }) => {
  // myKey DEBE coincidir con el driverId que el admin usa al enviar rutas.
  // El admin usa mensajero.id (de window.__rdMensajeros).
  // Si el driver logueado tiene driverId, lo usamos. Si no, buscamos su mensajero
  // en la lista por nombre para obtener el id correcto.
  const myKey = (() => {
    if (driver.driverId) return driver.driverId;
    // Buscar en mensajeros por nombre (normalizado)
    const norm = (s) => (s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const allMens = window.__rdMensajeros || DEFAULT_MENSAJEROS;
    const found = allMens.find(m => norm(m.name) === norm(driver.name));
    if (found) return found.id;
    // Último fallback
    return driver.id;
  })();

  // Buscar ruta en todos los canales disponibles al montar
  const _initRoute = () => {
    const fromProps = globalRoutes[myKey];
    const fromWin   = (window.__rdRouteStore||{})[myKey];
    const fromLS    = LS.getRoutes()[myKey];
    return fromProps || fromWin || fromLS || null;
  };
  const myRoute = _initRoute();

  const [stops, setStops] = useState(() => {
    const r = _initRoute();
    return (r?.stops||[]).map(s=>({...s, driverStatus: s.driverStatus||"pending"}));
  });
  const [tab,        setTab]        = useState("route"); // "route" | "chat" | "pending" | "history"
  const [chatMsg,    setChatMsg]    = useState("");
  const [chatLog,    setChatLog]    = useState(() => (window.__rdChatStore||{})[myKey]||[]);
  const [showProb,   setShowProb]   = useState(null);
  const [probNote,   setProbNote]   = useState("");
  // ── Flujo de evidencia con cámara ──────────────────────────────────────────
  const [evidenceFlow, setEvidenceFlow] = useState(null); // { stopId, mode:"delivered"|"failed", probNote? }
  const [time,       setTime]       = useState(new Date());
  const [logoutConf, setLogoutConf] = useState(false);
  const [search,     setSearch]     = useState("");
  const searchInputRef = useRef(null);
  const listScrollRef  = useRef(null);

  // Cuando el teclado aparece en mobile, scroll al input para que quede visible
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      // Si el viewport se achicó (teclado abierto) y search está activo
      if (document.activeElement === searchInputRef.current) {
        setTimeout(() => {
          searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);
  const [selStop,    setSelStop]    = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  // Bottom sheet: "peek" | "half" | "full"
  const [sheetSnap,   setSheetSnap]   = useState("half");
  const [sheetDragY,  setSheetDragY]  = useState(null); // null = not dragging
  const sheetDragRef  = useRef({ startY:0, startH:0 });
  const sheetRef      = useRef(null);
  const [sheetH,      setSheetH]      = useState(null); // null = use snap
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [filterMode, setFilterMode] = useState("all");
  const [mapPinPopup, setMapPinPopup] = useState(null); // stop shown in map popup

  const [showCompletedBanner, setShowCompletedBanner] = useState(false);
  const [driverNotif, setDriverNotif] = useState(null); // banner notificación de ruta asignada

  // ── Foto de perfil ────────────────────────────────────────────────────────
  const [profilePhoto, setProfilePhoto]   = useState(() => {
    try { return localStorage.getItem(`rdPhoto_${myKey}`) || null; } catch { return null; }
  });
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setProfilePhoto(dataUrl);
      try { localStorage.setItem(`rdPhoto_${myKey}`, dataUrl); } catch {}
      FB.set(`photos/${myKey}`, { photo: dataUrl, updatedAt: Date.now() });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setPhotoMenuOpen(false);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    try { localStorage.removeItem(`rdPhoto_${myKey}`); } catch {}
    FB.set(`photos/${myKey}`, null);
    setPhotoMenuOpen(false);
  };

  useEffect(() => {
    if (profilePhoto) return;
    FB.get(`photos/${myKey}`).then(data => {
      if (data?.photo) {
        setProfilePhoto(data.photo);
        try { localStorage.setItem(`rdPhoto_${myKey}`, data.photo); } catch {}
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Cola de rutas pendientes (enviadas por el admin mientras el mensajero tiene ruta activa)
  const [pendingRoutes, setPendingRoutes] = useState(() => {
    // Solo mostrar rutas que genuinamente están esperando ser activadas
    const fullQueue = (window.__rdPendingRoutes||{})[myKey] || LS.getPending(myKey) || [];
    return fullQueue.filter(r => r.queueStatus === "pending");
  });
  // Historial de rutas completadas (guardado localmente)
  const [routeHistory, setRouteHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`rdHistory_${myKey}`) || "[]"); } catch{ return []; }
  });
  const [histSelRoute, setHistSelRoute] = useState(null);
  const completedBannerTimer = useRef(null);
  const mapRef   = useRef(null);
  const gMapRef  = useRef(null);
  const markersRef = useRef([]);
  const chatEndRef = useRef(null);
  const lastSentAt = useRef(myRoute?.sentAt || null);
  // IDs ya vistos — nunca se reinyectan desde Firebase
  const seenRouteIds = useRef(new Set());

  // ── UBICACIÓN EN TIEMPO REAL ────────────────────────────────
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | requesting | active | denied
  const [myLocation,     setMyLocation]     = useState(null);   // { lat, lng, accuracy, ts }
  const watchIdRef = useRef(null);
  const locationMarkerRef = useRef(null); // marker azul del mensajero en el mapa
  const locationAccuracyRef = useRef(null); // círculo de precisión

  // Solicitar y activar tracking de ubicación
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("requesting");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          ts: Date.now(),
          driverName: driver.name || "Mensajero",
          driverId: myKey,
          routeName: myRoute?.routeName || null,
          online: true,
        };
        setMyLocation(loc);
        setLocationStatus("active");
        // Publicar en Firebase para que el admin la vea
        LS.setLocation(myKey, loc);
      },
      (err) => {
        console.warn("Geolocation error:", err.code, err.message);
        setLocationStatus(err.code === 1 ? "denied" : "error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,       // acepta cache de hasta 5s
        timeout: 15000,          // timeout de 15s
      }
    );
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    // Marcar offline en Firebase
    LS.setLocation(myKey, { ...myLocation, online: false, ts: Date.now() });
    setLocationStatus("idle");
    setMyLocation(null);
  };

  // Iniciar tracking automáticamente al montar (pide permiso una sola vez)
  useEffect(() => {
    startLocationTracking();
    return () => {
      // Al salir, marcar offline
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (myKey) {
        FB.set(`locations/${myKey}`, { online: false, ts: Date.now(), driverId: myKey });
      }
    };
  }, []); // eslint-disable-line

  // Actualizar el marker del mensajero en el mapa cuando cambia su posición
  useEffect(() => {
    if (!myLocation || !gMapRef.current || !window.google) return;
    const { lat, lng, accuracy } = myLocation;
    const pos = { lat, lng };

    // Círculo de precisión
    if (locationAccuracyRef.current) {
      locationAccuracyRef.current.setCenter(pos);
      locationAccuracyRef.current.setRadius(accuracy || 20);
    } else {
      locationAccuracyRef.current = new window.google.maps.Circle({
        map: gMapRef.current,
        center: pos,
        radius: accuracy || 20,
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.25,
        strokeWeight: 1.5,
        zIndex: 200,
      });
    }

    // Icono de motor (moto) animado
    const motorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <radialGradient id="lg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="24" cy="24" r="23" fill="rgba(59,130,246,0.18)" filter="url(#glow)"/>
      <circle cx="24" cy="24" r="17" fill="url(#lg)" stroke="white" stroke-width="2.5"/>
      <text x="24" y="29" text-anchor="middle" font-size="16" font-weight="900" fill="white" font-family="-apple-system,sans-serif">🏍</text>
    </svg>`;

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setPosition(pos);
    } else {
      locationMarkerRef.current = new window.google.maps.Marker({
        map: gMapRef.current,
        position: pos,
        zIndex: 9999,
        title: driver.name || "Mi ubicación",
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(motorSvg),
          scaledSize: new window.google.maps.Size(48, 48),
          anchor: new window.google.maps.Point(24, 24),
        },
      });
    }
  }, [myLocation, gMapRef.current]); // eslint-disable-line

  // -- Sync ruta en TIEMPO REAL desde Firebase --
  // REGLA FUNDAMENTAL: los stops en pantalla NUNCA retroceden.
  // Solo Firebase puede actualizar si trae un sentAt distinto (ruta nueva del admin).
  // Cambios del propio mensajero se guardan en localStorage + Firebase y NO se revierten.
  const writingRef = useRef(false); // true mientras pushUpdate está escribiendo en Firebase

  useEffect(() => {
    const LS_KEY       = `rdRoute_${myKey}`;
    const LS_QUEUE_KEY = `rdQueue_${myKey}`;    // cola local — fuente de verdad del mensajero
    const LS_SEEN_KEY  = `rdSeen_${myKey}`;     // IDs ya procesados

    // ── 1. Cargar IDs ya vistos (rutas procesadas en sesiones anteriores) ────
    try {
      const seen = JSON.parse(localStorage.getItem(LS_SEEN_KEY) || "[]");
      seen.forEach(id => seenRouteIds.current.add(id));
    } catch(e) {}

    // ── 2. Cargar ruta activa desde localStorage ─────────────────────────────
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved?.stops && saved?.sentAt) {
        lastSentAt.current = saved.sentAt;
        seenRouteIds.current.add(saved.sentAt);
        _memStore.routes[myKey] = saved;
        if (!window.__rdRouteStore) window.__rdRouteStore = {};
        window.__rdRouteStore[myKey] = saved;
        setStops(saved.stops.map(s => ({ ...s, driverStatus: s.driverStatus || "pending" })));
      }
    } catch(e) {}

    // ── 3. Cargar cola desde localStorage (fuente de verdad local de la cola) ─
    try {
      const savedQueue = JSON.parse(localStorage.getItem(LS_QUEUE_KEY) || "[]");
      if (Array.isArray(savedQueue) && savedQueue.length > 0) {
        if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
        window.__rdPendingRoutes[myKey] = savedQueue;
        setPendingRoutes(savedQueue.filter(r => r.queueStatus === "pending"));
      }
    } catch(e) {}

    // ── Helpers ──────────────────────────────────────────────────────────────

    const saveSeenIds = () => {
      try { localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...seenRouteIds.current])); } catch(e) {}
    };

    const saveQueue = (queue) => {
      if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
      window.__rdPendingRoutes[myKey] = queue;
      try { localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(queue)); } catch(e) {}
      // NO escribir en Firebase aquí — el admin gestiona pendingRoutes desde su lado
      // Escribir desde el mensajero causaría loop: saveQueue→Firebase→applyPending→saveQueue
      setPendingRoutes(queue.filter(r => r.queueStatus === "pending"));
    };

    // Marcar ruta como completada en Firebase (sin borrar — para que el admin no la reencole)
    const markDoneInFirebase = (routeId, sentAt) => {
      FB.get(`pendingRoutes/${myKey}`).then(fbData => {
        const arr = Array.isArray(fbData) ? fbData
          : (fbData && typeof fbData === "object") ? Object.values(fbData) : [];
        const updated = arr.map(r => {
          const matches = (routeId && r.routeId === routeId) || (sentAt && r.sentAt === sentAt);
          return matches ? { ...r, queueStatus: "completed", completedAt: new Date().toISOString() } : r;
        });
        if (updated.some(r => (r.routeId === routeId || r.sentAt === sentAt) && r.queueStatus === "completed")) {
          FB.set(`pendingRoutes/${myKey}`, updated);
        }
      }).catch(() => {});
    };

    // ── applyRoute: solo acepta rutas completamente nuevas del admin ─────────
    const applyRoute = (nr) => {
      if (!nr?.stops) return;
      if (writingRef.current) return;
      const normalizedStops = Array.isArray(nr.stops) ? nr.stops : Object.values(nr.stops);
      const route = { ...nr, stops: normalizedStops };

      // Ignorar si ya fue procesada (activa o en cola o completada antes)
      const routeKey = route.routeId || route.sentAt;
      if (!routeKey) return;
      if (seenRouteIds.current.has(routeKey)) return;
      if (route.sentAt && seenRouteIds.current.has(route.sentAt)) return;

      // Es nueva — ¿hay trabajo activo ahora mismo?
      setStops(currentStops => {
        const hasActive = currentStops.some(
          s => s.driverStatus === "pending" || s.driverStatus === "en_ruta"
        );

        if (hasActive) {
          // Encolar — marcar como vista para no reencolar
          seenRouteIds.current.add(routeKey);
          if (route.sentAt) seenRouteIds.current.add(route.sentAt);
          saveSeenIds();

          const currentQueue = window.__rdPendingRoutes?.[myKey] || [];
          const alreadyInQueue = currentQueue.some(r =>
            (r.routeId && r.routeId === route.routeId) || r.sentAt === route.sentAt
          );
          if (!alreadyInQueue) {
            saveQueue([...currentQueue, { ...route, queueStatus: "pending", enqueuedAt: new Date().toISOString() }]);
          }
          return currentStops;
        }

        // Sin trabajo activo — asignar directamente
        seenRouteIds.current.add(routeKey);
        if (route.sentAt) seenRouteIds.current.add(route.sentAt);
        saveSeenIds();
        lastSentAt.current = route.sentAt;
        if (!window.__rdRouteStore) window.__rdRouteStore = {};
        window.__rdRouteStore[myKey] = route;
        _memStore.routes[myKey] = route;
        onUpdateRoute(myKey, route);
        try { localStorage.setItem(LS_KEY, JSON.stringify(route)); } catch(e) {}
        return route.stops.map(s => ({ ...s, driverStatus: s.driverStatus || "pending" }));
      });
    };

    // applyPending: Firebase envía la cola — solo agregar rutas genuinamente nuevas
    const applyPending = (queue) => {
      const arr = Array.isArray(queue) ? queue
        : (queue && typeof queue === "object") ? Object.values(queue) : [];

      const currentQueue = window.__rdPendingRoutes?.[myKey] || [];
      const currentIds = new Set(currentQueue.map(r => r.routeId || r.sentAt).filter(Boolean));

      const toAdd = arr.filter(r => {
        const k = r.routeId || r.sentAt;
        if (!k) return false;
        if (r.queueStatus === "completed") return false;  // ya completada — nunca reencolar
        if (seenRouteIds.current.has(k)) return false;   // ya procesada en esta sesión
        if (r.sentAt && seenRouteIds.current.has(r.sentAt)) return false;
        if (currentIds.has(k)) return false;             // ya está en la cola local
        return r.queueStatus === "pending";
      });

      if (toAdd.length > 0) saveQueue([...currentQueue, ...toAdd]);
    };

    const applyChat = (msgs) => {
      if (Array.isArray(msgs)) setChatLog([...msgs]);
    };

    // ── 4. Firebase listeners ─────────────────────────────────────────────────
    // NO llamar FB.get("routes/myKey") al montar — ya tenemos localStorage como fuente de verdad.
    // Solo escuchar cambios NUEVOS del admin. Esto evita que la ruta con progreso parcial
    // se re-aplique al recargar la página.
    FB.get(`pendingRoutes/${myKey}`).then(applyPending);
    FB.get(`chats/${myKey}`).then(applyChat);

    const unsubRoute   = FB.listen(`routes/${myKey}`, applyRoute);
    const unsubPending = FB.listen(`pendingRoutes/${myKey}`, applyPending);
    const unsubChat    = FB.listen(`chats/${myKey}`, applyChat);

    // ── 5. Exponer helpers para admin en mismo navegador ─────────────────────
    window.__rdSetRoute   = (driverId, route) => { if (driverId === myKey) applyRoute(route); };
    window.__rdSetPending = (driverId, queue) => { if (driverId === myKey) applyPending(queue); };

    // ── 6. Notificaciones del admin ──────────────────────────────────────────

    // 3) Listener de notificaciones del admin → mensajero (ruta asignada)
    let lastNotifKeys = new Set();
    const checkNotifs = async () => {
      try {
        const data = await FB.get(`driverNotifs/${myKey}`);
        if (!data) return;
        Object.entries(data).forEach(([k, notif]) => {
          if (lastNotifKeys.has(k) || notif.read) return;
          lastNotifKeys.add(k);
          if (notif.type === "route_assigned") {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(notif.title, { body: notif.body, icon: "/favicon.ico" });
            }
            if (typeof window.__rdShowDriverNotif === "function") {
              window.__rdShowDriverNotif(notif);
            }
            FB.set(`driverNotifs/${myKey}/${k}`, { ...notif, read: true });
          }
        });
      } catch(e) {}
    };
    const unsubDriverNotifs = FB.listen(`driverNotifs/${myKey}`, (data) => {
      if (!data) return;
      Object.entries(data).forEach(([k, notif]) => {
        if (lastNotifKeys.has(k) || notif.read) return;
        lastNotifKeys.add(k);
        if (notif.type === "route_assigned") {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.body, icon: "/favicon.ico" });
          }
          if (typeof window.__rdShowDriverNotif === "function") {
            window.__rdShowDriverNotif(notif);
          }
          FB.set(`driverNotifs/${myKey}/${k}`, { ...notif, read: true });
        }
      });
    });

    // Polling de respaldo cada 8s — solo notifs y pendingRoutes (NO routes para no revertir progreso)
    const pollInterval = setInterval(() => {
      if (!writingRef.current) {
        FB.get(`pendingRoutes/${myKey}`).then(applyPending);
      }
      checkNotifs();
    }, 8000);
    checkNotifs();

    return () => { unsubRoute(); unsubChat(); unsubPending(); unsubDriverNotifs(); clearInterval(pollInterval); };
  }, [myKey]); // eslint-disable-line

  useEffect(() => { const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [chatLog]);

  // Registrar handler para mostrar banner de notificación de ruta asignada
  useEffect(() => {
    window.__rdShowDriverNotif = (notif) => {
      setDriverNotif(notif);
      setTimeout(() => setDriverNotif(null), 8000);
    };
    // Pedir permiso para notificaciones nativas del navegador
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => { window.__rdShowDriverNotif = null; };
  }, []);

  // -- Detectar nueva ruta via React state (misma pestana/admin envia) ----------
  // NOTA: El admin ya maneja la cola antes de llamar a __rdSetRoute,
  // así que aquí solo llegará una ruta si el mensajero NO tenía trabajo activo.
  // Por seguridad, también verificamos aquí.
  // globalRoutes changes are handled by the Firebase listener above.
  // This effect intentionally left empty to avoid double-applying routes.

  // -- Google Maps ---------------------------------------------------------------
  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (gMapRef.current || !mapRef.current) return;
      gMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: DEPOT.lat, lng: DEPOT.lng },
        zoom: 12,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        styles: [
          {featureType:"poi",stylers:[{visibility:"off"}]},
          {featureType:"transit",stylers:[{visibility:"off"}]},
          {featureType:"road",elementType:"geometry",stylers:[{color:"#ffffff"}]},
          {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#f0f0f0"}]},
          {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#e8e8e8"}]},
          {featureType:"water",elementType:"geometry",stylers:[{color:"#c9e8f5"}]},
          {featureType:"landscape",elementType:"geometry",stylers:[{color:"#f7f8fa"}]},
          {featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#d1d5db"}]},
          {elementType:"labels.text.fill",stylers:[{color:"#374151"}]},
          {elementType:"labels.text.stroke",stylers:[{color:"#ffffff"}]},
        ],
      });
    });
  }, []);

  // -- Re-render markers after map becomes ready --------------------------------
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    loadGoogleMaps().then(() => {
      // Poll until gMapRef is set (handles async init)
      const check = setInterval(() => {
        if (gMapRef.current) { setMapReady(true); clearInterval(check); }
      }, 100);
      setTimeout(() => clearInterval(check), 5000);
    });
  }, []);

  // -- Actualizar marcadores cuando cambian paradas ------------------------------
  useEffect(() => {
    if (!gMapRef.current) return;
    markersRef.current.forEach(m => { try { m.setMap(null); } catch(e){} });
    markersRef.current = [];
    const validStops = stops.filter(s => s.lat && s.lng);
    if (!validStops.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    const currentStop = stops.find(s=>s.driverStatus==="en_ruta") || stops.find(s=>s.driverStatus==="pending");

    // ── Draw glow polyline first (so markers render on top) ──
    const ordered = validStops.filter(s=>s.stopNum).sort((a,b)=>a.stopNum-b.stopNum);
    if (ordered.length > 1) {
      // Outer glow line (wide, low opacity)
      const glowLine = new window.google.maps.Polyline({
        map: gMapRef.current,
        path: ordered.map(s=>({lat:s.lat,lng:s.lng})),
        strokeColor: "#60a5fa",
        strokeOpacity: 0.18,
        strokeWeight: 14,
        zIndex: 1,
      });
      // Core bright line
      const coreLine = new window.google.maps.Polyline({
        map: gMapRef.current,
        path: ordered.map(s=>({lat:s.lat,lng:s.lng})),
        strokeColor: "#93c5fd",
        strokeOpacity: 0.9,
        strokeWeight: 2.5,
        zIndex: 2,
        icons: [{
          icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.2, strokeColor:"#bfdbfe", strokeWeight:1.5, fillColor:"#bfdbfe", fillOpacity:1 },
          offset: "100%",
          repeat: "120px"
        }],
      });
      markersRef.current.push(glowLine, coreLine);
    }

    // ── Premium teardrop markers ──
    validStops.forEach(stop => {
      const isDone = stop.driverStatus === "delivered";
      const isProb = stop.driverStatus === "problema";
      const isNow  = stop === currentStop;
      const label  = String(stop.stopNum || "?");
      const fs     = label.length > 2 ? 8 : label.length > 1 ? 10 : 12;

      // Paleta de color por estado
      const mc = isDone ? "#10b981" : isProb ? "#ef4444" : isNow ? "#3b82f6" : "#f59e0b";
      const mc2 = isDone ? "#059669" : isProb ? "#dc2626" : isNow ? "#1d4ed8" : "#d97706";
      const light = isDone ? "rgba(167,243,208,0.7)" : isProb ? "rgba(254,202,202,0.7)" : isNow ? "rgba(191,219,254,0.8)" : "rgba(253,230,138,0.75)";

      // Tamaño: pin actual = grande con halo, resto = normal
      const W = isNow ? 44 : 34;
      const H = isNow ? 56 : 44;
      const ballR = isNow ? 16 : 12.5;
      const ballCX = W / 2;
      const ballCY = ballR + (isNow ? 4 : 3);
      // Punta del pin — debajo del círculo
      const tipX = ballCX;
      const tipY = H - (isNow ? 4 : 3);

      const id = `p${stop.stopNum||"x"}`;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs>
          <radialGradient id="bg${id}" cx="42%" cy="32%" r="68%">
            <stop offset="0%" stop-color="${light}"/>
            <stop offset="55%" stop-color="${mc}"/>
            <stop offset="100%" stop-color="${mc2}"/>
          </radialGradient>
          <radialGradient id="glow${id}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${mc}" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="${mc}" stop-opacity="0"/>
          </radialGradient>
          <filter id="sh${id}" x="-50%" y="-30%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="${isNow?3.5:2}" flood-color="${mc2}" flood-opacity="${isNow?0.65:0.45}"/>
          </filter>
        </defs>

        ${isNow ? `<ellipse cx="${ballCX}" cy="${ballCY}" rx="${ballR+8}" ry="${ballR+8}" fill="url(#glow${id})"/>` : ""}

        <!-- Pin shape -->
        <g filter="url(#sh${id})">
          <path d="M${ballCX-7},${ballCY+ballR-4} Q${ballCX},${tipY+6} ${tipX},${tipY} Q${ballCX},${tipY+6} ${ballCX+7},${ballCY+ballR-4}Z"
            fill="url(#bg${id})"/>
          <circle cx="${ballCX}" cy="${ballCY}" r="${ballR}"
            fill="url(#bg${id})"
            stroke="rgba(255,255,255,${isNow?0.6:0.4})"
            stroke-width="${isNow?2:1.5}"/>
          <ellipse cx="${ballCX-ballR*0.22}" cy="${ballCY-ballR*0.28}"
            rx="${ballR*0.42}" ry="${ballR*0.26}"
            fill="rgba(255,255,255,0.32)"
            transform="rotate(-25,${ballCX-ballR*0.22},${ballCY-ballR*0.28})"/>
        </g>

        <!-- Siempre mostrar el número de parada -->
        <text x="${ballCX}" y="${ballCY+0.5}" text-anchor="middle" dominant-baseline="central"
          font-size="${fs}" font-weight="900" fill="white"
          font-family="-apple-system,BlinkMacSystemFont,sans-serif" letter-spacing="-0.5" opacity="0.97">${label}</text>

        <!-- Badge de estado (esquina superior derecha) -->
        ${isDone ? `
          <circle cx="${ballCX+ballR-1}" cy="${ballCY-ballR+1}" r="6" fill="#059669" stroke="white" stroke-width="1.5"/>
          <path d="M${ballCX+ballR-4},${ballCY-ballR+1} l2,2 4,-4"
            stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        ` : isProb ? `
          <circle cx="${ballCX+ballR-1}" cy="${ballCY-ballR+1}" r="6" fill="#dc2626" stroke="white" stroke-width="1.5"/>
          <text x="${ballCX+ballR-1}" y="${ballCY-ballR+1.5}" text-anchor="middle" dominant-baseline="central"
            font-size="7" font-weight="900" fill="white" font-family="sans-serif">!</text>
        ` : ""}
      </svg>`;

      const marker = new window.google.maps.Marker({
        map: gMapRef.current,
        position: { lat: stop.lat, lng: stop.lng },
        title: `#${stop.stopNum} ${stop.client}`,
        zIndex: isNow ? 999 : isDone ? 1 : isProb ? 2 : 10,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new window.google.maps.Size(W, H),
          anchor: new window.google.maps.Point(W / 2, H - 2), // punta del pin al suelo
        },
      });
      marker.addListener("click", () => {
        setSelStop(stop);
        setMapPinPopup(stop);
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });

    gMapRef.current.fitBounds(bounds, { top:24, right:24, bottom:24, left:24 });
  }, [stops, mapReady]);

  // -- Centrar en parada seleccionada --------------------------------------------
  useEffect(() => {
    if (selStop?.lat && gMapRef.current) {
      gMapRef.current.panTo({ lat: selStop.lat, lng: selStop.lng });
      gMapRef.current.setZoom(16);
    }
  }, [selStop]);

  // -- Helpers -------------------------------------------------------------------
  const delivered   = stops.filter(s=>s.driverStatus==="delivered");
  const problems    = stops.filter(s=>s.driverStatus==="problema");
  const pending     = stops.filter(s=>s.driverStatus==="pending"||s.driverStatus==="en_ruta");
  const currentStop = stops.find(s=>s.driverStatus==="en_ruta") || stops.find(s=>s.driverStatus==="pending");
  const pct         = stops.length>0 ? Math.round((delivered.length/stops.length)*100) : 0;

  const filteredStops = stops.filter(s => {
    if (filterMode !== "all") {
      if (filterMode === "pending" && s.driverStatus !== "pending" && s.driverStatus !== "en_ruta") return false;
      if (filterMode === "delivered" && s.driverStatus !== "delivered") return false;
      if (filterMode === "problema" && s.driverStatus !== "problema") return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.client||"").toLowerCase().includes(q) ||
           (s.displayAddr||s.rawAddr||"").toLowerCase().includes(q) ||
           (s.tracking||"").toLowerCase().includes(q) ||
           String(s.stopNum||"").includes(q);
  });

  const pushUpdate = (updatedStops) => {
    const base = _memStore.routes[myKey] || (window.__rdRouteStore||{})[myKey] || globalRoutes[myKey] || {};
    const updated = { ...base, stops:updatedStops, lastUpdate:Date.now() };
    // 1) Actualizar memoria local INMEDIATAMENTE (fuente de verdad local)
    if (!window.__rdRouteStore) window.__rdRouteStore = {};
    window.__rdRouteStore[myKey] = updated;
    _memStore.routes[myKey] = updated;
    onUpdateRoute(myKey, updated);
    // 2) Guardar en localStorage (persiste si se recarga antes de que Firebase responda)
    try { localStorage.setItem(`rdRoute_${myKey}`, JSON.stringify(updated)); } catch(e) {}
    // 3) Escribir en Firebase con bloqueo para que applyRoute no revierta
    writingRef.current = true;
    Promise.all([
      FB.set(`routes/${myKey}`, updated),
      updated.routeId ? FB.set(`routeHistory/${updated.routeId}`, updated) : Promise.resolve(),
    ]).finally(() => {
      writingRef.current = false;
    });
    // Route fully complete
    const allDone = updatedStops.length > 0 && updatedStops.every(s => s.driverStatus === "delivered" || s.driverStatus === "problema");
    if (allDone) {
      const histEntry = { ...updated, completedAt: new Date().toISOString(), histId: `H-${Date.now()}` };
      setRouteHistory(prev => {
        const next = [histEntry, ...prev].slice(0, 50);
        try { localStorage.setItem(`rdHistory_${myKey}`, JSON.stringify(next)); } catch(e){}
        return next;
      });
      // Marcar esta ruta como vista para siempre
      const routeKey = updated.routeId || updated.sentAt;
      if (routeKey) seenRouteIds.current.add(routeKey);
      if (updated.sentAt) seenRouteIds.current.add(updated.sentAt);
      try { localStorage.setItem(`rdSeen_${myKey}`, JSON.stringify([...seenRouteIds.current])); } catch(e) {}
      // Eliminar de la cola local (UI y localStorage)
      const currentQueue = window.__rdPendingRoutes?.[myKey] || [];
      const newQueue = currentQueue.filter(r =>
        updated.routeId ? r.routeId !== updated.routeId : r.sentAt !== updated.sentAt
      );
      if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
      window.__rdPendingRoutes[myKey] = newQueue;
      try { localStorage.setItem(`rdQueue_${myKey}`, JSON.stringify(newQueue)); } catch(e) {}
      setPendingRoutes(newQueue.filter(r => r.queueStatus === "pending"));
      // Marcar como "completed" en Firebase (NO borrar — así el admin no la reencola)
      markDoneInFirebase(updated.routeId, updated.sentAt);
    }
  };

  const addChatMsg = (text) => {
    const msg = { from:"driver", text, time:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) };
    if (!window.__rdChatStore) window.__rdChatStore = {};
    const nl = [...(window.__rdChatStore[myKey]||[]), msg].slice(-80);
    window.__rdChatStore[myKey] = nl; LS.setChat(myKey, nl);
    setChatLog(nl);
  };

  // ── Guardar evidencia en Firebase + enviar al backend para sync con SilpoPack ──
  const saveEvidenceAndSync = async (stopId, mode, photoDataUrl, note) => {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return;
    const ts        = Date.now();
    const timeStr   = new Date().toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
    const isDelivered = mode === "delivered";

    // 1. Subir foto a Firebase Storage (base64 en Realtime DB como fallback si no hay Storage)
    //    En producción reemplazar por Firebase Storage upload
    const photoKey = `evidence/${myKey}/${ts}_${stopId}`;
    await FB.set(photoKey, { photo: photoDataUrl, ts, stopId });
    const evidencePhotoUrl = `firebase:${photoKey}`; // placeholder hasta integrar Storage

    // 2. Obtener GPS actual
    let gpsLocation = null;
    try {
      gpsLocation = await new Promise((res) =>
        navigator.geolocation.getCurrentPosition(
          p => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
          () => res(null),
          { timeout: 4000, enableHighAccuracy: true }
        )
      );
    } catch {}

    // 3. Construir payload de sincronización
    const syncPayload = {
      packageCode:    stop.tracking || stop.id,
      status:         isDelivered ? "delivered" : "failed",
      evidencePhotoUrl,
      courierId:      myKey,
      courierName:    users.find(u => u.email === myKey)?.name || myKey,
      deliveredAt:    isDelivered ? new Date().toISOString() : null,
      failedAt:       !isDelivered ? new Date().toISOString() : null,
      failNote:       !isDelivered ? (note || "Sin detalles") : null,
      gpsLocation,
      syncStatus:     "pending",
      createdAt:      ts,
      stopId,
    };

    // 4. Guardar en Firebase (nodo deliveryEvents)
    const evKey = `deliveryEvents/${ts}_${stopId}`;
    await FB.set(evKey, syncPayload);

    // 5. Enviar al backend para sync con SilpoPack (fire-and-forget con reintento)
    const trySyncBackend = async (attempt = 1) => {
      try {
        const resp = await fetch(`${BACKEND_URL}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...syncPayload, firebaseKey: evKey }),
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // Backend confirma → actualizar syncStatus
        FB.set(`${evKey}/syncStatus`, "synced");
      } catch (e) {
        if (attempt < 3) {
          setTimeout(() => trySyncBackend(attempt + 1), attempt * 5000);
        } else {
          FB.set(`${evKey}/syncStatus`, "failed");
          FB.set(`${evKey}/errorMessage`, e.message);
        }
      }
    };
    trySyncBackend();

    // 6. Actualizar estado local de la parada
    if (isDelivered) {
      let foundNext = false;
      const updated = stops.map(s => {
        if (s.id === stopId) return { ...s, driverStatus:"delivered", deliveredAt:timeStr, evidencePhotoUrl };
        if (!foundNext && s.driverStatus === "pending") { foundNext = true; return { ...s, driverStatus:"en_ruta" }; }
        return s;
      });
      setStops(updated); pushUpdate(updated);
      addChatMsg(`✓ Entregado: ${stop.client || "Parada #"+stop.stopNum}`);
      const notifId = "n"+ts+stopId;
      FB.set(`adminNotifs/${notifId}`, { id:notifId, type:"delivered", icon:"✓", color:"#10b981",
        title:`Entregado: ${stop.client||"Parada #"+stop.stopNum}`,
        body:`${myKey} · #${stop.stopNum} · ${stop.displayAddr||stop.rawAddr||""}`,
        time:timeStr, read:false, isNew:true, createdAt:ts });
    } else {
      const updated = stops.map(s => s.id===stopId
        ? { ...s, driverStatus:"problema", issue:note||"Sin detalles", issueAt:timeStr, evidencePhotoUrl }
        : s);
      setStops(updated); pushUpdate(updated);
      addChatMsg(`⚠ Problema parada #${stop.stopNum}: ${note||"Sin detalles"}`);
      const notifId = "n"+ts+stopId;
      FB.set(`adminNotifs/${notifId}`, { id:notifId, type:"delayed", icon:"⚠", color:"#f59e0b",
        title:`Problema: ${stop.client||"Parada #"+stop.stopNum}`,
        body:`${myKey} · ${note||"Sin detalles"} · #${stop.stopNum}`,
        time:timeStr, read:false, isNew:true, createdAt:ts });
    }
    setEvidenceFlow(null); setShowProb(null); setProbNote(""); setSelStop(null);
  };

  // markDelivered ahora abre la cámara primero
  const markDelivered = (stopId) => {
    setEvidenceFlow({ stopId, mode: "delivered" });
  };

  // markProblem ahora abre la cámara primero
  const markProblem = (stopId) => {
    setEvidenceFlow({ stopId, mode: "failed", probNote: probNote || "Sin detalles" });
  };

  const sendChat = () => { if (!chatMsg.trim()) return; addChatMsg(chatMsg.trim()); setChatMsg(""); };

  // -- Auto-dismiss "Ruta completada" banner + sugerir siguiente pendiente ------
  useEffect(() => {
    const allDone = stops.length > 0 && stops.every(s => s.driverStatus === "delivered" || s.driverStatus === "problema");
    if (allDone) {
      setShowCompletedBanner(true);
      clearTimeout(completedBannerTimer.current);
      // Si hay rutas pendientes, mantener el banner más tiempo para que pueda verlo
      const delay = pendingRoutes.length > 0 ? 12000 : 6000;
      completedBannerTimer.current = setTimeout(() => setShowCompletedBanner(false), delay);
    } else {
      setShowCompletedBanner(false);
    }
    return () => clearTimeout(completedBannerTimer.current);
  }, [stops, pendingRoutes.length]);

  // -- Colores por status del driver ---------------------------------------------
  const dsColor = (ds) => ds==="delivered"?"#10b981":ds==="problema"?"#ef4444":ds==="en_ruta"?"#3b82f6":"#f59e0b";
  const dsLabel = (ds) => ds==="delivered"?"Entregado":ds==="problema"?"Problema":ds==="en_ruta"?"En ruta":"Pendiente";

  // -- Estimated finish time ----------------------------------------------------
  const estFinish = () => {
    const remaining = pending.length;
    if (!remaining) return null;
    const eta = new Date(Date.now() + remaining * 8 * 60000);
    return eta.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
  };
  const routeKm = myRoute?.km || 0;

  // Sheet height calculation
  const HEADER_H = 64;
  const NAV_H    = 68;
  const SNAP = {
    peek: 220,   // just stats + search handle visible
    half: Math.round(window.innerHeight * 0.52),
    full: window.innerHeight - HEADER_H,
  };
  const resolvedSheetH = sheetH !== null ? sheetH : SNAP[sheetSnap] || SNAP.half;

  const handleSheetDragStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    sheetDragRef.current = { startY: touch.clientY, startH: resolvedSheetH };
    setSheetDragY(touch.clientY);
  };
  const handleSheetDragMove = (e) => {
    if (sheetDragY === null) return;
    const touch = e.touches ? e.touches[0] : e;
    const dy = sheetDragRef.current.startY - touch.clientY;
    const next = Math.min(SNAP.full, Math.max(SNAP.peek, sheetDragRef.current.startH + dy));
    setSheetH(next);
  };
  const handleSheetDragEnd = () => {
    if (sheetDragY === null) return;
    setSheetDragY(null);
    // Snap to nearest
    if (sheetH !== null) {
      const closest = Object.entries(SNAP).reduce((a,[k,v]) =>
        Math.abs(v - sheetH) < Math.abs(SNAP[a] - sheetH) ? k : a, "half");
      setSheetSnap(closest);
      setSheetH(null);
    }
  };

  return (
    <div
      style={{ position:"fixed",inset:0,background:"#060c14",display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif",color:"#f1f5f9",overflow:"hidden" }}
      onPointerMove={handleSheetDragMove}
      onPointerUp={handleSheetDragEnd}
      onPointerLeave={handleSheetDragEnd}
      onTouchMove={handleSheetDragMove}
      onTouchEnd={handleSheetDragEnd}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;scrollbar-width:thin;scrollbar-color:#1e2d3d transparent}
        *::-webkit-scrollbar{width:2px}*::-webkit-scrollbar-thumb{background:#1e2d3d;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRow{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideLeft{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
        @keyframes countdown{from{width:100%}to{width:0%}}
        @keyframes shimmer{0%{background-position:200% 50%}100%{background-position:-200% 50%}}
        .rd-stop:hover{background:rgba(255,255,255,0.025)!important}
        .rd-btn:active{transform:scale(.97)!important}
        .rd-menu-item:hover{background:rgba(255,255,255,0.06)!important}
        .rd-chip-active{background:#1a2d4a!important;border-color:#2563eb!important;color:#60a5fa!important}
        .rd-chip:hover{border-color:#1e3550!important}
      `}</style>

      {/* ══ HEADER PREMIUM ══ */}
      <div style={{ flexShrink:0, position:"relative", background:"#06090f", borderBottom:"1px solid rgba(255,255,255,0.06)", height:68, display:"flex", alignItems:"center", paddingLeft:14, paddingRight:14, gap:12, zIndex:100, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, left:-20, width:120, height:80, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(59,130,246,0.18) 0%,transparent 70%)", pointerEvents:"none" }}/>

        {/* Menu button */}
        <button onClick={()=>setMenuOpen(o=>!o)} className="rd-btn"
          style={{ width:42, height:42, borderRadius:13, flexShrink:0, cursor:"pointer", border:"none", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, borderRadius:13, background:menuOpen?"rgba(59,130,246,0.18)":"rgba(255,255,255,0.05)", border:`1px solid ${menuOpen?"rgba(59,130,246,0.4)":"rgba(255,255,255,0.09)"}`, transition:"all .18s" }}/>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ position:"relative", zIndex:1, overflow:"visible" }}>
            <line x1="2" y1={menuOpen?9:5} x2="16" y2={menuOpen?9:5}
              stroke={menuOpen?"#60a5fa":"rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round"
              style={{ transformOrigin:"9px 9px", transform:menuOpen?"rotate(45deg)":"none", transition:"all .22s cubic-bezier(.4,0,.2,1)" }}/>
            <line x1="2" y1="9" x2="16" y2="9"
              stroke={menuOpen?"#60a5fa":"rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round"
              style={{ opacity:menuOpen?0:1, transition:"opacity .15s" }}/>
            <line x1="2" y1={menuOpen?9:13} x2="16" y2={menuOpen?9:13}
              stroke={menuOpen?"#60a5fa":"rgba(255,255,255,0.7)"} strokeWidth="1.8" strokeLinecap="round"
              style={{ transformOrigin:"9px 9px", transform:menuOpen?"rotate(-45deg)":"none", transition:"all .22s cubic-bezier(.4,0,.2,1)" }}/>
          </svg>
        </button>

        {/* Avatar con foto de perfil */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <input ref={photoInputRef} type="file" accept="image/*"
            onChange={handlePhotoUpload} style={{ display:"none" }}/>
          <div onClick={() => setPhotoMenuOpen(o => !o)} style={{
            width:42, height:42, borderRadius:14, overflow:"hidden", cursor:"pointer",
            background:"linear-gradient(135deg,#1e3a6e 0%,#1d4ed8 55%,#3b82f6 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, fontWeight:900, color:"white", letterSpacing:"-0.5px",
            boxShadow:"0 2px 14px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
            position:"relative", flexShrink:0,
          }}>
            {profilePhoto
              ? <img src={profilePhoto} alt="perfil" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              : <>
                  {(driver.avatar||(driver.name||"").slice(0,2)).toUpperCase()}
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:2, pointerEvents:"none" }}>
                    <div style={{ width:14, height:14, borderRadius:"50%", background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                  </div>
                </>
            }
          </div>
          {/* GPS dot — solo el indicador visual, sin texto */}
          <div style={{ position:"absolute", bottom:-1, right:-1, width:11, height:11, borderRadius:"50%", background:locationStatus==="active"?"#22c55e":locationStatus==="requesting"?"#f59e0b":locationStatus==="denied"?"#ef4444":"#374151", border:"2px solid #06090f", boxShadow:locationStatus==="active"?"0 0 7px #22c55e60":"none", animation:locationStatus==="requesting"?"pulse 1s infinite":"none", zIndex:2 }}/>
          {/* Mini-menú foto */}
          {photoMenuOpen && (
            <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:50, left:0, zIndex:500, background:"#0d1a26", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.8)", minWidth:170, animation:"popIn .15s ease" }}>
              <button onClick={()=>{ photoInputRef.current?.click(); }} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", width:"100%", border:"none", background:"transparent", color:"rgba(255,255,255,0.75)", fontSize:12, fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                {profilePhoto ? "Cambiar foto" : "Subir foto"}
              </button>
              {profilePhoto && (
                <button onClick={handleRemovePhoto} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", width:"100%", border:"none", borderTop:"1px solid rgba(255,255,255,0.06)", background:"transparent", color:"#ef4444", fontSize:12, fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Eliminar foto
                </button>
              )}
              <button onClick={()=>setPhotoMenuOpen(false)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", width:"100%", border:"none", borderTop:"1px solid rgba(255,255,255,0.06)", background:"transparent", color:"rgba(255,255,255,0.3)", fontSize:11, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", textAlign:"left" }}>
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Nombre centrado — sin GPS, premium */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#ffffff", letterSpacing:"-0.5px", lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textShadow:"0 1px 12px rgba(59,130,246,0.35)" }}>
            {(driver.name||"Mensajero").split(" ").slice(0,2).join(" ")}
          </div>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", fontWeight:600, marginTop:4, letterSpacing:"2px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>
            Mensajero
          </div>
        </div>

        {/* Anillo de progreso */}
        {stops.length > 0 && (
          <div style={{ flexShrink:0, position:"relative", width:38, height:38, cursor:"pointer" }} onClick={()=>setTab("route")}>
            <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="19" cy="19" r="14" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3"/>
              <circle cx="19" cy="19" r="14" fill="none"
                stroke={pct===100?"#10b981":"#3b82f6"} strokeWidth="3"
                strokeDasharray={`${2*Math.PI*14}`}
                strokeDashoffset={`${2*Math.PI*14*(1-pct/100)}`}
                strokeLinecap="round" style={{ transition:"stroke-dashoffset .5s ease" }}/>
            </svg>
            <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:pct===100?"#10b981":"#93c5fd", fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
          </div>
        )}

        {/* Botón mapa */}
        <button onClick={()=>setTab(t=>t==="mapa"?"route":"mapa")} className="rd-btn"
          style={{ width:42, height:42, borderRadius:13, border:`1px solid ${tab==="mapa"?"rgba(59,130,246,0.4)":"rgba(255,255,255,0.08)"}`, background:tab==="mapa"?"rgba(59,130,246,0.18)":"rgba(255,255,255,0.04)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, transition:"all .15s" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={tab==="mapa"?"#60a5fa":"rgba(255,255,255,0.45)"} strokeWidth="1.8">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/>
            <line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
        </button>
      </div>

      {/* ══ MAP SECTION — solo en tab mapa ══ */}
      <div style={{ position:"relative", flex:1, overflow:"hidden", background:"#060c14", display: tab === "mapa" ? "flex" : "none", flexDirection:"column" }}>
        <div ref={mapRef} style={{ position:"absolute", inset:0 }}/>

        {/* map controls bottom-right */}
        <div style={{ position:"absolute",bottom:22,right:12,display:"flex",flexDirection:"column",gap:7 }}>
          <button className="rd-btn" style={{ width:38,height:38,borderRadius:11,background:"rgba(6,12,20,0.9)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
          </button>
          <button className="rd-btn" style={{ width:38,height:38,borderRadius:11,background:"rgba(6,12,20,0.9)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </button>
        </div>

        {/* ── MAP PIN POPUP ── aparece cuando se toca un pin */}
        {mapPinPopup && (() => {
          const s = mapPinPopup;
          const isDone = s.driverStatus === "delivered";
          const isProb = s.driverStatus === "problema";
          const ac = isDone ? "#10b981" : isProb ? "#ef4444" : "#3b82f6";
          return (
            /* ── Info card: top-left, no obstruction, read-only ── */
            <div style={{
              position:"absolute", top:14, left:12, zIndex:200,
              width: Math.min(280, window.innerWidth - 24),
              animation:"slideUp .2s cubic-bezier(.4,0,.2,1)",
              pointerEvents:"auto",
            }}>
              <div style={{
                background:"rgba(6,12,22,0.96)",
                backdropFilter:"blur(24px)",
                WebkitBackdropFilter:"blur(24px)",
                borderRadius:16,
                border:`1px solid ${ac}30`,
                boxShadow:`0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px ${ac}15`,
                overflow:"hidden",
              }}>
                {/* Accent bar */}
                <div style={{ height:2, background:`linear-gradient(90deg,${ac},${ac}22)` }}/>

                <div style={{ padding:"11px 13px 13px" }}>

                  {/* Row 1: # parada + nombre + close */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:9, marginBottom:10 }}>
                    {/* Número de parada — siempre visible */}
                    <div style={{
                      minWidth:34, height:34, borderRadius:10,
                      background:`${ac}15`, border:`1.5px solid ${ac}35`,
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center",
                      flexShrink:0, gap:0,
                    }}>
                      <span style={{ fontSize:11, fontWeight:900, color:ac, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                        {s.stopNum||"?"}
                      </span>
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="3" style={{marginTop:1}}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {isProb && <span style={{ fontSize:9, color:ac, lineHeight:1, marginTop:1 }}>!</span>}
                    </div>

                    {/* Nombre cliente */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.2px", lineHeight:1.25, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {s.client || `Parada ${s.stopNum}`}
                      </div>
                      {/* Estado si entregado/problema */}
                      {(isDone || isProb) && (
                        <div style={{ fontSize:10, color:ac, fontWeight:600, marginTop:2 }}>
                          {isDone ? `✓ Entregado${s.deliveredAt ? " · " + s.deliveredAt : ""}` : `⚠ Problema`}
                        </div>
                      )}
                    </div>

                    {/* Cerrar */}
                    <button onClick={() => setMapPinPopup(null)}
                      style={{ width:26, height:26, borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.35)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0, lineHeight:1 }}>
                      ✕
                    </button>
                  </div>

                  {/* Row 2: SP code */}
                  {s.tracking && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                      <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontWeight:700, letterSpacing:"0.8px", textTransform:"uppercase", flexShrink:0 }}>SP</span>
                      <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(96,165,250,0.85)", background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.18)", borderRadius:5, padding:"1px 7px", letterSpacing:"0.4px" }}>
                        {s.tracking}
                      </span>
                    </div>
                  )}

                  {/* Row 3: Teléfono (solo texto, no botón) */}
                  {s.phone && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.91 10.5a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.9 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontFamily:"'DM Mono',monospace", letterSpacing:"0.3px" }}>
                        {s.phone}
                      </span>
                    </div>
                  )}

                  {/* Row 4: Dirección completa */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" style={{marginTop:2,flexShrink:0}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.45)", lineHeight:1.45 }}>
                      {s.displayAddr || s.rawAddr || "Sin dirección"}
                    </span>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

        {/* No route overlay */}
        {!myRoute && (
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,background:"rgba(6,12,20,0.96)" }}>
            <div style={{ width:64,height:64,borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30 }}>📭</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.6)",marginBottom:6 }}>Sin ruta asignada</div>
              <div style={{ display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 16px" }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.3)",animation:"pulse 2s infinite" }}/>
                <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)" }}>Esperando ruta del admin...</span>
              </div>
            </div>
          </div>
        )}





        {/* ── Banner: Nueva ruta asignada por el admin ── */}
        {driverNotif && (
          <div style={{ position:"absolute",top:16,left:16,right:16,zIndex:200,animation:"slideIn .3s cubic-bezier(.4,0,.2,1)" }}>
            <div style={{ background:"linear-gradient(135deg,rgba(29,78,216,0.97),rgba(59,130,246,0.97))",border:"1px solid rgba(147,197,253,0.3)",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 32px rgba(59,130,246,0.4)",backdropFilter:"blur(20px)" }}>
              <div style={{ fontSize:26,flexShrink:0 }}>📦</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:800,color:"white",marginBottom:2 }}>{driverNotif.title}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.75)",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{driverNotif.body}</div>
              </div>
              <button onClick={()=>setDriverNotif(null)} style={{ width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0 }}>✕</button>
            </div>
          </div>
        )}

        {/* Route complete banner */}
        {showCompletedBanner && tab!=="chat" && tab!=="pending" && (
          <div style={{ position:"absolute",bottom:14,left:14,right:14,background:"rgba(6,12,20,0.98)",border:`1px solid ${pendingRoutes.length>0?"rgba(245,158,11,0.25)":"rgba(255,255,255,0.1)"}`,borderRadius:16,padding:"16px",textAlign:"center",backdropFilter:"blur(20px)",boxShadow:"0 8px 32px rgba(0,0,0,0.8)",animation:"popIn .3s cubic-bezier(.4,0,.2,1)",zIndex:50 }}>
            <button onClick={()=>setShowCompletedBanner(false)} style={{ position:"absolute",top:8,right:10,background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:16,cursor:"pointer",lineHeight:1,padding:4 }}>✕</button>
            <div style={{ fontSize:30,marginBottom:6 }}>🎉</div>
            <div style={{ fontSize:15,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"white" }}>¡Ruta completada!</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:3 }}>{delivered.length} entregas · {problems.length > 0 ? `${problems.length} con problemas` : "todo entregado"}</div>
            {pendingRoutes.length > 0 && (
              <button onClick={()=>{setShowCompletedBanner(false);setTab("pending");}}
                style={{ marginTop:12,width:"100%",padding:"10px",borderRadius:10,border:"none",background:"rgba(245,158,11,0.15)",color:"#f59e0b",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Ver {pendingRoutes.length} ruta{pendingRoutes.length>1?"s":""} pendiente{pendingRoutes.length>1?"s":""}
              </button>
            )}
            <div style={{ marginTop:10,height:2,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden" }}>
              <div style={{ height:2,background:pendingRoutes.length>0?"#f59e0b":"white",borderRadius:2,width:"100%",animation:`countdown ${pendingRoutes.length>0?12:6}s linear forwards` }}/>
            </div>
          </div>
        )}
      </div>

      {/* ══ ROUTE PANEL — pantalla completa cuando tab=route ══ */}
      {tab === "route" && (
        <div
          ref={sheetRef}
          style={{
            flex:1,
            display:"flex",
            flexDirection:"column",
            overflow:"hidden",
            background:"#070d18",
          }}>



          {/* ── RUTA ACTIVA block ── */}
          {myRoute && (
            <div style={{ padding:"6px 10px 0", flexShrink:0 }}>
              <div style={{ background:"linear-gradient(135deg,rgba(14,30,60,0.85),rgba(10,20,45,0.85))", border:"1px solid rgba(59,130,246,0.18)", borderRadius:14, padding:"10px 13px", position:"relative", overflow:"hidden" }}>
                {/* Subtle glow */}
                <div style={{ position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(59,130,246,0.08)",filter:"blur(24px)",pointerEvents:"none" }}/>

                {/* Header row: label + ETA */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0, paddingRight:10 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"rgba(96,165,250,0.7)", letterSpacing:"1.5px", marginBottom:4, textTransform:"uppercase" }}>
                      RUTA ACTIVA
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:"#f8fafc", letterSpacing:"-0.5px", lineHeight:1.15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {myRoute.routeName || "Ruta del día"}
                    </div>
                  </div>
                  {estFinish() && (
                    <div style={{ background:"rgba(37,99,235,0.25)", border:"1px solid rgba(59,130,246,0.35)", borderRadius:12, padding:"6px 12px", textAlign:"center", flexShrink:0 }}>
                      <div style={{ fontSize:9, color:"rgba(96,165,250,0.7)", fontWeight:700, letterSpacing:"1px" }}>ETA</div>
                      <div style={{ fontSize:16, fontWeight:800, color:"#60a5fa", fontFamily:"'DM Mono',monospace", letterSpacing:"-0.5px" }}>{estFinish()}</div>
                    </div>
                  )}
                </div>

                {/* ── Segmented progress bar — un bloque por parada ── */}
                {stops.length > 0 && (
                  <div style={{ display:"flex", gap:2, marginBottom:12, height:6 }}>
                    {stops.filter(s=>s.stopNum!=null).sort((a,b)=>(a.stopNum||0)-(b.stopNum||0)).map((s,i) => {
                      const col = s.driverStatus==="delivered"?"#10b981":s.driverStatus==="problema"?"#ef4444":s.driverStatus==="en_ruta"?"#3b82f6":"rgba(255,255,255,0.1)";
                      const glow= s.driverStatus==="delivered"?"0 0 6px rgba(16,185,129,0.6)":s.driverStatus==="en_ruta"?"0 0 6px rgba(59,130,246,0.8)":"none";
                      return <div key={s.id} style={{ flex:1, height:"100%", borderRadius:3, background:col, boxShadow:glow, transition:"background .3s" }}/>;
                    })}
                  </div>
                )}

                {/* ── Stats row ── */}
                <div style={{ display:"flex", gap:0 }}>
                  {[
                    { val: delivered.length, label:"ENTREGADOS", color:"#10b981" },
                    { val: pending.length,   label:"PENDIENTES", color:"#3b82f6" },
                    { val: problems.length,  label:"PROBLEMAS",  color:problems.length>0?"#f59e0b":"rgba(255,255,255,0.2)" },
                    { val: routeKm>0 ? routeKm : stops.length, label: routeKm>0 ? "KM TOTALES" : "PARADAS", color:"rgba(255,255,255,0.5)" },
                  ].map(({val,label,color},i,arr) => (
                    <div key={label} style={{ flex:1, textAlign:"center", borderRight: i<arr.length-1?"1px solid rgba(255,255,255,0.06)":undefined, paddingRight: i<arr.length-1?0:undefined }}>
                      <div style={{ fontSize:22, fontWeight:800, color, lineHeight:1, fontFamily:"'DM Mono',monospace", letterSpacing:"-1px" }}>{val}</div>
                      <div style={{ fontSize:8, fontWeight:700, color:"rgba(255,255,255,0.25)", letterSpacing:"0.8px", marginTop:3 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PARADA ACTUAL card ── */}
          {currentStop && (
            <div style={{ padding:"8px 14px 0", flexShrink:0 }}>
              <div style={{
                background:"linear-gradient(135deg,rgba(10,22,50,0.95),rgba(8,18,40,0.95))",
                border:"1px solid rgba(59,130,246,0.3)",
                borderRadius:16,
                overflow:"hidden",
                boxShadow:"0 4px 20px rgba(59,130,246,0.12)",
              }}>
                {/* Accent top bar */}
                <div style={{ height:2, background:"linear-gradient(90deg,#1d4ed8,#3b82f6,#1d4ed8)", backgroundSize:"200% 100%", animation:"shimmer 2s linear infinite" }}/>

                <div style={{ padding:"12px 14px 14px" }}>
                  {/* Row 1: stop number + label + status badge */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div style={{
                      width:38, height:38, borderRadius:12,
                      background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, boxShadow:"0 4px 14px rgba(59,130,246,0.4)",
                    }}>
                      <span style={{ fontSize:15, fontWeight:900, color:"white", fontFamily:"'DM Mono',monospace" }}>{currentStop.stopNum||"?"}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"rgba(96,165,250,0.6)", letterSpacing:"1.2px", marginBottom:2 }}>PARADA ACTUAL</div>
                    </div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(59,130,246,0.15)", border:"1px solid rgba(59,130,246,0.3)", borderRadius:20, padding:"4px 10px", flexShrink:0 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:"#3b82f6", boxShadow:"0 0 6px #3b82f6", animation:"pulse 1.5s infinite" }}/>
                      <span style={{ fontSize:10, fontWeight:700, color:"#60a5fa" }}>En camino</span>
                    </div>
                  </div>

                  {/* Client name */}
                  <div style={{ fontSize:18, fontWeight:800, color:"#f8fafc", letterSpacing:"-0.4px", lineHeight:1.2, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {currentStop.client || `Parada ${currentStop.stopNum}`}
                  </div>

                  {/* Address */}
                  <div style={{ fontSize:11.5, color:"rgba(255,255,255,0.4)", lineHeight:1.45, marginBottom:10 }}>
                    {currentStop.displayAddr || currentStop.rawAddr || "Sin dirección"}
                    {currentStop.notes ? <span style={{ color:"rgba(255,255,255,0.25)" }}> · {currentStop.notes}</span> : null}
                  </div>

                  {/* ── Action buttons ── */}
                  <div style={{ display:"flex", gap:7 }}>
                    {/* Waze */}
                    <a href={`https://waze.com/ul?ll=${currentStop.lat},${currentStop.lng}&navigate=yes`}
                      target="_blank" rel="noreferrer"
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:11, background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", textDecoration:"none", boxShadow:"0 3px 12px rgba(59,130,246,0.3)", transition:"all .12s" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      <span style={{ fontSize:13, fontWeight:700, color:"white" }}>Waze</span>
                    </a>

                    {/* Entregado */}
                    <button className="rd-btn" onClick={()=>markDelivered(currentStop.id)}
                      style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#059669,#10b981)", cursor:"pointer", boxShadow:"0 4px 16px rgba(16,185,129,0.35)", transition:"all .12s" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize:13, fontWeight:700, color:"white" }}>Entregado</span>
                    </button>

                    {/* Problema */}
                    <button className="rd-btn" onClick={()=>setShowProb(currentStop.id)}
                      style={{ width:44, height:44, borderRadius:12, border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.1)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .12s" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PRÓXIMAS PARADAS header + filter chips ── */}
          {myRoute && (
            <div style={{ padding:"6px 12px 0", flexShrink:0, position:"sticky", top:0, background:"rgba(7,13,24,0.97)", backdropFilter:"blur(12px)", zIndex:10 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.3)", letterSpacing:"1.5px" }}>
                  {currentStop ? "PRÓXIMAS PARADAS" : "PARADAS"}
                </span>
                <div style={{ display:"flex", gap:5 }}>
                  {[
                    {id:"all",   label:"Todas"},
                    {id:"pending",label:"Pendientes"},
                    {id:"problema",label:"Problemas"},
                  ].map(chip=>(
                    <button key={chip.id} onClick={()=>setFilterMode(chip.id)} className="rd-btn"
                      style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${filterMode===chip.id?"#2563eb":"rgba(255,255,255,0.1)"}`, background:filterMode===chip.id?"rgba(37,99,235,0.25)":"transparent", color:filterMode===chip.id?"#93c5fd":"rgba(255,255,255,0.4)", fontSize:10, fontWeight:700, cursor:"pointer", transition:"all .15s" }}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search — scrollIntoView on focus so keyboard doesn't cover it */}
              <div style={{ position:"relative" }}>
                <svg style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar paradas..."
                  onFocus={()=>{
                    setTimeout(()=>{
                      searchInputRef.current?.scrollIntoView({behavior:"smooth",block:"start",inline:"nearest"});
                    }, 320);
                  }}
                  style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"9px 32px 9px 30px",color:"#f1f5f9",fontSize:13,outline:"none",caretColor:"#3b82f6" }}/>
                {search && <button onClick={()=>setSearch("")} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:15,lineHeight:1 }}>✕</button>}
              </div>
            </div>
          )}

          {/* ── Stops list — scrollable, compact ── */}
          <div ref={listScrollRef} style={{ flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:8,marginTop:4,WebkitOverflowScrolling:"touch" }}>

            {/* Empty state - no route */}
            {!myRoute && (
              <div style={{ textAlign:"center",padding:"60px 24px" }}>
                <div style={{ fontSize:44,marginBottom:14,opacity:0.3 }}>📭</div>
                <div style={{ fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.35)",marginBottom:6 }}>Sin ruta asignada</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.2)",lineHeight:1.6 }}>El admin te enviará la ruta del día</div>
              </div>
            )}

            {filteredStops.length===0 && myRoute && (
              <div style={{ textAlign:"center",padding:"32px 24px" }}>
                <div style={{ fontSize:28,marginBottom:8,opacity:0.3 }}>🔍</div>
                <div style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.3)" }}>Sin resultados</div>
              </div>
            )}

            {/* ── Stop list — premium redesign ── */}
            {filteredStops.map((stop,i) => {
              const isDone = stop.driverStatus==="delivered";
              const isProb = stop.driverStatus==="problema";
              const isEnR  = stop.driverStatus==="en_ruta";
              const isCur  = stop===currentStop;
              const isExp  = selStop?.id===stop.id;

              const dotColor = isDone?"#10b981":isProb?"#ef4444":isCur||isEnR?"#3b82f6":"#374151";
              const statusLabel= isDone?"ENTREGADO":isProb?"PROBLEMA":isEnR?"EN CAMINO":"PENDIENTE";
              const statusColor= isDone?"#10b981":isProb?"#ef4444":isEnR?"#60a5fa":"rgba(255,255,255,0.3)";
              const statusBg   = isDone?"rgba(16,185,129,0.1)":isProb?"rgba(239,68,68,0.1)":isEnR?"rgba(59,130,246,0.1)":"transparent";

              // Distancia desde DEPOT (estimada por stopNum)
              const distKm = stop.stopNum ? (stop.stopNum * 0.6).toFixed(1) : null;

              return (
                <div key={stop.id} style={{
                  margin:"6px 10px",
                  borderRadius:16,
                  background: isExp
                    ? "rgba(30,50,90,0.55)"
                    : isCur
                    ? "rgba(20,35,70,0.45)"
                    : isDone
                    ? "rgba(10,20,14,0.5)"
                    : isProb
                    ? "rgba(30,10,10,0.5)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isExp ? "rgba(59,130,246,0.35)"
                    : isCur ? "rgba(59,130,246,0.2)"
                    : isDone ? "rgba(16,185,129,0.15)"
                    : isProb ? "rgba(239,68,68,0.18)"
                    : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isCur ? "0 4px 20px rgba(59,130,246,0.12)" : isExp ? "0 6px 24px rgba(0,0,0,0.4)" : "none",
                  transition:"all .18s cubic-bezier(.4,0,.2,1)",
                  animation:`slideInRow .22s ${Math.min(i,8)*18}ms ease both`,
                  overflow:"hidden",
                }}>

                  {/* Accent line top — solo parada activa */}
                  {isCur && !isDone && !isProb && (
                    <div style={{ height:2, background:"linear-gradient(90deg,#3b82f6,#60a5fa,transparent)", borderRadius:"2px 2px 0 0" }}/>
                  )}

                  {/* ── ROW principal ── */}
                  <div onClick={()=>{ setSelStop(isExp?null:stop); if(!isExp&&gMapRef.current&&stop.lat&&stop.lng){gMapRef.current.panTo({lat:stop.lat,lng:stop.lng});gMapRef.current.setZoom(16);} }}
                    style={{ display:"flex", alignItems:"center", padding:"11px 13px", cursor:"pointer", gap:12 }}>

                    {/* Badge número — cuadrado redondeado */}
                    <div style={{
                      width:38, height:38, borderRadius:12, flexShrink:0,
                      background: isDone
                        ? "rgba(16,185,129,0.14)"
                        : isProb
                        ? "rgba(239,68,68,0.14)"
                        : isCur
                        ? "linear-gradient(135deg,rgba(29,78,216,0.9),rgba(59,130,246,0.9))"
                        : "rgba(255,255,255,0.06)",
                      border:`1.5px solid ${
                        isDone?"rgba(16,185,129,0.35)"
                        :isProb?"rgba(239,68,68,0.35)"
                        :isCur?"rgba(93,161,255,0.6)"
                        :"rgba(255,255,255,0.1)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow: isCur ? "0 2px 12px rgba(59,130,246,0.35)" : isDone ? "0 0 10px rgba(16,185,129,0.15)" : "none",
                      position:"relative",
                    }}>
                      {isDone ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : isProb ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      ) : (
                        <span style={{ fontSize: String(stop.stopNum||"?").length > 2 ? 9 : 12, fontWeight:900, color:isCur?"white":"rgba(255,255,255,0.55)", fontFamily:"'DM Mono',monospace", letterSpacing:"-0.5px" }}>
                          {stop.stopNum||"?"}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Nombre cliente */}
                      <div style={{ fontSize:13.5, fontWeight:700, color: isDone?"rgba(255,255,255,0.35)":isCur?"#ffffff":"rgba(255,255,255,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-0.2px", lineHeight:1.2 }}>
                        {stop.client||`Parada ${stop.stopNum}`}
                      </div>
                      {/* Dirección */}
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:3, lineHeight:1 }}>
                        {stop.displayAddr||stop.rawAddr||"Sin dirección"}
                      </div>
                      {/* Hora entrega */}
                      {isDone && stop.deliveredAt && (
                        <div style={{ fontSize:10, color:"#10b981", marginTop:4, fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:4 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          {stop.deliveredAt}
                        </div>
                      )}
                    </div>

                    {/* Right: status badge + chevron */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                      <div style={{ background:statusBg, borderRadius:20, padding:"3px 9px", border:`1px solid ${statusColor}30` }}>
                        <span style={{ fontSize:9, fontWeight:800, color:statusColor, letterSpacing:"0.8px" }}>{statusLabel}</span>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"
                        style={{ transform:isExp?"rotate(180deg)":"rotate(0deg)", transition:"transform .22s cubic-bezier(.4,0,.2,1)" }}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* ── PANEL EXPANDIDO ── */}
                  {isExp && (
                    <div style={{ borderTop:`1px solid ${dotColor}20`, animation:"ceUp .18s ease" }}>
                      {/* Accent bar */}
                      <div style={{ height:1, background:`linear-gradient(90deg,${dotColor}55,transparent)` }}/>

                      <div style={{ padding:"14px 13px 13px" }}>

                        {/* SP Code */}
                        {stop.tracking && (
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.14)", borderRadius:10, padding:"8px 11px" }}>
                            <span style={{ fontSize:9, fontWeight:800, color:"rgba(96,165,250,0.6)", letterSpacing:"1.5px", flexShrink:0 }}>SP</span>
                            <span style={{ fontSize:12, fontFamily:"'DM Mono',monospace", color:"#93c5fd", letterSpacing:"0.5px", fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis" }}>{stop.tracking}</span>
                            <button
                              onClick={e=>{e.stopPropagation();navigator.clipboard?.writeText(stop.tracking).catch(()=>{});}}
                              style={{ padding:"3px 9px", borderRadius:7, border:"1px solid rgba(96,165,250,0.2)", background:"rgba(59,130,246,0.1)", color:"#60a5fa", fontSize:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:700, flexShrink:0 }}>
                              Copiar
                            </button>
                          </div>
                        )}

                        {/* Phone */}
                        {stop.phone && (
                          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
                            <div style={{ width:28, height:28, borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.91 10.5a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.9 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            </div>
                            <a href={`tel:${stop.phone.replace(/\D/g,"")}`} onClick={e=>e.stopPropagation()}
                              style={{ fontSize:14, color:"#f1f5f9", fontFamily:"'DM Mono',monospace", letterSpacing:"0.4px", textDecoration:"none", fontWeight:600 }}>
                              {stop.phone}
                            </a>
                          </div>
                        )}

                        {/* Address */}
                        <div style={{ display:"flex", alignItems:"flex-start", gap:9, marginBottom:14 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                          <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.5, paddingTop:4 }}>{stop.displayAddr||stop.rawAddr||"Sin dirección"}</span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display:"flex", gap:8 }}>
                          {/* WhatsApp */}
                          {stop.phone && (
                            <button onClick={e=>{e.stopPropagation();window.open(`https://wa.me/1${stop.phone.replace(/\D/g,"")}`,"_blank");}}
                              style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:12, border:"1px solid rgba(37,211,102,0.25)", background:"rgba(37,211,102,0.08)", color:"#22c55e", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .12s" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.9"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.122 1.528 5.853L0 24l6.293-1.507A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.587-.504-5.083-1.382l-.363-.218-3.737.895.945-3.629-.237-.375A9.965 9.965 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                              WhatsApp
                            </button>
                          )}
                          {/* Llamar */}
                          {stop.phone && (
                            <a href={`tel:${stop.phone.replace(/\D/g,"")}`} onClick={e=>e.stopPropagation()}
                              style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.65)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", textDecoration:"none", transition:"all .12s" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.91 10.5a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.9 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              Llamar
                            </a>
                          )}
                          {/* Waze */}
                          {stop.lat && stop.lng && (
                            <a href={`https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                              style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px 0", borderRadius:12, border:"1px solid rgba(59,130,246,0.2)", background:"rgba(59,130,246,0.07)", color:"#60a5fa", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", textDecoration:"none", transition:"all .12s" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                              Waze
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ CHAT TAB ══ */}
      {false && (
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#060c14" }}>
          <div style={{ padding:"13px 16px",borderBottom:"1px solid #0d1a26",display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"#0f1e30",border:"1px solid #1a2d40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#60a5fa",fontWeight:800 }}>AD</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#f1f5f9" }}>Admin Rap Drive</div>
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:1 }}>
                <div style={{ width:5,height:5,borderRadius:"50%",background:"#22c55e",animation:"pulse 2s infinite" }}/>
                <span style={{ fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:500 }}>EN LÍNEA</span>
              </div>
            </div>
          </div>
          <div style={{ flex:1,overflow:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:8 }}>
            {chatLog.length===0 && (
              <div style={{ textAlign:"center",padding:"40px 0" }}>
                <div style={{ fontSize:28,marginBottom:8,opacity:0.3 }}>💬</div>
                <div style={{ fontSize:13,color:"rgba(255,255,255,0.25)",fontWeight:500 }}>Sin mensajes aún</div>
              </div>
            )}
            {chatLog.map((msg,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:msg.from==="driver"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"78%",background:msg.from==="driver"?"white":"#0f1e30",borderRadius:msg.from==="driver"?"16px 4px 16px 16px":"4px 16px 16px 16px",padding:"10px 13px",border:msg.from==="driver"?"none":"1px solid #1a2d40" }}>
                  <div style={{ fontSize:13,color:msg.from==="driver"?"#111":"rgba(255,255,255,0.8)",lineHeight:1.5 }}>{msg.text}</div>
                  <div style={{ fontSize:10,color:msg.from==="driver"?"rgba(0,0,0,0.35)":"rgba(255,255,255,0.2)",marginTop:4,textAlign:msg.from==="driver"?"right":"left",fontFamily:"'DM Mono',monospace" }}>{msg.time}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          <div style={{ padding:"10px 14px 16px",borderTop:"1px solid #0d1a26",display:"flex",gap:8,flexShrink:0 }}>
            <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()}
              placeholder="Mensaje al administrador..."
              style={{ flex:1,background:"#0a1420",border:"1px solid #1a2d40",borderRadius:12,padding:"10px 13px",color:"#f1f5f9",fontSize:13,outline:"none",caretColor:"#3b82f6" }}/>
            <button className="rd-btn" onClick={sendChat} disabled={!chatMsg.trim()}
              style={{ width:42,height:42,borderRadius:12,border:"none",background:chatMsg.trim()?"#2563eb":"#0a1420",color:chatMsg.trim()?"white":"rgba(255,255,255,0.2)",cursor:chatMsg.trim()?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s",border:"1px solid #1a2d40" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ══ TAB: RUTAS PENDIENTES ══ */}
      {tab === "pending" && (
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#060c14",paddingBottom:60 }}>
          {/* Header */}
          <div style={{ padding:"13px 16px",borderBottom:"1px solid #0d1a26",display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
            <button onClick={()=>setTab("route")} style={{ width:32,height:32,borderRadius:10,border:"1px solid #1a2d40",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#f1f5f9" }}>Rutas pendientes</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)" }}>
                {pendingRoutes.length === 0 ? "Sin rutas en cola" : `${pendingRoutes.length} ruta${pendingRoutes.length>1?"s":""} esperando`}
              </div>
            </div>
            {pendingRoutes.length > 0 && (
              <div style={{ padding:"3px 10px",borderRadius:20,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",fontSize:11,color:"#f59e0b",fontWeight:700 }}>
                {pendingRoutes.length} en cola
              </div>
            )}
          </div>

          {/* Info banner */}
          <div style={{ margin:"12px 14px 0",padding:"10px 13px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:12,display:"flex",gap:9,alignItems:"flex-start" }}>
            <span style={{ fontSize:16,flexShrink:0,marginTop:1 }}>ℹ️</span>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.55)",fontFamily:"'DM Sans',sans-serif",lineHeight:1.5 }}>
              Estas rutas fueron enviadas mientras tenías trabajo activo. <strong style={{color:"rgba(255,255,255,0.85)"}}>Termina tu ruta actual</strong> y luego activa la siguiente desde aquí.
            </div>
          </div>

          {/* Lista de rutas pendientes */}
          <div style={{ flex:1,overflow:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10 }}>
            {pendingRoutes.length === 0 ? (
              <div style={{ textAlign:"center",padding:"48px 0" }}>
                <div style={{ fontSize:36,marginBottom:12,opacity:0.3 }}>📋</div>
                <div style={{ fontSize:14,color:"rgba(255,255,255,0.3)",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>Sin rutas pendientes</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.15)",marginTop:6,fontFamily:"'DM Sans',sans-serif" }}>El admin enviará rutas aquí cuando tengas trabajo activo</div>
              </div>
            ) : pendingRoutes.map((route, idx) => {
              const stopsCount = route.stops?.length || 0;
              const sent = route.sentAt ? new Date(route.sentAt).toLocaleString("es-DO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
              const isFirst = idx === 0;
              const hasActiveWork = stops.some(s => s.driverStatus === "pending" || s.driverStatus === "en_ruta");
              return (
                <div key={route.routeId||route.sentAt||idx}
                  style={{ background:"#161616",border:`1.5px solid ${isFirst?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:16,padding:"14px",animation:"fadeUp .25s ease both" }}>
                  {/* Badge posición en cola */}
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                    <div style={{ width:22,height:22,borderRadius:6,background:isFirst?"rgba(245,158,11,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${isFirst?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:isFirst?"#f59e0b":"rgba(255,255,255,0.3)",fontFamily:"'DM Sans',sans-serif" }}>
                      {idx+1}
                    </div>
                    <span style={{ fontSize:11,color:isFirst?"#f59e0b":"rgba(255,255,255,0.3)",fontFamily:"'DM Sans',sans-serif",fontWeight:600 }}>
                      {isFirst ? "⚡ PRÓXIMA EN ACTIVAR" : `Cola #${idx+1}`}
                    </span>
                    <div style={{ marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"'DM Mono',monospace" }}>{sent}</div>
                  </div>

                  {/* Nombre de ruta */}
                  <div style={{ fontSize:15,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"rgba(255,255,255,0.9)",marginBottom:4 }}>
                    {route.routeName || "Ruta sin nombre"}
                  </div>

                  {/* Detalles */}
                  <div style={{ display:"flex",gap:12,marginBottom:12 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"rgba(255,255,255,0.4)",fontFamily:"'DM Sans',sans-serif" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {stopsCount} paradas
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"rgba(255,255,255,0.4)",fontFamily:"'DM Sans',sans-serif" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><polyline points="12 8 12 12 14 14"/></svg>
                      {route.km || "—"} km
                    </div>
                  </div>

                  {/* Preview de primeras paradas */}
                  {stopsCount > 0 && (
                    <div style={{ background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 10px",marginBottom:12,display:"flex",flexDirection:"column",gap:4 }}>
                      {(route.stops||[]).slice(0,3).map((s,si) => (
                        <div key={si} style={{ display:"flex",gap:8,alignItems:"center" }}>
                          <div style={{ width:18,height:18,borderRadius:5,background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,flexShrink:0 }}>{s.stopNum||si+1}</div>
                          <span style={{ fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"'DM Sans',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{s.client||"Cliente"} · {s.displayAddr||s.rawAddr||"—"}</span>
                        </div>
                      ))}
                      {stopsCount > 3 && (
                        <div style={{ fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"'DM Sans',sans-serif",paddingLeft:26 }}>+{stopsCount-3} paradas más</div>
                      )}
                    </div>
                  )}

                  {/* Botón activar */}
                  <button
                    disabled={hasActiveWork && isFirst}
                    onClick={() => {
                      if (hasActiveWork) return;
                      // Marcar como vista para siempre — Firebase no la reinyectará
                      const routeKey = route.routeId || route.sentAt;
                      seenRouteIds.current.add(routeKey);
                      if (route.sentAt) seenRouteIds.current.add(route.sentAt);
                      try { localStorage.setItem(`rdSeen_${myKey}`, JSON.stringify([...seenRouteIds.current])); } catch(e) {}

                      // Eliminar de la cola local (UI y localStorage)
                      const currentQueue = window.__rdPendingRoutes?.[myKey] || [];
                      const newQueue = currentQueue.filter(r =>
                        route.routeId ? r.routeId !== route.routeId : r.sentAt !== route.sentAt
                      );
                      if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
                      window.__rdPendingRoutes[myKey] = newQueue;
                      try { localStorage.setItem(`rdQueue_${myKey}`, JSON.stringify(newQueue)); } catch(e) {}
                      setPendingRoutes(newQueue.filter(r => r.queueStatus === "pending"));
                      // Marcar como "active" en Firebase (NO borrar — así el admin no la reencola)
                      markDoneInFirebase(route.routeId, route.sentAt);

                      // Activar como ruta actual
                      lastSentAt.current = route.sentAt;
                      const newStops = (route.stops||[]).map(s=>({...s, driverStatus: s.driverStatus||"pending"}));
                      const activeRoute = { ...route, stops: newStops };
                      setStops(newStops);
                      if (!window.__rdRouteStore) window.__rdRouteStore = {};
                      window.__rdRouteStore[myKey] = activeRoute;
                      _memStore.routes[myKey] = activeRoute;
                      LS.setRoute(myKey, activeRoute);
                      onUpdateRoute(myKey, activeRoute);
                      try { localStorage.setItem(`rdRoute_${myKey}`, JSON.stringify(activeRoute)); } catch(e) {}
                      addChatMsg(`🚀 Ruta "${route.routeName}" activada · ${stopsCount} paradas`);
                      setTab("route");
                      setFilterMode("all");
                    }}
                    style={{
                      width:"100%",padding:"12px",borderRadius:12,border:"none",
                      background: hasActiveWork && isFirst
                        ? "rgba(255,255,255,0.04)"
                        : isFirst
                          ? "white"
                          : "rgba(255,255,255,0.06)",
                      color: hasActiveWork && isFirst
                        ? "rgba(255,255,255,0.2)"
                        : isFirst ? "black" : "rgba(255,255,255,0.5)",
                      fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:700,
                      cursor: hasActiveWork && isFirst ? "not-allowed" : "pointer",
                      transition:"all .15s",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:7
                    }}>
                    {hasActiveWork && isFirst ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Termina la ruta actual primero
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        {isFirst ? "Activar esta ruta" : "Activar (saltar cola)"}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TAB: HISTORIAL ══ */}
      {tab === "history" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#060c14", paddingBottom:60 }}>
          <div style={{ padding:"13px 16px", borderBottom:"1px solid #0d1a26", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <button onClick={()=>setTab("route")} style={{ width:32,height:32,borderRadius:10,border:"1px solid #1a2d40",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>Mi historial</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{routeHistory.length} ruta{routeHistory.length!==1?"s":""} completada{routeHistory.length!==1?"s":""}</div>
            </div>
          </div>

          {histSelRoute ? (
            /* Detail view of a past route */
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <button onClick={()=>setHistSelRoute(null)} style={{ width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"white", fontFamily:"'DM Sans',sans-serif" }}>{histSelRoute.routeName||"Ruta"}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>
                    {histSelRoute.completedAt ? new Date(histSelRoute.completedAt).toLocaleDateString("es-DO",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                  </div>
                </div>
                {/* Stats */}
                {(() => {
                  const stops = histSelRoute.stops||[];
                  const del = stops.filter(s=>s.driverStatus==="delivered").length;
                  const prob = stops.filter(s=>s.driverStatus==="problema").length;
                  return (
                    <div style={{ display:"flex", gap:7 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#10b981", fontFamily:"'DM Sans',sans-serif" }}>✓ {del}</div>
                      {prob>0 && <div style={{ fontSize:11, fontWeight:700, color:"#ef4444", fontFamily:"'DM Sans',sans-serif" }}>⚠ {prob}</div>}
                    </div>
                  );
                })()}
              </div>
              <div style={{ flex:1, overflow:"auto" }}>
                {(histSelRoute.stops||[]).sort((a,b)=>(a.stopNum||99)-(b.stopNum||99)).map((stop, i, arr) => {
                  const isDone = stop.driverStatus === "delivered";
                  const isProb = stop.driverStatus === "problema";
                  const statusColor = isDone ? "#10b981" : isProb ? "#ef4444" : "#f59e0b";
                  const statusLabel = isDone ? "Entregado" : isProb ? "Problema" : "Pendiente";
                  const statusIcon  = isDone ? "✓" : isProb ? "✕" : "○";
                  return (
                    <div key={i} style={{ margin:"10px 14px", borderRadius:14, background:"#0a1420", border:`1px solid ${statusColor}22`, overflow:"hidden" }}>
                      {/* Status bar top */}
                      <div style={{ background:`${statusColor}12`, borderBottom:`1px solid ${statusColor}20`, padding:"7px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ width:20, height:20, borderRadius:"50%", background:`${statusColor}20`, border:`1.5px solid ${statusColor}50`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:statusColor, fontFamily:"'DM Sans',sans-serif" }}>
                            {statusIcon}
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:statusColor, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.3px" }}>{statusLabel}</span>
                          {stop.deliveredAt && <span style={{ fontSize:10, color:`${statusColor}80`, fontFamily:"'DM Mono',monospace" }}>· {stop.deliveredAt}</span>}
                        </div>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>#{stop.stopNum||i+1}</span>
                      </div>

                      {/* Main content */}
                      <div style={{ padding:"12px 14px" }}>
                        {/* Cliente - protagonista */}
                        <div style={{ fontSize:15, fontWeight:700, color:"white", fontFamily:"'DM Sans',sans-serif", letterSpacing:"-0.2px", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {stop.client || "—"}
                        </div>

                        {/* Línea divisora sutil */}
                        <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"8px 0" }}/>

                        {/* Dirección */}
                        <div style={{ display:"flex", alignItems:"flex-start", gap:7, marginBottom:6 }}>
                          <svg style={{flexShrink:0,marginTop:2}} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontFamily:"'DM Sans',sans-serif", lineHeight:1.4 }}>
                            {stop.displayAddr || stop.rawAddr || "Sin dirección"}
                          </span>
                        </div>

                        {/* Teléfono */}
                        {stop.phone && (
                          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                            <svg style={{flexShrink:0}} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.4 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.77-.77a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/></svg>
                            <span style={{ fontSize:12, color:"rgba(59,130,246,0.75)", fontFamily:"'DM Mono',monospace", fontWeight:500 }}>{stop.phone}</span>
                          </div>
                        )}

                        {/* Tracking */}
                        {stop.tracking && (
                          <div style={{ display:"inline-flex", alignItems:"center", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"2px 9px", marginTop:2 }}>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"'DM Mono',monospace", letterSpacing:"0.3px" }}>{stop.tracking}</span>
                          </div>
                        )}

                        {/* Notas */}
                        {stop.notes && (
                          <div style={{ marginTop:8, padding:"7px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8, border:"1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontFamily:"'DM Sans',sans-serif", fontStyle:"italic" }}>{stop.notes}</span>
                          </div>
                        )}

                        {/* Problema reportado */}
                        {isProb && stop.issue && (
                          <div style={{ marginTop:8, padding:"7px 10px", background:"rgba(239,68,68,0.06)", borderRadius:8, border:"1px solid rgba(239,68,68,0.15)" }}>
                            <span style={{ fontSize:11, color:"rgba(239,68,68,0.7)", fontFamily:"'DM Sans',sans-serif" }}>⚠ {stop.issue}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ height:20 }}/>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, overflow:"auto" }}>
              {routeHistory.length === 0 ? (
                <div style={{ padding:"52px 20px", textAlign:"center" }}>
                  <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>📋</div>
                  <div style={{ fontSize:14, color:"rgba(255,255,255,0.25)", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Sin historial aún</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.15)", marginTop:6 }}>Tus rutas completadas aparecerán aquí</div>
                </div>
              ) : routeHistory.map((r, i) => {
                const stops = r.stops||[];
                const del  = stops.filter(s=>s.driverStatus==="delivered").length;
                const prob = stops.filter(s=>s.driverStatus==="problema").length;
                const pct  = stops.length ? Math.round(del/stops.length*100) : 0;
                const dateStr = r.completedAt ? new Date(r.completedAt).toLocaleDateString("es-DO",{weekday:"long",day:"2-digit",month:"short"}) : "—";
                const timeStr = r.completedAt ? new Date(r.completedAt).toLocaleTimeString("es-DO",{hour:"2-digit",minute:"2-digit"}) : "";
                return (
                  <div key={r.histId||i} onClick={()=>setHistSelRoute(r)}
                    style={{ margin:"10px 14px", borderRadius:14, background:"#0a1420", border:"1px solid #1a2d40", overflow:"hidden", cursor:"pointer", transition:"border-color .15s", animation:`fadeUp .2s ${i*30}ms ease both` }}>
                    {/* Top strip */}
                    <div style={{ background:"rgba(255,255,255,0.02)", borderBottom:"1px solid #0d1a26", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", letterSpacing:"-0.2px" }}>{r.routeName||"Ruta sin nombre"}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:2, textTransform:"capitalize" }}>{dateStr}{timeStr ? " · "+timeStr : ""}</div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                    {/* Stats */}
                    <div style={{ padding:"12px 14px" }}>
                      {/* Progress bar */}
                      <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:4, marginBottom:10, overflow:"hidden" }}>
                        <div style={{ height:4, background:pct===100?"#10b981":"#3b82f6", borderRadius:4, width:`${pct}%`, transition:"width 1s" }}/>
                      </div>
                      {/* Numbers */}
                      <div style={{ display:"flex", gap:0 }}>
                        <div style={{ flex:1, textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.06)", paddingRight:8 }}>
                          <div style={{ fontSize:20, fontWeight:800, color:"#10b981", fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{del}</div>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:3, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.5px" }}>ENTREGADOS</div>
                        </div>
                        {prob > 0 && (
                          <div style={{ flex:1, textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.06)", padding:"0 8px" }}>
                            <div style={{ fontSize:20, fontWeight:800, color:"#ef4444", fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{prob}</div>
                            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:3, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.5px" }}>PROBLEMAS</div>
                          </div>
                        )}
                        <div style={{ flex:1, textAlign:"center", paddingLeft:8 }}>
                          <div style={{ fontSize:20, fontWeight:800, color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{stops.length}</div>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:3, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.5px" }}>TOTAL</div>
                        </div>
                        <div style={{ flex:1, textAlign:"center", borderLeft:"1px solid rgba(255,255,255,0.06)", paddingLeft:8 }}>
                          <div style={{ fontSize:20, fontWeight:800, color:pct===100?"#10b981":"#3b82f6", fontFamily:"'DM Sans',sans-serif", lineHeight:1 }}>{pct}%</div>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:3, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.5px" }}>ÉXITO</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* ══ DRAWER LATERAL ══ */}
        {menuOpen && (
          <div onClick={()=>setMenuOpen(false)}
            style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}>
            <div onClick={e=>e.stopPropagation()}
              style={{ position:"absolute", top:0, left:0, width:300, height:"100%", display:"flex", flexDirection:"column", overflow:"hidden", animation:"slideLeft .22s cubic-bezier(.4,0,.2,1)" }}>

              {/* ── Glass background layer ── */}
              <div style={{ position:"absolute", inset:0, background:"rgba(8,11,18,0.97)", backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)", borderRight:"1px solid rgba(255,255,255,0.07)" }}/>
              {/* Ambient top gradient */}
              <div style={{ position:"absolute", top:0, left:0, right:0, height:200, background:"linear-gradient(180deg,rgba(29,78,216,0.12) 0%,transparent 100%)", pointerEvents:"none", zIndex:0 }}/>
              {/* Subtle grid texture */}
              <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize:"28px 28px", pointerEvents:"none", zIndex:0 }}/>

              {/* ── Contenido sobre la capa glass ── */}
              <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", height:"100%" }}>

                {/* ── PERFIL HERO ── */}
                <div style={{ padding:"52px 22px 22px", position:"relative", overflow:"hidden" }}>
                  {/* Glow detrás del avatar */}
                  <div style={{ position:"absolute", top:20, left:10, width:120, height:120, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%)", pointerEvents:"none" }}/>

                  {/* Avatar grande con foto */}
                  <div style={{ position:"relative", display:"inline-block", marginBottom:14 }}>
                    <div style={{
                      width:72, height:72, borderRadius:22, overflow:"hidden",
                      background:"linear-gradient(135deg,#1e3a6e 0%,#1d4ed8 50%,#3b82f6 100%)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:26, fontWeight:900, color:"white", letterSpacing:"-1px",
                      boxShadow:"0 8px 32px rgba(59,130,246,0.45), 0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.2)",
                      cursor:"pointer", position:"relative",
                    }} onClick={()=>{ photoInputRef.current?.click(); }}>
                      {profilePhoto
                        ? <img src={profilePhoto} alt="perfil" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : (driver.avatar||(driver.name||"").slice(0,2)).toUpperCase()
                      }
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:22 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </div>
                    </div>
                    <div style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:locationStatus==="active"?"#22c55e":"#374151", border:"3px solid #080b12", boxShadow:locationStatus==="active"?"0 0 10px #22c55e70":"none" }}/>
                  </div>

                  {/* Nombre */}
                  <div style={{ fontSize:19, fontWeight:900, color:"white", letterSpacing:"-0.5px", lineHeight:1.1, marginBottom:4 }}>
                    {(driver.name||"Mensajero").toUpperCase()}
                  </div>
                  {/* Email */}
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.28)", fontFamily:"'DM Mono',monospace", marginBottom:14, letterSpacing:"0.2px" }}>
                    {driver.email||"mensajero@rapdrive.do"}
                  </div>

                  {/* Status pill */}
                  <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.22)", borderRadius:100, padding:"5px 13px" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px #22c55e", animation:"pulse 2s infinite" }}/>
                    <span style={{ fontSize:10, color:"#22c55e", fontWeight:700, letterSpacing:"0.8px" }}>EN LÍNEA</span>
                  </div>
                </div>

                {/* ── Stats resumen ── */}
                {stops.length > 0 && (
                  <div style={{ margin:"0 16px 16px", display:"flex", gap:8 }}>
                    {[
                      { val:pending.length,   label:"Pendientes", color:"#f59e0b", bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.2)"  },
                      { val:delivered.length, label:"Entregadas",  color:"#10b981", bg:"rgba(16,185,129,0.1)", border:"rgba(16,185,129,0.2)"  },
                      { val:problems.length,  label:"Problemas",   color:"#ef4444", bg:"rgba(239,68,68,0.1)",  border:"rgba(239,68,68,0.2)"   },
                    ].map(({val,label,color,bg,border}) => (
                      <div key={label} style={{ flex:1, background:bg, border:`1px solid ${border}`, borderRadius:14, padding:"10px 6px", textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:900, color, lineHeight:1, fontFamily:"'DM Mono',monospace" }}>{val}</div>
                        <div style={{ fontSize:8.5, color:"rgba(255,255,255,0.35)", marginTop:4, fontWeight:700, letterSpacing:"0.5px" }}>{label.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Separador */}
                <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 30%,rgba(255,255,255,0.06) 70%,transparent)", margin:"0 16px 10px" }}/>

                {/* ── Navegación ── */}
                <div style={{ flex:1, overflowY:"auto", padding:"4px 12px" }}>
                  {[
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
                      label:"Mi ruta de hoy", sub:`${stops.filter(s=>s.stopNum).length} paradas`, badge:pending.length, badgeColor:"#3b82f6",
                      active:tab==="route", action:()=>{setTab("route");setMenuOpen(false);} },
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
                      label:"Ver mapa", sub:"Ruta en tiempo real", badge:0, badgeColor:"#3b82f6",
                      active:tab==="mapa", action:()=>{setTab("mapa");setMenuOpen(false);} },
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,
                      label:"Completadas", sub:`${delivered.length} entregadas`, badge:0, badgeColor:"#10b981",
                      active:false, action:()=>{setFilterMode("delivered");setTab("route");setMenuOpen(false);} },
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                      label:"Problemas", sub:`${problems.length} reportados`, badge:problems.length, badgeColor:"#ef4444",
                      active:false, action:()=>{setFilterMode("problema");setTab("route");setMenuOpen(false);} },
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                      label:"En cola", sub:`${pendingRoutes.length} rutas esperando`, badge:pendingRoutes.length, badgeColor:"#f59e0b",
                      active:tab==="pending", action:()=>{setTab("pending");setMenuOpen(false);} },
                    { icon:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                      label:"Mi historial", sub:"Entregas anteriores", badge:0, badgeColor:"#8b5cf6",
                      active:tab==="history", action:()=>{setTab("history");setMenuOpen(false);} },
                  ].map((item,i) => (
                    <button key={i} onClick={item.action} className="rd-menu-item"
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:14, border:"none", background:item.active?"rgba(59,130,246,0.12)":"transparent", cursor:"pointer", width:"100%", textAlign:"left", transition:"background .12s", animation:`fadeUp .16s ${i*20}ms ease both`, marginBottom:2, position:"relative", overflow:"hidden" }}>
                      {/* Active indicator */}
                      {item.active && <div style={{ position:"absolute", left:0, top:8, bottom:8, width:3, borderRadius:"0 3px 3px 0", background:"#3b82f6" }}/>}
                      {/* Icon box */}
                      <div style={{ width:38, height:38, borderRadius:11, background:item.active?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${item.active?"rgba(59,130,246,0.35)":"rgba(255,255,255,0.07)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:item.active?"#60a5fa":"rgba(255,255,255,0.4)", transition:"all .15s" }}>
                        {item.icon}
                      </div>
                      {/* Text */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:item.active?700:500, color:item.active?"#f1f5f9":"rgba(255,255,255,0.65)", letterSpacing:"-0.1px", lineHeight:1.2 }}>{item.label}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:1 }}>{item.sub}</div>
                      </div>
                      {/* Badge */}
                      {item.badge > 0 && (
                        <div style={{ minWidth:20, height:20, borderRadius:10, background:item.badgeColor, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 6px", fontSize:10, fontWeight:800, color:"white", flexShrink:0, boxShadow:`0 2px 8px ${item.badgeColor}60` }}>
                          {item.badge > 99 ? "99+" : item.badge}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Separador */}
                <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.05) 30%,rgba(255,255,255,0.05) 70%,transparent)", margin:"8px 16px" }}/>

                {/* ── Footer ── */}
                <div style={{ padding:"10px 14px 48px" }}>
                  {/* Version */}
                  <div style={{ textAlign:"center", marginBottom:10 }}>
                    <span style={{ fontSize:10, color:"rgba(255,255,255,0.1)", fontFamily:"'DM Mono',monospace", letterSpacing:"1px" }}>RAP DRIVE v2.0</span>
                  </div>
                  {/* Logout */}
                  <button onClick={()=>{setMenuOpen(false);setLogoutConf(true);}} className="rd-btn"
                    style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:9, padding:"13px", borderRadius:13, border:"1px solid rgba(239,68,68,0.18)", background:"rgba(239,68,68,0.07)", color:"rgba(239,68,68,0.75)", cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", fontWeight:700, transition:"all .15s" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Cerrar sesión
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      {/* ══ BOTTOM NAV ══ */}
      <div style={{ flexShrink:0,background:"#060c14",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",zIndex:200,boxShadow:"0 -1px 0 rgba(255,255,255,0.04)" }}>
        {[
          { id:"route", label:"Ruta",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },

          { id:"mapa", label:"Mapa",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
          { id:"pending", label:"En cola",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            badge:pendingRoutes.length },
          { id:"history", label:"Historial",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)} className="rd-btn"
            style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:"10px 0 16px",border:"none",background:tab===item.id?"rgba(59,130,246,0.08)":"transparent",color:tab===item.id?"#3b82f6":"rgba(255,255,255,0.35)",cursor:"pointer",position:"relative",transition:"all .15s" }}>
            {item.badge>0 && tab!==item.id && (
              <div style={{ position:"absolute",top:8,right:"calc(50% - 14px)",minWidth:16,height:16,borderRadius:"50%",background:"#3b82f6",border:"2px solid #080f18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"white",fontWeight:800,padding:"0 3px" }}>{item.badge>9?"9+":item.badge}</div>
            )}
            {item.icon}
            <span style={{ fontSize:10,fontWeight:tab===item.id?700:500,letterSpacing:"0.2px" }}>{item.label}</span>
            {tab===item.id && <div style={{ position:"absolute",top:0,left:"25%",right:"25%",height:2,background:"#3b82f6",borderRadius:"0 0 3px 3px" }}/>}
          </button>
        ))}
      </div>

      {/* -- Reportar problema modal -- */}
      {/* ── Cámara de evidencia obligatoria ─────────────────────────────── */}
      {evidenceFlow && (() => {
        const flowStop = stops.find(s => s.id === evidenceFlow.stopId);
        if (!flowStop) return null;
        return (
          <EvidenceCameraModal
            stop={flowStop}
            mode={evidenceFlow.mode}
            onConfirm={(photoDataUrl) => {
              saveEvidenceAndSync(evidenceFlow.stopId, evidenceFlow.mode, photoDataUrl, evidenceFlow.probNote);
            }}
            onCancel={() => { setEvidenceFlow(null); }}
          />
        );
      })()}

      {showProb && (() => {
        const probStop = stops.find(s=>s.id===showProb);
        const REASONS = ["Nadie en casa","Dirección incorrecta","Cliente canceló","Negocio cerrado","Acceso no disponible","Paquete dañado","Otro"];
        return (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",zIndex:9000,display:"flex",alignItems:"flex-end",justifyContent:"center" }}
            onClick={e=>{if(e.target===e.currentTarget){setShowProb(null);setProbNote("");}}}>
            <div style={{ width:"100%",maxWidth:520,background:"#080f18",border:"1px solid rgba(239,68,68,0.2)",borderRadius:"20px 20px 0 0",padding:"20px 18px 36px",animation:"slideUp .25s cubic-bezier(.4,0,.2,1)" }}>
              <div style={{ width:32,height:3,background:"rgba(255,255,255,0.1)",borderRadius:2,margin:"0 auto 16px" }}/>
              <div style={{ fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:3 }}>
                Marcar como fallido · #{probStop?.stopNum}
              </div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:14 }}>
                {probStop?.client} · {probStop?.displayAddr||probStop?.rawAddr}
              </div>
              {/* Quick reasons */}
              <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:14 }}>
                {REASONS.map(r => (
                  <button key={r} onClick={()=>setProbNote(r)}
                    style={{ padding:"7px 13px",borderRadius:20,border:`1px solid ${probNote===r?"rgba(239,68,68,0.5)":"#1a2d40"}`,background:probNote===r?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.03)",color:probNote===r?"#f87171":"rgba(255,255,255,0.45)",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s" }}>
                    {r}
                  </button>
                ))}
              </div>
              <textarea value={probNote==="Nadie en casa"||probNote==="Dirección incorrecta"||probNote==="Cliente canceló"||probNote==="Negocio cerrado"||probNote==="Acceso no disponible"||probNote==="Paquete dañado" ? "" : probNote}
                onChange={e=>setProbNote(e.target.value)}
                placeholder="Otro motivo o detalle adicional..."
                style={{ width:"100%",background:"#0a1420",border:"1px solid #1a2d40",borderRadius:12,padding:"11px 13px",color:"#f1f5f9",fontSize:13,outline:"none",caretColor:"#3b82f6",resize:"none",height:70,marginBottom:14,boxSizing:"border-box" }}/>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>{setShowProb(null);setProbNote("");}} style={{ flex:1,padding:"13px",borderRadius:12,border:"1px solid #1a2d40",background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:13,fontWeight:600,cursor:"pointer" }}>Cancelar</button>
                <button onClick={()=>{ if(!probNote.trim()){alert("Selecciona o escribe un motivo");return;} markProblem(showProb);}} style={{ flex:2,padding:"13px",borderRadius:12,border:"none",background:"rgba(239,68,68,0.85)",color:"white",fontSize:13,fontWeight:700,cursor:"pointer" }}>Confirmar fallido</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* -- Logout confirm -- */}
      {logoutConf && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)",zIndex:9500,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ width:320,background:"#111",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"28px 24px",boxShadow:"0 40px 80px rgba(0,0,0,0.9)",animation:"popIn .2s ease" }}>
            <div style={{ width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"rgba(255,255,255,0.8)",margin:"0 auto 16px" }}>{driver.avatar||(driver.name||"").slice(0,2).toUpperCase()}</div>
            <div style={{ fontSize:16,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"rgba(255,255,255,0.9)",marginBottom:4,textAlign:"center" }}>¿Cerrar sesión?</div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,0.35)",textAlign:"center",marginBottom:24,fontFamily:"'DM Sans',sans-serif" }}>{driver.name}</div>
            <div style={{ display:"flex",gap:8 }}>
              <button className="rd-btn" onClick={()=>setLogoutConf(false)} style={{ flex:1,padding:"13px",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:"pointer" }}>Cancelar</button>
              <button className="rd-btn" onClick={onLogout} style={{ flex:1,padding:"13px",borderRadius:12,border:"none",background:"rgba(239,68,68,0.85)",color:"white",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.3)" }}>Salir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -- Vista previa del mensajero desde admin (reemplaza DriverMobileView viejo) -

// --- PHASE 6: AUTH & ROLES ---------------------------------------------------



// --- ADMIN: MENSAJERO MANAGER -------------------------------------------------
const MensajeroManager = ({ mensajeros, setMensajeros }) => {
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone,setEditPhone]= useState("");
  const [editEmail,setEditEmail]= useState("");
  const [saveMsg,  setSaveMsg]  = useState("");

  const inp = {
    background: "#060b10", border: "1px solid #1e2d3d", borderRadius: 7,
    padding: "8px 11px", color: "#e2e8f0", fontSize: 13,
    fontFamily: "'Inter',sans-serif", outline: "none", width: "100%",
  };

  const add = async () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;
    const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2);
    const newId    = "M-" + Date.now();
    const email    = newEmail.trim().toLowerCase() || `${name.split(" ")[0].toLowerCase()}@rapdrive.do`;
    const newMens  = { id: newId, name, initials, phone: newPhone.trim(), email, active: true, color: "#3b82f6" };

    setMensajeros(prev => {
      const updated = [...prev, newMens];
      LS.setMens(updated);
      return updated;
    });

    // Crear usuario de login para el mensajero
    // CRÍTICO: driverId DEBE ser igual a newId (el id del mensajero en la lista)
    const newUser = {
      id: "U-" + Date.now(), name,
      email,
      password: "driver123",
      role: "driver",
      avatar: initials,
      zone: "DN",
      color: "#10b981",
      driverId: newId,  // mismo que mensajero.id — el admin usará este para enviar rutas
    };
    USERS.push(newUser);
    // Persistir en Firebase — esperar escritura antes de mostrar éxito
    await Promise.all([
      FB.set(`users/${newUser.id}`, newUser),
      FB.set(`mens_users/${newId}`, newUser),
      FB.set(`mensajeros/${newId}`, newMens),
    ]);

    setSaveMsg(`✓ ${name} agregado · Login: ${email} / driver123`);
    setTimeout(() => setSaveMsg(""), 6000);
    setNewName(""); setNewPhone(""); setNewEmail(""); setAdding(false);
  };

  const saveEdit = (id) => {
    setMensajeros(prev => {
      const updated = prev.map(m => m.id !== id ? m : {
        ...m, name: editName.trim().toUpperCase(),
        phone: editPhone.trim(),
        email: editEmail.trim().toLowerCase(),
        initials: editName.trim().toUpperCase().split(" ").map(w=>w[0]).join("").slice(0,2),
      });
      LS.setMens(updated);
      return updated;
    });
    // Update USERS array too
    const u = USERS.find(u => u.driverId === id);
    if (u) { u.name = editName.trim().toUpperCase(); if (editEmail.trim()) u.email = editEmail.trim().toLowerCase(); }
    setEditId(null);
  };

  const remove = (id, name) => {
    if (!window.confirm(`¿Eliminar ${name}?`)) return;
    setMensajeros(prev => {
      const updated = prev.filter(m => m.id !== id);
      LS.setMens(updated);
      return updated;
    });
  };

  const toggle = (id) => setMensajeros(prev => {
    const updated = prev.map(m => m.id === id ? { ...m, active: !m.active } : m);
    LS.setMens(updated);
    return updated;
  });

  return (
    <div style={{background:"#0a1019",border:"1px solid #131f30",borderRadius:12,padding:"18px 20px",marginBottom:14}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:12,borderBottom:"1px solid #0d1420"}}>
        <div>
          <div style={{fontSize:13,color:"#e2e8f0",fontFamily:"'Syne',sans-serif",fontWeight:700}}>Mensajeros</div>
          <div style={{fontSize:11,color:"#374151",marginTop:2}}>{mensajeros.filter(m=>m.active).length} activos · {mensajeros.length} total</div>
        </div>
        <button onClick={()=>{ setAdding(!adding); setNewName(""); setNewPhone(""); }}
          style={{padding:"6px 12px",borderRadius:7,border:"1px solid #1e2d3d",background:adding?"#131f30":"transparent",color:adding?"#64748b":"#94a3b8",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:600,cursor:"pointer"}}>
          {adding ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {/* Formulario nuevo */}
      {adding && (
        <div style={{background:"#060b10",border:"1px solid #1e2d3d",borderRadius:9,padding:"12px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:4}}>NOMBRE *</div>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="PEDRO GARCIA" style={inp}
                onKeyDown={e=>e.key==="Enter"&&add()}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:4}}>TELÉFONO</div>
              <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="8091234567" style={inp}
                onKeyDown={e=>e.key==="Enter"&&add()}/>
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:4}}>CORREO (para login)</div>
            <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="pedro@rapdrive.do" type="email" style={inp}
              onKeyDown={e=>e.key==="Enter"&&add()}/>
            <div style={{fontSize:10,color:"#1e3550",marginTop:3}}>Si está vacío se genera automáticamente. Contraseña por defecto: <span style={{color:"#60a5fa"}}>driver123</span></div>
          </div>
          <button onClick={add} disabled={!newName.trim()}
            style={{padding:"8px 16px",borderRadius:7,border:"none",background:newName.trim()?"#1e3550":"#131f30",color:newName.trim()?"#93c5fd":"#374151",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:newName.trim()?"pointer":"not-allowed"}}>
            Guardar
          </button>
        </div>
      )}

      {/* Mensaje de confirmación */}
      {saveMsg && (
        <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:"9px 12px",marginBottom:10,fontSize:11,color:"#10b981",fontFamily:"'Inter',sans-serif"}}>
          {saveMsg}
        </div>
      )}

      {/* Lista */}
      <div style={{display:"flex",flexDirection:"column",gap:1}}>
        {mensajeros.length === 0 && (
          <div style={{textAlign:"center",padding:"20px",color:"#374151",fontSize:13}}>Sin mensajeros. Agrega el primero.</div>
        )}
        {mensajeros.map(m => (
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #0d1420",opacity:m.active?1:0.45}}>
            {/* Initials */}
            <div style={{width:32,height:32,borderRadius:8,background:"#131f30",border:"1px solid #1e2d3d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#64748b",fontFamily:"'Syne',sans-serif",fontWeight:700,flexShrink:0}}>
              {m.initials}
            </div>

            {/* Edit mode */}
            {editId === m.id ? (
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nombre" style={{...inp,padding:"5px 8px",fontSize:12}}/>
                  <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} placeholder="Teléfono" style={{...inp,padding:"5px 8px",fontSize:12}}/>
                </div>
                <input value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="correo@rapdrive.do" style={{...inp,padding:"5px 8px",fontSize:12}}/>
              </div>
            ) : (
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#e2e8f0",fontFamily:"'Syne',sans-serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</div>
                {m.phone && <div style={{fontSize:11,color:"#374151",marginTop:1}}>{m.phone}</div>}
                {m.email && <div style={{fontSize:10,color:"#2d4a60",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>}
              </div>
            )}

            {/* Status dot */}
            <div style={{width:6,height:6,borderRadius:"50%",background:m.active?"#10b981":"#374151",flexShrink:0}}/>

            {/* Actions */}
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              {editId === m.id ? (
                <>
                  <button onClick={()=>saveEdit(m.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid #1e3550",background:"transparent",color:"#60a5fa",fontSize:11,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600}}>OK</button>
                  <button onClick={()=>setEditId(null)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:11,cursor:"pointer"}}>✕</button>
                </>
              ) : (
                <>
                  <button onClick={()=>{setEditId(m.id);setEditName(m.name);setEditPhone(m.phone||"");setEditEmail(m.email||"");}} title="Editar"
                    style={{padding:"4px 8px",borderRadius:6,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:11,cursor:"pointer"}}>✏</button>
                  <button onClick={()=>toggle(m.id)} title={m.active?"Desactivar":"Activar"}
                    style={{padding:"4px 8px",borderRadius:6,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:11,cursor:"pointer"}}>
                    {m.active?"⏸":"▶"}
                  </button>
                  <button onClick={()=>remove(m.id,m.name)} title="Eliminar"
                    style={{padding:"4px 8px",borderRadius:6,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:11,cursor:"pointer"}}>🗑</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- LOGIN SCREEN -------------------------------------------------------------

const LoginScreen = ({ onLogin }) => {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused,  setFocused]  = useState("");
  const [success,  setSuccess]  = useState(false);

  // Carga usuarios de Firebase al montar (para que mensajeros nuevos funcionen)
  useEffect(() => {
    const loadFBUsers = async () => {
      try {
        const [usersData, mensUsersData] = await Promise.all([
          FB.get("users"),
          FB.get("mens_users"),
        ]);
        if (usersData && typeof usersData === "object") {
          Object.values(usersData).forEach(u => {
            if (u && u.id && !USERS.find(x => x.id === u.id)) USERS.push(u);
          });
        }
        if (mensUsersData && typeof mensUsersData === "object") {
          Object.values(mensUsersData).forEach(u => {
            if (u && u.id && !USERS.find(x => x.id === u.id)) USERS.push(u);
          });
        }
      } catch(e) { /* Firebase no disponible, usa USERS local */ }
    };
    loadFBUsers();
  }, []);

  const handleSubmit = () => {
    if (loading) return;
    setError("");
    setLoading(true);
    // Pequeño delay para que Firebase haya cargado
    setTimeout(async () => {
      // Buscar primero en USERS (ya incluye los de Firebase tras el useEffect)
      let user = USERS.find(u => u.email === email.trim().toLowerCase() && u.password === password);
      // Si no encontró, reintentar con Firebase directo (por si el useEffect aún no terminó)
      if (!user) {
        try {
          const [usersData, mensUsersData] = await Promise.all([
            FB.get("users"),
            FB.get("mens_users"),
          ]);
          const allFB = [
            ...Object.values(usersData || {}),
            ...Object.values(mensUsersData || {}),
          ];
          user = allFB.find(u => u && u.email === email.trim().toLowerCase() && u.password === password);
          // Si encontró en Firebase, agrégalo a USERS local para futuras búsquedas
          if (user && !USERS.find(x => x.id === user.id)) USERS.push(user);
        } catch(e) {}
      }
      if (user) {
        setSuccess(true);
        try { sessionStorage.setItem("rdSession", JSON.stringify(user)); } catch(e) {}
        setTimeout(() => onLogin(user), 700);
      } else {
        setError("Correo o contraseña incorrectos");
        setLoading(false);
      }
    }, 900);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"#080a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@500&display=swap');
        @keyframes lCard{from{opacity:0;transform:translateY(32px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lLogo{from{opacity:0;transform:translateY(-16px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes lSuccess{0%{transform:scale(1)}30%{transform:scale(1.03)}70%{transform:scale(0.99)}100%{transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes lOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.06) translateY(-8px)}}
        @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.1)}66%{transform:translate(-20px,20px) scale(0.95)}}
        @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-50px,25px) scale(1.05)}66%{transform:translate(30px,-35px) scale(1.08)}}
        @keyframes orb3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,40px)}}
        @keyframes shimmer{0%{opacity:0.03}50%{opacity:0.07}100%{opacity:0.03}}
        @keyframes inputGlow{from{box-shadow:0 0 0 0 rgba(59,130,246,0)}to{box-shadow:0 0 0 3px rgba(59,130,246,0.15)}}
      `}</style>

      {/* Animated background orbs */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"10%",left:"20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%)",animation:"orb1 12s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"15%",right:"15%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)",animation:"orb2 15s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"50%",left:"50%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.04) 0%,transparent 70%)",transform:"translate(-50%,-50%)",animation:"orb3 18s ease-in-out infinite"}}/>
        {/* Grid pattern */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"60px 60px",animation:"shimmer 4s ease-in-out infinite"}}/>
      </div>

      <div style={{
        width:380, position:"relative", zIndex:1,
        animation: success ? "lOut .5s ease forwards" : "lCard .6s cubic-bezier(.16,1,.3,1) both",
      }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28, animation:"lLogo .6s .08s cubic-bezier(.16,1,.3,1) both", opacity:0 }}>
          <div style={{ position:"relative",width:60,height:60,margin:"0 auto 14px" }}>
            <div style={{ position:"absolute",inset:-4,borderRadius:20,background:"linear-gradient(135deg,rgba(59,130,246,0.3),rgba(99,102,241,0.2))",filter:"blur(8px)" }}/>
            <div style={{ position:"relative",width:60,height:60,borderRadius:18,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 32px rgba(59,130,246,0.4)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.45"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize:26,fontWeight:800,color:"white",letterSpacing:"-0.8px",lineHeight:1 }}>Rap Drive</div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,0.22)",marginTop:5,letterSpacing:"3px",fontWeight:600,textTransform:"uppercase" }}>Gestión de Entregas</div>
        </div>

        {/* Card */}
        <div style={{
          background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:22,
          padding:"28px 26px 24px",
          boxShadow:"0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter:"blur(20px)",
          animation: success ? "lSuccess .5s ease" : "none",
        }}>
          {/* Header */}
          <div style={{textAlign:"center", marginBottom:26}}>
            <div style={{fontSize:17,fontWeight:700,color:"rgba(255,255,255,0.92)",letterSpacing:"-0.3px"}}>Bienvenido de vuelta</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.25)",marginTop:4}}>Inicia sesión para continuar</div>
          </div>

          {/* Email */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"1.5px",fontWeight:600,display:"block",marginBottom:7}}>CORREO</label>
            <input
              value={email}
              onChange={e=>{setEmail(e.target.value);setError("");}}
              onFocus={()=>setFocused("email")} onBlur={()=>setFocused("")}
              onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              placeholder="tu@rapdrive.do"
              type="email"
              style={{
                width:"100%", background:focused==="email"?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.04)",
                border:`1.5px solid ${focused==="email"?"rgba(59,130,246,0.6)":"rgba(255,255,255,0.08)"}`,
                borderRadius:13, padding:"13px 14px", color:"white",
                fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none",
                caretColor:"#3b82f6", transition:"all .2s", boxSizing:"border-box",
                boxShadow: focused==="email"?"0 0 0 3px rgba(59,130,246,0.12)":"none",
              }}
            />
          </div>

          {/* Password */}
          <div style={{marginBottom:22}}>
            <label style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:"1.5px",fontWeight:600,display:"block",marginBottom:7}}>CONTRASEÑA</label>
            <div style={{position:"relative"}}>
              <input
                value={password}
                onChange={e=>{setPassword(e.target.value);setError("");}}
                onFocus={()=>setFocused("pass")} onBlur={()=>setFocused("")}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                placeholder="••••••••"
                type={showPass?"text":"password"}
                style={{
                  width:"100%", background:focused==="pass"?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.04)",
                  border:`1.5px solid ${focused==="pass"?"rgba(59,130,246,0.6)":"rgba(255,255,255,0.08)"}`,
                  borderRadius:13, padding:"13px 44px 13px 14px", color:"white",
                  fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none",
                  caretColor:"#3b82f6", transition:"all .2s", boxSizing:"border-box",
                  boxShadow: focused==="pass"?"0 0 0 3px rgba(59,130,246,0.12)":"none",
                }}
              />
              <button onClick={()=>setShowPass(s=>!s)}
                style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.25)",cursor:"pointer",padding:4,display:"flex",alignItems:"center",justifyContent:"center",transition:"color .15s"}}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"11px 14px",marginBottom:16,fontSize:12,color:"#f87171",display:"flex",alignItems:"center",gap:8,animation:"fadeUp .2s ease"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading||!email||!password}
            style={{
              width:"100%", padding:"14px", borderRadius:13, border:"none",
              background: success
                ? "linear-gradient(135deg,#059669,#10b981)"
                : !loading&&email&&password
                  ? "linear-gradient(135deg,#2563eb,#3b82f6)"
                  : "rgba(255,255,255,0.05)",
              color: !loading&&email&&password ? "white" : "rgba(255,255,255,0.15)",
              fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
              cursor:!loading&&email&&password?"pointer":"not-allowed",
              transition:"all .3s cubic-bezier(.4,0,.2,1)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxSizing:"border-box", letterSpacing:"-0.2px",
              boxShadow: !loading&&email&&password&&!success ? "0 8px 24px rgba(37,99,235,0.4)" : "none",
            }}>
            {success
              ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>¡Entrando!</>
              : loading
                ? <><div style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"white",animation:"spin .7s linear infinite"}}/>Verificando...</>
                : <>Ingresar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
            }
          </button>

          {/* Footer */}
          <div style={{textAlign:"center",marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>
              Developer: <span style={{color:"rgba(255,255,255,0.45)",fontWeight:600}}>Adonis Castillo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PHASE 6: EXPORT CSV -----------------------------------------------------

const exportCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => `"${String(row[h]||"").replace(/"/g,'""')}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// --- PHASE 6: ROLE BADGE -----------------------------------------------------

const RoleBadge = ({ role }) => {
  const rc = ROLE_CONFIG[role] || ROLE_CONFIG.driver;
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:5,background:`${rc.color}12`,border:`1px solid ${rc.color}28`,borderRadius:7,padding:"3px 9px"}}>
      <div style={{width:5,height:5,borderRadius:"50%",background:rc.color}}/>
      <span style={{fontSize:10,color:rc.color,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.3px"}}>{rc.label}</span>
    </div>
  );
};

// --- PHASE 6: ROLE GUARD -----------------------------------------------------

const RoleGuard = ({ allowed, currentRole, children, fallback }) => {
  if (allowed.includes(currentRole)) return children;
  return fallback || (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontSize:36,opacity:0.15}}>🔒</div>
      <span style={{fontSize:13,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px"}}>ACCESO RESTRINGIDO</span>
      <span style={{fontSize:11,color:"#1e3550"}}>Tu rol no tiene permisos para esta sección</span>
    </div>
  );
};


// --- PHASE 7: IMPORT ENGINE --------------------------------------------------
// The core differentiator: Excel import + geocoding + route optimization

// Geocoding: parse & normalize Spanish addresses into structured data
// ─────────────────────────────────────────────────────────────────────────────
// PARSER DOMINICANO — descompone direcciones en formato RD en sus partes
// Soporta:
//   "C/Mella #45, 2da planta, al lado del colmado El Rey, Herrera"
//   "frente a la iglesia, detrás del parque, Bayona"
//   "Res. Carmen Renata I, Calle 5 casa 12, SDO"
//   "Km 9 Autopista Duarte, al lado de PriceSmart"
//   "7VXP+Q3 Herrera"  (Plus Code)
//   "esq. Av. Isabel Aguiar con Calle 3, Herrera"
// ─────────────────────────────────────────────────────────────────────────────

// Palabras de referencia relacional — frases que indican "cerca de X"
const RD_REF_PATTERNS = [
  /\b(?:al\s+lado\s+(?:de(?:l)?)?|next\s+to)\s+(.+?)(?:,|$)/gi,
  /\b(?:frente\s+a(?:l)?)\s+(.+?)(?:,|$)/gi,
  /\b(?:detr[aá]s\s+(?:de(?:l)?)?)\s+(.+?)(?:,|$)/gi,
  /\b(?:cerca\s+(?:de(?:l)?)?)\s+(.+?)(?:,|$)/gi,
  /\b(?:esquina\s+(?:con|a)?)\s+(.+?)(?:,|$)/gi,
  /\b(?:diagonal\s+(?:a(?:l)?)?)\s+(.+?)(?:,|$)/gi,
  /\b(?:subiendo|bajando)\s+(.+?)(?:,|$)/gi,
  /\b(?:entre\s+.+?\s+y)\s+(.+?)(?:,|$)/gi,
  /\b(?:a\s+(?:una\s+)?(?:\d+\s+)?(?:cuadra|bloque)s?\s+(?:de(?:l)?)?)\s+(.+?)(?:,|$)/gi,
];

// Sectores conocidos SDO para extracción automática
const SDO_SECTORS = [
  "herrera","bayona","engombe","las caobas","manoguayabo","villa aura",
  "olimpo","hato nuevo","las palmas","enriquillo","caballona","lechería",
  "arroyo bonito","ciudad agraria","la isabela","savica","las caobitas",
  "las colinas","el libertador","pueblo nuevo","juan guzmán","las mercedes",
  "altos de engombe","altos de las caobas","buenos aires de herrera",
  "buenos aires de manoguayabo","buenos aires de las caobas",
  "el café de herrera","las palmas de herrera","barrio nuevo","barrio duarte",
  "barrio san francisco","barrio san miguel","barrio enriquillo","barrio libertad",
  "barrio progreso","batey bienvenido","nuevo horizonte","la venta",
  "el hoyo de manoguayabo","carmen renata","brisas del oeste","don honorio",
  "operaciones especiales","residencial altagracia","residencial antonia",
];

// Plus Code detector
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s+\w+)?$/i;

const parseAddress = (raw) => {
  if (!raw) return { valid: false, raw: "" };
  const s = String(raw).trim();

  // ── 0. Plus Code directo ──────────────────────────────────────────────────
  if (PLUS_CODE_RE.test(s.split(",")[0].trim())) {
    return { valid: true, raw: s, isPlusCode: true, plusCode: s.split(",")[0].trim(),
      street: s, number: "", floor: "", reference: "", sector: "", display: s };
  }

  // ── 1. Extraer referencias relacionales ("frente a", "al lado de"…) ───────
  let working = s;
  const references = [];
  for (const pat of RD_REF_PATTERNS) {
    let m;
    pat.lastIndex = 0;
    while ((m = pat.exec(working)) !== null) {
      if (m[1]) references.push(m[1].trim().replace(/,$/, ""));
    }
  }

  // ── 2. Extraer sector SDO ─────────────────────────────────────────────────
  let sector = "";
  const lc = working.toLowerCase();
  for (const sec of SDO_SECTORS) {
    if (lc.includes(sec)) { sector = sec.replace(/\b\w/g, c => c.toUpperCase()); break; }
  }

  // ── 3. Extraer número de casa/local ──────────────────────────────────────
  const numMatch = working.match(/[,\s](?:no?[.ºo°#]?\s*)?(\d{1,4}[a-z]?)(?:\s|,|$)/i)
                || working.match(/\s#\s*(\d{1,4}[a-z]?)/i)
                || working.match(/n[ºo°]\s*(\d{1,4})/i);
  const number = numMatch ? numMatch[1] : "";

  // ── 4. Extraer piso / apartamento / local ────────────────────────────────
  const floorMatch = working.match(/(\d+[aº]?)\s*(?:er|ro|do|to)?\s*(?:piso|planta)/i)
                  || working.match(/apt(?:o|artamento)?\.?\s*(\d+[a-z]?)/i)
                  || working.match(/local\s+(\d+[a-z]?)/i);
  const floor = floorMatch ? floorMatch[0].trim() : "";

  // ── 5. Limpiar y normalizar la parte de calle ─────────────────────────────
  let street = working
    .replace(/,?\s*(?:no?[.ºo°#]?\s*)?\d{1,4}[a-z]?\s*(?:er|ro|do|to)?(?:\s+piso|\s+planta)?/gi, "")
    .replace(/,?\s*apt(?:o|artamento)?\.?\s*\d+[a-z]?/gi, "")
    .replace(/,?\s*local\s+\d+[a-z]?/gi, "")
    .replace(/,?\s*\d+[aº]?\s*(?:piso|planta)[^,]*/gi, "")
    // quitar las frases relacionales ya extraídas
    .replace(/\b(?:al\s+lado\s+(?:de(?:l)?)?|frente\s+a(?:l)?|detr[aá]s\s+(?:de(?:l)?)?|cerca\s+(?:de(?:l)?)?|diagonal\s+(?:a(?:l)?)?|subiendo|bajando)\s+[^,]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();

  // ── 6. Expandir abreviaturas de vía ──────────────────────────────────────
  street = street
    .replace(/\bc\/?(\s+|(?=[A-ZÁÉÍÓÚ\d]))/gi, "Calle ")
    .replace(/\bav\.?\s*/gi,    "Avenida ")
    .replace(/\bave\.?\s*/gi,   "Avenida ")
    .replace(/\bavda\.?\s*/gi,  "Avenida ")
    .replace(/\bprol\.?\s*/gi,  "Prolongación ")
    .replace(/\besq\.?\s*/gi,   "Esquina ")
    .replace(/\bres\.?\s*/gi,   "Residencial ")
    .replace(/\burb\.?\s*/gi,   "Urbanización ")
    .replace(/\bkm\.?\s+/gi,    "Km ")
    .replace(/\bctra\.?\s*/gi,  "Carretera ");

  // ── 7. Capitalizar ────────────────────────────────────────────────────────
  street = street.replace(/\b\w/g, c => c.toUpperCase());

  // ── 8. Construir query optimizada para Google ─────────────────────────────
  // Orden: calle+número, sector, ciudad — referencias van al final como hint
  const parts = [street, number].filter(Boolean).join(" No. ");
  const sectorHint = sector ? `${sector}, Santo Domingo Oeste` : "Santo Domingo Oeste";
  const optimizedQuery = references.length
    ? `${parts}, ${sectorHint} (cerca de ${references[0]})`
    : `${parts}, ${sectorHint}`;

  return {
    valid: street.length > 2 || sector.length > 0,
    raw: s,
    street,
    number,
    floor,
    sector,
    reference: references[0] || "",
    allReferences: references,
    display: [street, number, floor].filter(Boolean).join(", "),
    optimizedQuery,
    isPlusCode: false,
  };
};

const geocodeWithGoogle = async (rawAddress) => {
  const cacheKey = rawAddress.trim().toLowerCase();

  // ── CAPA 0A: Cache aprendido (correcciones manuales del admin, persistidas en Firebase)
  if (_learnedCache.has(cacheKey)) {
    const l = _learnedCache.get(cacheKey);
    return { ok: true, lat: l.lat, lng: l.lng, display: l.display, confidence: 99, allResults: [], source: "learned" };
  }

  // ── CAPA 0B: Cache en-memoria (evita llamadas repetidas a Google)
  if (_geoCache.has(cacheKey)) return _geoCache.get(cacheKey);

  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  const queries = buildQueryVariants(rawAddress);

  // ── Detectar anchor local para sesgar búsqueda y validar resultado ─────────
  const anchor = findAnchor(rawAddress);
  const hintBounds = anchor ? new window.google.maps.LatLngBounds(
    { lat: anchor.lat - 0.08, lng: anchor.lng - 0.08 },
    { lat: anchor.lat + 0.08, lng: anchor.lng + 0.08 }
  ) : null;

  // ── CAPA 1: Geocoding API con todas las variantes ─────────────────────────
  let bestResult = null;
  let bestScore  = 0;

  for (const q of queries) {
    try {
      const gcOpts = { address: q, region: "DO" };
      // componentRestrictions eliminado — rechaza resultados válidos en sectores informales
      // Usamos bounds del anchor si lo hay; sino bounds completos de RD
      if (hintBounds) gcOpts.bounds = hintBounds;
      const result = await new Promise((res, rej) =>
        geocoder.geocode(gcOpts, (results, status) => status === "OK" ? res(results) : rej(status))
      );
      if (!result || result.length === 0) continue;

      // Evaluar TODOS los candidatos, quedarse con el mejor score
      const candidates = result
        .filter(r => { const l = r.geometry.location; return inRD(l.lat(), l.lng()); })
        .map(r => ({ r, score: scoreGoogleResult(r, rawAddress) }))
        .sort((a, b) => b.score - a.score);

      if (candidates.length === 0) continue;
      const { r: top, score: conf } = candidates[0];

      // Si hay anchor, penalizar resultados que estén muy lejos de él (>15km)
      if (anchor) {
        const dlat = top.geometry.location.lat() - anchor.lat;
        const dlng = top.geometry.location.lng() - anchor.lng;
        const distKm = Math.sqrt(dlat*dlat + dlng*dlng) * 111;
        if (distKm > 15) continue; // resultado random, ignorar
      }

      if (conf > bestScore) {
        bestScore = conf;
        bestResult = { top, conf, allCandidates: candidates };
      }

      // Score excelente → no seguir buscando variantes
      if (bestScore >= 90) break;
    } catch { /* try next variant */ }
  }

  if (bestResult) {
    const { top, conf, allCandidates } = bestResult;
    const lat = top.geometry.location.lat();
    const lng = top.geometry.location.lng();
    const out = {
      ok: true, lat, lng,
      display: top.formatted_address,
      confidence: conf,
      types: top.types || [],
      source: "geocoding_api",
      allResults: allCandidates.slice(0, 3).map(({ r, score }) => ({
        display: r.formatted_address,
        lat: r.geometry.location.lat(),
        lng: r.geometry.location.lng(),
        confidence: score,
      })),
    };
    _geoCache.set(cacheKey, out);
    return out;
  }

  // ── CAPA 2: Places Text Search (landmarks, negocios, sectores informales) ──
  try {
    const placesResult = await searchWithPlaces(rawAddress);
    if (placesResult) {
      _geoCache.set(cacheKey, placesResult);
      return placesResult;
    }
  } catch { /* places failed */ }

  // ── CAPA 3: Nominatim (último recurso) ────────────────────────────────────
  try {
    const nominatimQueries = [
      rawAddress + ", República Dominicana",
      expandRDAddress(rawAddress) + ", República Dominicana",
      rawAddress.split(",")[0].trim() + ", Santo Domingo, República Dominicana",
    ];
    for (const nmQuery of nominatimQueries) {
      const encoded = encodeURIComponent(nmQuery);
      const nm = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=do&addressdetails=1`,
        { headers: { "Accept-Language": "es", "User-Agent": "RapDrive/1.0" } }
      );
      if (!nm.ok) continue;
      const nmData = await nm.json();
      if (!nmData?.length) continue;

      const rdResults = nmData.filter(r => inRD(parseFloat(r.lat), parseFloat(r.lon)));
      if (rdResults.length === 0) continue;

      const top = rdResults[0];
      const lat = parseFloat(top.lat), lng = parseFloat(top.lon);
      let conf = 50;
      if (top.type === "house")           conf = 85;
      else if (top.type === "building")   conf = 78;
      else if (top.class === "highway")   conf = 70;
      else if (top.type === "residential") conf = 65;
      else if (top.class === "place")     conf = 57;
      const nums = rawAddress.match(/\d{1,4}/g);
      if (nums?.some(n => top.display_name.includes(n))) conf = Math.min(conf + 8, 92);

      const out = {
        ok: true, lat, lng,
        display: top.display_name.split(",").slice(0, 3).join(",").trim(),
        confidence: conf,
        types: [top.type || "nominatim"],
        source: "nominatim",
        allResults: rdResults.slice(0, 3).map(r => ({
          display: r.display_name.split(",").slice(0, 3).join(",").trim(),
          lat: parseFloat(r.lat), lng: parseFloat(r.lon),
          confidence: 52,
        })),
      };
      _geoCache.set(cacheKey, out);
      return out;
    }
  } catch { /* nominatim failed */ }

  // ── CAPA 4: Fallback de anchor local (último recurso) ─────────────────────
  // Si Google y Nominatim fallaron pero detectamos el sector, devolver el anchor
  // con confianza baja para que el admin sepa que es aproximado
  const lastAnchor = findAnchor(rawAddress);
  if (lastAnchor) {
    const fallbackOut = {
      ok: true,
      lat: lastAnchor.lat,
      lng: lastAnchor.lng,
      display: `${rawAddress} (aprox. ${lastAnchor.city})`,
      confidence: 35,
      types: ["anchor_fallback"],
      source: "anchor_local",
      allResults: [],
    };
    _geoCache.set(cacheKey, fallbackOut);
    return fallbackOut;
  }

  const failed = { ok: false, lat: null, lng: null, display: null, confidence: 0, allResults: [] };
  return failed;
};

// Build multiple query variants for maximum hit rate
// Estrategia: de más específico a más general, hasta que Google responda
const buildQueryVariants = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return [];

  const expanded = expandRDAddress(s);
  const variants = new Set();

  // ── Usar query optimizada del parser dominicano como variante prioritaria ──
  const parsed = parseAddress(s);
  if (parsed.isPlusCode) {
    variants.add(parsed.plusCode + " Santo Domingo Oeste, República Dominicana");
    variants.add(parsed.plusCode);
  } else if (parsed.valid && parsed.optimizedQuery) {
    variants.add(parsed.optimizedQuery + ", República Dominicana");
    if (parsed.reference) {
      const noRef = [parsed.street, parsed.number].filter(Boolean).join(" No. ");
      const sec   = parsed.sector || "Santo Domingo Oeste";
      variants.add(noRef + ", " + sec + ", Santo Domingo Oeste, República Dominicana");
    }
  }

  // --- Detección de contexto geográfico ---
  const hasCountry = /rep[uú]blica dominicana|dominican republic/i.test(s);
  const hasCity    = /santo domingo|santiago|la romana|punta cana|san pedro|boca chica|higüey|moca|bonao|puerto plata|barahona|azua|d\.?\s*n\.?|distrito nacional/i.test(s);
  const hasSector  = /(?:sector|ens(?:anche)?|res(?:idencial)?|urb(?:anizaci[oó]n)?|reparto|barrio)\s+\w/i.test(s);

  const RD = ", República Dominicana";
  const SD = ", Santo Domingo" + RD;
  const DN = ", Distrito Nacional" + RD;

  // 1. Versión expandida + ciudad — SDO primero si hay anchor en esa zona
  const _anchor = findAnchor(s);
  const _isSDO = _anchor?.city === "Santo Domingo Oeste";
  const _isDN  = _anchor?.city === "Distrito Nacional";
  const _isSDE = _anchor?.city === "Santo Domingo Este";
  const _isSDN = _anchor?.city === "Santo Domingo Norte";
  if (!hasCountry && !hasCity) {
    // Priorizar la ciudad del anchor — evita que Google devuelva resultado en zona equivocada
    if (_isSDO) {
      variants.add(expanded + ", Santo Domingo Oeste" + RD);
      variants.add(expanded + SD);
      variants.add(expanded + DN);
    } else if (_isDN) {
      variants.add(expanded + DN);
      variants.add(expanded + SD);
      variants.add(expanded + ", Santo Domingo Oeste" + RD);
    } else if (_isSDE) {
      variants.add(expanded + ", Santo Domingo Este" + RD);
      variants.add(expanded + SD);
    } else if (_isSDN) {
      variants.add(expanded + ", Santo Domingo Norte" + RD);
      variants.add(expanded + SD);
    } else {
      variants.add(expanded + SD);
      variants.add(expanded + DN);
      variants.add(expanded + ", Santo Domingo Este" + RD);
      variants.add(expanded + ", Santo Domingo Oeste" + RD);
      variants.add(expanded + ", Santo Domingo Norte" + RD);
    }
  } else if (!hasCountry) {
    variants.add(expanded + RD);
    variants.add(expanded);
  } else {
    variants.add(expanded);
  }

  // 2. Raw original + contexto
  if (s !== expanded) {
    if (!hasCity && !hasCountry) {
      variants.add(s + SD);
      variants.add(s + RD);
    } else if (!hasCountry) {
      variants.add(s + RD);
    }
    variants.add(s);
  }

  // 3. Si tiene sector/residencial, construir variante con solo el sector + ciudad
  const secMatch = s.match(/(?:sector|ens(?:anche)?|res(?:idencial)?|urb(?:anizaci[oó]n)?|reparto)\s+([^,]+)/i);
  if (secMatch) {
    const sec = secMatch[1].trim();
    variants.add(sec + SD);
    variants.add(sec + ", Santo Domingo Este" + RD);
    variants.add(sec + ", Santo Domingo Oeste" + RD);
    // Agregar calle + sector para mayor precisión
    const calleMatch = expanded.match(/(?:Calle|Avenida|Av\.|Prolongación)\s+[^,]+/i);
    if (calleMatch) {
      variants.add(calleMatch[0].trim() + ", " + sec + SD);
    }
  }

  // 4. Extraer solo la parte de calle + número (sin piso/apto) como fallback
  const calleNum = expanded.match(/(?:Calle|Avenida|Prolongación|Callejón)\s+[^,]+?\s+(?:No\.)?\s*\d+/i);
  if (calleNum && !hasCity) {
    variants.add(calleNum[0].trim() + SD);
    variants.add(calleNum[0].trim() + ", Santo Domingo Este" + RD);
  }

  // 5. Fallback más genérico: solo las primeras 2 partes de la dirección + SD
  const parts = expanded.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    variants.add(parts.slice(0, 2).join(", ") + SD);
  }
  if (parts.length >= 1 && !hasCity) {
    variants.add(parts[0] + SD);
  }

  // 6. Si tiene número de calle, probar variante sin número (por si hay typo en el número)
  const numMatch = expanded.match(/(\d{1,4})/);
  if (numMatch) {
    const withoutNum = expanded.replace(numMatch[0], "").replace(/\s{2,}/g, " ").trim();
    if (withoutNum.length > 5 && !hasCity) variants.add(withoutNum + SD);
  }

  // 7. Variante de solo palabras clave (sin abreviaciones ni números de apto)
  // Elimina Apartamento/Torre/Edificio/Local/Piso y todo lo que sigue
  const stripped = expanded.replace(/,?\s*(?:Apartamento|Torre|Edificio|Local|Piso|Apto?|Nivel|Suite)\s*[\w-]*.*/i, "").trim();
  if (stripped !== expanded && !hasCity) variants.add(stripped + SD);

  // Eliminar variantes vacías o muy cortas
  return [...new Set([...variants])].filter(v => v && v.trim().length > 7).slice(0, 10); // cap at 10 queries
};

// RD-specific address normalizer - expanded for Dominican Republic
const expandRDAddress = (s) => {
  // 1. Limpieza inicial
  let r = s.trim();

  // 2. Separadores comunes en RD: barras, guiones como separadores de sector/calle
  r = r.replace(/\s*\/\s*/g, ", ").replace(/\s*-{2,}\s*/g, ", ");

  // 3. Tipos de vía
  const abbrevs = [
    // Avenida
    [/\bav\.\s*/gi,            "Avenida "],
    [/\bave\.\s*/gi,           "Avenida "],
    [/\bavda\.\s*/gi,          "Avenida "],
    [/\bavenida\s*/gi,         "Avenida "],
    // Calle
    [/\bc\/\s*/gi,             "Calle "],
    [/\bclle?\.\s*/gi,         "Calle "],
    [/\bcl\.\s*/gi,            "Calle "],
    [/\bca\.\s+(?=[A-ZÁÉÍÓÚ])/gi, "Calle "],
    // Callejón
    [/\bclj[oó]n?\.\s*/gi,    "Callejón "],
    // Residencial / Urbanización / Sector / Barrio
    [/\bres(?:id(?:encial)?)?\.\s*/gi, "Residencial "],
    [/\burb\.\s*/gi,           "Urbanización "],
    [/\burbaniz\.\s*/gi,       "Urbanización "],
    [/\bsect?\.\s*/gi,         "Sector "],
    [/\bbarr?\.\s*/gi,         "Barrio "],
    [/\bens\.\s*/gi,           "Ensanche "],
    [/\bensanche\s*/gi,        "Ensanche "],
    [/\bprol\.\s*/gi,          "Prolongación "],
    [/\besq\.\s*/gi,           "Esquina "],
    [/\besquina\s+con\s*/gi,   "Esquina "],
    // Numeración
    [/\bno\.\s*(\d)/gi,        "No. $1"],
    [/\bn[oº°#]\s*(\d)/gi,     "No. $1"],
    [/\bnúm\.\s*(\d)/gi,       "No. $1"],
    [/\b#\s*(\d)/gi,           "No. $1"],
    // Kilómetro
    [/\bkm\.?\s+/gi,           "Km "],
    // Apartamento / Edificio / Torre / Local
    [/\bapto\.?\s*/gi,         "Apartamento "],
    [/\bapt\.?\s*/gi,          "Apartamento "],
    [/\bap\.?\s+(?=\d)/gi,     "Apartamento "],
    [/\bdepto\.?\s*/gi,        "Departamento "],
    [/\bedif\.?\s*/gi,         "Edificio "],
    [/\bedificio\s*/gi,        "Edificio "],
    [/\btorre\s+/gi,           "Torre "],
    [/\bloc\.?\s*/gi,          "Local "],
    // Zonas especiales RD
    [/\bz\.?\s*col(?:onial)?\b/gi,  "Zona Colonial"],
    [/\bznc?\b/gi,             "Zona Colonial"],
    [/\bd\.?\s*n\.?\b/gi,      "Distrito Nacional"],
    [/\bsto\.?\s*dgo\.?\b/gi,  "Santo Domingo"],
    [/\bsdo\.?\b/gi,           "Santo Domingo"],
    [/\bsdq\b/gi,              "Santo Domingo"],
    [/\bstgo\.?\b/gi,          "Santiago"],
    [/\bstgo\s+de\s+los\s+cab\b/gi, "Santiago de los Caballeros"],
    [/\blr\b/gi,               "La Romana"],
    [/\bpup\b/gi,              "Punta Cana"],
    [/\bspm\b/gi,              "San Pedro de Macorís"],
    [/\bsd\s+este\b/gi,        "Santo Domingo Este"],
    [/\bsd\s+oeste\b/gi,       "Santo Domingo Oeste"],
    [/\bsd\s+norte\b/gi,       "Santo Domingo Norte"],
    // Sectores comunes SD
    [/\bnaco\b/gi,             "Naco, Santo Domingo"],
    [/\bpiantini\b/gi,         "Piantini, Santo Domingo"],
    [/\bgazcue\b/gi,           "Gazcue, Santo Domingo"],
    [/\bpolo\s*gov\b/gi,       "Polígono Central, Santo Domingo"],
    [/\bensanche\s+ozama\b/gi, "Ensanche Ozama, Santo Domingo"],
    [/\barroyo\s+hondo\b/gi,   "Arroyo Hondo, Santo Domingo"],
    [/\bcmdo\b/gi,             "Cristo Rey, Santo Domingo"],

    // ── Santo Domingo Oeste – Zona Herrera (núcleo principal) ─────────────────
    [/\bherrera\b(?!\s+de)/gi,                 "Herrera, Santo Domingo Oeste"],
    [/\bbuenos\s+aires\s+de\s+herrera\b/gi,    "Buenos Aires de Herrera, Santo Domingo Oeste"],
    [/\bel\s+caf[eé]\s+de\s+herrera\b/gi,     "El Café de Herrera, Santo Domingo Oeste"],
    [/\blas\s+palmas\s+de\s+herrera\b/gi,      "Las Palmas de Herrera, Santo Domingo Oeste"],
    [/\benriquillo\b/gi,                        "Enriquillo, Santo Domingo Oeste"],
    [/\bduarte\s*(?:\(herrera\))?\b/gi,        "Duarte, Herrera, Santo Domingo Oeste"],
    [/\bpueblo\s+nuevo\b(?!.*ozama)/gi,        "Pueblo Nuevo, Santo Domingo Oeste"],
    [/\bjuan\s+guzm[aá]n\b/gi,                "Juan Guzmán, Santo Domingo Oeste"],
    [/\biv[aá]n\s+guzm[aá]n\s+klang\b/gi,    "Iván Guzmán Klang, Santo Domingo Oeste"],
    [/\blas\s+mercedes\b/gi,                   "Las Mercedes, Santo Domingo Oeste"],
    [/\bvilla\s+aura\b/gi,                     "Villa Aura, Santo Domingo Oeste"],
    [/\bolimpo\b/gi,                            "Olimpo, Santo Domingo Oeste"],
    [/\bbarrio\s+duarte\b/gi,                  "Barrio Duarte, Santo Domingo Oeste"],
    [/\bbarrio\s+nuevo\b/gi,                   "Barrio Nuevo, Santo Domingo Oeste"],
    [/\bbarrio\s+san\s+francisco\b/gi,         "Barrio San Francisco, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Zona Las Caobas ────────────────────────────────
    [/\blas\s+caobas\b/gi,                     "Las Caobas, Santo Domingo Oeste"],
    [/\blas\s+caobitas\b/gi,                   "Las Caobitas, Santo Domingo Oeste"],
    [/\blas\s+colinas\b/gi,                    "Las Colinas, Santo Domingo Oeste"],
    [/\blas\s+palmas\b(?!\s+de\s+herrera)/gi,  "Las Palmas, Santo Domingo Oeste"],
    [/\bel\s+libertador\b/gi,                  "El Libertador, Santo Domingo Oeste"],
    [/\bsavica\b/gi,                            "Savica, Santo Domingo Oeste"],
    [/\bbuenos\s+aires\s+de\s+las\s+caobas\b/gi, "Buenos Aires de Las Caobas, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+las\s+caobas\b/gi, "Urbanización Las Caobas, Santo Domingo Oeste"],
    [/\baltos\s+de\s+las\s+caobas\b/gi,        "Altos de Las Caobas, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Zona Bayona / Manoguayabo ──────────────────────
    [/\bbayona\b/gi,                            "Bayona, Santo Domingo Oeste"],
    [/\bmanoguayabo\b/gi,                       "Manoguayabo, Santo Domingo Oeste"],
    [/\bbuenos\s+aires\s+de\s+manoguayabo\b/gi,"Buenos Aires de Manoguayabo, Santo Domingo Oeste"],
    [/\bel\s+hoyo\s+de\s+manoguayabo\b/gi,     "El Hoyo de Manoguayabo, Santo Domingo Oeste"],
    [/\bbarrio\s+san\s+miguel\b/gi,            "Barrio San Miguel, Santo Domingo Oeste"],
    [/\bla\s+venta\b/gi,                        "La Venta, Santo Domingo Oeste"],
    [/\bel\s+8\s+de\s+bayona\b/gi,             "El 8 de Bayona, Santo Domingo Oeste"],
    [/\bbarrio\s+enriquillo\b/gi,              "Barrio Enriquillo, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Zona Engombe ───────────────────────────────────
    [/\bengombe\b/gi,                           "Engombe, Santo Domingo Oeste"],
    [/\baltos\s+de\s+engombe\b/gi,             "Altos de Engombe, Santo Domingo Oeste"],
    [/\bla\s+ure[nñ]a\b/gi,                   "La Ureña, Santo Domingo Oeste"],
    [/\bbarrio\s+progreso\b/gi,               "Barrio Progreso, Santo Domingo Oeste"],
    [/\bbarrio\s+libertad\b/gi,               "Barrio Libertad, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+engombe\b/gi,  "Urbanización Engombe, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Zona Hato Nuevo / Expansión ────────────────────
    [/\bhato\s+nuevo\b/gi,                     "Hato Nuevo, Santo Domingo Oeste"],
    [/\bcaballona\b/gi,                         "Caballona, Santo Domingo Oeste"],
    [/\blechería\b/gi,                          "Lechería, Santo Domingo Oeste"],
    [/\bbatey\s+bienvenido\b/gi,              "Batey Bienvenido, Santo Domingo Oeste"],
    [/\bnuevo\s+horizonte\b/gi,               "Barrio Nuevo Horizonte, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Residenciales y Urbanizaciones ─────────────────
    [/\bres(?:idencial)?\s+carmen\s+renata\b/gi, "Residencial Carmen Renata, Santo Domingo Oeste"],
    [/\bbrisas\s+del\s+oeste\b/gi,            "Residencial Brisas del Oeste, Santo Domingo Oeste"],
    [/\bciudad\s+agraria\b/gi,                "Ciudad Agraria, Santo Domingo Oeste"],
    [/\boperaciones\s+especiales\b/gi,         "Operaciones Especiales, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+antonia\b/gi,       "Residencial Antonia, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+altagracia\b/gi,    "Residencial Altagracia, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+el\s+caf[eé]\b/gi, "Urbanización El Café, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+las\s+palmas\b/gi,  "Urbanización Las Palmas, Santo Domingo Oeste"],
    [/\bdon\s+honorio\b/gi,                    "Residencial Don Honorio, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Sectores en crecimiento ────────────────────────
    [/\barroyo\s+bonito\b/gi,                 "Arroyo Bonito, Santo Domingo Oeste"],
    [/\bel\s+30\s+de\s+mayo\b/gi,            "El 30 de Mayo, Santo Domingo Oeste"],
    [/\bbarrio\s+libertador\b/gi,             "Barrio Libertador, Santo Domingo Oeste"],
    [/\bbarrio\s+progreso\s+ii\b/gi,          "Barrio Progreso II, Santo Domingo Oeste"],
    [/\bla\s+isabela\b/gi,                    "La Isabela, Santo Domingo Oeste"],

    // ── Santo Domingo Oeste – Corredores viales clave ────────────────────────
    [/\bautopista\s+duarte\b/gi,              "Autopista Duarte, Santo Domingo Oeste"],
    [/\bprol(?:ongaci[oó]n)?\s+27\s+de\s+febrero\b/gi, "Prolongación 27 de Febrero, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+isabel\s+aguiar\b/gi,  "Avenida Isabel Aguiar, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+las\s+palmas\b/gi,     "Avenida Las Palmas, Santo Domingo Oeste"],
    [/\bprol(?:ongaci[oó]n)?\s+independencia\b/gi, "Prolongación Independencia, Santo Domingo Oeste"],

    // ── Abreviaturas rápidas SDO ──────────────────────────────────────────────
    [/\bsdo\s+oeste\b/gi,                     "Santo Domingo Oeste"],
    [/\bsd\s+o\b/gi,                          "Santo Domingo Oeste"],

    // ════════════════════════════════════════════════════════════════════════
    // NUEVOS PUNTOS DE REFERENCIA SDO — segunda tanda
    // ════════════════════════════════════════════════════════════════════════

    // ── ZONAS Y MICRO-SECTORES ADICIONALES ───────────────────────────────────
    [/\bla\s+zurza\b/gi,                      "La Zurza, Santo Domingo Oeste"],
    [/\bel\s+café\b(?!\s+de\s+herrera)/gi,    "El Café, Santo Domingo Oeste"],
    [/\bla\s+mosca\b/gi,                      "La Mosca, Santo Domingo Oeste"],
    [/\bel\s+gordo\b/gi,                      "El Gordo, Santo Domingo Oeste"],
    [/\blos\s+girasoles\b/gi,                 "Los Girasoles, Santo Domingo Oeste"],
    [/\blos\s+jardines\s+(?:de\s+)?herrera\b/gi, "Los Jardines de Herrera, Santo Domingo Oeste"],
    [/\blos\s+pinos\s+(?:de\s+)?herrera\b/gi, "Los Pinos de Herrera, Santo Domingo Oeste"],
    [/\blos\s+almendros\b/gi,                 "Los Almendros, Santo Domingo Oeste"],
    [/\bla\s+colonia\b/gi,                    "La Colonia, Santo Domingo Oeste"],
    [/\breparto\s+herrera\b/gi,               "Reparto Herrera, Santo Domingo Oeste"],
    [/\breparto\s+oriental\b/gi,              "Reparto Oriental, Santo Domingo Oeste"],
    [/\bel\s+limonal\b/gi,                    "El Limonal, Santo Domingo Oeste"],
    [/\bla\s+javilla\b/gi,                    "La Javilla, Santo Domingo Oeste"],
    [/\blos\s+ciruelitos\b/gi,                "Los Ciruelitos, Santo Domingo Oeste"],
    [/\bel\s+cachón\b/gi,                     "El Cachón, Santo Domingo Oeste"],
    [/\bla\s+barranquita\b/gi,                "La Barranquita, Santo Domingo Oeste"],
    [/\blos\s+frailes\b/gi,                   "Los Frailes, Santo Domingo Oeste"],
    [/\bvilla\s+mella\s+(?:oeste|sdo)\b/gi,   "Villa Mella Oeste, Santo Domingo Oeste"],
    [/\bel\s+carril\b/gi,                     "El Carril, Santo Domingo Oeste"],

    // ── CALLES ADICIONALES ────────────────────────────────────────────────────
    [/\bav(?:enida)?\s+hermanos\s+deligne\b/gi,  "Avenida Hermanos Deligne, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+jacobo\s+majluta\b/gi,    "Avenida Jacobo Majluta, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+circunvalaci[oó]n\b/gi,   "Avenida Circunvalación, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+(?:de\s+)?los\s+pr[oó]ceres\b/gi, "Avenida de los Próceres, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+lup[eé]r[oó]n\b/gi,      "Avenida Luperón, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+s[aá]nchez\b/gi,          "Avenida Sánchez, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+mella\b/gi,               "Avenida Mella, Santo Domingo Oeste"],
    [/\bav(?:enida)?\s+padre\s+castellanos\b/gi, "Avenida Padre Castellanos, Santo Domingo Oeste"],
    [/\bcalle\s+los\s+mameyes\b/gi,              "Calle Los Mameyes, Santo Domingo Oeste"],
    [/\bcalle\s+los\s+cacao\b/gi,                "Calle Los Cacao, Santo Domingo Oeste"],
    [/\bcalle\s+las\s+flores\b/gi,               "Calle Las Flores, Santo Domingo Oeste"],
    [/\bcalle\s+las\s+rosas\b/gi,                "Calle Las Rosas, Santo Domingo Oeste"],
    [/\bcalle\s+los\s+almendros\b/gi,            "Calle Los Almendros, Santo Domingo Oeste"],
    [/\bcalle\s+san\s+juan\b/gi,                 "Calle San Juan, Santo Domingo Oeste"],
    [/\bcalle\s+san\s+pedro\b/gi,                "Calle San Pedro, Santo Domingo Oeste"],
    [/\bcalle\s+san\s+pablo\b/gi,                "Calle San Pablo, Santo Domingo Oeste"],
    [/\bcalle\s+san\s+luis\b/gi,                 "Calle San Luis, Santo Domingo Oeste"],
    [/\bcalle\s+san\s+rafael\b/gi,               "Calle San Rafael, Santo Domingo Oeste"],
    [/\bcalle\s+el\s+mamey\b/gi,                 "Calle El Mamey, Santo Domingo Oeste"],
    [/\bcalle\s+el\s+jobo\b/gi,                  "Calle El Jobo, Santo Domingo Oeste"],
    [/\bcalle\s+principal\s+bayona\b/gi,          "Calle Principal Bayona, Santo Domingo Oeste"],
    [/\bcalle\s+principal\s+engombe\b/gi,         "Calle Principal Engombe, Santo Domingo Oeste"],
    [/\bcalle\s+principal\s+las\s+caobas\b/gi,   "Calle Principal Las Caobas, Santo Domingo Oeste"],
    [/\bcalle\s+principal\s+manoguayabo\b/gi,     "Calle Principal Manoguayabo, Santo Domingo Oeste"],
    [/\bcalle\s+principal\s+engombe\b/gi,         "Calle Principal Engombe, Santo Domingo Oeste"],
    [/\bcalle\s+21\b(?:\s+herrera)?/gi,          "Calle 21, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+22\b(?:\s+herrera)?/gi,          "Calle 22, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+23\b(?:\s+herrera)?/gi,          "Calle 23, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+24\b(?:\s+herrera)?/gi,          "Calle 24, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+25\b(?:\s+herrera)?/gi,          "Calle 25, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+g\b(?:\s+herrera)?/gi,           "Calle G, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+h\b(?:\s+herrera)?/gi,           "Calle H, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+i\b(?:\s+herrera)?/gi,           "Calle I, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+j\b(?:\s+herrera)?/gi,           "Calle J, Herrera, Santo Domingo Oeste"],
    [/\bcalle\s+k\b(?:\s+herrera)?/gi,           "Calle K, Herrera, Santo Domingo Oeste"],

    // ── COLEGIOS Y CENTROS EDUCATIVOS ADICIONALES ────────────────────────────
    [/\bcolegio\s+san\s+judas\s+tadeo\b/gi,      "Colegio San Judas Tadeo, Santo Domingo Oeste"],
    [/\bcolegio\s+nuestra\s+se[nñ]ora\s+(?:de\s+)?la\s+paz\b/gi, "Colegio Nuestra Señora de la Paz, Santo Domingo Oeste"],
    [/\bcolegio\s+la\s+paz\s+herrera\b/gi,       "Colegio La Paz, Herrera, Santo Domingo Oeste"],
    [/\bcolegio\s+el\s+camino\b/gi,              "Colegio El Camino, Santo Domingo Oeste"],
    [/\bcolegio\s+bilingüe\s+herrera\b/gi,       "Colegio Bilingüe Herrera, Santo Domingo Oeste"],
    [/\binstituto\s+salesiano\s+herrera\b/gi,    "Instituto Salesiano Herrera, Santo Domingo Oeste"],
    [/\bcolegio\s+la\s+salle\s+bayona\b/gi,      "Colegio La Salle Bayona, Santo Domingo Oeste"],
    [/\bescuela\s+(?:b[aá]sica\s+)?arroyo\s+bonito\b/gi, "Escuela Arroyo Bonito, Santo Domingo Oeste"],
    [/\bescuela\s+(?:b[aá]sica\s+)?villa\s+mella\b/gi,   "Escuela Villa Mella Oeste, Santo Domingo Oeste"],
    [/\bcentro\s+educativo\s+herrera\b/gi,       "Centro Educativo Herrera, Santo Domingo Oeste"],
    [/\bcolegio\s+jard[ií]n\s+de\s+ni[nñ]os\b/gi, "Colegio Jardín de Niños, Santo Domingo Oeste"],
    [/\bescuela\s+técnica\s+herrera\b/gi,        "Escuela Técnica Herrera, Santo Domingo Oeste"],
    [/\binstituto\s+técnico\s+(?:de\s+)?herrera\b/gi, "Instituto Técnico Herrera, Santo Domingo Oeste"],
    [/\buniversidad\s+abierta\s+(?:herrera|sdo)\b/gi, "Universidad Abierta SDO, Santo Domingo Oeste"],
    [/\binfotep\s+herrera\b/gi,                  "INFOTEP Herrera, Santo Domingo Oeste"],
    [/\binfotep\s+(?:de\s+)?bayona\b/gi,         "INFOTEP Bayona, Santo Domingo Oeste"],

    // ── CLÍNICAS Y SALUD ADICIONAL ────────────────────────────────────────────
    [/\bcl[ií]nica\s+el\s+buen\s+pastor\b/gi,    "Clínica El Buen Pastor, Santo Domingo Oeste"],
    [/\bcl[ií]nica\s+san\s+juan\s+herrera\b/gi,  "Clínica San Juan, Herrera, Santo Domingo Oeste"],
    [/\bcl[ií]nica\s+nova\s+herrera\b/gi,        "Clínica Nova Herrera, Santo Domingo Oeste"],
    [/\bcl[ií]nica\s+dra?\.\s+\w+\s+herrera\b/gi,"Clínica Herrera, Santo Domingo Oeste"],
    [/\bunidad\s+médica\s+herrera\b/gi,          "Unidad Médica Herrera, Santo Domingo Oeste"],
    [/\blaboratorio\s+(?:cl[ií]nico\s+)?herrera\b/gi, "Laboratorio Clínico Herrera, Santo Domingo Oeste"],
    [/\blaboratorio\s+bayona\b/gi,               "Laboratorio Bayona, Santo Domingo Oeste"],
    [/\bóptica\s+herrera\b/gi,                   "Óptica Herrera, Santo Domingo Oeste"],
    [/\bdentista\s+herrera\b/gi,                 "Dentista Herrera, Santo Domingo Oeste"],
    [/\bcl[ií]nica\s+dental\s+herrera\b/gi,      "Clínica Dental Herrera, Santo Domingo Oeste"],
    [/\bfarmacia\s+roma\s+herrera\b/gi,          "Farmacia Roma Herrera, Santo Domingo Oeste"],
    [/\bfarmacia\s+sim[oó]n\s+bolívar\s+herrera\b/gi, "Farmacia Simón Bolívar, Herrera, Santo Domingo Oeste"],
    [/\bfarmacia\s+carol\s+las\s+caobas\b/gi,    "Farmacia Carol Las Caobas, Santo Domingo Oeste"],
    [/\bfarmacia\s+el\s+roble\b/gi,              "Farmacia El Roble, Santo Domingo Oeste"],
    [/\bfarmacia\s+san\s+mart[ií]n\s+herrera\b/gi, "Farmacia San Martín, Herrera, Santo Domingo Oeste"],

    // ── NEGOCIOS Y SERVICIOS ADICIONALES ─────────────────────────────────────
    [/\bferro\s+norte\s+herrera\b/gi,            "Ferro Norte Herrera, Santo Domingo Oeste"],
    [/\bferro\s+centro\s+herrera\b/gi,           "Ferro Centro Herrera, Santo Domingo Oeste"],
    [/\bdeposito\s+(?:de\s+)?materiales\s+herrera\b/gi, "Depósito de Materiales Herrera, Santo Domingo Oeste"],
    [/\bdeposito\s+(?:de\s+)?materiales\s+bayona\b/gi,  "Depósito de Materiales Bayona, Santo Domingo Oeste"],
    [/\bcervecería\s+(?:nacional\s+)?herrera\b/gi, "Cervecería Nacional Herrera, Santo Domingo Oeste"],
    [/\brivera\s+herrera\b/gi,                   "Rivera Herrera, Santo Domingo Oeste"],
    [/\bcolmena\s+herrera\b/gi,                  "Colmena Herrera, Santo Domingo Oeste"],
    [/\bwanda\s+herrera\b/gi,                    "Wanda Herrera, Santo Domingo Oeste"],
    [/\bel\s+barrigón\b/gi,                      "El Barrigón, Santo Domingo Oeste"],
    [/\bel\s+ticket\s+herrera\b/gi,              "El Ticket Herrera, Santo Domingo Oeste"],
    [/\bcopy\s+(?:center\s+)?herrera\b/gi,        "Copy Center Herrera, Santo Domingo Oeste"],
    [/\bimpresiones\s+herrera\b/gi,              "Impresiones Herrera, Santo Domingo Oeste"],
    [/\bwestern\s+union\s+herrera\b/gi,          "Western Union Herrera, Santo Domingo Oeste"],
    [/\bmoneygram\s+herrera\b/gi,                "MoneyGram Herrera, Santo Domingo Oeste"],
    [/\bpagos\s+(?:en\s+l[ií]nea\s+)?herrera\b/gi, "Pagos Herrera, Santo Domingo Oeste"],
    [/\binternet\s+caf[eé]\s+herrera\b/gi,       "Internet Café Herrera, Santo Domingo Oeste"],
    [/\bmercadom[oó]vil\s+herrera\b/gi,          "MercadoMóvil Herrera, Santo Domingo Oeste"],
    [/\bclaro\s+hogar\s+herrera\b/gi,            "Claro Hogar Herrera, Santo Domingo Oeste"],
    [/\boficina\s+(?:de\s+)?claro\s+herrera\b/gi,"Oficina Claro Herrera, Santo Domingo Oeste"],
    [/\btaller\s+(?:mec[aá]nico\s+)?herrera\b/gi,"Taller Mecánico Herrera, Santo Domingo Oeste"],
    [/\btaller\s+(?:mec[aá]nico\s+)?bayona\b/gi, "Taller Mecánico Bayona, Santo Domingo Oeste"],
    [/\bautorepuestos?\s+herrera\b/gi,           "Autorepuestos Herrera, Santo Domingo Oeste"],
    [/\bautorepuestos?\s+bayona\b/gi,            "Autorepuestos Bayona, Santo Domingo Oeste"],
    [/\bgomera\s+herrera\b/gi,                   "Gomera Herrera, Santo Domingo Oeste"],
    [/\bgomera\s+bayona\b/gi,                    "Gomera Bayona, Santo Domingo Oeste"],
    [/\bcar\s+wash\s+herrera\b/gi,               "Car Wash Herrera, Santo Domingo Oeste"],
    [/\blavado\s+(?:de\s+autos\s+)?herrera\b/gi, "Lavado de Autos Herrera, Santo Domingo Oeste"],
    [/\bservi\s+centro\s+herrera\b/gi,           "Servi Centro Herrera, Santo Domingo Oeste"],
    [/\bpintura\s+(?:y\s+colisión\s+)?herrera\b/gi, "Pintura y Colisión Herrera, Santo Domingo Oeste"],
    [/\bair\s+express\s+herrera\b/gi,            "Air Express Herrera, Santo Domingo Oeste"],
    [/\bservi-cargo\s+herrera\b/gi,              "Servi-Cargo Herrera, Santo Domingo Oeste"],
    [/\balmac[eé]n\s+roma\s+herrera\b/gi,        "Almacén Roma Herrera, Santo Domingo Oeste"],

    // ── IGLESIAS ADICIONALES ──────────────────────────────────────────────────
    [/\biglesia\s+testigos\s+(?:de\s+jehov[aá]\s+)?herrera\b/gi, "Iglesia Testigos de Jehová, Herrera, Santo Domingo Oeste"],
    [/\biglesia\s+mormones?\s+herrera\b/gi,      "Iglesia Mormones Herrera, Santo Domingo Oeste"],
    [/\biglesia\s+el\s+aposento\s+alto\b/gi,     "Iglesia El Aposento Alto, Santo Domingo Oeste"],
    [/\biglesia\s+palabra\s+de\s+vida\b/gi,      "Iglesia Palabra de Vida, Santo Domingo Oeste"],
    [/\biglesia\s+rey\s+de\s+reyes\b/gi,         "Iglesia Rey de Reyes, Santo Domingo Oeste"],
    [/\biglesia\s+nueva\s+vida\s+herrera\b/gi,   "Iglesia Nueva Vida, Herrera, Santo Domingo Oeste"],
    [/\biglesia\s+dios\s+es\s+amor\s+herrera\b/gi, "Iglesia Dios es Amor, Herrera, Santo Domingo Oeste"],
    [/\bcongregaci[oó]n\s+cristiana\s+herrera\b/gi, "Congregación Cristiana Herrera, Santo Domingo Oeste"],
    [/\btabern[aá]culo\s+herrera\b/gi,           "Tabernáculo Herrera, Santo Domingo Oeste"],
    [/\biglesia\s+(?:de\s+)?hato\s+nuevo\b/gi,   "Iglesia Hato Nuevo, Santo Domingo Oeste"],

    // ── CANCHAS Y ESPACIOS ADICIONALES ───────────────────────────────────────
    [/\bcancha\s+(?:de\s+)?los\s+girasoles\b/gi, "Cancha Los Girasoles, Santo Domingo Oeste"],
    [/\bcancha\s+(?:de\s+)?los\s+pinos\b/gi,     "Cancha Los Pinos, Santo Domingo Oeste"],
    [/\bcancha\s+(?:de\s+)?caballona\b/gi,       "Cancha Caballona, Santo Domingo Oeste"],
    [/\bcancha\s+(?:de\s+)?arroyo\s+bonito\b/gi, "Cancha Arroyo Bonito, Santo Domingo Oeste"],
    [/\bparque\s+(?:de\s+)?caballona\b/gi,       "Parque Caballona, Santo Domingo Oeste"],
    [/\bparque\s+(?:de\s+)?hato\s+nuevo\b/gi,    "Parque Hato Nuevo, Santo Domingo Oeste"],
    [/\bparque\s+(?:de\s+)?olimpo\b/gi,          "Parque Olimpo, Santo Domingo Oeste"],
    [/\bparque\s+(?:de\s+)?arroyo\s+bonito\b/gi, "Parque Arroyo Bonito, Santo Domingo Oeste"],
    [/\bplaza\s+deportiva\s+bayona\b/gi,         "Plaza Deportiva Bayona, Santo Domingo Oeste"],
    [/\bgi(?:mn)?asio\s+bayona\b/gi,             "Gimnasio Bayona, Santo Domingo Oeste"],
    [/\bgi(?:mn)?asio\s+engombe\b/gi,            "Gimnasio Engombe, Santo Domingo Oeste"],
    [/\bcampo\s+(?:de\s+)?b[eé]isbol\s+engombe\b/gi, "Campo de Béisbol Engombe, Santo Domingo Oeste"],
    [/\bcampo\s+(?:de\s+)?b[eé]isbol\s+manoguayabo\b/gi, "Campo de Béisbol Manoguayabo, Santo Domingo Oeste"],
    [/\bcampo\s+(?:de\s+)?b[eé]isbol\s+las\s+caobas\b/gi, "Campo de Béisbol Las Caobas, Santo Domingo Oeste"],

    // ── PUNTOS KM Y REFERENCIAS VIALES ADICIONALES ───────────────────────────
    [/\bkm\s*16\b/gi,                            "Km 16 Autopista Duarte, Santo Domingo Oeste"],
    [/\bkm\s*17\b/gi,                            "Km 17 Autopista Duarte, Santo Domingo Oeste"],
    [/\bkm\s*18\b/gi,                            "Km 18 Autopista Duarte, Santo Domingo Oeste"],
    [/\bkm\s*19\b/gi,                            "Km 19 Autopista Duarte, Santo Domingo Oeste"],
    [/\bkm\s*20\b/gi,                            "Km 20 Autopista Duarte, Santo Domingo Oeste"],
    [/\bentrada\s+(?:de\s+)?bayona\b/gi,         "Entrada de Bayona, Santo Domingo Oeste"],
    [/\bentrada\s+(?:de\s+)?engombe\b/gi,        "Entrada de Engombe, Santo Domingo Oeste"],
    [/\bentrada\s+(?:de\s+)?las\s+caobas\b/gi,  "Entrada de Las Caobas, Santo Domingo Oeste"],
    [/\bentrada\s+(?:de\s+)?manoguayabo\b/gi,   "Entrada de Manoguayabo, Santo Domingo Oeste"],
    [/\bentrada\s+(?:de\s+)?hato\s+nuevo\b/gi,  "Entrada de Hato Nuevo, Santo Domingo Oeste"],
    [/\bsalida\s+(?:de\s+)?bayona\b/gi,         "Salida de Bayona, Santo Domingo Oeste"],
    [/\bcurva\s+(?:de\s+)?herrera\b/gi,         "Curva de Herrera, Santo Domingo Oeste"],
    [/\bcurva\s+(?:de\s+)?bayona\b/gi,          "Curva de Bayona, Santo Domingo Oeste"],
    [/\bcurva\s+(?:de\s+)?engombe\b/gi,         "Curva de Engombe, Santo Domingo Oeste"],
    [/\bcruce\s+(?:de\s+)?herrera\b/gi,         "Cruce de Herrera, Santo Domingo Oeste"],
    [/\bcruce\s+(?:de\s+)?bayona\b/gi,          "Cruce de Bayona, Santo Domingo Oeste"],
    [/\bcruce\s+(?:de\s+)?manoguayabo\b/gi,     "Cruce de Manoguayabo, Santo Domingo Oeste"],
    [/\bcallejón\s+(?:de\s+)?herrera\b/gi,      "Callejón de Herrera, Santo Domingo Oeste"],
    [/\bintercambiador\s+herrera\b/gi,          "Intercambiador Herrera, Santo Domingo Oeste"],
    [/\bintercambiador\s+(?:de\s+)?bayona\b/gi, "Intercambiador Bayona, Santo Domingo Oeste"],
    [/\bpaso\s+elevado\s+herrera\b/gi,          "Paso Elevado Herrera, Santo Domingo Oeste"],
    [/\bpaso\s+(?:a\s+)?nivel\s+herrera\b/gi,  "Paso a Nivel Herrera, Santo Domingo Oeste"],

    // ── RESIDENCIALES ADICIONALES ─────────────────────────────────────────────
    [/\bres(?:idencial)?\s+las\s+américas\s+(?:herrera|sdo)\b/gi, "Residencial Las Américas, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+los\s+pinos\s+(?:herrera|sdo)\b/gi,    "Residencial Los Pinos, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+el\s+roble\b/gi,      "Residencial El Roble, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+villa\s+linda\b/gi,   "Residencial Villa Linda, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+el\s+caf[eé]\b/gi,    "Residencial El Café, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+palmas\s+del\s+norte\b/gi, "Residencial Palmas del Norte, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+la\s+esperanza\b/gi,  "Residencial La Esperanza, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+los\s+girasoles\b/gi, "Residencial Los Girasoles, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+monte\s+verde\b/gi,   "Residencial Monte Verde, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+jardines\s+del\s+norte\b/gi, "Residencial Jardines del Norte, Santo Domingo Oeste"],
    [/\bres(?:idencial)?\s+nuevo\s+herrera\b/gi, "Residencial Nuevo Herrera, Santo Domingo Oeste"],
    [/\bvillas\s+(?:de\s+)?herrera\b/gi,         "Villas de Herrera, Santo Domingo Oeste"],
    [/\bvillas\s+(?:de\s+)?bayona\b/gi,          "Villas de Bayona, Santo Domingo Oeste"],
    [/\bvillas\s+(?:de\s+)?engombe\b/gi,         "Villas de Engombe, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+nueva\s+herrera\b/gi, "Urbanización Nueva Herrera, Santo Domingo Oeste"],
    [/\burb(?:anizaci[oó]n)?\s+los\s+pinos\b/gi, "Urbanización Los Pinos, Santo Domingo Oeste"],

    // ── INSTITUCIONES ADICIONALES ─────────────────────────────────────────────
    [/\bministerio\s+(?:de\s+)?salud\s+herrera\b/gi, "Ministerio de Salud Herrera, Santo Domingo Oeste"],
    [/\bjunta\s+electoral\s+herrera\b/gi,        "Junta Electoral Herrera, Santo Domingo Oeste"],
    [/\bjce\s+herrera\b/gi,                      "JCE Herrera, Santo Domingo Oeste"],
    [/\boficina\s+(?:de\s+)?interior\s+herrera\b/gi, "Oficina Interior Herrera, Santo Domingo Oeste"],
    [/\bmigración\s+herrera\b/gi,                "Migración Herrera, Santo Domingo Oeste"],
    [/\bdirección\s+(?:de\s+)?impuestos\s+herrera\b/gi, "DGII Herrera, Santo Domingo Oeste"],
    [/\bdgii\s+herrera\b/gi,                     "DGII Herrera, Santo Domingo Oeste"],
    [/\btesorería\s+herrera\b/gi,                "Tesorería Herrera, Santo Domingo Oeste"],
    [/\bregistro\s+mercantil\s+herrera\b/gi,     "Registro Mercantil Herrera, Santo Domingo Oeste"],
    [/\bnotaría\s+herrera\b/gi,                  "Notaría Herrera, Santo Domingo Oeste"],
    [/\bbanco\s+agi\s+herrera\b/gi,              "Banco BDI Herrera, Santo Domingo Oeste"],
    [/\bbanco\s+vimenca\s+herrera\b/gi,          "Banco Vimenca Herrera, Santo Domingo Oeste"],
    [/\bassociaci[oó]n\s+(?:cibao|popular)\s+herrera\b/gi, "Asociación Cibao Herrera, Santo Domingo Oeste"],
    [/\bcoopverde\s+herrera\b/gi,                "CoopVerde Herrera, Santo Domingo Oeste"],
    [/\bcooperativa\s+herrera\b/gi,              "Cooperativa Herrera, Santo Domingo Oeste"],
  ];

  for (const [pat, repl] of abbrevs) r = r.replace(pat, repl);

  // 4. Limpiar espacios múltiples y comas duplicadas
  r = r.replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();

  return r;
};

// Score Google result quality
const scoreGoogleResult = (result, original) => {
  const types = result.types || [];
  const addr  = result.formatted_address || "";
  let score = 55;

  // Tipo de resultado (cuanto más específico, mejor)
  if      (types.includes("street_address"))            score = 96;
  else if (types.includes("premise"))                   score = 93;
  else if (types.includes("subpremise"))                score = 91;
  else if (types.includes("route"))                     score = 82;
  else if (types.includes("intersection"))              score = 80;
  else if (types.includes("neighborhood"))              score = 70;
  else if (types.includes("sublocality"))               score = 68;
  else if (types.includes("sublocality_level_1"))       score = 68;
  else if (types.includes("sublocality_level_2"))       score = 65;
  else if (types.includes("locality"))                  score = 60;
  else if (types.includes("administrative_area_level_1")) score = 40;
  else if (types.includes("country"))                   score = 20;

  // Bonus: original tiene número Y el resultado también → más preciso
  const origHasNum = /\d/.test(original);
  const resHasNum  = /\d/.test(addr);
  if (origHasNum && resHasNum)   score = Math.min(score + 5, 99);
  if (origHasNum && !resHasNum)  score = Math.max(score - 8, 10); // no encontró el número

  // Bonus: resultado está dentro de la bounding box de RD
  const loc = result.geometry.location;
  const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
  if (lat < 17.4 || lat > 19.9 || lng < -72.1 || lng > -68.3) {
    score = Math.max(score - 50, 3); // resultado fuera de RD → descartar
  }

  // Bonus: la dirección formateada contiene la ciudad/sector del original
  const origLower = (original || "").toLowerCase();
  const addrLower = addr.toLowerCase();
  if (/santo domingo|santiago|la romana|punta cana|san pedro|barahona|moca|bonao/.test(origLower)) {
    const city = origLower.match(/santo domingo|santiago|la romana|punta cana|san pedro|barahona|moca|bonao/)?.[0];
    if (city && addrLower.includes(city)) score = Math.min(score + 5, 99);
    else if (city && !addrLower.includes(city)) score = Math.max(score - 8, 5);
  }

  // Bonus: resultado tiene número de calle cuando el original también lo tiene
  const numInOrig = (original || "").match(/\d{1,4}/g);
  if (numInOrig) {
    const anyMatch = numInOrig.some(n => addr.includes(n));
    if (anyMatch) score = Math.min(score + 3, 99);
  }

  // Penalizar si el resultado es solo país/provincia (demasiado vago)
  if (types.includes("country") || types.includes("administrative_area_level_1")) score = Math.min(score, 20);

  return Math.min(Math.max(score, 1), 99);
};

// --- PLUS CODE → LAT/LNG via Google ------------------------------------------
const decodePlusCodeGoogle = async (code) => {
  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  const query = code.includes(" ") ? code : code + " Santo Domingo";
  try {
    const r = await new Promise((res, rej) =>
      geocoder.geocode({ address: query }, (results, status) =>
        status === "OK" ? res(results) : rej(status))
    );
    if (r?.[0]) {
      const loc = r[0].geometry.location;
      return { ok: true, lat: loc.lat(), lng: loc.lng(), display: r[0].formatted_address, confidence: 99 };
    }
  } catch {}
  return { ok: false };
};

// --- COORDINATE DETECTOR - acepta múltiples formatos ---
// Detecta: "18.4714,-69.9318" | "18.4714, -69.9318" | links de Google Maps
const detectCoords = (s) => {
  const t = (s || "").trim();

  // Formato: lat,lng o lat, lng (con o sin espacios)
  const pair = t.match(/^(-?\d{1,3}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})$/);
  if (pair) {
    const lat = parseFloat(pair[1]), lng = parseFloat(pair[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Link de Google Maps: https://maps.google.com/?q=18.4714,-69.9318
  const gmLink = t.match(/[?&]q=(-?\d{1,3}\.\d{3,})[,+](-?\d{1,3}\.\d{3,})/);
  if (gmLink) {
    const lat = parseFloat(gmLink[1]), lng = parseFloat(gmLink[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Link de Google Maps con @lat,lng
  const atLink = t.match(/@(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
  if (atLink) {
    const lat = parseFloat(atLink[1]), lng = parseFloat(atLink[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  return null;
};

// Plus Code detector: acepta códigos completos (8+2) y cortos (con ciudad)
// Ejemplos: "G2F8+7G3" | "G2F8+7G3 Santo Domingo" | "7G3 Santo Domingo"
const isPlusCode = (s) => {
  const t = (s || "").trim();
  // Código completo: XXXXXXXX+XX o XXXX+XX
  if (/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}/i.test(t)) return true;
  // Código corto + ciudad: XX+XX Ciudad
  if (/^[23456789CFGHJMPQRVWX]{2,}\+[23456789CFGHJMPQRVWX]{2,}\s+\w/i.test(t)) return true;
  return false;
};

// --- HAVERSINE (fallback local cuando Routes API no disponible) ---------------
const hav = (a, b) => {
  const R = 6371, dl = ((b.lat - a.lat) * Math.PI) / 180, dg = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dg / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// --- ROUTES API v2 — WAYPOINT OPTIMIZER REAL ---------------------------------
// Usa calles reales, sentidos de vía y tráfico de Santo Domingo.
// Google permite hasta 25 waypoints intermedios por solicitud.
// Chunking automático si hay más de 25 paradas válidas.
const optimizeWithRoutesAPI = async (validStops) => {
  // Máximo 25 waypoints por llamada a la API
  const CHUNK = 25;
  if (validStops.length <= 1) return validStops.map((s, i) => ({ ...s, stopNum: i + 1 }));

  // Helper: llamada a la Routes API v2 para un chunk
  const callRoutesAPI = async (chunk) => {
    const waypoints = chunk.map(s => ({
      location: { latLng: { latitude: s.lat, longitude: s.lng } },
    }));

    const body = {
      origin:      { location: { latLng: { latitude: DEPOT.lat,  longitude: DEPOT.lng  } } },
      destination: { location: { latLng: { latitude: DEPOT.lat,  longitude: DEPOT.lng  } } },
      intermediates: waypoints,
      travelMode: "DRIVE",
      optimizeWaypointOrder: true,
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "es",
    };

    const resp = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GMAPS_KEY,
          "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.legs.duration,routes.legs.distanceMeters",
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) throw new Error(`Routes API HTTP ${resp.status}`);
    const data = await resp.json();

    const route = data?.routes?.[0];
    if (!route?.optimizedIntermediateWaypointIndex) throw new Error("No optimized order returned");

    return {
      order:    route.optimizedIntermediateWaypointIndex,   // índices reordenados
      durations: (route.legs || []).slice(1).map(l =>       // segundos por tramo (sin el tramo depot→1)
        parseInt(l.duration?.replace("s", "") || "0", 10)
      ),
      distances: (route.legs || []).slice(1).map(l => Math.round((l.distanceMeters || 0) / 1000 * 10) / 10),
    };
  };

  // Si entran ≤25 paradas → una sola llamada
  if (validStops.length <= CHUNK) {
    try {
      const { order, durations, distances } = await callRoutesAPI(validStops);
      return order.map((origIdx, newPos) => ({
        ...validStops[origIdx],
        stopNum:      newPos + 1,
        etaMin:       durations[newPos] ? Math.round(durations[newPos] / 60) : null,
        distKmRoutes: distances[newPos] ?? null,
      }));
    } catch (e) {
      console.warn("Routes API falló, usando Haversine:", e.message);
      return null; // señal para caer al fallback
    }
  }

  // Más de 25: dividir en chunks, optimizar cada uno y concatenar
  const ordered = [];
  for (let i = 0; i < validStops.length; i += CHUNK) {
    const chunk = validStops.slice(i, i + CHUNK);
    try {
      const { order, durations, distances } = await callRoutesAPI(chunk);
      const reordered = order.map((origIdx, newPos) => ({
        ...chunk[origIdx],
        stopNum:      ordered.length + newPos + 1,
        etaMin:       durations[newPos] ? Math.round(durations[newPos] / 60) : null,
        distKmRoutes: distances[newPos] ?? null,
      }));
      ordered.push(...reordered);
    } catch {
      // Chunk fallido → mantener orden Haversine para ese chunk
      chunk.forEach((s, j) => ordered.push({ ...s, stopNum: ordered.length + j + 1 }));
    }
  }
  return ordered;
};

// --- NEAREST NEIGHBOR + 2-opt + Or-opt (fallback puro Haversine) --------------
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️  MOTOR DE OPTIMIZACIÓN LOCAL v3 — NO MODIFICAR SIN AUTORIZACIÓN
// Clustering geográfico (CLUSTER_KM) + NN + 2-opt + Or-opt
// Garantiza paradas de la misma zona en bloques CONSECUTIVOS.
// No depende de Routes API — funciona siempre.
// ═══════════════════════════════════════════════════════════════════════════════
const CLUSTER_KM = 2.0; // radio de zona — 2km captura mejor zonas como Las Caobas, Engombe

const optimizeRouteLocal = (stops) => {
  if (!stops || stops.length === 0) return [];
  const valid   = stops.filter(s => s.lat != null && s.lng != null && isFinite(s.lat) && isFinite(s.lng));
  const invalid = stops.filter(s => !(s.lat != null && s.lng != null && isFinite(s.lat) && isFinite(s.lng)));
  if (valid.length === 0) return invalid.map(s => ({ ...s, stopNum: null }));
  if (valid.length === 1) return [{ ...valid[0], stopNum: 1 }, ...invalid.map(s => ({ ...s, stopNum: null }))];

  const depot = { lat: DEPOT.lat, lng: DEPOT.lng };
  const centroid = (idxArr) => ({
    lat: idxArr.reduce((s, i) => s + valid[i].lat, 0) / idxArr.length,
    lng: idxArr.reduce((s, i) => s + valid[i].lng, 0) / idxArr.length,
  });

  // PASO 1: Clustering geográfico greedy
  const clusters = [];
  valid.forEach((stop, si) => {
    let bestCluster = -1, bestDist = CLUSTER_KM;
    clusters.forEach((cl, ci) => {
      const d = hav(stop, centroid(cl));
      if (d < bestDist) { bestDist = d; bestCluster = ci; }
    });
    if (bestCluster === -1) clusters.push([si]);
    else clusters[bestCluster].push(si);
  });

  // PASO 1b: Fusionar outliers solitarios con el cluster más cercano
  // Un cluster de 1 sola parada a >3km de cualquier otro es un "outlier excursión".
  // En vez de visitarlo por separado (crea zigzag), se fusiona con el cluster
  // más cercano para que quede de paso en esa zona.
  const OUTLIER_MERGE_KM = 3.5; // si está a menos de esto del cluster más cercano, fusionar
  let changed = true;
  while (changed) {
    changed = false;
    for (let ci = 0; ci < clusters.length; ci++) {
      if (clusters[ci].length > 1) continue; // solo outliers solitarios
      const c = centroid(clusters[ci]);
      let bestOther = -1, bestDist = Infinity;
      clusters.forEach((cl, oi) => {
        if (oi === ci) return;
        const d = hav(c, centroid(cl));
        if (d < bestDist) { bestDist = d; bestOther = oi; }
      });
      if (bestOther >= 0 && bestDist < OUTLIER_MERGE_KM) {
        clusters[bestOther].push(...clusters[ci]);
        clusters.splice(ci, 1);
        changed = true;
        break;
      }
    }
  }

  // PASO 2: Ordenar clusters desde DEPOT (NN entre centroides)
  let remClusters = clusters.map((_, ci) => ci);
  const ordClusters = [];
  let curPoint = depot;
  while (remClusters.length) {
    let bestPos = 0, bestDist = Infinity;
    remClusters.forEach((ci, pos) => {
      const d = hav(curPoint, centroid(clusters[ci]));
      if (d < bestDist) { bestDist = d; bestPos = pos; }
    });
    const chosen = remClusters.splice(bestPos, 1)[0];
    ordClusters.push(chosen);
    curPoint = centroid(clusters[chosen]);
  }

  // PASO 3: NN dentro de cada cluster desde punto de entrada
  let tour = [];
  let entryPt = depot;
  ordClusters.forEach(ci => {
    let remStops = [...clusters[ci]];
    const clTour = [];
    while (remStops.length) {
      let bestPos = 0, bestDist = Infinity;
      remStops.forEach((si, pos) => {
        const d = hav(entryPt, valid[si]);
        if (d < bestDist) { bestDist = d; bestPos = pos; }
      });
      const chosen = remStops.splice(bestPos, 1)[0];
      clTour.push(valid[chosen]);
      entryPt = valid[chosen];
    }
    tour = tour.concat(clTour);
  });

  // PASO 4: 2-opt global
  let improved = true, iterations = 0;
  while (improved && iterations < 150) {
    improved = false; iterations++;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const A = i === 0 ? depot : tour[i-1], B = tour[i];
        const C = tour[j], D = j+1 < tour.length ? tour[j+1] : depot;
        if (hav(A, C) + hav(B, D) < hav(A, B) + hav(C, D) - 0.001) {
          let l = i, r = j;
          while (l < r) { [tour[l], tour[r]] = [tour[r], tour[l]]; l++; r--; }
          improved = true;
        }
      }
    }
  }

  // PASO 5: Or-opt (mover nodos individuales)
  let orImproved = true, orIter = 0;
  while (orImproved && orIter < 30) {
    orImproved = false; orIter++;
    for (let i = 0; i < tour.length; i++) {
      const node = tour[i], prev = i === 0 ? depot : tour[i-1], next = i === tour.length-1 ? depot : tour[i+1];
      const removeCost = hav(prev, node) + hav(node, next) - hav(prev, next);
      let bestGain = 0.001, bestJ = -1;
      for (let j = 0; j < tour.length; j++) {
        if (j === i || j === i-1) continue;
        const a = tour[j], b = j+1 < tour.length ? tour[j+1] : depot;
        const gain = removeCost - (hav(a, node) + hav(node, b) - hav(a, b));
        if (gain > bestGain) { bestGain = gain; bestJ = j; }
      }
      if (bestJ >= 0) {
        const removed = tour.splice(i, 1)[0];
        tour.splice(bestJ > i ? bestJ : bestJ+1, 0, removed);
        orImproved = true; break;
      }
    }
  }

  return [
    ...tour.map((s, i) => ({ ...s, stopNum: i+1 })),
    ...invalid.map(s => ({ ...s, stopNum: null })),
  ];
};

// ⚠️ Routes API deshabilitada — producía saltos entre zonas.
// Motor v3 local (clustering) da mejores resultados para mensajería urbana en RD.
const optimizeRoute = (stops) => optimizeRouteLocal(stops);

const optimizeRouteAsync = async (stops, onProgress) => {
  onProgress?.("Optimizando con motor de zonas v3…");
  const result = optimizeRouteLocal(stops);
  onProgress?.("✓ Ruta optimizada con motor de zonas");
  return result;
};

const totalKm = (stops) => {
  const v = stops.filter(s => s.lat && s.lng);
  if (!v.length) return 0;
  // Si hay datos reales de la Routes API, sumarlos
  if (v[0]?.distKmRoutes !== undefined && v[0]?.distKmRoutes !== null) {
    return Math.round(v.reduce((acc, s) => acc + (s.distKmRoutes || 0), 0) * 10) / 10;
  }
  return Math.round((v.reduce((acc, s, i) => acc + hav(i === 0 ? DEPOT : v[i - 1], s), 0) + hav(v[v.length - 1], DEPOT)) * 10) / 10;
};

// --- COLUMN AUTODETECT --------------------------------------------------------
const autoDetect = (headers) => {
  const patterns = {
    address:   /direcci[oó]n\b(?!.*2)|^dir$|address(?!.*2)|calle|domicilio|destino|ubicaci[oó]n|lugar|via\b/i,
    address2:  /direcci[oó]n\s*2|dir\.?\s*2|address\s*2|dir2|ref(?:erencia)?|indicaci[oó]n|complement|edificio|apto|piso|local/i,
    client:    /cliente|nombre|name|destinatario|recipient|contacto/i,
    phone:     /tel[eé]fono|phone|m[oó]vil|mobile|celular|tlf|whatsapp/i,
    notes:     /notas?|notes?|observ|instruc|detalle/i,
    sector:    /sector|barrio|colonia|urbanizaci[oó]n|urb|residencial|reparto/i,
    ciudad:    /ciudad|municipio|localidad|town|city/i,
    provincia: /provincia|province|estado|state|dpto|departamento/i,
    cp:        /c[oó]digo\s*postal|cp\b|c\.p\.|zip|postal/i,
    tracking:  /c[oó]digo|tracking|track|guia|gu[ií]a|orden|order|referencia|ref\b|sp\d|barcode/i,
  };
  const m = {};
  headers.forEach(h => {
    Object.entries(patterns).forEach(([f, re]) => { if (!m[f] && re.test(h)) m[f] = h; });
  });
  return m;
};

// --- GOOGLE MAP COMPONENT -----------------------------------------------------
const RouteMap = ({ stops, selectedId, onSelectStop, phase }) => {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polyRef = useRef(null);
  const infoRef = useRef(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (mapRef.current) return;
      mapRef.current = new window.google.maps.Map(ref.current, {
        center: { lat: DEPOT.lat, lng: DEPOT.lng },
        zoom: 12,
        mapTypeId: "roadmap",
        styles: [
          {featureType:"poi",stylers:[{visibility:"off"}]},
          {featureType:"transit",stylers:[{visibility:"off"}]},
          {featureType:"road",elementType:"geometry",stylers:[{color:"#ffffff"}]},
          {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#f0f0f0"}]},
          {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#e8e8e8"}]},
          {featureType:"water",elementType:"geometry",stylers:[{color:"#c9e8f5"}]},
          {featureType:"landscape",elementType:"geometry",stylers:[{color:"#f7f8fa"}]},
          {featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#d1d5db"}]},
          {elementType:"labels.text.fill",stylers:[{color:"#374151"}]},
          {elementType:"labels.text.stroke",stylers:[{color:"#ffffff"}]},
        ],
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      });
      infoRef.current = new window.google.maps.InfoWindow();

      // Depot marker - house icon like Circuit
      const depotSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="21" fill="#1d4ed8" stroke="white" stroke-width="2.5"/><path d="M22 11L11 21h3v12h6v-7h4v7h6V21h3L22 11z" fill="white"/></svg>';
      new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: DEPOT.lat, lng: DEPOT.lng },
        title: DEPOT.label,
        zIndex: 999,
        icon: { url: "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(depotSvg), scaledSize: new window.google.maps.Size(44,44), anchor: new window.google.maps.Point(22,22) },
      });
    });
  }, []);

  const stopsLenRef = useRef(0);

  useEffect(() => {
    if (!mapRef.current) return;
    // Clear old markers properly to prevent memory leaks
    markersRef.current.forEach(m => { m.setMap(null); });
    markersRef.current = [];
    if (polyRef.current) { polyRef.current.setMap(null); polyRef.current = null; }

    const valid = stops.filter(s => s.lat && s.lng && s.stopNum);

    // Draw route polyline
    if (valid.length > 1 && phase === "route") {
      const path = [
        { lat: DEPOT.lat, lng: DEPOT.lng },
        ...valid.map(s => ({ lat: s.lat, lng: s.lng })),
        { lat: DEPOT.lat, lng: DEPOT.lng },
      ];
      polyRef.current = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map: mapRef.current,
      });
    }

    // Inject shared SVG filters once (avoids per-marker filter accumulation)
    if (!document.getElementById("rd-map-filters")) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.id = "rd-map-filters";
      svg.setAttribute("style","position:absolute;width:0;height:0;overflow:hidden");
      svg.innerHTML = `<defs>
        <filter id="rdGlowSel" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="rdGlowNorm" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>`;
      document.body.appendChild(svg);
    }

    // Draw stop markers
    const colMap = { ok: "#3b82f6", warning: "#f59e0b", error: "#ef4444", pending: "#475569" };
    stops.filter(s => s.lat && s.lng).forEach(stop => {
      const isSelected = stop.id === selectedId;
      const col = colMap[stop.status] || "#3b82f6";

      // Detect co-located stops (same lat/lng rounded to 4 decimals)
      const key = `${stop.lat?.toFixed(4)},${stop.lng?.toFixed(4)}`;
      const colocated = stops.filter(s => s.lat && s.lng && `${s.lat?.toFixed(4)},${s.lng?.toFixed(4)}` === key);
      const isCluster = colocated.length > 1;
      const clusterIdx = colocated.findIndex(s => s.id === stop.id);
      // Only render marker for the first of a cluster group (to avoid stacking)
      if (isCluster && clusterIdx !== 0) return;

      const displayStop = isCluster && selectedId
        ? (colocated.find(s => s.id === selectedId) || colocated[0])
        : stop;

      const label = isCluster
        ? (isSelected ? String(displayStop.stopNum || "?") : `${colocated.length}`)
        : String(stop.stopNum || "?");
      const fs = label.length > 2 ? 8 : label.length > 1 ? 10 : 12;
      const w = isSelected ? 40 : 32;
      const filterId = isSelected ? "rdGlowSel" : "rdGlowNorm";
      const clusterRing = isCluster && !isSelected ? `<circle cx="20" cy="20" r="18" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.4" stroke-dasharray="3 2"/>` : "";
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 40 40">${clusterRing}<circle cx="20" cy="20" r="${isSelected?18:14}" fill="${isSelected?col:"#0d1f35"}" filter="url(#${filterId})" stroke="${col}" stroke-width="${isSelected?0:2}"/>${isSelected?`<circle cx="20" cy="20" r="11" fill="rgba(255,255,255,0.2)"/>`:`<circle cx="20" cy="20" r="10" fill="#0a1829"/>`}<text x="20" y="20" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,system-ui,Arial" font-weight="900" font-size="${fs}" fill="${isSelected?"white":col}">${label}</text></svg>`;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: stop.lat, lng: stop.lng },
        icon: { url: "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(pinSvg), scaledSize: new window.google.maps.Size(w, w), anchor: new window.google.maps.Point(w/2, w/2) },
        zIndex: isSelected ? 100 : 10,
        title: isCluster ? `${colocated.length} paquetes aquí · Clic para ciclar` : stop.displayAddr,
      });
      marker.addListener("click", () => {
        if (isCluster) {
          // Cycle through co-located stops
          const curIdx = colocated.findIndex(s => s.id === selectedId);
          const nextIdx = (curIdx + 1) % colocated.length;
          onSelectStop(colocated[nextIdx].id, true);
        } else {
          onSelectStop(stop.id, true);
        }
        infoRef.current.close();
      });
      markersRef.current.push(marker);
    });

    // Fit bounds only when number of valid stops changes (first load / after geocoding)
    const newLen = valid.length;
    if (newLen > 0 && newLen !== stopsLenRef.current) {
      stopsLenRef.current = newLen;
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: DEPOT.lat, lng: DEPOT.lng });
      valid.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
      mapRef.current.fitBounds(bounds, { padding: 40 });
    }
  }, [stops, selectedId, phase]);

  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
};

// --- ADDRESS EDIT MODAL --------------------------------------------------------
// Light mode, UX clara: muestra qué dirección tiene, acepta texto/coords/pluscode

// ─────────────────────────────────────────────────────────────────────────────
// EvidenceCameraModal — Cámara obligatoria para evidencia de entrega/fallo
// ⚠ NO MODIFICAR SIN REVISIÓN — es parte del flujo legal de evidencia
// ─────────────────────────────────────────────────────────────────────────────
const EvidenceCameraModal = ({ stop, mode, onConfirm, onCancel }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const [phase,     setPhase]     = useState("preview");   // preview | captured | saving
  const [photoData, setPhotoData] = useState(null);        // base64 dataURL
  const [camErr,    setCamErr]    = useState(null);
  const [flash,     setFlash]     = useState(false);
  const isDelivered = mode === "delivered";
  const accentColor = isDelivered ? "#10b981" : "#ef4444";
  const label       = isDelivered ? "Entregado" : "Fallido";

  // Iniciar cámara al montar
  useEffect(() => {
    let active = true;
    const startCam = async () => {
      try {
        // Preferir cámara trasera en móvil (mejor calidad de evidencia)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (e) {
        setCamErr(e.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Ve a Ajustes > Navegador > Cámara y actívalo."
          : "No se pudo acceder a la cámara: " + e.message);
      }
    };
    startCam();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const takePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoData(dataUrl);
    setPhase("captured");
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    // Parar stream para liberar cámara
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const retake = () => {
    setPhotoData(null);
    setPhase("preview");
    setCamErr(null);
    // Re-iniciar cámara
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false,
    }).then(stream => {
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    }).catch(e => setCamErr("Error al reiniciar cámara: " + e.message));
  };

  const confirm = () => {
    if (!photoData) return;
    setPhase("saving");
    onConfirm(photoData);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"#000", display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes camFlash { from{opacity:1} to{opacity:0} }
        @keyframes camPop { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Flash overlay */}
      {flash && <div style={{ position:"absolute", inset:0, background:"white", zIndex:10001, animation:"camFlash .2s ease forwards", pointerEvents:"none" }}/>}

      {/* Header */}
      <div style={{ padding:"16px 20px 12px", display:"flex", alignItems:"center", gap:12, background:"rgba(0,0,0,0.8)", flexShrink:0 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${accentColor}22`, border:`1.5px solid ${accentColor}55`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {isDelivered
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:"white", fontFamily:"'Syne',sans-serif" }}>
            📸 Foto de evidencia — {label}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:1 }}>
            {stop.client} · #{stop.tracking || stop.stopNum}
          </div>
        </div>
        <button onClick={onCancel} style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
      </div>

      {/* Viewfinder */}
      <div style={{ flex:1, position:"relative", overflow:"hidden", background:"#111" }}>
        {/* Error de cámara */}
        {camErr && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:30, textAlign:"center", zIndex:10 }}>
            <div style={{ fontSize:40, marginBottom:16 }}>📷</div>
            <div style={{ fontSize:14, color:"#f87171", fontWeight:600, lineHeight:1.5, marginBottom:20 }}>{camErr}</div>
            <button onClick={onCancel} style={{ padding:"10px 24px", borderRadius:10, border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Cancelar
            </button>
          </div>
        )}

        {/* Video preview */}
        {phase === "preview" && !camErr && (
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        )}

        {/* Foto tomada */}
        {phase === "captured" && photoData && (
          <img src={photoData} alt="evidencia"
            style={{ width:"100%", height:"100%", objectFit:"contain", animation:"camPop .2s ease" }}/>
        )}

        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} style={{ display:"none" }}/>

        {/* Overlay de guía cuando está en preview */}
        {phase === "preview" && !camErr && (
          <>
            {/* Esquinas de encuadre */}
            {[["0,0","top:12px;left:12px;border-top-left-radius:6px"],
              ["90deg","top:12px;right:12px;border-top-right-radius:6px"],
              ["180deg","bottom:12px;right:12px;border-bottom-right-radius:6px"],
              ["270deg","bottom:12px;left:12px;border-bottom-left-radius:6px"],
            ].map(([, pos], i) => (
              <div key={i} style={{ position:"absolute", width:28, height:28, borderTop:`2.5px solid ${accentColor}`, borderLeft:`2.5px solid ${accentColor}`, opacity:0.8, ...Object.fromEntries(pos.split(";").map(p => { const [k,v]=p.split(":"); return [k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v?.trim()]; }).filter(([k])=>k)) }}/>
            ))}
            <div style={{ position:"absolute", bottom:80, left:0, right:0, textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.5)", fontFamily:"'Syne',sans-serif" }}>
              Encuadra el paquete o la puerta del cliente
            </div>
          </>
        )}

        {/* Label de estado capturado */}
        {phase === "captured" && (
          <div style={{ position:"absolute", top:12, left:12, background:`${accentColor}dd`, color:"white", padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, fontFamily:"'Syne',sans-serif" }}>
            ✓ Foto capturada
          </div>
        )}
      </div>

      {/* Controles */}
      <div style={{ padding:"20px 24px 28px", background:"rgba(0,0,0,0.9)", flexShrink:0 }}>
        {phase === "preview" && !camErr && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <button onClick={takePhoto}
              style={{ width:72, height:72, borderRadius:"50%", border:`4px solid ${accentColor}`, background:"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 0 0 6px ${accentColor}33` }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:accentColor }}/>
            </button>
          </div>
        )}

        {phase === "captured" && (
          <div style={{ display:"flex", gap:12 }}>
            <button onClick={retake}
              style={{ flex:1, padding:"14px", borderRadius:12, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.7)", fontSize:13, fontWeight:700, fontFamily:"'Syne',sans-serif", cursor:"pointer" }}>
              🔄 Repetir
            </button>
            <button onClick={confirm}
              style={{ flex:2, padding:"14px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`, color:"white", fontSize:13, fontWeight:800, fontFamily:"'Syne',sans-serif", cursor:"pointer", boxShadow:`0 4px 20px ${accentColor}55` }}>
              ✓ Usar esta foto — {label}
            </button>
          </div>
        )}

        {phase === "saving" && (
          <div style={{ textAlign:"center", color:"rgba(255,255,255,0.6)", fontSize:13 }}>
            <div style={{ width:24, height:24, border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"white", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 8px" }}/>
            Guardando evidencia…
          </div>
        )}
      </div>
    </div>
  );
};

const AddressEditModal = ({ stop, onSave, onCancel }) => {
  const inputRef = useRef(null);
  const acRef    = useRef(null);
  const [saving,  setSaving]  = useState(false);
  const [found,   setFound]   = useState(null);  // { display, lat, lng, confidence }
  const [errMsg,  setErrMsg]  = useState("");

  // Inject light-mode pac-container styles
  useEffect(() => {
    const id = "pac-light-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        .pac-container { z-index:99999!important; background:#fff!important; border:1px solid #d1d5db!important; border-radius:12px!important; box-shadow:0 8px 32px rgba(0,0,0,0.15)!important; margin-top:4px!important; font-family:'Inter',sans-serif!important; overflow:hidden!important; }
        .pac-item { background:transparent!important; color:#374151!important; padding:10px 14px!important; cursor:pointer!important; border-top:1px solid #f3f4f6!important; font-size:13px!important; }
        .pac-item:hover,.pac-item-selected { background:#eff6ff!important; }
        .pac-item-query { color:#111827!important; font-size:13px!important; font-weight:600!important; }
        .pac-matched { color:#2563eb!important; }
        .pac-icon { display:none!important; }
        .pac-logo:after { display:none!important; }
      `;
      document.head.appendChild(s);
    }
    loadGoogleMaps().then(() => {
      if (!inputRef.current) return;
      if (acRef.current) { window.google.maps.event.clearInstanceListeners(acRef.current); acRef.current = null; }
      acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "DO" },
        fields: ["formatted_address", "geometry", "name"],
      });
      acRef.current.addListener("place_changed", () => {
        const place = acRef.current.getPlace();
        if (place?.geometry?.location) {
          const result = { display: place.formatted_address || place.name, lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), confidence: 97 };
          setFound(result);
          setErrMsg("");
        }
      });
      setTimeout(() => inputRef.current?.focus(), 60);
    });
    return () => { if (acRef.current) { window.google?.maps?.event?.clearInstanceListeners(acRef.current); acRef.current = null; } };
  }, []);

  const handleSearch = async () => {
    const text = inputRef.current?.value?.trim();
    if (!text) return;
    setFound(null); setErrMsg(""); setSaving(true);
    // Coords? (18.xxx, -69.xxx)
    const coords = detectCoords(text);
    if (coords) {
      setFound({ display: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, lat: coords.lat, lng: coords.lng, confidence: 99 });
      setSaving(false); return;
    }
    // Plus Code?
    if (isPlusCode(text)) {
      const r = await decodePlusCodeGoogle(text);
      if (r.ok) { setFound({ display: r.display || text, lat: r.lat, lng: r.lng, confidence: 99 }); setSaving(false); return; }
    }
    // Google geocoder
    const r = await geocodeWithGoogle(text);
    setSaving(false);
    if (r.ok) { setFound({ display: r.display, lat: r.lat, lng: r.lng, confidence: r.confidence }); }
    else { setErrMsg("No encontrada. Prueba con otro formato o selecciona una sugerencia de la lista."); }
  };

  const handleConfirm = () => { if (found) onSave(found); };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>

      <style>{`@keyframes addrPop{from{opacity:0;transform:scale(.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      <div style={{ width:520, background:"#ffffff", borderRadius:20, boxShadow:"0 24px 64px rgba(0,0,0,0.2)", overflow:"hidden", animation:"addrPop .2s cubic-bezier(.4,0,.2,1)" }}>

        {/* ── HEADER ── */}
        <div style={{ background:"#1d4ed8", padding:"18px 22px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"white" }}>Corregir dirección</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {stop.client} · Parada #{stop.stopNum || "?"}
            </div>
          </div>
          <button onClick={onCancel} style={{ width:30,height:30,borderRadius:8,border:"1px solid rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.1)",color:"white",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>✕</button>
        </div>

        <div style={{ padding:"20px 22px 22px" }}>

          {/* ── DIRECCIÓN ACTUAL ── */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#6b7280",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:5 }}>DIRECCIÓN ACTUAL EN EL SISTEMA</div>
            <div style={{ background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:"10px 14px",display:"flex",gap:8,alignItems:"flex-start" }}>
              <span style={{ fontSize:16,flexShrink:0,marginTop:1 }}>📍</span>
              <div>
                <div style={{ fontSize:13,color:"#111827",fontWeight:500,lineHeight:1.4 }}>{stop.displayAddr || stop.rawAddr || "Sin dirección"}</div>
                {stop.lat && <div style={{ fontSize:10,color:"#9ca3af",marginTop:3,fontFamily:"monospace" }}>{stop.lat?.toFixed(5)}, {stop.lng?.toFixed(5)}</div>}
              </div>
            </div>
          </div>

          {/* ── NUEVA DIRECCIÓN ── */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10,color:"#2563eb",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:6 }}>NUEVA DIRECCIÓN, COORDENADAS O PLUS CODE</div>
            <div style={{ display:"flex",gap:8 }}>
              <input
                ref={inputRef}
                defaultValue=""
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } if (e.key === "Escape") onCancel(); }}
                placeholder="Ej: Av. 27 de Febrero 45, Naco  ·  18.4714,-69.9318  ·  G2F8+7G3"
                autoComplete="off"
                style={{ flex:1, background:"#f9fafb", border:"2px solid #2563eb", borderRadius:10, padding:"11px 14px", color:"#111827", fontSize:13, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#2563eb", boxShadow:"0 0 0 4px rgba(37,99,235,0.1)" }}
              />
              <button onClick={handleSearch} disabled={saving}
                style={{ padding:"11px 16px",borderRadius:10,border:"none",background:"#2563eb",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:saving?"not-allowed":"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:6,opacity:saving?0.7:1,transition:"all .15s" }}>
                {saving ? <div style={{ width:13,height:13,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",borderRadius:"50%",animation:"spin .8s linear infinite" }}/> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
                {saving ? "..." : "Buscar"}
              </button>
            </div>
            <div style={{ fontSize:11,color:"#6b7280",marginTop:6,display:"flex",gap:12 }}>
              <span>💡 Selecciona una sugerencia de la lista o escribe y pulsa Buscar</span>
            </div>
          </div>

          {/* ── RESULTADO ENCONTRADO ── */}
          {found && (
            <div style={{ background:"#f0fdf4",border:"1px solid #86efac",borderRadius:12,padding:"12px 14px",marginBottom:14,animation:"addrPop .2s ease" }}>
              <div style={{ fontSize:10,color:"#16a34a",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:6 }}>✓ DIRECCIÓN ENCONTRADA</div>
              <div style={{ fontSize:13,color:"#111827",fontWeight:600,marginBottom:3 }}>{found.display}</div>
              <div style={{ fontSize:11,color:"#4b5563",fontFamily:"monospace" }}>
                {found.lat?.toFixed(5)}, {found.lng?.toFixed(5)}
                <span style={{ marginLeft:10,background:"#dcfce7",color:"#16a34a",padding:"1px 7px",borderRadius:6,fontSize:10,fontWeight:700,fontFamily:"sans-serif" }}>{found.confidence}% confianza</span>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {errMsg && (
            <div style={{ background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#dc2626" }}>
              ⚠ {errMsg}
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div style={{ display:"flex",gap:8,marginTop:4 }}>
            <button onClick={onCancel}
              style={{ flex:1,padding:"11px",borderRadius:10,border:"1px solid #d1d5db",background:"white",color:"#6b7280",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer" }}>
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!found}
              style={{ flex:2,padding:"11px",borderRadius:10,border:"none",background:found?"#16a34a":"#e5e7eb",color:found?"white":"#9ca3af",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:found?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all .15s",boxShadow:found?"0 4px 16px rgba(22,163,74,0.3)":"none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              {found ? "Guardar esta dirección" : "Busca primero una dirección"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- ADDRESS SEARCH BOX (usado en el editor inline legacy) --------------------
const AddressSearchBox = ({ value, onChange, onSelect, placeholder }) => {
  const ref = useRef(null);
  const acRef = useRef(null);
  useEffect(() => {
    loadGoogleMaps().then(() => {
      setTimeout(() => {
        if (acRef.current || !ref.current) return;
        acRef.current = new window.google.maps.places.Autocomplete(ref.current, {
          componentRestrictions: { country: "DO" },
          fields: ["formatted_address", "geometry", "name"],
        });
        acRef.current.addListener("place_changed", () => {
          const place = acRef.current.getPlace();
          if (place?.geometry) onSelect({ display: place.formatted_address || place.name, lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), confidence: 97 });
        });
        ref.current?.focus();
      }, 60);
    });
  }, []);
  return (
    <input ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Buscar dirección en RD..."}
      style={{ width:"100%", background:"#0a1019", border:"1px solid #3b82f6", borderRadius:9, padding:"10px 13px", color:"#e2e8f0", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#3b82f6", boxShadow:"0 0 0 3px rgba(59,130,246,0.15)" }} autoFocus/>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
// ── IMPORTMODAL usa el geocodificador real (geocodeWithGoogle) ───────────────
// geocodeAddress ya no es un fake — delega al motor real de 4 capas.
// Se llama desde runGeocoding con la query enriquecida: dirección + sector + dirección2
// para que Google tenga suficiente contexto y encuentre calles informales de RD.



// --- IMPORT MODAL -------------------------------------------------------------

const ImportModal = ({ onClose, onImported }) => {
  const [stage, setStage]       = useState("upload");
  const [rawRows, setRawRows]   = useState([]);
  const [headers, setHeaders]   = useState([]);
  const [mapping, setMapping]   = useState({});
  const [stops, setStops]       = useState([]);
  const [optimized, setOptimized] = useState(null);
  const [progress, setProgress] = useState(0);
  const [geoStatus, setGeoStatus] = useState("");
  const [geoCount,  setGeoCount]  = useState(0); // geocodificadas en tiempo real
  const [fileName, setFileName] = useState("");
  const [driverName, setDriverName] = useState(DEFAULT_MENSAJEROS[0].id);
  const [routeName, setRouteName]   = useState("Ruta importada");
  const fileRef = useRef(null);

  const REQUIRED_FIELDS = ["address"];
  const OPTIONAL_FIELDS = ["client","phone","notes","sector","address2","priority"];
  const FIELD_LABELS = { address:"Dirección *", client:"Cliente", phone:"Teléfono", notes:"Notas", sector:"Sector/Zona", address2:"Dirección 2 / Referencia", priority:"Prioridad" };

  const autoDetectLegacy = (hdrs) => {
    const m = {};
    const patterns = {
      address:  /direcci[oó]n(?!\s*2)\b|^dir$|address(?!\s*2)|calle|domicilio|destino/i,
      address2: /direcci[oó]n\s*2|dir\.?\s*2|address\s*2|dir2|referencia|indicaci[oó]n|complement/i,
      client:   /cliente|nombre|name|destinatario|recipient/i,
      phone:    /tel[eé]fono|phone|m[oó]vil|mobile|tlf|whatsapp/i,
      notes:    /notas?|notes?|observ|instruc|detalle/i,
      sector:   /sector|barrio|zona|colonia|urbanizaci[oó]n|urb|residencial|reparto/i,
      priority: /prioridad|priority|urgente|urgent/i,
    };
    hdrs.forEach(h => {
      Object.entries(patterns).forEach(([field, re]) => {
        if (!m[field] && re.test(h)) m[field] = h;
      });
    });
    return m;
  };

  const processFile = (file) => {
    setFileName(file.name);
    const reader = new FileReader();

    if (file.name.match(/\.csv$/i)) {
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const sep = lines[0].includes(";") ? ";" : ",";
        const hdrs = lines[0].split(sep).map(h => h.replace(/^"|"$/g,"").trim());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(sep).map(v => v.replace(/^"|"$/g,"").trim());
          return Object.fromEntries(hdrs.map((h,i)=>[h, vals[i]||""]));
        }).filter(r => Object.values(r).some(v => v));
        setHeaders(hdrs);
        setRawRows(rows);
        setMapping(autoDetectLegacy(hdrs));
        setStage("mapping");
      };
      reader.readAsText(file);
    } else {
      // XLSX via SheetJS
      reader.onload = (e) => {
        try {
          const XLSX = window.XLSX;
          if (!XLSX) { alert("SheetJS no disponible. Usa CSV."); return; }
          const wb = XLSX.read(new Uint8Array(e.target.result), { type:"array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
          if (rows.length === 0) return;
          const hdrs = Object.keys(rows[0]);
          setHeaders(hdrs);
          setRawRows(rows);
          setMapping(autoDetectLegacy(hdrs));
          setStage("mapping");
        } catch(err) {
          alert("Error leyendo Excel. Prueba con CSV.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const runGeocoding = async () => {
    setStage("geocoding");
    setGeoCount(0);
    const addressCol = mapping.address;
    if (!addressCol) return;

    const total = rawRows.length;
    const result = [];
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const row = rawRows[i];

      // ── Leer todos los campos relevantes del Excel ──────────────────────────
      const rawAddr  = String(row[addressCol]            || "").trim();
      const sector   = mapping.sector   ? String(row[mapping.sector]   || "").trim() : "";
      const addr2    = mapping.address2 ? String(row[mapping.address2] || "").trim() : "";
      const client   = String(row[mapping.client]   || `Cliente ${i+1}`).trim();
      const phone    = String(row[mapping.phone]    || "").trim();
      const notes    = [String(row[mapping.notes] || "").trim(), addr2].filter(Boolean).join(" · ");

      // ── Construir query enriquecida ─────────────────────────────────────────
      const parts = [rawAddr, sector, "Santo Domingo", "República Dominicana"].filter(Boolean);
      const enrichedQuery = parts.join(", ");

      setGeoStatus(`${i+1}/${total} — ${rawAddr.slice(0,50)}`);
      setProgress(Math.round(((i+1)/total)*100));

      const stop = {
        id:          `IMP-${String(i+1).padStart(3,"0")}`,
        stopNum:     null,
        rawAddr,
        displayAddr: rawAddr,
        client, phone, notes, sector, addr2,
        originalRow: row,
        lat: null, lng: null, confidence: 0,
        geocoded: false, status: "pending",
      };

      try {
        if (!rawAddr) {
          stop.status = "error"; stop.issue = "Dirección vacía";
        } else {
          const r = await geocodeWithGoogle(enrichedQuery);
          if (r.ok) {
            stop.lat        = r.lat;
            stop.lng        = r.lng;
            stop.displayAddr = r.display || rawAddr;
            stop.confidence  = r.confidence;
            stop.allResults  = r.allResults || [];
            stop.geocoded    = true;
            stop.status      = r.confidence >= 70 ? "ok" : "warning";
            stop.issue       = r.confidence < 70 ? "Confianza baja — verifica en mapa" : null;
            if (r.confidence >= 70) {
              successCount++;
              setGeoCount(successCount); // actualizar contador en tiempo real
            }
          } else {
            stop.status = "error"; stop.issue = "No encontrada";
          }
        }
      } catch(e) {
        stop.status = "error"; stop.issue = "Error de red";
      }

      result.push(stop);
      await new Promise(r => setTimeout(r, 35));
    }

    setStops(result);
    setStage("optimize");
  };

  const runOptimize = () => {
    // Usa el motor global: nearest neighbor desde DEPOT, sin 2-opt
    const depot = { lat: DEPOT.lat, lng: DEPOT.lng };
    const valid = stops.filter(s => s.lat && s.lng);
    let cur = depot, rem = [...valid], ordered = [];
    while (rem.length) {
      let bestIdx = 0, bestDist = Infinity;
      rem.forEach((s, i) => {
        const dl = (s.lat - cur.lat) * Math.PI / 180;
        const dg = (s.lng - cur.lng) * Math.PI / 180;
        const x = Math.sin(dl/2)**2 + Math.cos(cur.lat*Math.PI/180)*Math.cos(s.lat*Math.PI/180)*Math.sin(dg/2)**2;
        const d = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      ordered.push(rem.splice(bestIdx, 1)[0]);
      cur = ordered[ordered.length - 1];
    }
    const originalKm = valid.reduce((acc, s, i) => {
      const prev = i === 0 ? depot : valid[i-1];
      const dl = (s.lat-prev.lat)*Math.PI/180, dg = (s.lng-prev.lng)*Math.PI/180;
      const x = Math.sin(dl/2)**2+Math.cos(prev.lat*Math.PI/180)*Math.cos(s.lat*Math.PI/180)*Math.sin(dg/2)**2;
      return acc + 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
    }, 0);
    const optKm = ordered.reduce((acc, s, i) => {
      const prev = i === 0 ? depot : ordered[i-1];
      const dl = (s.lat-prev.lat)*Math.PI/180, dg = (s.lng-prev.lng)*Math.PI/180;
      const x = Math.sin(dl/2)**2+Math.cos(prev.lat*Math.PI/180)*Math.cos(s.lat*Math.PI/180)*Math.sin(dg/2)**2;
      return acc + 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
    }, 0);
    setOptimized({ ordered, totalKm: Math.round(optKm*10)/10, savings: Math.round((originalKm-optKm)*10)/10, originalKm: Math.round(originalKm*10)/10 });
  };

  const handleImport = () => {
    const raw = optimized ? optimized.ordered : stops;
    const finalStops = raw.map((s, i) => ({ ...s, stopNum: i + 1 }));
    onImported({ stops: finalStops, driverName, routeName, optimized });
    setStage("done");
    setTimeout(onClose, 2000);
  };

  const confidenceColor = (c) => c >= 90 ? "#10b981" : c >= 70 ? "#f59e0b" : "#ef4444";
  const confidenceLabel = (c) => c >= 90 ? "Alta" : c >= 70 ? "Media" : "Baja";

  const inputS = { background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:9, padding:"8px 12px", color:"#e2e8f0", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#3b82f6", width:"100%" };
  const selectS = { ...inputS, cursor:"pointer" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(6px)",zIndex:5500,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s ease"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      <div style={{width:640,maxHeight:"90vh",background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:20,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.9)",display:"flex",flexDirection:"column",animation:"popIn .25s cubic-bezier(.4,0,.2,1)"}}>

        {/* Header */}
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #0d1420",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Importar entregas</div>
              <div style={{fontSize:11,color:"#2d4a60",marginTop:2}}>Excel · CSV · Geocodificación automática · Optimización</div>
            </div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
          {/* Stage pills */}
          <div style={{display:"flex",gap:4,marginTop:14}}>
            {[["upload","1. Subir archivo"],["mapping","2. Mapear columnas"],["geocoding","3. Geocodificar"],["optimize","4. Optimizar ruta"],["done","5. Listo"]].map(([s,l],i)=>{
              const active = stage===s;
              const done = ["upload","mapping","geocoding","optimize","done"].indexOf(stage) > i;
              return (
                <div key={s} style={{flex:1,padding:"5px 0",borderRadius:7,background:active?"#0a1828":done?"rgba(16,185,129,0.08)":"transparent",border:`1px solid ${active?"#1e3550":done?"rgba(16,185,129,0.2)":"#0d1420"}`,textAlign:"center"}}>
                  <span style={{fontSize:9,fontFamily:"'Syne',sans-serif",fontWeight:700,color:active?"#60a5fa":done?"#10b981":"#2d4a60",letterSpacing:"0.3px"}}>{done?"✓ ":""}{l.split(". ")[1]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:"18px 22px"}}>

          {/* -- STAGE: UPLOAD -- */}
          {stage==="upload" && (
            <div style={{animation:"fadeUp .3s ease"}}>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={handleDrop}
                onClick={()=>fileRef.current?.click()}
                style={{
                  border:`2px dashed ${dragOver?"#3b82f6":"#1e2d3d"}`,
                  borderRadius:16, padding:"48px 24px",
                  textAlign:"center", cursor:"pointer",
                  background:dragOver?"rgba(59,130,246,0.05)":"rgba(255,255,255,0.01)",
                  transition:"all .2s",
                }}>
                <div style={{fontSize:36,marginBottom:12,opacity:0.6}}>📂</div>
                <div style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Arrastra tu archivo aquí</div>
                <div style={{fontSize:12,color:"#4b5563",marginBottom:16}}>o haz clic para seleccionar</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  {[".xlsx",".xls",".csv"].map(ext=>(
                    <div key={ext} style={{background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:6,padding:"4px 12px",fontSize:11,color:"#4b5563",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{ext}</div>
                  ))}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])processFile(e.target.files[0]);}}/>
              </div>

              {/* Template download hint */}
              <div style={{marginTop:16,padding:"12px 16px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:18}}>💡</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#93c5fd",fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:2}}>Consejo: usa nuestra plantilla</div>
                  <div style={{fontSize:11,color:"#4b5563"}}>Columnas recomendadas: Dirección, Cliente, Teléfono, Notas, Prioridad</div>
                </div>
                <button
                  onClick={e=>{
                    e.stopPropagation();
                    const csv = "Dirección,Cliente,Teléfono,Notas,Prioridad\n\"Calle Mayor 1, Madrid\",Juan García,+34600000001,Portero 2B,normal\n\"Av. Diagonal 100, Barcelona\",María López,+34600000002,,alta";
                    const blob = new Blob([csv],{type:"text/csv"});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href=url; a.download="plantilla_rapdrive.csv"; a.click();
                  }}
                  style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(59,130,246,0.3)",background:"rgba(59,130,246,0.1)",color:"#60a5fa",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                  ↓ Plantilla
                </button>
              </div>
            </div>
          )}

          {/* -- STAGE: MAPPING -- */}
          {stage==="mapping" && (
            <div style={{animation:"fadeUp .3s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9"}}>{fileName}</div>
                  <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{rawRows.length} filas detectadas · {headers.length} columnas</div>
                </div>
                <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:"5px 12px"}}>
                  <span style={{fontSize:11,color:"#10b981",fontFamily:"'Syne',sans-serif",fontWeight:700}}>✓ {rawRows.length} filas</span>
                </div>
              </div>

              {/* Column mapping */}
              <div style={{background:"#0a1019",border:"1px solid #131f30",borderRadius:13,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:12}}>MAPEAR COLUMNAS</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[...REQUIRED_FIELDS,...OPTIONAL_FIELDS].map(field=>(
                    <div key={field}>
                      <label style={{fontSize:10,color:REQUIRED_FIELDS.includes(field)?"#60a5fa":"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",display:"block",marginBottom:5}}>{FIELD_LABELS[field]}</label>
                      <select value={mapping[field]||""} onChange={e=>setMapping(m=>({...m,[field]:e.target.value||undefined}))} style={selectS}>
                        <option value="">— No mapear —</option>
                        {headers.map(h=><option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div style={{background:"#0a1019",border:"1px solid #131f30",borderRadius:13,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid #0d1420"}}>
                  <span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>PREVISUALIZACIÓN - {Math.min(rawRows.length,5)} de {rawRows.length} filas</span>
                </div>
                <div style={{overflow:"auto",maxHeight:180}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{borderBottom:"1px solid #0d1420"}}>
                        {Object.values(FIELD_LABELS).map(l=><th key={l} style={{padding:"7px 12px",textAlign:"left",color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:9,letterSpacing:"1px",whiteSpace:"nowrap"}}>{l.replace(" *","")}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0,5).map((row,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #080e16"}}>
                          {[...REQUIRED_FIELDS,...OPTIONAL_FIELDS].map(f=>(
                            <td key={f} style={{padding:"7px 12px",color:f==="address"?"#e2e8f0":"#64748b",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mapping[f]?row[mapping[f]]||"—":"—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* -- STAGE: GEOCODING -- */}
          {stage==="geocoding" && (
            <div style={{animation:"fadeUp .3s ease"}}>
              <div style={{textAlign:"center",padding:"20px 0 24px"}}>
                <div style={{fontSize:32,marginBottom:12}}>🌍</div>
                <div style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Geocodificando con Google Maps...</div>
                <div style={{fontSize:11,color:"#4b5563",marginBottom:16}}>Usando dirección + sector + referencia para mayor precisión</div>
                {geoStatus && <div style={{fontSize:11,color:"#60a5fa",marginBottom:10,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{geoStatus}</div>}
                <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>Normalizando y asignando coordenadas a cada parada</div>
                {/* Progress bar */}
                <div style={{height:6,background:"#131f30",borderRadius:6,marginBottom:8,overflow:"hidden"}}>
                  <div style={{height:6,background:"linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)",borderRadius:6,width:`${progress}%`,transition:"width .3s",backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite"}}/>
                </div>
                <div style={{fontSize:12,color:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{progress}%</div>
                <div style={{fontSize:11,color:"#10b981",marginTop:4}}>✓ {geoCount} geocodificadas</div>
              </div>
            </div>
          )}

          {/* -- STAGE: OPTIMIZE -- */}
          {stage==="optimize" && (
            <div style={{animation:"fadeUp .3s ease"}}>
              {/* Geocoding results summary */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[
                  ["✓ Geocodificadas", stops.filter(s=>s.confidence>=70).length, "#10b981"],
                  ["⚠ Baja confianza",  stops.filter(s=>s.confidence>0&&s.confidence<70).length, "#f59e0b"],
                  ["✕ Sin geocodificar",stops.filter(s=>!s.geocoded||s.confidence===0).length, "#ef4444"],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:"#0a1019",border:`1px solid ${c}22`,borderRadius:11,padding:"12px 14px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontFamily:"'Syne',sans-serif",fontWeight:800,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Stops list with geocoding quality */}
              <div style={{background:"#0a1019",border:"1px solid #131f30",borderRadius:13,overflow:"hidden",marginBottom:14}}>
                <div style={{padding:"10px 14px 8px",borderBottom:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>PARADAS PROCESADAS</span>
                  <span style={{fontSize:10,color:"#2d4a60"}}>{stops.length} total</span>
                </div>
                <div style={{maxHeight:160,overflow:"auto"}}>
                  {stops.map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:"1px solid #080e16"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:"#0d1420",border:"1.5px solid #1e2d3d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.display||s.raw}</div>
                        <div style={{fontSize:10,color:"#4b5563",marginTop:1}}>{s.client}{s.phone?` · ${s.phone}`:""}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:5,background:`${confidenceColor(s.confidence)}14`,border:`1px solid ${confidenceColor(s.confidence)}28`,borderRadius:6,padding:"2px 8px",flexShrink:0}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:confidenceColor(s.confidence)}}/>
                        <span style={{fontSize:9.5,color:confidenceColor(s.confidence),fontFamily:"'Syne',sans-serif",fontWeight:700}}>{s.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Route optimizer */}
              <div style={{background:"linear-gradient(135deg,rgba(59,130,246,0.06),rgba(59,130,246,0.03))",border:"1px solid rgba(59,130,246,0.18)",borderRadius:13,padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#60a5fa"}}>⚡ Optimizador de ruta</div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>Vecino más cercano desde la base · Mínima distancia total</div>
                  </div>
                  <button onClick={runOptimize} style={{padding:"8px 16px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"white",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px #3b82f630"}}>
                    ⚡ Optimizar
                  </button>
                </div>
                {optimized ? (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                    {[
                      ["Distancia opt.", `${optimized.totalKm} km`, "#10b981"],
                      ["Distancia orig.", `${optimized.originalKm} km`, "#4b5563"],
                      ["Ahorro",         `${optimized.savings} km`, "#f59e0b"],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{background:"#0a1019",borderRadius:9,padding:"10px 12px",border:`1px solid ${c}22`}}>
                        <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:c}}>{v}</div>
                        <div style={{fontSize:9.5,color:"#4b5563",marginTop:2}}>{l}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:11,color:"#2d4a60",textAlign:"center",padding:"8px 0"}}>Haz clic en "Optimizar" para calcular el orden óptimo de paradas</div>
                )}
              </div>

              {/* Assign driver & route name */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
                <div>
                  <label style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",display:"block",marginBottom:5}}>NOMBRE DE LA RUTA</label>
                  <input value={routeName} onChange={e=>setRouteName(e.target.value)} style={inputS}/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",display:"block",marginBottom:5}}>ASIGNAR MENSAJERO</label>
                  <select value={driverName} onChange={e=>setDriverName(e.target.value)} style={selectS}>
                    {(window.__rdMensajeros || DEFAULT_MENSAJEROS).filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* -- STAGE: DONE -- */}
          {stage==="done" && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:200,gap:14,animation:"fadeUp .3s ease"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(16,185,129,0.15)",border:"2px solid #10b981",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px #10b98140"}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>¡Ruta creada!</div>
              <div style={{fontSize:12,color:"#10b981"}}>{stops.length} paradas · {driverName} · {routeName}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage!=="geocoding" && stage!=="done" && (
          <div style={{padding:"13px 22px",borderTop:"1px solid #0d1420",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <button onClick={()=>{
              if(stage==="mapping") setStage("upload");
              else if(stage==="optimize") setStage("mapping");
              else onClose();
            }} style={{padding:"8px 16px",borderRadius:9,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer"}}>
              {stage==="upload"?"Cancelar":"← Atrás"}
            </button>
            <button
              onClick={()=>{
                if(stage==="mapping") { if(mapping.address) runGeocoding(); }
                else if(stage==="optimize") handleImport();
              }}
              disabled={stage==="mapping"&&!mapping.address}
              style={{padding:"9px 20px",borderRadius:9,border:"none",background:stage==="mapping"&&!mapping.address?"#0d1420":"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:stage==="mapping"&&!mapping.address?"#1e3550":"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:stage==="mapping"&&!mapping.address?"not-allowed":"pointer",boxShadow:stage==="mapping"&&!mapping.address?"none":"0 4px 16px #3b82f630",letterSpacing:"0.5px"}}>
              {stage==="upload"?"":stage==="mapping"?"Geocodificar →":stage==="optimize"?"✓ Crear ruta":""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


// --- PHASE 8: ADDRESS INTELLIGENCE ENGINE ------------------------------------
// The core differentiator: multi-layer address parsing + geocoding + confidence scoring
// Handles: raw addresses, Google Plus Codes, coordinates, informal descriptions

// -- 8.1 PLUS CODE DECODER ----------------------------------------------------
// Google Plus Codes (e.g. "8CQPM2Q8+QF" or "M2Q8+QF Madrid")
const PLUS_CODE_ALPHABET = "23456789CFGHJMPQRVWX";
const decodePlusCode = (code) => {
  const clean = code.replace(/\s+.*/, "").replace(/\+/,"").toUpperCase();
  if (!/^[23456789CFGHJMPQRVWX]{4,8}[+]?[23456789CFGHJMPQRVWX]{0,2}$/.test(code.toUpperCase().replace(/\s.*/,""))) return null;
  try {
    // Simplified Open Location Code decoder
    const full = clean.padEnd(8,"0");
    const latChars  = full.slice(0,4);
    const lngChars  = full.slice(4,8);
    let lat = -90, lng = -180;
    let latScale = 20, lngScale = 20;
    for (let i = 0; i < 4; i++) {
      const li = PLUS_CODE_ALPHABET.indexOf(latChars[i]);
      const loi= PLUS_CODE_ALPHABET.indexOf(lngChars[i]);
      if (li < 0 || loi < 0) return null;
      const div = Math.pow(20, i);
      lat  += (li  / div) * (180/20);
      lng  += (loi / div) * (360/20);
    }
    return { lat: Math.round(lat*10000)/10000, lng: Math.round(lng*10000)/10000, type:"plus_code" };
  } catch { return null; }
};

// -- 8.2 COORDINATE DETECTOR --------------------------------------------------
const detectCoordinates = (input) => {
  // "40.4168, -3.7038" or "40.4168 -3.7038" or "40°25'N 3°42'W"
  const decimalMatch = input.match(/(-?\d{1,3}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/);
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]);
    const lng = parseFloat(decimalMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
      return { lat, lng, type:"coordinates" };
  }
  // DMS: "40°25'01"N 3°41'31"W"
  const dmsMatch = input.match(/(\d+)°(\d+)'([\d.]+)"?([NS])[,\s]+(\d+)°(\d+)'([\d.]+)"?([EW])/i);
  if (dmsMatch) {
    const lat = (parseInt(dmsMatch[1]) + parseInt(dmsMatch[2])/60 + parseFloat(dmsMatch[3])/3600) * (dmsMatch[4].toUpperCase()==="S"?-1:1);
    const lng = (parseInt(dmsMatch[5]) + parseInt(dmsMatch[6])/60 + parseFloat(dmsMatch[7])/3600) * (dmsMatch[8].toUpperCase()==="W"?-1:1);
    return { lat, lng, type:"dms" };
  }
  return null;
};

// -- 8.3 SPANISH ADDRESS NORMALIZER -------------------------------------------
const STREET_ABBREV = [
  [/^c\/\s*/i,        "Calle "],
  [/^cl\.?\s*/i,      "Calle "],
  [/^c\.\s*/i,        "Calle "],
  [/^av\.?\s*/i,      "Avenida "],
  [/^avda\.?\s*/i,    "Avenida "],
  [/^avd\.?\s*/i,     "Avenida "],
  [/^pza?\.?\s*/i,    "Plaza "],
  [/^pl\.?\s*/i,      "Plaza "],
  [/^pso\.?\s*/i,     "Paseo "],
  [/^po\.?\s*/i,      "Paseo "],
  [/^pg?\.?\s*ind\.?\s*/i, "Polígono Industrial "],
  [/^pol\.?\s*ind\.?\s*/i, "Polígono Industrial "],
  [/^rda\.?\s*/i,     "Ronda "],
  [/^ctra\.?\s*/i,    "Carretera "],
  [/^crta\.?\s*/i,    "Carretera "],
  [/^blv?d?\.?\s*/i,  "Bulevar "],
  [/^trav\.?\s*/i,    "Travesía "],
  [/^trv\.?\s*/i,     "Travesía "],
  [/^urb\.?\s*/i,     "Urbanización "],
  [/^cam\.?\s*/i,     "Camino "],
  [/^cno\.?\s*/i,     "Camino "],
  [/^glta\.?\s*/i,    "Glorieta "],
  [/^rbla\.?\s*/i,    "Rambla "],
];

const NUMBER_PATTERNS = [
  /,?\s*n[ºo°\.]\s*(\d+[-\w]*)/i,
  /,?\s*num\.?\s*(\d+[-\w]*)/i,
  /\s+n\.?\s*(\d+)\b/i,
  /,\s*(\d+[-\w]*)$/,
  /\s(\d+[-\w]*)$/,
];

const FLOOR_PATTERNS = [
  /,?\s*(\d+[ºo°]?)\s*(?:piso|planta)\b/i,
  /,?\s*piso\s*(\d+[ºo°]?)/i,
  /,?\s*(\d+[ºo°]?)\s*pta\.?\s*([A-Z\d])?/i,
  /,?\s*puerta\s*([A-Z\d]+)/i,
  /,?\s*portal\s*(\d+)/i,
  /,?\s*bajo\b/i,
  /,?\s*atico\b/i,
  /,?\s*ático\b/i,
  /,?\s*entreplanta\b/i,
];

const CP_PATTERN = /\b(\d{5})\b/;
const CITY_AFTER_CP = /\d{5}\s+([A-ZÀ-Ÿa-zà-ÿ\s]+?)(?:,|$)/i;

const normalizeSpanishAddress = (raw) => {
  if (!raw || !raw.trim()) return { valid: false, raw: "" };
  let s = raw.trim().replace(/\s+/g," ");

  // Extract postal code
  const cpMatch = s.match(CP_PATTERN);
  const postalCode = cpMatch ? cpMatch[1] : "";

  // Extract city (after postal code or after last comma)
  let city = "";
  const cityMatch = s.match(CITY_AFTER_CP);
  if (cityMatch) city = cityMatch[1].trim();
  else {
    const parts = s.split(",");
    if (parts.length > 2) city = parts[parts.length-1].trim();
  }

  // Extract floor/door
  let floor = "";
  for (const pat of FLOOR_PATTERNS) {
    const m = s.match(pat);
    if (m) { floor = m[0].replace(/^,?\s*/,"").trim(); s = s.replace(m[0],""); break; }
  }

  // Extract street number
  let number = "";
  for (const pat of NUMBER_PATTERNS) {
    const m = s.match(pat);
    if (m) { number = m[1]; s = s.replace(m[0],""); break; }
  }

  // Remove postal code and city from street string
  s = s.replace(CP_PATTERN,"").replace(/,?\s*$/,"").trim();
  if (city) s = s.replace(new RegExp(",?\\s*" + city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*$","i"),"").trim();

  // Normalize street type abbreviation
  let street = s.trim().replace(/^,+/,"").replace(/,+$/,"").trim();
  for (const [pat, repl] of STREET_ABBREV) {
    if (pat.test(street)) { street = street.replace(pat, repl); break; }
  }

  // Title-case
  street = street.replace(/\b\w/g, c => c.toUpperCase());

  // Rebuild display
  const parts = [street, number, floor].filter(Boolean);
  const display = parts.join(", ") + (postalCode ? ` · ${postalCode}` : "") + (city ? ` · ${city}` : "");

  return {
    valid:      street.length > 2,
    raw,
    street:     street.trim(),
    number:     number.trim(),
    floor:      floor.trim(),
    postalCode,
    city:       city.trim(),
    display:    display.trim(),
    normalized: [street, number].filter(Boolean).join(" ") + (postalCode ? ` ${postalCode}` : "") + (city ? ` ${city}` : ""),
  };
};

// -- 8.4 INFORMAL / LANDMARK DETECTOR -----------------------------------------
// Detects "junto al", "frente a", "detrás del", "esquina con" etc.
const LANDMARK_PATTERNS = [
  { re: /junto\s+a[l]?\s+(.+)/i,           type:"near",    prep:"Junto a" },
  { re: /al\s+lado\s+de[l]?\s+(.+)/i,      type:"near",    prep:"Al lado de" },
  { re: /frente\s+a[l]?\s+(.+)/i,          type:"opposite",prep:"Frente a" },
  { re: /enfrente\s+de[l]?\s+(.+)/i,       type:"opposite",prep:"Enfrente de" },
  { re: /detr[aá]s\s+de[l]?\s+(.+)/i,      type:"behind",  prep:"Detrás de" },
  { re: /esquina\s+(?:con\s+)?(.+)/i,       type:"corner",  prep:"Esquina con" },
  { re: /cruce\s+(?:con\s+)?(.+)/i,         type:"corner",  prep:"Cruce con" },
  { re: /portería\s+(?:de[l]?\s+)?(.+)/i,  type:"entrance",prep:"Portería de" },
  { re: /entrada\s+(?:de[l]?\s+)?(.+)/i,   type:"entrance",prep:"Entrada de" },
  { re: /local\s+(\d+[a-z]?)/i,            type:"local",   prep:"Local" },
  { re: /bajo\s+([a-z])\b/i,               type:"floor",   prep:"Bajo" },
];

const detectLandmark = (input) => {
  for (const p of LANDMARK_PATTERNS) {
    const m = input.match(p.re);
    if (m) return { found:true, type:p.type, prep:p.prep, reference:m[1]?.trim(), original:m[0] };
  }
  return { found:false };
};

// -- 8.5 MAIN INTELLIGENCE ENGINE ---------------------------------------------
const analyzeAddress = (input) => {
  if (!input || !input.trim()) return { type:"empty", confidence:0, error:"Dirección vacía" };

  const raw = input.trim();
  const result = {
    raw,
    type:       "unknown",
    confidence: 0,
    lat:        null,
    lng:        null,
    display:    raw,
    normalized: null,
    postalCode: "",
    city:       "",
    issues:     [],
    suggestions:[],
    landmark:   null,
    debugSteps: [],
  };

  // Step 1: Check Plus Code
  const plusCodeRe = /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,})\b/i;
  const pcMatch = raw.match(plusCodeRe);
  if (pcMatch) {
    const decoded = decodePlusCode(pcMatch[1]);
    if (decoded) {
      result.type = "plus_code";
      result.lat  = decoded.lat;
      result.lng  = decoded.lng;
      result.confidence = 99;
      result.display = `Plus Code: ${pcMatch[1]}`;
      result.debugSteps.push({ step:"Plus Code detectado", ok:true, detail:pcMatch[1] });
      // Check if there's extra context after the plus code
      const extra = raw.replace(pcMatch[0],"").trim().replace(/^[,\s]+/,"");
      if (extra) result.display += ` (${extra})`;
      return result;
    }
  }

  // Step 2: Check coordinates
  const coords = detectCoordinates(raw);
  if (coords) {
    result.type = "coordinates";
    result.lat  = coords.lat;
    result.lng  = coords.lng;
    result.confidence = 99;
    result.display = `${coords.lat}, ${coords.lng}`;
    result.debugSteps.push({ step:"Coordenadas detectadas", ok:true, detail:`${coords.type}: ${coords.lat}, ${coords.lng}` });
    return result;
  }

  // Step 3: Detect landmarks / informal references
  const landmark = detectLandmark(raw);
  if (landmark.found) {
    result.landmark = landmark;
    result.issues.push(`Referencia informal: "${landmark.prep} ${landmark.reference}" - puede reducir precisión`);
    result.debugSteps.push({ step:"Landmark detectado", ok:false, detail:`${landmark.prep} ${landmark.reference}` });
  }

  // Step 4: Normalize address
  const normalized = normalizeSpanishAddress(raw);
  result.debugSteps.push({ step:"Normalización", ok:normalized.valid, detail:normalized.display||"No válida" });

  if (!normalized.valid) {
    result.confidence = 10;
    result.issues.push("Dirección muy corta o sin calle reconocible");
    result.suggestions.push("Añade el nombre de la calle y número");
    return result;
  }

  result.normalized = normalized.normalized;
  result.display    = normalized.display;
  result.postalCode = normalized.postalCode;
  result.city       = normalized.city;
  result.street     = normalized.street;
  result.number     = normalized.number;
  result.floor      = normalized.floor;

  // Step 5: Confidence scoring
  let confidence = 40; // base

  // Street name quality
  if (normalized.street.length > 10) confidence += 15;
  else if (normalized.street.length > 5) confidence += 8;

  // Has street number?
  if (normalized.number) {
    confidence += 20;
    result.debugSteps.push({ step:"Número de portal", ok:true, detail:normalized.number });
  } else {
    result.issues.push("Sin número de portal - la precisión puede bajar");
    result.suggestions.push("Añade el número de la calle para mayor exactitud");
    result.debugSteps.push({ step:"Número de portal", ok:false, detail:"No encontrado" });
  }

  // Has postal code?
  if (normalized.postalCode) {
    confidence += 15;
    result.debugSteps.push({ step:"Código postal", ok:true, detail:normalized.postalCode });
  } else {
    result.issues.push("Sin código postal");
    result.suggestions.push("Añade el código postal para más precisión");
  }

  // Has city?
  if (normalized.city) {
    confidence += 8;
    result.debugSteps.push({ step:"Ciudad", ok:true, detail:normalized.city });
  }

  // Landmark penalty
  if (landmark.found) confidence = Math.min(confidence, 72);

  // Floor/door bonus (more specific = more confident)
  if (normalized.floor) { confidence += 3; }

  // Known street type bonus
  const hasKnownType = STREET_ABBREV.some(([,repl]) => normalized.street.startsWith(repl.trim()));
  if (hasKnownType) { confidence += 5; result.debugSteps.push({ step:"Tipo de vía reconocido", ok:true, detail:normalized.street.split(" ")[0] }); }

  result.confidence = Math.min(99, confidence);
  result.type = "address";

  // Geocode with pseudo-randomized coords (in prod: call Maps API)
  let hash = 0;
  for (const ch of normalized.normalized) hash = ((hash<<5)-hash)+ch.charCodeAt(0);
  const seed  = (hash >>> 0) / 0xffffffff;
  const seed2 = ((hash * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  result.lat = 40.4168 + (seed  - 0.5) * 0.09;
  result.lng = -3.7038 + (seed2 - 0.5) * 0.13;

  // Step 6: Generate smart suggestions if confidence < 85
  if (result.confidence < 85) {
    if (!normalized.number) result.suggestions.push(`Prueba: "${normalized.street} 1, ${normalized.postalCode||"Madrid"}"`);
    if (!normalized.postalCode && normalized.city) result.suggestions.push(`Añade CP a "${normalized.city}"`);
  }

  return result;
};

// -- 8.6 CONFIDENCE UI HELPERS -------------------------------------------------
const confColor = (c) => c>=90?"#10b981":c>=75?"#3b82f6":c>=55?"#f59e0b":"#ef4444";
const confLabel = (c) => c>=90?"Muy alta":c>=75?"Alta":c>=55?"Media":"Baja";
const confIcon  = (c) => c>=90?"✓":c>=75?"◎":c>=55?"⚠":"✕";
const typeLabel = { plus_code:"Plus Code", coordinates:"Coordenadas", address:"Dirección", unknown:"Desconocido", empty:"Vacío" };

// -- 8.7 ADDRESS TESTER UI -----------------------------------------------------
const AddressIntelligencePanel = ({ onClose }) => {
  const [input,   setInput]   = useState("");
  const [results, setResults] = useState([]);
  const [bulk,    setBulk]    = useState(false);
  const [bulkText,setBulkText]= useState("");
  const inputRef = useRef(null);

  // Single analyze on-the-fly
  useEffect(()=>{
    if (!bulk && input.trim().length > 3) {
      const r = analyzeAddress(input);
      setResults([r]);
    } else if (!bulk) {
      setResults([]);
    }
  }, [input, bulk]);

  const runBulk = () => {
    const lines = bulkText.split(/\n/).map(l=>l.trim()).filter(Boolean);
    setResults(lines.map(l=>analyzeAddress(l)));
  };

  const DEMO_INPUTS = [
    "C/ Gran Vía 45, 2º B, 28013 Madrid",
    "Av. Diagonal 100, Barcelona",
    "8FVC9G8F+6W",
    "40.4168, -3.7038",
    "Junto al Mercadona de la Avenida Principal",
    "Pza Mayor 3 Madrid",
    "ctra. de la coruña km 15",
    "Cll esperanza 6 bajo A lavapies",
    "40°25'01\"N 3°41'31\"W",
    "Fuencarral 89 ático",
  ];

  const S = {
    input: { width:"100%", background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:11, padding:"11px 14px", color:"#e2e8f0", fontSize:13, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#3b82f6", transition:"border .2s" },
    tag: (c) => ({ background:`${c}12`, border:`1px solid ${c}28`, borderRadius:6, padding:"2px 8px", fontSize:10, color:c, fontFamily:"'Syne',sans-serif", fontWeight:700, display:"inline-flex", alignItems:"center", gap:4 }),
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",zIndex:6000,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s ease"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:760,maxHeight:"92vh",background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:22,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",animation:"popIn .25s cubic-bezier(.4,0,.2,1)"}}>

        {/* Header */}
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #0d1420",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px #3b82f640"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <div>
                  <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Motor de Direcciones · Rap Drive</div>
                  <div style={{fontSize:11,color:"#2d4a60"}}>Plus Codes · Coordenadas · Español informal · Geocodificación</div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",background:"#0a1019",border:"1px solid #131f30",borderRadius:9,overflow:"hidden"}}>
                {[["individual","Una dirección"],["bulk","Lote"]].map(([m,l])=>(
                  <button key={m} onClick={()=>{setBulk(m==="bulk");setResults([]);}} style={{padding:"6px 14px",border:"none",background:bulk===(m==="bulk")?"#0a1828":"transparent",color:bulk===(m==="bulk")?"#60a5fa":"#374151",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{l}</button>
                ))}
              </div>
              <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>
        </div>

        <div style={{flex:1,overflow:"hidden",display:"flex"}}>
          {/* Left: input */}
          <div style={{width:300,borderRight:"1px solid #0d1420",display:"flex",flexDirection:"column",padding:"16px",gap:12,overflow:"auto",flexShrink:0}}>

            {!bulk ? (
              <>
                <div>
                  <label style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",display:"block",marginBottom:6}}>INTRODUCE LA DIRECCIÓN</label>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e=>setInput(e.target.value)}
                    placeholder="Escribe cualquier formato..."
                    style={S.input}
                    autoFocus
                  />
                  <div style={{fontSize:10,color:"#1e3550",marginTop:5}}>El motor analiza en tiempo real mientras escribes</div>
                </div>

                {/* Demo inputs */}
                <div>
                  <div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:8}}>EJEMPLOS - PRUEBA ESTOS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {DEMO_INPUTS.map((d,i)=>(
                      <button key={i} onClick={()=>setInput(d)} style={{textAlign:"left",padding:"7px 10px",borderRadius:8,border:"1px solid #131f30",background:"transparent",color:"#4b5563",fontSize:11,fontFamily:"'Inter',sans-serif",cursor:"pointer",transition:"all .1s",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",display:"block",marginBottom:6}}>UNA DIRECCIÓN POR LÍNEA</label>
                  <textarea
                    value={bulkText}
                    onChange={e=>setBulkText(e.target.value)}
                    placeholder={"C/ Gran Vía 45 Madrid\n8FVC9G8F+6W\n40.4168, -3.7038\nJunto al Mercadona..."}
                    rows={10}
                    style={{...S.input,resize:"none",lineHeight:1.6,fontSize:12}}
                  />
                </div>
                <button onClick={runBulk} style={{padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px #3b82f630"}}>
                  ⚡ Analizar {bulkText.split("\n").filter(l=>l.trim()).length} direcciones
                </button>
                {results.length>0 && (
                  <div style={{fontSize:11,color:"#2d4a60",textAlign:"center"}}>
                    {results.filter(r=>r.confidence>=75).length} / {results.length} con confianza alta
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: results */}
          <div style={{flex:1,overflow:"auto",padding:"16px"}}>
            {results.length === 0 && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,opacity:0.4}}>
                <div style={{fontSize:40}}>🔍</div>
                <div style={{fontSize:13,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700}}>Esperando dirección...</div>
              </div>
            )}

            {results.map((r, ri) => {
              const cc = confColor(r.confidence);
              return (
                <div key={ri} style={{background:"#0a1019",border:`1px solid ${cc}28`,borderRadius:14,padding:"16px",marginBottom:12,animation:"fadeUp .3s ease"}}>

                  {/* Result header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                        {/* Confidence badge */}
                        <div style={{width:36,height:36,borderRadius:10,background:`${cc}15`,border:`2px solid ${cc}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:cc,fontWeight:700,flexShrink:0}}>{confIcon(r.confidence)}</div>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:800,color:cc}}>{r.confidence}%</span>
                            <span style={{fontSize:12,color:cc}}>{confLabel(r.confidence)} confianza</span>
                          </div>
                          <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                            <span style={S.tag(cc)}>{typeLabel[r.type]||r.type}</span>
                            {r.postalCode && <span style={S.tag("#4b5563")}>{r.postalCode}</span>}
                            {r.city       && <span style={S.tag("#64748b")}>{r.city}</span>}
                            {r.landmark?.found && <span style={S.tag("#f59e0b")}>Landmark</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    {r.lat && (
                      <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                        <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:2}}>COORDENADAS</div>
                        <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>{r.lat?.toFixed(5)}</div>
                        <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>{r.lng?.toFixed(5)}</div>
                      </div>
                    )}
                  </div>

                  {/* Confidence bar */}
                  <div style={{height:5,background:"#131f30",borderRadius:5,marginBottom:12,overflow:"hidden"}}>
                    <div style={{height:5,background:`linear-gradient(90deg,${cc},${cc}88)`,borderRadius:5,width:`${r.confidence}%`,transition:"width 1s ease"}}/>
                  </div>

                  {/* Input → Normalized */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                    <div style={{background:"#060b10",borderRadius:9,padding:"10px 12px",border:"1px solid #131f30"}}>
                      <div style={{fontSize:9,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:5}}>INPUT ORIGINAL</div>
                      <div style={{fontSize:12,color:"#64748b",lineHeight:1.5,wordBreak:"break-word"}}>{r.raw}</div>
                    </div>
                    <div style={{background:"#060b10",borderRadius:9,padding:"10px 12px",border:`1px solid ${cc}28`}}>
                      <div style={{fontSize:9,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:5}}>INTERPRETADO COMO</div>
                      <div style={{fontSize:12,color:"#e2e8f0",lineHeight:1.5,wordBreak:"break-word"}}>{r.display||r.normalized||r.raw}</div>
                    </div>
                  </div>

                  {/* Parsed components */}
                  {r.street && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                      {[
                        r.street   && ["Calle",    r.street,     "#3b82f6"],
                        r.number   && ["Número",   r.number,     "#10b981"],
                        r.floor    && ["Piso/Pta", r.floor,      "#f59e0b"],
                        r.postalCode&&["C.P.",     r.postalCode, "#8b5cf6"],
                        r.city     && ["Ciudad",   r.city,       "#64748b"],
                      ].filter(Boolean).map(([l,v,c])=>(
                        <div key={l} style={{background:`${c}10`,border:`1px solid ${c}25`,borderRadius:7,padding:"4px 10px"}}>
                          <div style={{fontSize:8.5,color:c,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:1}}>{l}</div>
                          <div style={{fontSize:11,color:"#e2e8f0"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Debug steps */}
                  {r.debugSteps.length > 0 && (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:9,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:6}}>PASOS DE ANÁLISIS</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {r.debugSteps.map((step,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"#060b10",borderRadius:7,border:`1px solid ${step.ok?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.1)"}`}}>
                            <span style={{fontSize:10,color:step.ok?"#10b981":"#ef4444",flexShrink:0}}>{step.ok?"✓":"✕"}</span>
                            <span style={{fontSize:10,color:"#4b5563",flex:1}}>{step.step}</span>
                            <span style={{fontSize:10,color:step.ok?"#374151":"#4b5563",fontFamily:"monospace",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{step.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues & suggestions */}
                  {r.issues.length > 0 && (
                    <div style={{marginBottom:8}}>
                      {r.issues.map((issue,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:7,padding:"5px 8px",background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:7,marginBottom:4}}>
                          <span style={{color:"#f59e0b",fontSize:11,flexShrink:0}}>⚠</span>
                          <span style={{fontSize:11,color:"#92400e"}}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.suggestions.length > 0 && (
                    <div>
                      {r.suggestions.map((s,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:7,padding:"5px 8px",background:"rgba(59,130,246,0.05)",border:"1px solid rgba(59,130,246,0.12)",borderRadius:7,marginBottom:4}}>
                          <span style={{color:"#3b82f6",fontSize:11,flexShrink:0}}>💡</span>
                          <span style={{fontSize:11,color:"#1e40af"}}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Landmark info */}
                  {r.landmark?.found && (
                    <div style={{padding:"8px 10px",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:9,marginTop:8}}>
                      <div style={{fontSize:10,color:"#f59e0b",fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:3}}>📍 REFERENCIA INFORMAL DETECTADA</div>
                      <div style={{fontSize:11,color:"#a16207"}}>"{r.landmark.prep} <b>{r.landmark.reference}</b>" - Para máxima precisión, añade la dirección exacta</div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bulk summary */}
            {bulk && results.length > 0 && (
              <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #1e2d3d",borderRadius:14,padding:"16px",marginTop:4}}>
                <div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:12}}>RESUMEN DEL LOTE</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {[
                    ["Total",             results.length,                                    "#4b5563"],
                    ["Alta confianza",    results.filter(r=>r.confidence>=75).length,        "#10b981"],
                    ["Confianza media",   results.filter(r=>r.confidence>=55&&r.confidence<75).length, "#f59e0b"],
                    ["Baja / Error",      results.filter(r=>r.confidence<55).length,         "#ef4444"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:"#060b10",borderRadius:10,padding:"10px 12px",border:`1px solid ${c}22`,textAlign:"center"}}>
                      <div style={{fontSize:22,fontFamily:"'Syne',sans-serif",fontWeight:800,color:c}}>{v}</div>
                      <div style={{fontSize:9.5,color:"#4b5563",marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- PHASE 9: CIRCUIT ENGINE (EMBEDDED) -------------------------------------

// --- CONFIG -------------------------------------------------------------------
// URL del backend de sincronización con SilpoPack
// En producción cambiar por la URL real del servidor Node.js
const BACKEND_URL = "https://silpo-sync-backend-production.up.railway.app";

const GMAPS_KEY = "AIzaSyCH51LeKVUD92nJ3EJwKlN7QDgz1Gad5A4";
// DEPOT defined globally above (18.523359816124955, -69.98369283305884)

// --- GOOGLE MAPS LOADER -------------------------------------------------------
let gmapsPromise = null;
const loadGoogleMaps = () => {
  if (gmapsPromise) return gmapsPromise;
  if (window.google?.maps) return Promise.resolve();
  gmapsPromise = new Promise((res) => {
    const cb = "__gmaps_cb_" + Date.now();
    window[cb] = () => { delete window[cb]; res(); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places,geometry&callback=${cb}`;
    s.async = true;
    document.head.appendChild(s);
  });
  return gmapsPromise;
};

// --- SHEETJS LOADER -----------------------------------------------------------
const loadSheetJS = () => new Promise((res) => {
  if (window.XLSX) { res(); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  s.onload = res;
  document.head.appendChild(s);
});

// --- DEPOT (base interna, no visible en pantalla) -----------------------------
const DEPOT = { lat: 18.523359816124955, lng: -69.98369283305884, label: "CD Distrito 6 – Palma Real", plusCode: "G2F8+7G3" };

// --- GEOCODER CACHE (in-memory, evita llamadas repetidas a Google) ------------
const _geoCache = new Map();


// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 2: DICCIONARIO DE COORDENADAS ANCLA (SDO_ANCHORS)
// Coordenadas GPS verificadas de sectores, comercios, residenciales y puntos
// clave de la zona de operación. Usadas para:
//   1) Sesgar el query de Google hacia la zona correcta (hintCoords)
//   2) Fallback cuando Google falla completamente
//   3) Validar que el resultado de Google está cerca del sector correcto
//
// Para añadir más: { lat, lng, city } — city para el fallback display
// ─────────────────────────────────────────────────────────────────────────────
const SDO_ANCHORS = {
  // ══ ZONA HERRERA (núcleo) ══════════════════════════════════════════════════
  "herrera":                         { lat: 18.4890, lng: -70.0023, city: "Santo Domingo Oeste" },
  "buenos aires de herrera":         { lat: 18.4865, lng: -70.0105, city: "Santo Domingo Oeste" },
  "el café de herrera":              { lat: 18.4820, lng: -70.0180, city: "Santo Domingo Oeste" },
  "el cafe de herrera":              { lat: 18.4820, lng: -70.0180, city: "Santo Domingo Oeste" },
  "las palmas de herrera":           { lat: 18.4840, lng: -70.0060, city: "Santo Domingo Oeste" },
  "enriquillo":                      { lat: 18.4902, lng: -70.0041, city: "Santo Domingo Oeste" },
  "barrio enriquillo":               { lat: 18.4902, lng: -70.0041, city: "Santo Domingo Oeste" },
  "duarte herrera":                  { lat: 18.4878, lng: -70.0035, city: "Santo Domingo Oeste" },
  "barrio duarte":                   { lat: 18.4878, lng: -70.0035, city: "Santo Domingo Oeste" },
  "pueblo nuevo":                    { lat: 18.4911, lng: -70.0012, city: "Santo Domingo Oeste" },
  "juan guzman":                     { lat: 18.4855, lng: -70.0090, city: "Santo Domingo Oeste" },
  "ivan guzman klang":               { lat: 18.4862, lng: -70.0070, city: "Santo Domingo Oeste" },
  "las mercedes":                    { lat: 18.4930, lng: -69.9980, city: "Santo Domingo Oeste" },
  "villa aura":                      { lat: 18.4920, lng: -70.0050, city: "Santo Domingo Oeste" },
  "olimpo":                          { lat: 18.4870, lng: -70.0030, city: "Santo Domingo Oeste" },
  "barrio nuevo":                    { lat: 18.4895, lng: -70.0015, city: "Santo Domingo Oeste" },
  "barrio san francisco":            { lat: 18.4860, lng: -70.0080, city: "Santo Domingo Oeste" },
  "zona industrial herrera":         { lat: 18.4830, lng: -70.0200, city: "Santo Domingo Oeste" },
  "urb el cafe":                     { lat: 18.4815, lng: -70.0190, city: "Santo Domingo Oeste" },
  "urbanizacion el cafe":            { lat: 18.4815, lng: -70.0190, city: "Santo Domingo Oeste" },
  "res carmen renata":               { lat: 18.4910, lng: -70.0060, city: "Santo Domingo Oeste" },
  "residencial carmen renata":       { lat: 18.4910, lng: -70.0060, city: "Santo Domingo Oeste" },
  "residencial pablo mella":         { lat: 18.4900, lng: -70.0040, city: "Santo Domingo Oeste" },
  "residencial santo domingo":       { lat: 18.4885, lng: -70.0025, city: "Santo Domingo Oeste" },
  "residencial altagracia":          { lat: 18.4875, lng: -70.0055, city: "Santo Domingo Oeste" },
  "residencial antonia":             { lat: 18.4868, lng: -70.0045, city: "Santo Domingo Oeste" },
  "brisas del oeste":                { lat: 18.4835, lng: -70.0120, city: "Santo Domingo Oeste" },
  "residencial brisas del oeste":    { lat: 18.4835, lng: -70.0120, city: "Santo Domingo Oeste" },
  "operaciones especiales":          { lat: 18.4842, lng: -70.0130, city: "Santo Domingo Oeste" },
  "residencial don honorio":         { lat: 18.4750, lng: -69.9950, city: "Santo Domingo Oeste" },

  // ══ ZONA LAS CAOBAS ════════════════════════════════════════════════════════
  "las caobas":                      { lat: 18.5020, lng: -70.0180, city: "Santo Domingo Oeste" },
  "las caobitas":                    { lat: 18.5040, lng: -70.0200, city: "Santo Domingo Oeste" },
  "las colinas":                     { lat: 18.5010, lng: -70.0160, city: "Santo Domingo Oeste" },
  "el libertador":                   { lat: 18.5030, lng: -70.0170, city: "Santo Domingo Oeste" },
  "savica":                          { lat: 18.5000, lng: -70.0190, city: "Santo Domingo Oeste" },
  "buenos aires de las caobas":      { lat: 18.5015, lng: -70.0210, city: "Santo Domingo Oeste" },
  "urbanizacion las caobas":         { lat: 18.5025, lng: -70.0175, city: "Santo Domingo Oeste" },
  "altos de las caobas":             { lat: 18.5050, lng: -70.0220, city: "Santo Domingo Oeste" },
  "las palmas":                      { lat: 18.4840, lng: -70.0060, city: "Santo Domingo Oeste" },

  // ══ ZONA BAYONA / MANOGUAYABO ═════════════════════════════════════════════
  "bayona":                          { lat: 18.5120, lng: -70.0320, city: "Santo Domingo Oeste" },
  "manoguayabo":                     { lat: 18.5200, lng: -70.0450, city: "Santo Domingo Oeste" },
  "buenos aires de manoguayabo":     { lat: 18.5180, lng: -70.0470, city: "Santo Domingo Oeste" },
  "el hoyo de manoguayabo":         { lat: 18.5160, lng: -70.0420, city: "Santo Domingo Oeste" },
  "barrio san miguel":               { lat: 18.5130, lng: -70.0350, city: "Santo Domingo Oeste" },
  "la venta":                        { lat: 18.5100, lng: -70.0300, city: "Santo Domingo Oeste" },
  "el 8 de bayona":                  { lat: 18.5110, lng: -70.0330, city: "Santo Domingo Oeste" },
  "barrio libertad":                 { lat: 18.5090, lng: -70.0310, city: "Santo Domingo Oeste" },

  // ══ ZONA ENGOMBE ══════════════════════════════════════════════════════════
  "engombe":                         { lat: 18.5250, lng: -70.0600, city: "Santo Domingo Oeste" },
  "altos de engombe":                { lat: 18.5280, lng: -70.0630, city: "Santo Domingo Oeste" },
  "la urena":                        { lat: 18.5230, lng: -70.0580, city: "Santo Domingo Oeste" },
  "barrio progreso":                 { lat: 18.5240, lng: -70.0610, city: "Santo Domingo Oeste" },
  "barrio progreso ii":              { lat: 18.5260, lng: -70.0620, city: "Santo Domingo Oeste" },
  "urbanizacion engombe":            { lat: 18.5255, lng: -70.0595, city: "Santo Domingo Oeste" },
  "barrio libertador":               { lat: 18.5235, lng: -70.0570, city: "Santo Domingo Oeste" },

  // ══ ZONA HATO NUEVO / EXPANSIÓN ════════════════════════════════════════════
  "hato nuevo":                      { lat: 18.5350, lng: -70.0750, city: "Santo Domingo Oeste" },
  "caballona":                       { lat: 18.5380, lng: -70.0780, city: "Santo Domingo Oeste" },
  "lecheria":                        { lat: 18.5320, lng: -70.0720, city: "Santo Domingo Oeste" },
  "batey bienvenido":                { lat: 18.5400, lng: -70.0800, city: "Santo Domingo Oeste" },
  "la cuaba":                        { lat: 18.5420, lng: -70.0830, city: "Santo Domingo Oeste" },
  "barrio nuevo horizonte":          { lat: 18.5360, lng: -70.0760, city: "Santo Domingo Oeste" },
  "ciudad agraria":                  { lat: 18.5300, lng: -70.0700, city: "Santo Domingo Oeste" },

  // ══ ZONA LOS ALCARRIZOS / PEDRO BRAND ═════════════════════════════════════
  "los alcarrizos":                  { lat: 18.5450, lng: -70.1050, city: "Santo Domingo Oeste" },
  "pedro brand":                     { lat: 18.5600, lng: -70.1200, city: "Santo Domingo Oeste" },
  "manoguayabo":                     { lat: 18.5200, lng: -70.0450, city: "Santo Domingo Oeste" },
  "la isabela":                      { lat: 18.5500, lng: -70.0900, city: "Santo Domingo Oeste" },
  "arroyo bonito":                   { lat: 18.5050, lng: -70.0250, city: "Santo Domingo Oeste" },
  "el 30 de mayo":                   { lat: 18.4960, lng: -70.0150, city: "Santo Domingo Oeste" },

  // ══ CORREDORES VIALES CLAVE ════════════════════════════════════════════════
  "autopista duarte":                { lat: 18.5100, lng: -70.0500, city: "Santo Domingo Oeste" },
  "prolongacion 27 de febrero":      { lat: 18.4780, lng: -70.0050, city: "Santo Domingo Oeste" },
  "avenida isabel aguiar":           { lat: 18.5050, lng: -70.0280, city: "Santo Domingo Oeste" },
  "avenida las palmas":              { lat: 18.4840, lng: -70.0060, city: "Santo Domingo Oeste" },
  "prolongacion independencia":      { lat: 18.4720, lng: -69.9980, city: "Santo Domingo Oeste" },

  // ══ DISTRITO NACIONAL (sectores frecuentes) ════════════════════════════════
  "naco":                            { lat: 18.4796, lng: -69.9273, city: "Distrito Nacional" },
  "piantini":                        { lat: 18.4745, lng: -69.9312, city: "Distrito Nacional" },
  "gazcue":                          { lat: 18.4768, lng: -69.9115, city: "Distrito Nacional" },
  "bella vista":                     { lat: 18.4680, lng: -69.9340, city: "Distrito Nacional" },
  "evaristo morales":                { lat: 18.4820, lng: -69.9340, city: "Distrito Nacional" },
  "arroyo hondo":                    { lat: 18.4910, lng: -69.9650, city: "Distrito Nacional" },
  "mirador sur":                     { lat: 18.4630, lng: -69.9510, city: "Distrito Nacional" },
  "mirador norte":                   { lat: 18.4760, lng: -69.9490, city: "Distrito Nacional" },
  "los cacicazgos":                  { lat: 18.4590, lng: -69.9440, city: "Distrito Nacional" },
  "palma real":                      { lat: 18.5234, lng: -69.9837, city: "Distrito Nacional" },
  "poligono central":                { lat: 18.4870, lng: -69.9490, city: "Distrito Nacional" },
  "cristo rey":                      { lat: 18.4960, lng: -69.9530, city: "Distrito Nacional" },
  "capotillo":                       { lat: 18.5040, lng: -69.9360, city: "Distrito Nacional" },
  "villa consuelo":                  { lat: 18.4895, lng: -69.9200, city: "Distrito Nacional" },
  "villa francisca":                 { lat: 18.4880, lng: -69.9110, city: "Distrito Nacional" },
  "ciudad nueva":                    { lat: 18.4810, lng: -69.9040, city: "Distrito Nacional" },
  "zona colonial":                   { lat: 18.4740, lng: -69.8930, city: "Distrito Nacional" },
  "gualey":                          { lat: 18.5010, lng: -69.9280, city: "Distrito Nacional" },
  "guachupita":                      { lat: 18.5050, lng: -69.9200, city: "Distrito Nacional" },
  "ensanche peravia":                { lat: 18.4920, lng: -69.9420, city: "Distrito Nacional" },
  "ensanche ozama":                  { lat: 18.4780, lng: -69.8800, city: "Distrito Nacional" },
  "ensanche isabelita":              { lat: 18.4830, lng: -69.9550, city: "Distrito Nacional" },
  "ensanche luperon":                { lat: 18.5030, lng: -69.9600, city: "Distrito Nacional" },
  "ensanche espaillat":              { lat: 18.4840, lng: -69.9450, city: "Distrito Nacional" },
  "30 de mayo":                      { lat: 18.4900, lng: -69.9500, city: "Distrito Nacional" },
  "la julia":                        { lat: 18.4930, lng: -69.9430, city: "Distrito Nacional" },
  "los prados":                      { lat: 18.5100, lng: -69.9600, city: "Distrito Nacional" },

  // ══ SANTO DOMINGO ESTE ════════════════════════════════════════════════════
  "villa duarte":                    { lat: 18.5010, lng: -69.8400, city: "Santo Domingo Este" },
  "los mina":                        { lat: 18.5080, lng: -69.8280, city: "Santo Domingo Este" },
  "alma rosa":                       { lat: 18.4940, lng: -69.8100, city: "Santo Domingo Este" },
  "la victoria":                     { lat: 18.5160, lng: -69.8600, city: "Santo Domingo Este" },
  "bonavista":                       { lat: 18.4880, lng: -69.7950, city: "Santo Domingo Este" },
  "san isidro":                      { lat: 18.5050, lng: -69.7800, city: "Santo Domingo Este" },
  "las americas":                    { lat: 18.4790, lng: -69.7700, city: "Santo Domingo Este" },

  // ══ SANTO DOMINGO NORTE ════════════════════════════════════════════════════
  "villa mella":                     { lat: 18.5850, lng: -69.9650, city: "Santo Domingo Norte" },
  "los girasoles":                   { lat: 18.5700, lng: -69.9700, city: "Santo Domingo Norte" },
  "el almirante":                    { lat: 18.5750, lng: -69.9600, city: "Santo Domingo Norte" },
  "sabana perdida":                  { lat: 18.6000, lng: -69.9400, city: "Santo Domingo Norte" },
  "guaricano":                       { lat: 18.5550, lng: -69.9800, city: "Santo Domingo Norte" },
  "pantoja":                         { lat: 18.5500, lng: -70.0100, city: "Santo Domingo Norte" },
};

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 3: CACHE DE APRENDIZAJE PERSISTENTE
// Cuando el admin corrige manualmente una dirección, la corrección se guarda
// en Firebase y se usa en futuras geocodificaciones de la misma dirección.
// Esto es lo que Circuit hace — aprende de tus correcciones.
// ─────────────────────────────────────────────────────────────────────────────
const _learnedCache = new Map(); // runtime: key → { lat, lng, display, confidence }

// Cargar cache aprendido desde Firebase al iniciar
const _loadLearnedCache = async () => {
  try {
    const data = await FB.get("geoCache");
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([k, v]) => {
        if (v?.lat && v?.lng) _learnedCache.set(k, v);
      });
    }
  } catch(e) { /* silencioso */ }
};
if (typeof window !== "undefined") _loadLearnedCache();

// Guardar una corrección manual en Firebase + cache local
const learnGeoCorrection = (rawAddress, lat, lng, display) => {
  const key = rawAddress.trim().toLowerCase();
  const entry = { lat, lng, display, confidence: 99, learnedAt: Date.now() };
  _learnedCache.set(key, entry);
  // Persistir en Firebase (nodo geoCache)
  const fbKey = key.replace(/[.#$/[\]]/g, "_").slice(0, 120);
  FB.set(`geoCache/${fbKey}`, entry).catch(() => {});
  // También guardar en el cache en-memoria inmediato
  _geoCache.set(key, { ok: true, lat, lng, display, confidence: 99, allResults: [], source: "learned" });
};

// Detectar el anchor más relevante para una dirección dada
// Retorna { lat, lng } o null
const findAnchor = (rawAddress) => {
  const t = rawAddress.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quitar acentos para comparar
    .replace(/\s+/g, " ").trim();
  // Buscar de más específico a más general (mayor longitud de clave = más específico)
  const keys = Object.keys(SDO_ANCHORS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const kn = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (t.includes(kn)) return SDO_ANCHORS[k];
  }
  return null;
};

// --- RD bounding box para filtrar resultados fuera del país ------------------
const RD_BOUNDS = {
  north: 19.93, south: 17.36, east: -68.32, west: -72.01,
};
const inRD = (lat, lng) => lat >= RD_BOUNDS.south && lat <= RD_BOUNDS.north && lng >= RD_BOUNDS.west && lng <= RD_BOUNDS.east;

// --- PLACES TEXT SEARCH (fallback #1 cuando Geocoder falla) ------------------
// Encuentra landmarks, negocios y sectores informales que el Geocoder no resuelve
const searchWithPlaces = async (rawAddress) => {
  await loadGoogleMaps();
  const service = new window.google.maps.places.PlacesService(
    document.createElement("div")
  );
  const rdBounds = new window.google.maps.LatLngBounds(
    { lat: RD_BOUNDS.south, lng: RD_BOUNDS.west },
    { lat: RD_BOUNDS.north, lng: RD_BOUNDS.east }
  );

  // Intentar varias queries: expandida, raw, y simplificada
  const queries = [
    expandRDAddress(rawAddress) + ", República Dominicana",
    rawAddress + ", Santo Domingo, República Dominicana",
    rawAddress.split(",")[0].trim() + ", Santo Domingo",
  ];

  for (const query of queries) {
    try {
      const results = await new Promise((res, rej) =>
        service.textSearch({ query, bounds: rdBounds, region: "do" },
          (r, s) => (s === "OK" || s === "ZERO_RESULTS") ? res(r || []) : rej(s))
      );

      const valid = (results || []).filter(r => {
        const loc = r.geometry?.location;
        if (!loc) return false;
        const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
        return inRD(lat, lng);
      });

      if (valid.length > 0) {
        const top = valid[0];
        const loc = top.geometry.location;
        const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
        const types = top.types || [];

        // Scoring por tipo de Place
        let conf = 62;
        if (types.includes("street_address") || types.includes("premise"))         conf = 88;
        else if (types.includes("establishment") || types.includes("point_of_interest")) conf = 76;
        else if (types.includes("neighborhood") || types.includes("sublocality"))  conf = 68;
        else if (types.includes("locality"))                                        conf = 60;

        // Bonus si el nombre coincide parcialmente
        const nameLow = (top.name || "").toLowerCase();
        const rawLow  = rawAddress.toLowerCase();
        if (rawLow.split(" ").some(w => w.length > 3 && nameLow.includes(w))) conf = Math.min(conf + 6, 94);

        return {
          ok: true, lat, lng,
          display: top.formatted_address || top.name,
          confidence: conf,
          types,
          source: "places_text_search",
          allResults: valid.slice(0, 3).map(r => {
            const l = r.geometry.location;
            return {
              display: r.formatted_address || r.name,
              lat: typeof l.lat === "function" ? l.lat() : l.lat,
              lng: typeof l.lng === "function" ? l.lng() : l.lng,
              confidence: 60,
            };
          }),
        };
      }
    } catch { /* try next query */ }
  }
  return null;
};

// --- GEOCODER (Google Maps Geocoding API + Places Text Search + Nominatim) ----
const CircuitEngine = () => {
  const [phase, setPhase]         = useState("upload");
  const [rawRows, setRawRows]     = useState([]);
  const [headers, setHeaders]     = useState([]);
  const [mapping, setMapping]     = useState({});
  const [stops, setStops]         = useState([]);
  const [routeName, setRouteName] = useState("Ruta nueva");
  const [driverName, setDriverName] = useState(() => (window.__rdMensajeros || DEFAULT_MENSAJEROS).find(m=>m.active)?.id || DEFAULT_MENSAJEROS[0].id);
  const [geoProgress, setGeoProgress] = useState(0);
  const [geoStatus, setGeoStatus] = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [reoptimizing, setReoptimizing] = useState(false);
  const [routesOptStatus, setRoutesOptStatus] = useState(""); // mensaje de la Routes API
  const [mapsReady, setMapsReady] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [addrEditStop, setAddrEditStop] = useState(null); // stop being edited in modal

  const fileRef = useRef(null);

  // -- RUTA DE PRUEBA - para testear el puente admin→mensajero sin subir archivo -
  const loadDemoRoute = () => {
    const demoStops = [
      { id:"S001", stopNum:1, rawAddr:"Av. Winston Churchill, Santo Domingo", displayAddr:"Av. Winston Churchill, Santo Domingo", client:"Henry Franco",    phone:"8097077979", notes:"Edificio Los Arroyos, 7 piso", lat:18.4714, lng:-69.9318, status:"ok", confidence:92, driverStatus:"pending", allResults:[], issue:null },
      { id:"S002", stopNum:2, rawAddr:"Av. 27 de Febrero, Naco, Santo Domingo", displayAddr:"Av. 27 de Febrero, Naco, Santo Domingo", client:"Jonathan Díaz",  phone:"8492030863", notes:"",                        lat:18.4762, lng:-69.9252, status:"ok", confidence:88, driverStatus:"pending", allResults:[], issue:null },
      { id:"S003", stopNum:3, rawAddr:"Calle El Conde, Zona Colonial, Santo Domingo", displayAddr:"Calle El Conde, Zona Colonial", client:"Yan Vargas",     phone:"8098204793", notes:"Frente al Parque Colón",   lat:18.4740, lng:-69.8887, status:"ok", confidence:94, driverStatus:"pending", allResults:[], issue:null },
      { id:"S004", stopNum:4, rawAddr:"Av. Independencia, Santo Domingo", displayAddr:"Av. Independencia, Santo Domingo",           client:"Blsdi Martínez", phone:"8092574449", notes:"",                        lat:18.4720, lng:-69.9100, status:"ok", confidence:90, driverStatus:"pending", allResults:[], issue:null },
      { id:"S005", stopNum:5, rawAddr:"Av. Tiradentes, Naco, Santo Domingo", displayAddr:"Av. Tiradentes, Naco, Santo Domingo",     client:"Adily Bonilla",  phone:"8097171086", notes:"Urgente",                lat:18.4780, lng:-69.9200, status:"ok", confidence:91, driverStatus:"pending", allResults:[], issue:null },
    ];
    setStops(demoStops);
    setRouteName("RUTA DEMO · " + new Date().toLocaleDateString("es-DO",{day:"2-digit",month:"short"}));
    const allMens = window.__rdMensajeros || DEFAULT_MENSAJEROS;
    setDriverName(allMens.find(m=>m.active)?.id || DEFAULT_MENSAJEROS[0].id);
    setPhase("route");
  };
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true));
    loadSheetJS();
  }, []);

  // -- STATS ------------------------------------------------------------------
  const statsOk      = stops.filter(s => s.status === "ok").length;
  const statsWarn    = stops.filter(s => s.status === "warning").length;
  const statsError   = stops.filter(s => s.status === "error").length;
  const statsPending = stops.filter(s => s.status === "pending").length;
  const validStops   = stops.filter(s => s.lat && s.lng);
  const km           = totalKm(validStops.filter(s => s.stopNum));

  // -- FILE PARSE -------------------------------------------------------------
  const parseFile = (file) => {
    const reader = new FileReader();
    if (/\.csv$/i.test(file.name)) {
      reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        const sep = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
        const hdrs = lines[0].split(sep).map(h => h.replace(/^"|"$/g, "").trim());
        const rows = lines.slice(1)
          .map(l => Object.fromEntries(hdrs.map((h, i) => [h, (l.split(sep)[i] || "").replace(/^"|"$/g, "").trim()])))
          .filter(r => Object.values(r).some(v => v.trim()));
        setHeaders(hdrs); setRawRows(rows); setMapping(autoDetect(hdrs)); setPhase("mapping");
      };
      reader.readAsText(file, "UTF-8");
    } else {
      reader.onload = (e) => {
        if (!window.XLSX) { alert("Recarga e intenta de nuevo"); return; }
        const wb = window.XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) return;
        const hdrs = Object.keys(rows[0]);
        setHeaders(hdrs); setRawRows(rows); setMapping(autoDetect(hdrs)); setPhase("mapping");
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // -- GEOCODING PIPELINE - batch con yield para no congelar UI ---------------
  const geocodingRef = useRef(false);

  const runGeocoding = useCallback(async () => {
    setPhase("geocoding");
    setGeoProgress(0);
    setGeoStatus("");
    geocodingRef.current = true;
    const col = mapping.address;
    const results = [];

    for (let i = 0; i < rawRows.length; i++) {
      if (!geocodingRef.current) break; // cancelable

      const row = rawRows[i];
      const raw      = String(row[col] || "").trim();
      const addr2    = mapping.address2  ? String(row[mapping.address2]  || "").trim() : "";
      const sector   = mapping.sector    ? String(row[mapping.sector]    || "").trim() : "";
      const ciudad   = mapping.ciudad    ? String(row[mapping.ciudad]    || "").trim() : "";
      const provincia= mapping.provincia ? String(row[mapping.provincia] || "").trim() : "";
      const cp       = mapping.cp        ? String(row[mapping.cp]        || "").trim() : "";
      // Build enriched query: address + addr2 + sector + ciudad + provincia
      const enrichedParts = [raw, addr2, sector, ciudad, provincia, cp].filter(Boolean);
      const enrichedRaw = enrichedParts.join(", ");
      const stop = {
        id:          `S${String(i + 1).padStart(3, "0")}`,
        stopNum:     null,
        rawAddr:     raw,
        displayAddr: raw ? expandRDAddress(enrichedRaw) : "Sin dirección",
        client:      String(row[mapping.client]   || `Parada ${i + 1}`).trim(),
        phone:       String(row[mapping.phone]    || "").trim(),
        notes:       [String(row[mapping.notes] || "").trim(), addr2].filter(Boolean).join(" · "),
        tracking:    String(row[mapping.tracking] || "").trim(),
        sector, ciudad, provincia, cp, addr2,
        lat: null, lng: null, confidence: 0,
        status: "pending", allResults: [], issue: null,
      };

      setGeoStatus(`${i + 1} / ${rawRows.length} - ${raw.slice(0, 55)}`);

      try {
        if (!raw) {
          stop.status = "error"; stop.issue = "Dirección vacía";
        } else {
          const coords = detectCoords(raw);
          if (coords) {
            Object.assign(stop, { ...coords, status: "ok", confidence: 99, displayAddr: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
          } else if (isPlusCode(raw)) {
            const r = await decodePlusCodeGoogle(raw);
            if (r.ok) Object.assign(stop, { lat: r.lat, lng: r.lng, status: "ok", confidence: 99, displayAddr: r.display || raw });
            else { stop.status = "error"; stop.issue = "Plus Code no reconocido"; }
          } else {
            const r = await geocodeWithGoogle(enrichedRaw);
            if (r.ok) {
              stop.lat = r.lat; stop.lng = r.lng; stop.displayAddr = r.display;
              stop.confidence = r.confidence; stop.allResults = r.allResults;
              stop.status = r.confidence >= 70 ? "ok" : "warning";
              stop.issue  = r.confidence < 70 ? "Confianza baja - verifica" : null;
            } else {
              stop.status = "error"; stop.issue = "No encontrada";
            }
          }
        }
      } catch {
        stop.status = "error"; stop.issue = "Error de red";
      }

      results.push(stop);
      const pct = Math.round(((i + 1) / rawRows.length) * 100);
      setGeoProgress(pct);

      // Yield al browser en CADA parada para que el progreso se vea siempre
      // Pequeño delay para no saturar la API de Google (rate limit)
      await new Promise(r => setTimeout(r, stop.status === "error" ? 80 : 30));
    }

    geocodingRef.current = false;

    // ── Optimización local inmediata (Haversine) para mostrar rápido ──────────
    const localOptimized = optimizeRoute(results);
    setStops(localOptimized);
    setPhase("review");
    setRoutesOptStatus("✓ Ruta optimizada con motor de zonas v3");
    setTimeout(() => setRoutesOptStatus(""), 4000);
  }, [rawRows, mapping]);

  // -- EDIT + RE-GEOCODE ------------------------------------------------------
  const saveEdit = async (stopId, placeResult) => {
    const newAddr = editValue.trim();
    if (!newAddr && !placeResult) return;
    setEditingId(null);

    if (placeResult) {
      // Came from Places autocomplete
      setStops(prev => {
        const updated = prev.map(s => s.id !== stopId ? s : {
          ...s, lat: placeResult.lat, lng: placeResult.lng,
          displayAddr: placeResult.display, rawAddr: placeResult.display,
          confidence: placeResult.confidence || 95, status: "ok", issue: null, allResults: [],
        });
        return optimizeRoute(updated);
      });
      return;
    }

    // Manual text → re-geocode
    setStops(prev => prev.map(s => s.id !== stopId ? s : { ...s, status: "pending", confidence: 0, displayAddr: newAddr, rawAddr: newAddr }));
    const coords = detectCoords(newAddr);
    let result;
    if (coords) {
      result = { ok: true, lat: coords.lat, lng: coords.lng, display: newAddr, confidence: 99, allResults: [] };
    } else if (isPlusCode(newAddr)) {
      const r = await decodePlusCodeGoogle(newAddr);
      result = r.ok ? { ok: true, lat: r.lat, lng: r.lng, display: r.display || newAddr, confidence: 99, allResults: [] }
                    : { ok: false };
    } else {
      result = await geocodeWithGoogle(newAddr);
    }

    setStops(prev => {
      const updated = prev.map(s => s.id !== stopId ? s : result.ok ? {
        ...s, lat: result.lat, lng: result.lng,
        displayAddr: result.display || newAddr,
        confidence: result.confidence, status: result.confidence >= 70 ? "ok" : "warning",
        issue: result.confidence < 70 ? "Confianza media" : null,
        allResults: result.allResults || [],
      } : { ...s, status: "error", confidence: 0, issue: "No encontrada - intenta otro formato" });
      return optimizeRoute(updated);
    });
  };

  const pickAlt = (stopId, alt) => {
    // ── Nivel 3: aprender cuando admin elige una alternativa ─────────────────
    const correctedStop = stops.find(s => s.id === stopId);
    if (correctedStop?.rawAddr) learnGeoCorrection(correctedStop.rawAddr, alt.lat, alt.lng, alt.display);
    learnGeoCorrection(alt.display, alt.lat, alt.lng, alt.display);
    setStops(prev => {
      const updated = prev.map(s => s.id !== stopId ? s : {
        ...s, lat: alt.lat, lng: alt.lng, displayAddr: alt.display,
        confidence: alt.confidence || 88, status: "ok", issue: null, allResults: [],
      });
      return optimizeRoute(updated);
    });
  };

  const reOpt = () => {
    setReoptimizing(true);
    setRoutesOptStatus("Optimizando con motor de zonas v3…");
    // Re-optimización con motor v3 local
    setStops(prev => optimizeRoute([...prev]));
    setRoutesOptStatus("✓ Re-optimizado con motor de zonas v3");
    setTimeout(() => setRoutesOptStatus(""), 3000);
    setReoptimizing(false);
  };

  const deleteStop = (stopId) => {
    setStops(prev => optimizeRoute(prev.filter(s => s.id !== stopId)));
    if (selectedId === stopId) setSelectedId(null);
  };

  const handleModalSave = (stopId, placeResult, rawText) => {
    setAddrEditStop(null);
    if (placeResult) {
      // ── Nivel 3: aprender corrección manual ───────────────────────────────
      const correctedStop = stops.find(s => s.id === stopId);
      if (correctedStop?.rawAddr) learnGeoCorrection(correctedStop.rawAddr, placeResult.lat, placeResult.lng, placeResult.display);
      learnGeoCorrection(placeResult.display, placeResult.lat, placeResult.lng, placeResult.display);
      setStops(prev => {
        const updated = prev.map(s => s.id !== stopId ? s : {
          ...s, lat: placeResult.lat, lng: placeResult.lng,
          displayAddr: placeResult.display, rawAddr: placeResult.display,
          confidence: placeResult.confidence || 97, status: "ok", issue: null, allResults: [],
        });
        return optimizeRoute(updated);
      });
    } else if (rawText) {
      // fallback: re-geocode with raw text
      setStops(prev => prev.map(s => s.id !== stopId ? s : { ...s, status:"pending", displayAddr: rawText, rawAddr: rawText }));
      geocodeWithGoogle(rawText).then(result => {
        setStops(prev => {
          const updated = prev.map(s => s.id !== stopId ? s : result.ok ? {
            ...s, lat:result.lat, lng:result.lng, displayAddr:result.display||rawText,
            confidence:result.confidence, status:result.confidence>=70?"ok":"warning",
            issue:result.confidence<70?"Confianza media":null, allResults:result.allResults||[],
          } : { ...s, status:"error", confidence:0, issue:"No encontrada" });
          return optimizeRoute(updated);
        });
      });
    }
  };

  // -- STYLES -----------------------------------------------------------------
  const inp  = { background: "#0a1019", border: "1px solid #1e2d3d", borderRadius: 9, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, fontFamily: "'Inter',sans-serif", outline: "none", caretColor: "#3b82f6", width: "100%" };
  const sel  = { ...inp, cursor: "pointer" };

  // confColor: usa la función global del módulo (misma lógica adaptada)
  const stopConfColor = (c) => c >= 70 ? "#e2e8f0" : "#ef4444";
  const statusBg  = (s) => s === "error" ? "rgba(239,68,68,0.06)" : "transparent";

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#060b10", fontFamily:"'Inter',sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2d3d;border-radius:4px}
        body,html{font-size:15px}
        @keyframes ceUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin2{to{transform:rotate(360deg)}}
        @keyframes shimmer2{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideR{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}
        .rh:hover{background:#0d1a2a!important}
        .gh:hover{background:#131f30!important;color:#94a3b8!important}
        input,select,textarea{font-size:14px!important}
        input::placeholder,textarea::placeholder{color:#2d4a60}
        select option{background:#0d1420}
        .pac-container{background:#0a0f1a!important;border:1px solid rgba(255,255,255,0.1)!important;border-radius:12px!important;box-shadow:0 16px 48px rgba(0,0,0,0.9)!important;margin-top:6px!important;padding:4px 0!important;overflow:hidden}
        .pac-item{background:transparent!important;color:#6b7280!important;padding:11px 14px!important;cursor:pointer!important;border-top:1px solid rgba(255,255,255,0.05)!important;display:flex!important;align-items:center}
        .pac-item:hover,.pac-item-selected{background:rgba(59,130,246,0.08)!important}
        .pac-item-query{color:#f1f5f9!important;font-size:13px!important;font-weight:600}
        .pac-secondary-text{color:#4b5563!important;font-size:11px}
        .pac-matched{color:#3b82f6!important}
        .pac-icon{width:16px!important;height:16px!important;background-image:none!important;background-color:#374151!important;border-radius:50%!important;margin-right:10px!important;flex-shrink:0!important}
        .pac-item:before{content:"📍";margin-right:8px;font-size:13px}
        .pac-icon-marker,.hdpi .pac-icon-marker{background:none!important}
      `}</style>

      {/* -- TOPBAR -- */}
      <div style={{ height: 50, borderBottom: "1px solid #0d1420", display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between", flexShrink: 0, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/></svg>
          </div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Rap Drive</span>
          <span style={{ color: "#131f30" }}>·</span>
          <span style={{ fontSize: 11, color: "#2d4a60" }}>Motor de Rutas</span>
          {!mapsReady && <span style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "2px 8px" }}>Cargando Maps...</span>}
          {mapsReady  && <span style={{ fontSize: 10, color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "2px 8px" }}>● Google Maps OK</span>}
        </div>
        {/* Phase steps */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[["upload","Subir"],["mapping","Columnas"],["geocoding","Geocodificar"],["review","Revisar"],["route","Ruta"]].map(([p, l], i, arr) => {
            const order = arr.map(x => x[0]);
            const cur = order.indexOf(phase), me = order.indexOf(p);
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 20, background: cur === me ? "#0a1828" : cur > me ? "rgba(16,185,129,0.07)" : "transparent", border: `1px solid ${cur === me ? "#1e3550" : cur > me ? "rgba(16,185,129,0.18)" : "transparent"}` }}>
                  <div style={{ width: 15, height: 15, borderRadius: "50%", background: cur === me ? "#3b82f6" : cur > me ? "#10b981" : "#131f30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "white", fontWeight: 700 }}>{cur > me ? "✓" : me + 1}</div>
                  <span style={{ fontSize: 10, fontFamily: "'Syne',sans-serif", fontWeight: 700, color: cur === me ? "#60a5fa" : cur > me ? "#10b981" : "#2d4a60" }}>{l}</span>
                </div>
                {i < arr.length - 1 && <div style={{ width: 12, height: 1, background: "#131f30" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* -- BODY -- */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

        {/* ════ UPLOAD ════ */}
        {phase === "upload" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ maxWidth: 560, width: "100%", animation: "fadeUp .4s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(59,130,246,0.4)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ fontSize: 22, fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: 8, letterSpacing:"-0.5px" }}>Motor de Rutas — Circuit Mode</div>
                <div style={{ fontSize: 12, color: "#4b5563", lineHeight:1.6 }}>Importa tu Excel o CSV. El motor geocodifica cada dirección con Google Maps<br/>y optimiza la ruta automáticamente con algoritmo Nearest-Neighbor + 2-opt.</div>
              </div>

              {/* Feature pills */}
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:22, flexWrap:"wrap" }}>
                {[["📍","Geocodificación real"],["🔢","Optimización 2-opt"],["📦","Cola de rutas"],["📱","Push al mensajero"]].map(([ic,lb])=>(
                  <div key={lb} style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:20,padding:"4px 12px" }}>
                    <span style={{ fontSize:11 }}>{ic}</span>
                    <span style={{ fontSize:10,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{lb}</span>
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? "#3b82f6" : "#1e2d3d"}`, borderRadius: 18, padding: "44px 28px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.01)", transition: "all .2s", marginBottom: 14, position:"relative", overflow:"hidden" }}>
                {dragOver && <div style={{ position:"absolute",inset:0,background:"rgba(59,130,246,0.04)",animation:"pulse .8s ease infinite" }}/>}
                <div style={{ fontSize: 48, marginBottom: 12, filter:"grayscale(0.2)" }}>📂</div>
                <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: 6 }}>{dragOver?"¡Suelta aquí!":"Arrastra tu Excel o CSV"}</div>
                <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>o haz clic para buscar en tu computadora</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {[".xlsx",".xls",".csv"].map(e => <span key={e} style={{ background: "#0a1019", border: "1px solid #1e2d3d", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "#60a5fa", fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>{e}</span>)}
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) parseFile(e.target.files[0]); }} />
              </div>

              {/* Bottom row: Demo + Template */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {/* Demo route */}
                <div style={{ padding:"14px 16px", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.15)", borderRadius:14, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:18 }}>🧪</span>
                    <div style={{ fontSize:12, color:"#6ee7b7", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>Ruta de prueba</div>
                  </div>
                  <div style={{ fontSize:11, color:"#4b5563", lineHeight:1.5 }}>5 paradas reales en Santo Domingo para testear el flujo completo</div>
                  <button onClick={loadDemoRoute} style={{ background:"linear-gradient(135deg,#059669,#10b981)", border:"none", borderRadius:9, padding:"9px", color:"white", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(16,185,129,0.3)", width:"100%" }}>
                    ▶ Cargar demo
                  </button>
                </div>

                {/* Plantilla */}
                <div style={{ padding:"14px 16px", background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:14, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:18 }}>💡</span>
                    <div style={{ fontSize:12, color:"#93c5fd", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>Plantilla oficial</div>
                  </div>
                  <div style={{ fontSize:11, color:"#4b5563", lineHeight:1.5 }}>Formato RD con ejemplos de sectores, Plus Codes y coordenadas</div>
                  <button onClick={e => {
                    e.stopPropagation();
                    const csv = `Dirección,Cliente,Teléfono,Notas,Prioridad\n"Calle Miguel Angel Monclus No 3, Mirador Norte, Santo Domingo",Henry Franco,8097077979,Edificio Los Arroyos 7 piso 4,normal\n"Calle Leonor Feltz #5, Mirador Sur, Santo Domingo DN",Jonathan Diaz,8492030863,,alta\n"calle Marginal Sarasota, Torre Atlantic III Apto 7-B Mirador Sur",Yan Vargas,8098204793,,normal\n"Sector 30 de Mayo Calle Juan Pablo Duarte #87",Blsdi Martinez,8092574449,,normal\n"Avenida Independencia Km 6 1/2, cerca Calle Luperon #74",Adily Bonilla,8097171086,,urgente\n"G2F8+7G3, Santo Domingo",Pedro García,8091234567,Palma Real - depósito,normal\n"18.4722, -69.9514",Ana Rodríguez,8094567890,Residencial Los Prados,alta`;
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "plantilla_rapdrive_RD.csv"; a.click();
                  }} style={{ background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", border: "none", borderRadius: 9, padding: "9px", color: "white", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 700, cursor: "pointer", width:"100%", boxShadow:"0 4px 14px rgba(59,130,246,0.3)" }}>
                    ↓ Descargar plantilla
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MAPPING ════ */}
        {phase === "mapping" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* LEFT PANEL */}
            <div style={{ width: 320, borderRight: "1px solid #0d1420", padding: "0", overflow: "auto", flexShrink: 0, display: "flex", flexDirection: "column", background:"#060b10" }}>

              {/* Panel header */}
              <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid #0d1420", background:"linear-gradient(180deg,#0a1019,#060b10)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(59,130,246,0.4)",flexShrink:0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9" }}>Configurar importación</div>
                    <div style={{ fontSize:11,color:"#374151",marginTop:1 }}>
                      <span style={{ color:"#3b82f6",fontWeight:700 }}>{rawRows.length}</span> filas detectadas · <span style={{ color:"#10b981",fontWeight:700 }}>{headers.length}</span> columnas
                    </div>
                  </div>
                </div>

                {/* CTA buttons */}
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setPhase("upload")} className="gh"
                    style={{ flex:1, padding:"8px", borderRadius:8, border:"1px solid #1e2d3d", background:"transparent", color:"#4b5563", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                    Atrás
                  </button>
                  <button onClick={runGeocoding} disabled={!mapping.address}
                    style={{ flex:2, padding:"8px", borderRadius:8, border:"none", background: mapping.address ? "linear-gradient(135deg,#1d4ed8,#3b82f6)" : "#131f30", color: mapping.address ? "white" : "#374151", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor: mapping.address ? "pointer" : "not-allowed", boxShadow: mapping.address ? "0 4px 16px #3b82f640" : "none", display:"flex", alignItems:"center", justifyContent:"center", gap:5, transition:"all .15s" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {mapping.address ? "Geocodificar →" : "Asigna Dirección primero"}
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex:1, overflow:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:12 }}>

                {/* MENSAJERO + RUTA */}
                <div style={{ background:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:9.5,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.2px",marginBottom:8 }}>📦 DESTINO DE LA RUTA</div>
                  <label style={{ fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",display:"block",marginBottom:4 }}>MENSAJERO</label>
                  <select value={driverName} onChange={e => setDriverName(e.target.value)} style={{ ...sel, marginBottom:10 }}>
                    {(window.__rdMensajeros || DEFAULT_MENSAJEROS).filter(m => m.active).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <label style={{ fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",display:"block",marginBottom:4 }}>NOMBRE DE RUTA</label>
                  <input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Ej: ADONIS ABRIL 20" style={{ ...inp }} />
                </div>

                {/* COLUMN MAPPING — Visual Card Style */}
                <div>
                  <div style={{ fontSize:9.5,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.2px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
                      ASIGNACIÓN DE COLUMNAS
                    </div>
                    <span style={{ fontSize:9,color:Object.values(mapping).filter(Boolean).length>0?"#10b981":"#374151",fontWeight:700 }}>
                      {Object.values(mapping).filter(Boolean).length}/{headers.length} mapeadas
                    </span>
                  </div>

                  {/* Columnas detectadas — chips scrollables */}
                  <div style={{ background:"#080e16",border:"1px solid #0d1420",borderRadius:10,padding:"10px",marginBottom:10 }}>
                    <div style={{ fontSize:9,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:7 }}>COLUMNAS EN TU ARCHIVO</div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                      {headers.map(h => {
                        const isMapped = Object.values(mapping).includes(h);
                        const fieldKey = Object.keys(mapping).find(k => mapping[k] === h);
                        const icons = { address:"📍",address2:"🏠",client:"👤",phone:"📞",tracking:"🏷",sector:"🗺",ciudad:"🏙",provincia:"🌎",cp:"📮",notes:"📝" };
                        return (
                          <div key={h} style={{
                            display:"inline-flex",alignItems:"center",gap:4,
                            background: isMapped ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isMapped ? "rgba(16,185,129,0.3)" : "#1a2d40"}`,
                            borderRadius:20, padding:"3px 9px", fontSize:10.5,
                            color: isMapped ? "#10b981" : "#4b5563",
                            fontFamily:"'Inter',sans-serif", fontWeight:600,
                            transition:"all .15s",
                          }}>
                            {isMapped && <span style={{ fontSize:10 }}>{icons[fieldKey]||"✓"}</span>}
                            {h}
                            {isMapped && <span style={{ fontSize:8,opacity:0.7 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cards de mapeo — diseño compacto con color */}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[
                      { f:"address",   l:"Dirección",          req:true,  icon:"📍", color:"#3b82f6", desc:"Principal campo de entrega" },
                      { f:"client",    l:"Cliente",            req:false, icon:"👤", color:"#8b5cf6", desc:"Nombre del destinatario" },
                      { f:"phone",     l:"Teléfono",           req:false, icon:"📞", color:"#10b981", desc:"Para llamar y WhatsApp" },
                      { f:"tracking",  l:"Código SP",          req:false, icon:"🏷", color:"#f59e0b", desc:"Guía, tracking o referencia" },
                      { f:"address2",  l:"Dirección 2",        req:false, icon:"🏠", color:"#64748b", desc:"Apt, piso, referencia extra" },
                      { f:"sector",    l:"Sector",             req:false, icon:"🗺", color:"#64748b", desc:"Sector o barrio" },
                      { f:"notes",     l:"Notas",              req:false, icon:"📝", color:"#64748b", desc:"Instrucciones especiales" },
                      { f:"ciudad",    l:"Ciudad",             req:false, icon:"🏙", color:"#64748b", desc:"Municipio / localidad" },
                      { f:"provincia", l:"Provincia",          req:false, icon:"🌎", color:"#64748b", desc:"Provincia o estado" },
                      { f:"cp",        l:"Cód. Postal",        req:false, icon:"📮", color:"#64748b", desc:"ZIP o código postal" },
                    ].map(({ f, l, req, icon, color, desc }) => {
                      const mapped = !!mapping[f];
                      return (
                        <div key={f} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:10, background: mapped ? `${color}08` : "rgba(255,255,255,0.02)", border:`1px solid ${mapped ? color+"30" : req ? "rgba(59,130,246,0.2)" : "#0d1420"}`, transition:"all .15s" }}>
                          {/* Icon */}
                          <div style={{ width:30, height:30, borderRadius:8, background: mapped ? `${color}15` : "rgba(255,255,255,0.04)", border:`1px solid ${mapped ? color+"25" : "#1a2d40"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                            {mapped ? <span style={{ fontSize:12 }}>✓</span> : icon}
                          </div>
                          {/* Label + desc */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10.5, fontWeight:700, color: mapped ? color : req ? "#60a5fa" : "#4b5563", fontFamily:"'Syne',sans-serif", letterSpacing:"0.3px", display:"flex", alignItems:"center", gap:4 }}>
                              {l}{req && <span style={{ fontSize:9,color:"#ef4444" }}>*</span>}
                            </div>
                            <div style={{ fontSize:9.5, color:"#2d4a60", marginTop:0.5, fontFamily:"'Inter',sans-serif" }}>{desc}</div>
                          </div>
                          {/* Select */}
                          <select value={mapping[f] || ""} onChange={e => setMapping(m => ({ ...m, [f]: e.target.value || undefined }))}
                            style={{ background:"#060b10", border:`1px solid ${mapped ? color+"35" : "#1a2d40"}`, borderRadius:7, padding:"5px 8px", color: mapped ? "#e2e8f0" : "#4b5563", fontSize:10.5, fontFamily:"'Inter',sans-serif", outline:"none", cursor:"pointer", maxWidth:110, flexShrink:0, transition:"border .15s" }}>
                            <option value="">— —</option>
                            {headers.map(h => <option key={h} value={h}>{h.length > 14 ? h.slice(0,14)+"…" : h}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT: Preview table — más visual */}
            <div style={{ flex:1, overflow:"auto", padding:"20px", background:"#060b10" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px" }}>
                    PREVISUALIZACIÓN DE DATOS
                  </div>
                  <div style={{ fontSize:10,color:"#2d4a60",marginTop:2 }}>
                    {rawRows.length} filas · {headers.length} columnas · mostrando primeras {Math.min(rawRows.length,10)}
                  </div>
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:20,padding:"4px 10px" }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:"#10b981" }}/>
                    <span style={{ fontSize:10,color:"#10b981",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{Object.values(mapping).filter(Boolean).length} mapeadas</span>
                  </div>
                  {!mapping.address && (
                    <div style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:20,padding:"4px 10px" }}>
                      <div style={{ width:6,height:6,borderRadius:"50%",background:"#ef4444" }}/>
                      <span style={{ fontSize:10,color:"#ef4444",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>Falta dirección *</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla con scroll horizontal para ver todas las columnas */}
              <div style={{ borderRadius:14, border:"1px solid #0d1420", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.4)" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                    <thead>
                      <tr style={{ background:"#080e16", borderBottom:"1px solid #131f30" }}>
                        <th style={{ padding:"9px 12px", textAlign:"center", fontSize:9, color:"#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.8px", borderRight:"1px solid #0d1420", width:36, whiteSpace:"nowrap" }}>#</th>
                        {headers.map(h => {
                          const isMapped = Object.values(mapping).includes(h);
                          const fieldKey = Object.keys(mapping).find(k => mapping[k] === h);
                          const icons = { address:"📍",address2:"🏠",client:"👤",phone:"📞",tracking:"🏷",sector:"🗺",ciudad:"🏙",notes:"📝",provincia:"🌎",cp:"📮" };
                          const colors = { address:"#3b82f6",client:"#8b5cf6",phone:"#10b981",tracking:"#f59e0b" };
                          const col = colors[fieldKey] || "#10b981";
                          return (
                            <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:9.5, color: isMapped ? col : "#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.6px", whiteSpace:"nowrap", borderRight:"1px solid #0d1420", background: isMapped ? `${col}08` : "transparent" }}>
                              <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                                {isMapped && <span style={{ fontSize:11 }}>{icons[fieldKey]||"✓"}</span>}
                                {h}
                                {isMapped && (
                                  <span style={{ background:`${col}20`,border:`1px solid ${col}30`,borderRadius:4,padding:"1px 5px",fontSize:8,color:col,fontWeight:800 }}>
                                    {fieldKey==="address"?"DIRECCIÓN":fieldKey==="client"?"CLIENTE":fieldKey==="phone"?"TEL":fieldKey==="tracking"?"SP":fieldKey?.toUpperCase()||"✓"}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 10).map((row, i) => (
                        <tr key={i} style={{ borderBottom:"1px solid #080e16", transition:"background .1s", background: i%2===0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                          <td style={{ padding:"9px 12px", textAlign:"center", fontSize:10, color:"#1e3550", fontFamily:"'DM Mono',monospace", borderRight:"1px solid #0a0f18", width:36 }}>{i+1}</td>
                          {headers.map(h => {
                            const isMapped = Object.values(mapping).includes(h);
                            const fieldKey = Object.keys(mapping).find(k => mapping[k] === h);
                            const colors = { address:"#e2e8f0",client:"#c4b5fd",phone:"#6ee7b7",tracking:"#fcd34d" };
                            const col = isMapped ? (colors[fieldKey]||"#e2e8f0") : "#374151";
                            const val = String(row[h] || "");
                            return (
                              <td key={h} style={{ padding:"9px 14px", fontSize:11.5, color: col, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", borderRight:"1px solid #0a0f18", fontWeight: isMapped ? 500 : 400 }}>
                                {val || <span style={{ color:"#1e3550",fontStyle:"italic",fontSize:10 }}>vacío</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {rawRows.length > 10 && (
                <div style={{ textAlign:"center", marginTop:10, fontSize:11, color:"#2d4a60", fontFamily:"'Inter',sans-serif" }}>
                  + {rawRows.length - 10} filas más · {rawRows.length} total
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ GEOCODING ════ */}
        {phase === "geocoding" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background:"linear-gradient(135deg,#060b10,#080e16)" }}>
            <style>{`
              @keyframes orbit1{from{transform:rotate(0deg) translateX(44px) rotate(0deg)}to{transform:rotate(360deg) translateX(44px) rotate(-360deg)}}
              @keyframes orbit2{from{transform:rotate(120deg) translateX(32px) rotate(-120deg)}to{transform:rotate(480deg) translateX(32px) rotate(-480deg)}}
              @keyframes orbit3{from{transform:rotate(240deg) translateX(52px) rotate(-240deg)}to{transform:rotate(600deg) translateX(52px) rotate(-600deg)}}
              @keyframes geoRing1{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.22);opacity:0.08}}
              @keyframes geoRing2{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(1.35);opacity:0.05}}
              @keyframes geoRing3{0%,100%{transform:scale(1);opacity:0.12}50%{transform:scale(1.5);opacity:0.03}}
              @keyframes geoPulseText{0%,100%{opacity:1}50%{opacity:0.6}}
              @keyframes geoShimmer{0%{background-position:200% center}100%{background-position:-200% center}}
              @keyframes geoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
              @keyframes scanLine{0%{transform:translateY(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(300%);opacity:0}}
              @keyframes addressFly{0%{opacity:0;transform:translateX(-10px)}20%{opacity:1;transform:translateX(0)}80%{opacity:1}100%{opacity:0;transform:translateX(10px)}}
            `}</style>
            <div style={{ maxWidth: 460, width: "100%", padding: "36px 32px", textAlign: "center", animation: "fadeUp .3s ease" }}>

              {/* Orbital core */}
              <div style={{ width: 120, height: 120, position: "relative", margin: "0 auto 28px", animation:"geoFloat 3s ease-in-out infinite" }}>
                {/* Pulse rings */}
                <div style={{ position:"absolute", inset:-22, borderRadius:"50%", border:"1px solid #3b82f640", animation:"geoRing1 2.2s ease-in-out infinite" }}/>
                <div style={{ position:"absolute", inset:-38, borderRadius:"50%", border:"1px solid #3b82f625", animation:"geoRing2 2.2s .5s ease-in-out infinite" }}/>
                <div style={{ position:"absolute", inset:-54, borderRadius:"50%", border:"1px solid #3b82f612", animation:"geoRing3 2.2s 1s ease-in-out infinite" }}/>
                {/* Glow */}
                <div style={{ position:"absolute", inset:-8, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 70%)" }}/>
                {/* Core */}
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 40px rgba(59,130,246,0.7), 0 0 80px rgba(59,130,246,0.3)", overflow:"hidden" }}>
                  {/* Scan line */}
                  <div style={{ position:"absolute", left:0, right:0, height:2, background:"rgba(255,255,255,0.4)", animation:"scanLine 2s linear infinite" }}/>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                {/* Orbiting dots */}
                {[
                  {size:10,color:"#60a5fa",shadow:"#60a5fa",anim:"orbit1",dur:"1.8s"},
                  {size:7,color:"#818cf8",shadow:"#818cf8",anim:"orbit2",dur:"2.2s"},
                  {size:8,color:"#34d399",shadow:"#34d399",anim:"orbit3",dur:"1.5s"},
                ].map((d,i)=>(
                  <div key={i} style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:d.size,height:d.size,borderRadius:"50%",background:d.color,boxShadow:`0 0 10px ${d.shadow}`,animation:`${d.anim} ${d.dur} linear infinite` }}/>
                  </div>
                ))}
              </div>

              {/* Title */}
              <div style={{ fontSize: 18, fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: 6, color:"#f1f5f9", letterSpacing:"-0.4px" }}>Geolocalizando con Google Maps</div>
              <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 6 }}>Procesando calles · sectores · referencias · Plus Codes</div>

              {/* Address flying by */}
              <div style={{ height:22, overflow:"hidden", marginBottom:18 }}>
                <div key={geoStatus} style={{ fontSize:11, color:"#3b82f6", fontFamily:"'Inter',monospace", animation:"addressFly 2s ease-in-out", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", padding:"0 20px" }}>{geoStatus || "Iniciando..."}</div>
              </div>

              {/* Progress bar - enhanced */}
              <div style={{ height: 8, background: "#0d1420", borderRadius: 8, marginBottom: 10, overflow: "hidden", border:"1px solid #131f30" }}>
                <div style={{ height:"100%", borderRadius: 8, width: `${geoProgress}%`, background: "linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa,#3b82f6)", backgroundSize: "300% 100%", animation: "geoShimmer 2s linear infinite", transition: "width .6s cubic-bezier(.4,0,.2,1)", boxShadow:"0 0 12px rgba(59,130,246,0.5)" }} />
              </div>

              {/* Stats row */}
              <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:8 }}>
                <div style={{ fontSize: 24, fontFamily: "'Syne',sans-serif", fontWeight: 900, color: "#3b82f6", animation:"geoPulseText 1.8s ease-in-out infinite" }}>{geoProgress}%</div>
                <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:2, textAlign:"left" }}>
                  <div style={{ fontSize:10, color:"#10b981", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>✓ {stops.filter(s=>s.status==="ok"||s.confidence>=70).length} geocodificadas</div>
                  {stops.filter(s=>s.status==="error").length > 0 && <div style={{ fontSize:10, color:"#ef4444", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>✕ {stops.filter(s=>s.status==="error").length} con error</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ REVIEW + ROUTE ════ */}
        {(phase === "review" || phase === "route") && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Left panel: stops list */}
            <div style={{ width: 360, borderRight: "1px solid #0d1420", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              {/* Header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #0d1420", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: 800 }}>{routeName || "Nueva Ruta"}</div>
                    {driverName && <div style={{ fontSize: 11, color: "#4b5563" }}>{(window.__rdMensajeros||DEFAULT_MENSAJEROS).find(m=>m.id===driverName)?.name || driverName}</div>}
                  </div>
                  <div style={{ textAlign: "right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "#3b82f6" }}>{stops.filter(s => s.stopNum).length} paradas</div>
                    {km > 0 && <div style={{ fontSize: 10, color: "#4b5563" }}>{km} km</div>}
                  </div>
                </div>
                {/* Status pills */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {statsOk>0&&<div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"2px 8px"}}><div style={{width:5,height:5,borderRadius:"50%",background:"#3b82f6"}}/><span style={{fontSize:9.5,color:"#94a3b8",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{statsOk} Geocodificadas</span></div>}
                  {statsWarn>0&&<div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"2px 8px"}}><div style={{width:5,height:5,borderRadius:"50%",background:"#94a3b8"}}/><span style={{fontSize:9.5,color:"#94a3b8",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{statsWarn} Advertencia</span></div>}
                  {statsError>0&&<div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:6,padding:"2px 8px"}}><div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444"}}/><span style={{fontSize:9.5,color:"#ef4444",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{statsError} Error</span></div>}
                  {reoptimizing && <div style={{ fontSize: 10, color: "#3b82f6", display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, border: "2px solid #3b82f655", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin .8s linear infinite" }} />Re-optimizando...</div>}
                  {routesOptStatus && !reoptimizing && <div style={{ fontSize: 10, color: routesOptStatus.startsWith("✓") ? "#10b981" : "#f59e0b", display:"flex", alignItems:"center", gap:4 }}>{routesOptStatus.startsWith("✓") ? "✓" : <div style={{ width:8,height:8,border:"2px solid #f59e0b55",borderTopColor:"#f59e0b",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>}{routesOptStatus.replace("✓ ","")}</div>}
                </div>
              </div>

              {/* Action bar */}
              <div style={{ padding: "8px 16px", borderBottom: "1px solid #0d1420", display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                <button onClick={() => { setPhase("upload"); setStops([]); setRawRows([]); setHeaders([]); setMapping({}); setRouteName("Ruta nueva"); setSelectedId(null); setClientSearch(""); }} className="gh"
                  style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #1e3550", background: "rgba(59,130,246,0.08)", color: "#60a5fa", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 700, cursor: "pointer", transition: "all .1s", minWidth: 110, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Nueva Ruta
                </button>
                <button onClick={() => setPhase(phase === "review" ? "route" : "review")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "white", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 12px #10b98130", minWidth: 100 }}>
                  {phase === "review" ? "Ver ruta →" : "← Revisar"}
                </button>
                  {phase === "route" && (
                  <button
                    onClick={async () => {
                      const confirmed = stops.filter(s => s.stopNum != null);
                      const allMens = window.__rdMensajeros || DEFAULT_MENSAJEROS;
                      const norm = (s) => (s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
                      const mensajero = allMens.find(m => m.id === driverName)
                                     || allMens.find(m => norm(m.name) === norm(driverName))
                                     || allMens.find(m => norm(m.name).includes(norm(driverName).split(" ")[0]))
                                     || allMens[0];
                      const driverId = mensajero?.id || driverName || "M-01";
                      const route = {
                        routeName, driverName: mensajero?.name || driverId, driverId,
                        stops: confirmed,
                        km, sentAt: new Date().toISOString(),
                        routeId: `R-${Date.now()}`,
                      };

                      // ── LÓGICA DE COLA ─────────────────────────────────────────
                      // Verificar trabajo activo DESDE FIREBASE (fuente de verdad real)
                      const fbRoute = await FB.get(`routes/${driverId}`);
                      const fbStops = fbRoute?.stops
                        ? (Array.isArray(fbRoute.stops) ? fbRoute.stops : Object.values(fbRoute.stops))
                        : [];
                      const hasActiveStops = fbStops.some(
                        s => s.driverStatus === "pending" || s.driverStatus === "en_ruta"
                      );

                      if (hasActiveStops) {
                        // → Agregar a la cola de rutas pendientes
                        // SIEMPRE leer desde memoria local (no Firebase) para evitar resucitar rutas completadas
                        if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
                        const currentQueue = window.__rdPendingRoutes[driverId] || [];
                        // Verificar que no esté ya en la cola (evitar duplicados)
                        const alreadyQueued = currentQueue.some(r =>
                          r.routeId === route.routeId || r.sentAt === route.sentAt
                        );
                        if (!alreadyQueued) {
                          const routeWithStatus = { ...route, queueStatus: "pending", enqueuedAt: new Date().toISOString() };
                          const queue = [...currentQueue, routeWithStatus];
                          window.__rdPendingRoutes[driverId] = queue;
                          LS.setPending(driverId, queue);
                          if (typeof window.__rdSetPending === "function") window.__rdSetPending(driverId, queue);
                        }
                        // Chat automático
                        if (!window.__rdChatStore) window.__rdChatStore = {};
                        const chatNote = { from:"admin", text:`📋 Ruta "${routeName}" en cola - ${confirmed.length} paradas · ${km} km. Se activará cuando termines la ruta actual.`, time: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) };
                        const updatedChat = [...(window.__rdChatStore[driverId]||[]), chatNote];
                        window.__rdChatStore[driverId] = updatedChat;
                        LS.setChat(driverId, updatedChat);
                        alert(`📋 Ruta enviada a la COLA de ${mensajero?.name || driverId}\n\n${confirmed.length} paradas · ${km} km\n\nEl mensajero tiene una ruta activa. Esta ruta quedará pendiente hasta que la termine.`);
                      } else {
                        // → Asignar directamente como ruta activa
                        if (!window.__rdRouteStore) window.__rdRouteStore = {};
                        window.__rdRouteStore[driverId] = route;
                        LS.setRoute(driverId, route);
                        // Guardar también en historial de rutas (keyed by routeId, no por driverId)
                        FB.set(`routeHistory/${route.routeId}`, { ...route, sentAt: route.sentAt });
                        if (typeof window.__rdSetRoute === "function") window.__rdSetRoute(driverId, route);
                        // ── Notificación Firebase al mensajero ──
                        const driverNotifId = "dn"+Date.now();
                        FB.set(`driverNotifs/${driverId}/${driverNotifId}`, {
                          id: driverNotifId,
                          type: "route_assigned",
                          title: "📦 Nueva ruta asignada",
                          body: `${routeName} · ${confirmed.length} paradas · ${km} km`,
                          routeId: route.routeId,
                          sentAt: new Date().toISOString(),
                          read: false,
                        });
                        // Chat automático
                        if (!window.__rdChatStore) window.__rdChatStore = {};
                        const chatNote = { from:"admin", text:`📦 Ruta "${routeName}" asignada - ${confirmed.length} paradas · ${km} km`, time: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) };
                        const updatedChat = [...(window.__rdChatStore[driverId]||[]), chatNote];
                        window.__rdChatStore[driverId] = updatedChat;
                        LS.setChat(driverId, updatedChat);
                        // Evento real en notificaciones admin
                        if (typeof window.__rdPushEvent === "function") window.__rdPushEvent({
                          id:"e"+Date.now(), type:"new", icon:"📦", color:"#3b82f6",
                          title:`Ruta enviada → ${mensajero?.name||driverId}`,
                          body:`${routeName} · ${confirmed.length} paradas · ${km} km`,
                          time: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}),
                          read: false, isNew: true,
                        });
                        alert(`✅ Ruta enviada a ${mensajero?.name || driverId} · ${confirmed.length} paradas · ${km} km`);
                      }
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", color: "white", fontSize: 12, fontFamily: "'Syne',sans-serif", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 150, boxShadow:"0 4px 20px #3b82f650", letterSpacing:"0.3px", position:"relative", overflow:"hidden" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Enviar al mensajero
                  </button>
                )}
              </div>

              {/* -- CLIENT SEARCH -- */}
              {stops.length > 0 && (
                <div style={{ padding:"8px 12px", borderBottom:"1px solid #0d1420", flexShrink:0 }}>
                  <div style={{ position:"relative" }}>
                    <svg style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Buscar por nombre, SP, teléfono..."
                      style={{ width:"100%", background:"#0a1019", border:"1px solid #1a2a3a", borderRadius:8, padding:"7px 28px 7px 28px", color:"#e2e8f0", fontSize:11, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#3b82f6" }}
                    />
                    {clientSearch && <button onClick={() => setClientSearch("")} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:12, padding:0, lineHeight:1 }}>✕</button>}
                  </div>
                </div>
              )}

              {/* -- STOPS LIST -- */}
              <div style={{ flex:1, overflow:"auto" }}>
                {(() => {
                  const q = clientSearch.trim().toLowerCase();
                  const list = q
                    ? stops.filter(s =>
                        (s.client||"").toLowerCase().includes(q) ||
                        (s.displayAddr||"").toLowerCase().includes(q) ||
                        (s.phone||"").includes(q) ||
                        (s.tracking||"").toLowerCase().includes(q) ||
                        String(s.stopNum||"").includes(q)
                      )
                    : stops;
                  if (q && list.length === 0) return (
                    <div style={{ padding:"28px 16px", textAlign:"center", color:"#2d4a60", fontSize:12 }}>
                      <div style={{ fontSize:24, marginBottom:8, opacity:0.4 }}>🔍</div>
                      Sin resultados para "<span style={{ color:"#4b5563" }}>{clientSearch}</span>"
                    </div>
                  );
                  return list.map((stop, i) => {
                    const isSelected = selectedId === stop.id;
                    return (
                      <div key={stop.id}
                        onClick={() => setSelectedId(stop.id === selectedId ? null : stop.id)}
                        className="rh"
                        style={{ borderBottom:"1px solid #0a0d14", background: isSelected ? "#0b1a2e" : statusBg(stop.status), cursor:"pointer", transition:"background .1s", animation:`slideR .2s ${Math.min(i,20)*20}ms ease both`, borderLeft: isSelected ? "3px solid #3b82f6" : `3px solid ${stop.status==="error"?"#ef444433":"transparent"}` }}>
                        <div style={{ padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
                          {/* Stop number bubble */}
                          <div style={{ width:32, height:32, borderRadius:9, background:stop.status==="error"?"rgba(239,68,68,0.12)":isSelected?"#3b82f6":"#0d1a28", border:`1.5px solid ${stop.status==="error"?"rgba(239,68,68,0.35)":isSelected?"#3b82f6":"#1a2a3a"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11.5, color:stop.status==="error"?"#ef4444":isSelected?"white":"#3b82f6", fontFamily:"'Inter',sans-serif", fontWeight:700, flexShrink:0, letterSpacing:"-0.3px" }}>
                            {stop.status==="pending"
                              ? <div style={{ width:9, height:9, border:"2px solid #37415055", borderTopColor:"#6b7280", borderRadius:"50%", animation:"spin .9s linear infinite" }}/>
                              : stop.stopNum || "✕"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            {/* CLIENT NAME */}
                            <div style={{ fontSize:13.5, fontFamily:"'Inter',sans-serif", fontWeight:600, color:"#e8eef5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2, letterSpacing:"-0.1px" }}>
                              {stop.client || `Parada ${stop.stopNum||"?"}`}
                            </div>
                            {/* TRACKING CODE — solo el código, sin prefijo duplicado */}
                            {stop.tracking && (
                              <div style={{ display:"inline-flex", alignItems:"center", gap:0, background:"#0a0f18", border:"1px solid #1e2d3d", borderRadius:5, padding:"2px 8px", marginBottom:4 }}>
                                <span style={{ fontSize:10.5, color:"#64748b", fontFamily:"'Inter',monospace", fontWeight:500, letterSpacing:"0.3px" }}>{stop.tracking}</span>
                              </div>
                            )}
                            {/* ADDRESS */}
                            <div
                              onClick={e => { e.stopPropagation(); setAddrEditStop(stop); setSelectedId(stop.id); }}
                              title="Clic para corregir con Google Maps"
                              style={{ fontSize:11, color:stop.status==="error"?"#f87171":"#475569", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:stop.phone?2:0, cursor:"pointer", letterSpacing:"0.05px" }}>
                              {stop.displayAddr}
                            </div>
                            {/* PHONE */}
                            {stop.phone && (
                              <div style={{ fontSize:11, color:"#3b82f6", fontFamily:"'Inter',sans-serif", fontWeight:500, letterSpacing:"0.2px" }}>
                                {stop.phone}
                              </div>
                            )}
                            {stop.issue && (
                              <div style={{ fontSize:10, color:stop.status==="error"?"#f87171":"#f59e0b", marginTop:3, display:"flex", alignItems:"center", gap:4 }}>
                                <span>⚠</span>
                                <span>{stop.issue}</span>
                                {stop.status==="error" && <span style={{ color:"#3b82f6", cursor:"pointer" }} onClick={e=>{e.stopPropagation();setAddrEditStop(stop);setSelectedId(stop.id);}}>— corregir</span>}
                              </div>
                            )}
                            {/* ETA from Routes API */}
                            {stop.etaMin != null && (
                              <div style={{ fontSize:10, color:"#3b82f6", marginTop:2, display:"flex", alignItems:"center", gap:3, fontFamily:"'Inter',monospace" }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {stop.etaMin} min desde parada anterior
                                {stop.distKmRoutes != null && <span style={{color:"#374151"}}> · {stop.distKmRoutes} km</span>}
                              </div>
                            )}
                            {/* Confidence warning */}
                            {stop.confidence > 0 && stop.confidence < 70 && (
                              <div style={{ fontSize:9, color:"#ef4444", marginTop:2 }}>{stop.confidence}% confianza</div>
                            )}
                            {/* WhatsApp when selected */}
                            {isSelected && stop.lat && stop.lng && (
                              <div style={{ display:"flex", gap:5, marginTop:9 }}>
                                {stop.phone && <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${stop.phone.replace(/\D/g,"")}`,"_blank"); }}
                                  style={{ flex:1, padding:"7px 0", borderRadius:7, border:"1px solid rgba(37,211,102,0.3)", background:"rgba(37,211,102,0.07)", color:"#22c55e", fontSize:11, fontFamily:"'Inter',sans-serif", fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                  WhatsApp
                                </button>}
                                {!stop.phone && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic" }}>Sin teléfono</div>}
                              </div>
                            )}
                            {/* Alternatives */}
                            {stop.allResults?.length > 0 && stop.status==="warning" && (
                              <div style={{ marginTop:6 }}>
                                <div style={{ fontSize:9.5, color:"#4b5563", marginBottom:4 }}>¿Quisiste decir?</div>
                                {stop.allResults.slice(0,2).map((alt, ai) => (
                                  <button key={ai} onClick={e => { e.stopPropagation(); pickAlt(stop.id, alt); }}
                                    style={{ display:"block", width:"100%", textAlign:"left", padding:"5px 8px", marginBottom:3, borderRadius:7, border:"1px solid rgba(59,130,246,0.2)", background:"rgba(59,130,246,0.05)", color:"#93c5fd", fontSize:10.5, cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                    📍 {alt.display.split(",").slice(0,3).join(",")}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* DELETE button — always visible, red on hover */}
                          <button
                            onClick={e => { e.stopPropagation(); deleteStop(stop.id); }}
                            title="Eliminar parada"
                            style={{ width:28, height:28, borderRadius:7, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.06)", color:"#ef4444", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity: isSelected ? 1 : 0.45, transition:"opacity .15s, background .15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background="rgba(239,68,68,0.18)"; e.currentTarget.style.opacity="1"; }}
                            onMouseLeave={e => { e.currentTarget.style.background="rgba(239,68,68,0.06)"; e.currentTarget.style.opacity=isSelected?"1":"0.45"; }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Footer: summary stats */}
              {statsError > 0 && (
                <div style={{ padding: "10px 14px", borderTop: "1px solid #0d1420", background: "rgba(239,68,68,0.06)", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "#ef4444", fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>⚠ {statsError} direcciones sin geocodificar</div>
                  <div style={{ fontSize: 10, color: "#9f1239", marginTop: 2 }}>Haz clic en la dirección subrayada para corregir con Google Maps</div>
                </div>
              )}
            </div>

            {/* Right: Google Map */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <RouteMap
                stops={stops}
                selectedId={selectedId}
                onSelectStop={(id, openEdit) => {
                  setSelectedId(id);
                  if (openEdit) {
                    const stop = stops.find(s => s.id === id);
                    if (stop) setAddrEditStop(stop);
                  }
                }}
                phase={phase}
              />
              {/* Map overlay: clean stats like Circuit */}
              {(phase === "route" || phase === "review") && km > 0 && (
                <div style={{ position:"absolute", top:12, right:12, background:"rgba(6,11,16,0.88)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:"10px 16px", display:"flex", gap:20 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:18, fontFamily:"'Syne',sans-serif", fontWeight:800, color:"#f1f5f9" }}>{km} <span style={{fontSize:11,color:"#4b5563"}}>km</span></div>
                    <div style={{ fontSize:10, color:"#4b5563" }}>Distancia</div>
                  </div>
                  <div style={{ width:1, background:"rgba(255,255,255,0.07)" }}/>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:18, fontFamily:"'Syne',sans-serif", fontWeight:800, color:"#f1f5f9" }}>{stops.filter(s=>s.stopNum).length}</div>
                    <div style={{ fontSize:10, color:"#4b5563" }}>Paradas</div>
                  </div>
                  {statsError>0&&<><div style={{width:1,background:"rgba(255,255,255,0.07)"}}/>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:18,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#ef4444"}}>{statsError}</div>
                    <div style={{fontSize:10,color:"#4b5563"}}>Errores</div>
                  </div></>}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* -- ADDRESS EDIT MODAL (Google Places) -- */}
      {addrEditStop && (
        <AddressEditModal
          stop={addrEditStop}
          onSave={(placeResult, rawText) => handleModalSave(addrEditStop.id, placeResult, rawText)}
          onCancel={() => setAddrEditStop(null)}
        />
      )}
    </div>
  );
}

// --- DRIVER MOBILE VIEW -------------------------------------------------------
const DriverMobileView = ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center"}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{width:380,background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:20,padding:"24px",boxShadow:"0 40px 80px rgba(0,0,0,0.9)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Vista Mensajero</span>
        <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid #1e2d3d",background:"transparent",color:"#374151",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{textAlign:"center",padding:"32px 0",color:"#2d4a60"}}>
        <div style={{fontSize:40,marginBottom:12}}>📱</div>
        <div style={{fontSize:13,color:"#64748b"}}>Vista móvil del mensajero</div>
        <div style={{fontSize:11,marginTop:6,color:"#374151"}}>Inicia sesión como mensajero para ver esta vista</div>
      </div>
      <button onClick={onClose} style={{width:"100%",padding:"11px",borderRadius:10,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer"}}>Cerrar</button>
    </div>
  </div>
);

// --- ROOT ---------------------------------------------------------------------

export default function RapDrive() {
  // -- Phase 6: Auth --
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("rdSession");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Aceptar la sesión si está en USERS local, o si tiene id y email válidos
        // (mensajeros nuevos de Firebase pueden no estar en USERS aún al init)
        const valid = USERS.find(u => u.id === parsed.id && u.email === parsed.email);
        if (valid) return valid;
        // Si no está en USERS local pero la sesión tiene datos completos, aceptarla y agregar a USERS
        if (parsed?.id && parsed?.email && parsed?.role) {
          if (!USERS.find(x => x.id === parsed.id)) USERS.push(parsed);
          return parsed;
        }
      }
    } catch(e) {}
    return null;
  });
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // -- Mensajeros state (admin-managed) --
  const [mensajeros, setMensajeros] = useState(() => {
    // Usar lo que ya cargó el init global de Firebase, o DEFAULT
    const fromMem = _memStore.mens;
    return fromMem && fromMem.length > 0 ? fromMem : DEFAULT_MENSAJEROS;
  });

  // Sincronizar mensajeros desde Firebase al montar (por si llegaron después del init)
  useEffect(() => {
    FB.get("mens").then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setMensajeros(data);
        _memStore.mens = data;
        window.__rdMensajeros = data;
      }
    });
  }, []);

  // -- Datos persistentes entre navegaciones --
  const [drivers,      setDrivers]      = useState(DRIVERS);
  const [clients,      setClients]      = useState([]);
  const [globalRoutes, setGlobalRoutes] = useState({});

  // globalRoutes se sincroniza dentro del useEffect de notificaciones (un solo FB.listen)

  const handleUpdateRoute = (driverId, route) => {
    setGlobalRoutes(prev => ({ ...prev, [driverId]: route }));
    if (typeof window !== "undefined") { window.__rdRouteStore = window.__rdRouteStore || {}; window.__rdRouteStore[driverId] = route; LS.setRoute(driverId, route); }
  };

  const handleLogin  = (user) => setCurrentUser(user);
  const handleLogout = () => { setLogoutConfirm(false); try { sessionStorage.removeItem("rdSession"); } catch(e) {} setCurrentUser(null); };

  const [nav,setNav]=useState("dashboard");
  const [time,setTime]=useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return ()=>clearInterval(t);},[]);
  // Load SheetJS for Excel parsing
  useEffect(()=>{
    if(!window.XLSX){
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.head.appendChild(s);
    }
  },[]);

  // -- Phase 4 state --
  const [toasts,setToasts]       = useState([]);
  const [notifOpen,setNotifOpen] = useState(false);
  const [feedOpen,setFeedOpen]   = useState(false);
  const [modalOpen,setModalOpen] = useState(false);
  const [events,setEvents]       = useState(LIVE_EVENTS_SEED);
  const toastId = useRef(0);
  const lastRouteSnapRef = useRef({}); // track previous route states to detect changes
  const cleanupRef = useRef(null); // cleanup for async Firebase listener

  // Helper: push a real event + toast
  const pushEvent = useCallback((ev) => {
    setEvents(prev => [ev, ...prev].slice(0, 30));
    const tid = ++toastId.current;
    setToasts(ts => [...ts, { ...ev, toastId: tid }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.toastId !== tid)), 5500);
  }, []);

  // -- Firebase: UN SOLO listener para rutas (sincroniza globalRoutes + notificaciones) --------
  useEffect(() => {
    // Inicializar snapshot de una ruta sin disparar eventos
    const initSnapshot = (driverId, route) => {
      const stopsMap = {};
      (route.stops||[]).forEach(s => { stopsMap[s.id] = s.driverStatus; });
      lastRouteSnapRef.current[driverId] = {
        sentAt: route.sentAt,
        stops: stopsMap,
        routeCompletedNotified: (route.stops||[]).every(s => s.driverStatus === "delivered" || s.driverStatus === "problema"),
      };
    };

    // Procesar cambios de rutas y disparar notificaciones
    const processChanges = (data) => {
      if (!data || typeof data !== "object") return;
      _memStore.routes = data;
      window.__rdRouteStore = data;
      setGlobalRoutes(prev => ({ ...prev, ...data }));
      // Notificar a PageRoutes si está montado
      if (typeof window.__rdOnRoutesUpdated === "function") window.__rdOnRoutesUpdated(data);

      const now = new Date().toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
      Object.entries(data).forEach(([driverId, route]) => {
        if (!route?.stops) return;
        const snap = lastRouteSnapRef.current[driverId];

        // Sin snapshot todavía: inicializar sin notificar
        if (!snap) { initSnapshot(driverId, route); return; }

        // Ruta diferente: actualizar snapshot sin notificar
        if (snap.sentAt !== route.sentAt) { initSnapshot(driverId, route); return; }

        // Misma ruta: comparar stop por stop
        const driverLabel = route.driverName || driverId;
        let anyChange = false;
        route.stops.forEach(stop => {
          const prevStatus = snap.stops[stop.id];
          const newStatus  = stop.driverStatus;
          snap.stops[stop.id] = newStatus; // actualizar snapshot
          if (!prevStatus || prevStatus === newStatus) return;
          anyChange = true;
          const clientLabel = stop.client || `Parada #${stop.stopNum}`;
          const trackLabel  = stop.tracking ? ` · ${stop.tracking}` : "";
          if (newStatus === "delivered") {
            pushEvent({ id:"e"+Date.now()+stop.id, type:"delivered", icon:"✓", color:"#10b981",
              title:`Entregado: ${clientLabel}${trackLabel}`,
              body:`${driverLabel} · #${stop.stopNum} · ${stop.displayAddr||stop.rawAddr||""}`,
              time: now, read: false, isNew: true });
          } else if (newStatus === "problema") {
            pushEvent({ id:"e"+Date.now()+stop.id, type:"delayed", icon:"⚠", color:"#f59e0b",
              title:`Problema: ${clientLabel}${trackLabel}`,
              body:`${driverLabel} · ${stop.issue||"Sin detalles"} · #${stop.stopNum}`,
              time: now, read: false, isNew: true });
          } else if (newStatus === "en_ruta") {
            pushEvent({ id:"e"+Date.now()+stop.id, type:"on_route", icon:"→", color:"#3b82f6",
              title:`En camino: ${clientLabel}${trackLabel}`,
              body:`${driverLabel} → #${stop.stopNum} · ${stop.displayAddr||stop.rawAddr||""}`,
              time: now, read: false, isNew: true });
          }
        });
        // Ruta completada
        if (anyChange && !snap.routeCompletedNotified) {
          const allDone = route.stops.every(s => s.driverStatus === "delivered" || s.driverStatus === "problema");
          if (allDone) {
            snap.routeCompletedNotified = true;
            const del  = route.stops.filter(s => s.driverStatus === "delivered").length;
            const prob = route.stops.filter(s => s.driverStatus === "problema").length;
            pushEvent({ id:"e"+Date.now()+"done"+driverId, type:"delivered", icon:"🏁", color:"#10b981",
              title:`Ruta completada: ${driverLabel}`,
              body:`${del} entregados · ${prob} problemas · ${route.stops.length} paradas totales`,
              time: now, read: false, isNew: true });
          }
        }
      });
    };

    // 1) Carga inicial desde Firebase: inicializar snapshot sin disparar notificaciones
    FB.get("routes").then(data => {
      if (data && typeof data === "object") {
        _memStore.routes = data;
        window.__rdRouteStore = data;
        setGlobalRoutes(data);
        Object.entries(data).forEach(([driverId, route]) => {
          if (route?.stops) initSnapshot(driverId, route);
        });
      }
    });

    // 2) Listener SSE de rutas
    const unsubRoutes = FB.listen("routes", processChanges);

    // 3) Listener SSE de adminNotifs — mensajero escribe aquí cuando entrega/falla
    let lastNotifIds = new Set();
    const processAdminNotifs = (data) => {
      if (!data || typeof data !== "object") return;
      const now = new Date().toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
      Object.values(data).forEach(notif => {
        if (!notif || !notif.id || lastNotifIds.has(notif.id)) return;
        lastNotifIds.add(notif.id);
        // Solo procesar notificaciones recientes (últimos 60s)
        if (notif.createdAt && Date.now() - notif.createdAt > 60000) return;
        pushEvent({ ...notif, time: now, read: false, isNew: true });
      });
    };
    // Carga inicial de notifs para poblar lastNotifIds sin disparar eventos
    FB.get("adminNotifs").then(data => {
      if (data && typeof data === "object") {
        Object.keys(data).forEach(k => lastNotifIds.add(k));
      }
    });
    const unsubNotifs = FB.listen("adminNotifs", processAdminNotifs);

    // 4) Polling cada 5s como respaldo
    const poll = setInterval(() => FB.get("routes").then(d => { if(d) processChanges(d); }), 5000);

    return () => { unsubRoutes(); unsubNotifs(); clearInterval(poll); };
  }, [pushEvent]);

  const unreadCount = events.filter(e=>!e.read).length;
  const markAllRead = () => setEvents(ev=>ev.map(e=>({...e,read:true})));
  const handleCreated = (form) => {
    const newEv = {id:"e"+Date.now(),type:"new",icon:"＋",color:"#8b5cf6",title:"Nueva entrega creada",body:`${form.client} · ${form.address}`,time:"ahora",read:false,isNew:true};
    setEvents(ev=>[newEv,...ev].slice(0,30));
    const tid = ++toastId.current;
    setToasts(ts=>[...ts,{...newEv,toastId:tid}]);
    setTimeout(()=>setToasts(ts=>ts.filter(t=>t.toastId!==tid)),5000);
  };

  // -- Phase 5 state --
  const [searchOpen,    setSearchOpen]   = useState(false);

  // -- Phase 7 state --
  const [importOpen,    setImportOpen]   = useState(false);

  // -- Phase 8 state --
  const [addrEngineOpen, setAddrEngineOpen] = useState(false);
  const [detailDelivery,setDetailDelivery] = useState(null);
  const [driverMobile,  setDriverMobile]   = useState(false);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(()=>{
    const handler = (e) => {
      if ((e.metaKey||e.ctrlKey) && e.key==="k") { e.preventDefault(); setSearchOpen(o=>!o); }
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  },[]);

  // Expose detail opener globally for dashboard table clicks
  if(typeof window!=="undefined"){
    window.__rdOpenDetail  = (d) => setDetailDelivery(d);
    window.__rdOpenMobile  = ()  => setDriverMobile(true);
    window.__rdSetNav      = (p) => setNav(p);
    window.__rdMensajeros  = mensajeros;
    window.__rdLogout      = () => setLogoutConfirm(true);
    window.__rdSetRoute    = (driverId, route) => handleUpdateRoute(driverId, route);
    window.__rdPushEvent   = pushEvent;
  }

  const PAGE_TITLES={dashboard:"Dashboard",routes:"Rutas",import:"Motor de Rutas",settings:"Configuración"};
  if(typeof window!=="undefined") window.__rdOpenModal=()=>setModalOpen(true);

  const navItems=[
    {id:"dashboard",label:"Dashboard",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>},
    {id:"routes",   label:"Rutas",    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v6a4 4 0 0 0 4 4h6"/><path d="M19 5v8"/></svg>},
    {id:"import",   label:"Motor",    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>},
    {id:"settings", label:"Config",   icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>},
  ];

  // Show login when not authenticated
  if (!currentUser) return <LoginScreen onLogin={handleLogin}/>;

  const role = currentUser.role;
  const rc   = ROLE_CONFIG[role] || ROLE_CONFIG.driver;

  // -- Panel mensajero --
  if (role === "driver") {
    return (
      <DriverPanel
        driver={currentUser}
        mensajeros={mensajeros}
        onLogout={handleLogout}
        globalRoutes={globalRoutes}
        onUpdateRoute={handleUpdateRoute}
      />
    );
  }

  return (
    <div style={{display:"flex",position:"fixed",inset:0,background:"#060b10",fontFamily:"'Inter',sans-serif",overflow:"hidden",color:"#f1f5f9"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;scrollbar-width:thin;scrollbar-color:#131f30 transparent}
        *::-webkit-scrollbar{width:3px}*::-webkit-scrollbar-thumb{background:#131f30;border-radius:3px}
        html,body,#root{height:100%;width:100%;overflow:hidden;font-size:15px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.6)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        .nb:hover{background:#0d1420!important;color:#94a3b8!important}
        .fb:hover{border-color:#1e3550!important}
        .tr:hover{background:#0a1422!important;cursor:pointer}
        .ab:hover{background:#131f30!important;color:#94a3b8!important}
        .si:hover{background:#0a1422!important}
        input,select,textarea{font-size:14px!important}
        input::placeholder{color:#1e3550}
        td,th{font-size:13px}
      `}</style>

      {/* SIDEBAR */}
      <aside style={{width:88,background:"#060b10",borderRight:"1px solid #0d1420",display:"flex",flexDirection:"column",alignItems:"center",padding:"18px 0 14px",flexShrink:0}}>
        {/* Logo */}
        <div style={{marginBottom:28,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
          <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px #3b82f640"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/></svg>
          </div>
          <span style={{fontSize:9,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>RAP DRIVE</span>
        </div>

        {/* Nav items */}
        <div style={{display:"flex",flexDirection:"column",gap:4,width:"100%",padding:"0 10px"}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setNav(item.id)} style={{width:"100%",padding:"10px 0 9px",borderRadius:12,border:"none",cursor:"pointer",background:nav===item.id?"linear-gradient(135deg,#0d1f35,#0a1828)":"transparent",color:nav===item.id?"#60a5fa":"#374151",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,transition:"all .2s",position:"relative",boxShadow:nav===item.id?"0 2px 12px rgba(59,130,246,0.12)":"none"}}>
              {nav===item.id&&<div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:3,height:22,background:"#3b82f6",borderRadius:"0 3px 3px 0",boxShadow:"0 0 8px #3b82f6"}}/>}
              <div style={{color:nav===item.id?"#60a5fa":"#374151",transition:"color .2s"}}>{item.icon}</div>
              <span style={{fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.3px",color:nav===item.id?"#60a5fa":"#374151",lineHeight:1,transition:"color .2s"}}>{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{flex:1}}/>

        {/* User avatar */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"0 10px 4px",width:"100%"}}>
          <div style={{width:"100%",height:1,background:"#0d1420",marginBottom:8}}/>
          <div onClick={()=>setLogoutConfirm(true)} title={`${currentUser.name} · Cerrar sesión`}
            style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${rc.color}22,${rc.color}10)`,border:`1.5px solid ${rc.color}30`,display:"flex",alignItems:"center",justifyContent:"center",color:rc.color,fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,cursor:"pointer",transition:"all .15s"}}>
            {currentUser.avatar}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 5px #10b981"}}/>
            <span style={{fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:600}}>Online</span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        <header style={{height:52,borderBottom:"1px solid #0c1522",display:"flex",alignItems:"center",padding:"0 24px",justifyContent:"space-between",flexShrink:0,background:"#070c14",position:"relative"}}>
          {/* subtle bottom glow line */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent 0%,#1e3a5f22 30%,#3b82f618 50%,#1e3a5f22 70%,transparent 100%)"}}/>

          {/* LEFT — page title */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div>
              <div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",marginBottom:1}}>Rap Drive</div>
              <div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.5px",lineHeight:1}}>{PAGE_TITLES[nav]}</div>
            </div>
            <div style={{width:1,height:28,background:"#0d1a28",margin:"0 2px"}}/>
            <RoleBadge role={role}/>
          </div>

          {/* CENTER — date + live status */}
          <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"#2d4a60",fontFamily:"'Inter',sans-serif",fontWeight:500,whiteSpace:"nowrap",letterSpacing:"0.1px"}}>
              {time.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
            </span>
            <div style={{width:1,height:14,background:"#0d1a28"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b98199",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:12,color:"#64748b",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.5px",fontVariantNumeric:"tabular-nums"}}>
                {time.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
              </span>
            </div>
          </div>

          {/* RIGHT — utilities */}
          <div style={{display:"flex",alignItems:"center",gap:5}}>

            {/* Search */}
            <button onClick={()=>setSearchOpen(true)} className="fb" style={{display:"flex",alignItems:"center",gap:8,background:"transparent",border:"1px solid #0d1a28",borderRadius:8,padding:"6px 11px",cursor:"pointer",transition:"border-color .2s"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style={{fontSize:11,color:"#2d4a60",fontFamily:"'Inter',sans-serif",fontWeight:400}}>Buscar</span>
              <kbd style={{background:"#0a1322",border:"1px solid #1a2d40",borderRadius:5,padding:"1px 6px",fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.5px"}}>⌘K</kbd>
            </button>

            <div style={{width:1,height:18,background:"#0d1a28",margin:"0 1px"}}/>

            {/* Notifications */}
            <button onClick={()=>{setNotifOpen(o=>!o);setFeedOpen(false);}} style={{width:34,height:34,borderRadius:8,border:`1px solid ${notifOpen?"#1e3a5f":"#0d1a28"}`,background:notifOpen?"rgba(59,130,246,0.08)":"transparent",color:notifOpen?"#60a5fa":"#2d4a60",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all .2s"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:15,height:15,borderRadius:8,background:"linear-gradient(135deg,#dc2626,#ef4444)",border:"2px solid #070c14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"white",fontFamily:"'Syne',sans-serif",fontWeight:900,padding:"0 3px"}}>{unreadCount>9?"9+":unreadCount}</div>}
            </button>

            {/* Activity feed */}
            <button onClick={()=>{setFeedOpen(o=>!o);setNotifOpen(false);}} style={{width:34,height:34,borderRadius:8,border:`1px solid ${feedOpen?"#0d3322":"#0d1a28"}`,background:feedOpen?"rgba(16,185,129,0.07)":"transparent",color:feedOpen?"#10b981":"#2d4a60",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",position:"relative"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              {feedOpen&&<div style={{position:"absolute",top:6,right:6,width:5,height:5,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981",animation:"pulse 2s infinite"}}/>}
            </button>

          </div>
        </header>

        {/* PÁGINAS - siempre montadas, visibilidad por CSS para preservar estado */}
        <div style={{display:nav==="dashboard"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <PageDashboard/>
        </div>
        <div style={{display:nav==="routes"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <PageRoutes/>
        </div>

        <div style={{display:nav==="import"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <CircuitEngine/>
        </div>
        <div style={{display:nav==="settings"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <PageSettings mensajeros={mensajeros} setMensajeros={setMensajeros} currentUser={currentUser} role={role} rc={rc}/>
        </div>
      </main>

      {/* -- PHASE 4: OVERLAYS -- */}
      {notifOpen && <NotifPanel events={events} onMarkAll={markAllRead} onMarkEvent={(id)=>setEvents(ev=>ev.map(e=>e.id===id?{...e,read:true}:e))} onClose={()=>setNotifOpen(false)}/>}
      {feedOpen  && <ActivityFeed events={events} onClose={()=>setFeedOpen(false)}/>}
      {modalOpen && <ModalNewDelivery onClose={()=>setModalOpen(false)} onCreated={handleCreated}/>}



      {/* Toast stack */}
      <div style={{position:"fixed",top:64,right:12,display:"flex",flexDirection:"column",gap:8,zIndex:3000,pointerEvents:"none",alignItems:"flex-end"}}>
        {toasts.map(t=>(
          <div key={t.toastId} style={{pointerEvents:"auto"}}>
            <Toast notif={t} onDismiss={()=>setToasts(ts=>ts.filter(x=>x.toastId!==t.toastId))}/>
          </div>
        ))}
      </div>

      {/* -- PHASE 5 OVERLAYS -- */}
      {searchOpen && (
        <GlobalSearch
          onClose={()=>setSearchOpen(false)}
          onNavigate={(dest)=>{ if(dest==="modal"){setModalOpen(true);}else{setNav(dest);} }}
        />
      )}
      {detailDelivery && (
        <DeliveryDetail
          delivery={detailDelivery}
          onClose={()=>setDetailDelivery(null)}
        />
      )}
      {driverMobile && (
        <DriverMobileView onClose={()=>setDriverMobile(false)}/>
      )}

      {/* -- PHASE 8: ADDRESS ENGINE -- */}
      {addrEngineOpen && <AddressIntelligencePanel onClose={()=>setAddrEngineOpen(false)}/>}

      {/* -- PHASE 7: IMPORT -- */}
      {importOpen && (
        <ImportModal
          onClose={()=>setImportOpen(false)}
          onImported={(data)=>{
            const newEv={id:"e"+Date.now(),type:"new",icon:"📂",color:"#8b5cf6",title:"Ruta importada",body:`${data.stops.length} paradas · ${data.driverName} · ${data.routeName}`,time:"ahora",read:false,isNew:true};
            setEvents(ev=>[newEv,...ev].slice(0,20));
            const tid=++toastId.current;
            setToasts(ts=>[...ts,{...newEv,toastId:tid}]);
            setTimeout(()=>setToasts(ts=>ts.filter(t=>t.toastId!==tid)),5000);
          }}
        />
      )}

      {/* -- PHASE 6: LOGOUT CONFIRM -- */}
      {logoutConfirm && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",zIndex:9500,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)setLogoutConfirm(false);}}>
          <div style={{width:340,background:"linear-gradient(145deg,#0d1420,#080e16)",border:"1px solid #1e2d3d",borderRadius:20,padding:"28px 28px 22px",boxShadow:"0 40px 80px rgba(0,0,0,0.9)",animation:"popIn .2s cubic-bezier(.4,0,.2,1)"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,marginBottom:22}}>
              <div style={{width:52,height:52,borderRadius:16,background:`${rc.color}18`,border:`1px solid ${rc.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:rc.color,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{currentUser.avatar}</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>{currentUser.name}</div>
                <div style={{fontSize:11,color:"#4b5563",marginTop:3}}>{currentUser.email}</div>
                <div style={{marginTop:8}}><RoleBadge role={role}/></div>
              </div>
            </div>
            <div style={{fontSize:13,color:"#64748b",textAlign:"center",marginBottom:20}}>¿Cerrar sesión en Rap Drive?</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setLogoutConfirm(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #1e2d3d",background:"transparent",color:"#4b5563",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleLogout} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7f1d1d,#ef4444)",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.3)"}}>Cerrar sesión</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}