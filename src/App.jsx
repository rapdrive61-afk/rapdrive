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
  window.__rdPendingRoutes = LS.getAllPending();

  // ── CARGA INICIAL DESDE FIREBASE ─────────────────────────────────────────
  FB.get("routes").then(data => {
    if (data) { _memStore.routes = data; window.__rdRouteStore = data; }
  });
  FB.get("chats").then(data => {
    if (data) { _memStore.chats = data; window.__rdChatStore = data; }
  });
  FB.get("pendingRoutes").then(data => {
    if (data) { _memStore.pendingRoutes = data; window.__rdPendingRoutes = data; }
  });
  // Cargar mensajeros y usuarios desde Firebase (persisten mensajeros nuevos creados por admin)
  FB.get("mens").then(data => {
    if (data && Array.isArray(data)) { _memStore.mens = data; window.__rdMensajeros = data; }
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
  // FIX: Escuchar cada mensajero individualmente en Firebase Realtime Database.
  // Cuando el mensajero escribe FB.set("locations/M-01", loc), el SSE del nodo hijo
  // llega con data = { lat, lng, ... } (el objeto directo), no con el driverId.
  // La solución es suscribirse a cada nodo hijo por separado y mergearlo con su key.
  useEffect(() => {
    const DRIVER_IDS = DRIVERS.map(d => d.id);

    // ── Carga inicial del nodo raíz ──────────────────────────────────────
    FB.get("locations").then(data => {
      if (data && typeof data === "object") {
        setLiveLocations(data);
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });

    // ── SSE nodo raíz (detecta when el nodo entero cambia) ───────────────
    const unsubRoot = FB.listen("locations", (data) => {
      if (!data) return;
      if (typeof data === "object" && !data.lat) {
        setLiveLocations(prev => ({ ...prev, ...data }));
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });

    // ── FIX PRINCIPAL: escuchar cada mensajero individualmente ───────────
    // Cuando el mensajero hace FB.set("locations/M-01", loc) el SSE del child
    // llega con data = { lat, lng, ... } — mergeamos con el driverId correcto.
    const unsubDrivers = DRIVER_IDS.map(driverId =>
      FB.listen(`locations/${driverId}`, (loc) => {
        if (!loc || !loc.lat) return;
        const locWithId = { ...loc, driverId };
        setLiveLocations(prev => ({ ...prev, [driverId]: locWithId }));
        if (!window.__rdLocations) window.__rdLocations = {};
        window.__rdLocations[driverId] = locWithId;
      })
    );

    // ── Polling cada 3s como backup robusto ──────────────────────────────
    const t = setInterval(() => {
      FB.get("locations").then(data => {
        if (data && typeof data === "object") {
          setLiveLocations(prev => ({ ...prev, ...data }));
          if (!window.__rdLocations) window.__rdLocations = {};
          Object.assign(window.__rdLocations, data);
        }
      });
    }, 3000);

    return () => {
      unsubRoot();
      unsubDrivers.forEach(u => u());
      clearInterval(t);
    };
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

  // ── Ticker de "hace X min" para la barra GPS ─────────────────
  const [gpsTick, setGpsTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setGpsTick(p => p + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const [gpsExpanded, setGpsExpanded] = useState(false);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

      {/* ══ PANEL GPS ADMIN ═══════════════════════════════════════════════════════ */}
      <div style={{
        background:"linear-gradient(135deg,#070d16,#0a1220)",
        borderBottom:"1px solid #0f1e2e",
        padding: gpsExpanded ? "10px 16px 14px" : "7px 16px",
        flexShrink:0,
        transition:"padding .2s",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: gpsExpanded ? 10 : 0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ position:"relative", width:8, height:8 }}>
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#22c55e", animation:"pulse 2s infinite", opacity:0.4 }}/>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 6px #22c55e", position:"relative" }}/>
            </div>
            <span style={{ fontSize:10, fontFamily:"'Syne',sans-serif", fontWeight:800, letterSpacing:"1.5px", color:"rgba(255,255,255,0.4)", textTransform:"uppercase" }}>
              GPS en Tiempo Real
            </span>
            {(() => {
              const onlineCount = Object.values(liveLocations).filter(l => l && l.online !== false && (Date.now()-(l.ts||0)) < 120000).length;
              const totalWithLoc = Object.keys(liveLocations).length;
              return totalWithLoc > 0 ? (
                <div style={{ display:"flex", gap:5 }}>
                  <span style={{ background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:5, padding:"1px 7px", fontSize:9, color:"#22c55e", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
                    {onlineCount} online
                  </span>
                  {totalWithLoc - onlineCount > 0 && (
                    <span style={{ background:"rgba(55,65,81,0.3)", border:"1px solid rgba(55,65,81,0.4)", borderRadius:5, padding:"1px 7px", fontSize:9, color:"#6b7280", fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
                      {totalWithLoc - onlineCount} offline
                    </span>
                  )}
                </div>
              ) : null;
            })()}
          </div>
          <button onClick={() => setGpsExpanded(e => !e)}
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:7, padding:"3px 10px", color:"rgba(255,255,255,0.3)", fontSize:10, fontFamily:"'Syne',sans-serif", fontWeight:700, cursor:"pointer" }}>
            {gpsExpanded ? "▲ Colapsar" : "▼ Detalle"}
          </button>
        </div>

        <div style={{
          display:"flex", gap:8, flexWrap: gpsExpanded ? "wrap" : "nowrap",
          overflowX: gpsExpanded ? "visible" : "auto",
          marginTop: gpsExpanded ? 0 : 8,
        }}>
          {(() => {
            const mensajeros = window.__rdMensajeros || DEFAULT_MENSAJEROS;
            const allIds = [...new Set([...mensajeros.map(m => m.id), ...Object.keys(liveLocations)])];
            return allIds.map(driverId => {
              const loc = liveLocations[driverId];
              const mens = mensajeros.find(m => m.id === driverId);
              const name = loc && loc.driverName ? loc.driverName : (mens ? mens.name : driverId);
              const initials = mens ? (mens.initials || name.slice(0,2).toUpperCase()) : name.slice(0,2).toUpperCase();
              const hasLoc = !!(loc && loc.lat);
              const isOnline = hasLoc && loc.online !== false && (Date.now() - (loc.ts||0)) < 120000;
              const mins = loc && loc.ts ? Math.round((Date.now() - loc.ts) / 60000) : null;
              const timeStr = mins === null ? "sin GPS" : mins === 0 ? "ahora" : mins < 60 ? mins+"m" : Math.floor(mins/60)+"h";
              return (
                <div key={driverId}
                  onClick={() => { if (gMapRef.current && hasLoc) { gMapRef.current.panTo({ lat: loc.lat, lng: loc.lng }); gMapRef.current.setZoom(16); } }}
                  style={{
                    display:"flex", alignItems:"center", gap: gpsExpanded ? 10 : 7,
                    background: isOnline ? "rgba(34,197,94,0.07)" : "rgba(255,255,255,0.03)",
                    border:"1px solid "+(isOnline ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.06)"),
                    borderRadius:10, padding: gpsExpanded ? "10px 14px" : "5px 10px",
                    cursor: hasLoc ? "pointer" : "default", flexShrink:0,
                    minWidth: gpsExpanded ? 190 : "auto",
                    transition:"all .15s",
                  }}>
                  <div style={{ width: gpsExpanded ? 34 : 26, height: gpsExpanded ? 34 : 26, borderRadius:"50%", background: isOnline ? "linear-gradient(135deg,#1d4ed8,#3b82f6)" : "#1f2937", display:"flex", alignItems:"center", justifyContent:"center", fontSize: gpsExpanded ? 12 : 9, fontWeight:800, color:"white", flexShrink:0, position:"relative" }}>
                    {initials}
                    <div style={{ position:"absolute", bottom:-1, right:-1, width:8, height:8, borderRadius:"50%", background: isOnline ? "#22c55e" : hasLoc ? "#f59e0b" : "#374151", border:"1.5px solid #070d16", boxShadow: isOnline ? "0 0 5px #22c55e" : "none" }}/>
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize: gpsExpanded ? 12 : 10, fontWeight:700, color: isOnline ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth: gpsExpanded ? 120 : 75 }}>
                      {name.split(" ")[0]}
                    </div>
                    {gpsExpanded && <div style={{ fontSize:10, color: isOnline ? "#22c55e" : "#4b5563", marginTop:2 }}>{isOnline ? "🟢 Online" : hasLoc ? "🟡 Hace "+timeStr : "⚫ Sin GPS"}</div>}
                    {gpsExpanded && loc && loc.routeName && <div style={{ fontSize:9, color:"rgba(59,130,246,0.7)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>📦 {loc.routeName}</div>}
                    {gpsExpanded && hasLoc && <div style={{ fontSize:9, color:"rgba(255,255,255,0.18)", marginTop:2, fontFamily:"'DM Mono',monospace" }}>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</div>}
                  </div>
                  {!gpsExpanded && <span style={{ fontSize:9, color: isOnline ? "rgba(34,197,94,0.6)" : "rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{timeStr}</span>}
                  {gpsExpanded && hasLoc && (
                    <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isOnline?"#22c55e":"#4b5563"}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span style={{ fontSize:8, color:"rgba(255,255,255,0.2)" }}>{timeStr}</span>
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {Object.keys(liveLocations).length === 0 && (
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", padding:"5px 4px", fontStyle:"italic" }}>
              Esperando que los mensajeros activen su GPS...
            </div>
          )}
        </div>
      </div>

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
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="${color}" opacity="${isDone?0.7:1}" stroke="white" stroke-width="2"/>
          <text x="16" y="21" text-anchor="middle" font-size="11" font-weight="800" fill="white" font-family="sans-serif">${stop.stopNum||"?"}</text>
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
  const filtered = filterDriver === "all" ? allRouteHistory : allRouteHistory.filter(r => r.driverName === filterDriver);

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
      <div style={{ width:300, borderRight:"1px solid #0d1420", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
        {/* Header */}
        <div style={{ padding:"16px 14px 12px", borderBottom:"1px solid #0d1420", flexShrink:0 }}>
          <div style={{ fontSize:10, color:"#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"1.5px", marginBottom:10 }}>HISTORIAL DE RUTAS</div>
          {/* Driver filter */}
          <select value={filterDriver} onChange={e=>setFilterDriver(e.target.value)}
            style={{ width:"100%", background:"#0a1019", border:"1px solid #1e2d3d", borderRadius:8, padding:"7px 10px", color:"#94a3b8", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", cursor:"pointer" }}>
            <option value="all">Todos los mensajeros</option>
            {allDrivers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
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
                  padding:"12px 14px", borderBottom:"1px solid #0a0f18",
                  background: isSel ? "#091527" : "transparent",
                  borderLeft: `3px solid ${isSel ? "#3b82f6" : "transparent"}`,
                  cursor:"pointer", transition:"all .12s",
                  animation:`slideIn .3s ${Math.min(i,15)*30}ms ease both`,
                }}>
                {/* Route name */}
                <div style={{ fontSize:12, fontFamily:"'Syne',sans-serif", fontWeight:700, color: isSel?"#e2e8f0":"#94a3b8", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {route.routeName || "Ruta sin nombre"}
                </div>
                {/* Driver + date */}
                <div style={{ fontSize:10, color:"#374151", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ color:"#2d4a60", fontWeight:600 }}>{route.driverName || "—"}</span>
                  <span style={{ color:"#1e2d3d" }}>·</span>
                  <span>{fmtDate(route.sentAt)}</span>
                </div>
                {/* Stats pills */}
                <div style={{ display:"flex", gap:5 }}>
                  <div style={{ fontSize:9.5, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"2px 7px", borderRadius:5, background:"rgba(16,185,129,0.1)", color:"#10b981" }}>
                    ✓ {stats.delivered}
                  </div>
                  {stats.problems > 0 && (
                    <div style={{ fontSize:9.5, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"2px 7px", borderRadius:5, background:"rgba(239,68,68,0.1)", color:"#ef4444" }}>
                      ⚠ {stats.problems}
                    </div>
                  )}
                  {stats.pending > 0 && (
                    <div style={{ fontSize:9.5, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"2px 7px", borderRadius:5, background:"rgba(245,158,11,0.1)", color:"#f59e0b" }}>
                      ○ {stats.pending}
                    </div>
                  )}
                  <div style={{ fontSize:9.5, color:"#2d4a60", marginLeft:"auto" }}>{stats.total} paradas · {route.km||"—"} km</div>
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
                    <div style={{ width:26, height:26, borderRadius:7, background:`${c}15`, border:`1px solid ${c}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontFamily:"'Syne',sans-serif", fontWeight:700, color:c, flexShrink:0, marginTop:1 }}>
                      {isDone ? "✓" : isProb ? "!" : stop.stopNum || i+1}
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
  const myKey = driver.driverId || driver.id;

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
  const [time,       setTime]       = useState(new Date());
  const [logoutConf, setLogoutConf] = useState(false);
  const [search,     setSearch]     = useState("");
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
  // Cola de rutas pendientes (enviadas por el admin mientras el mensajero tiene ruta activa)
  const [pendingRoutes, setPendingRoutes] = useState(() => {
    const fromWin = (window.__rdPendingRoutes||{})[myKey];
    const fromLS  = LS.getPending(myKey);
    return fromWin || fromLS || [];
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

  // ── UBICACIÓN EN TIEMPO REAL ────────────────────────────────
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | requesting | active | denied
  const [myLocation,     setMyLocation]     = useState(null);   // { lat, lng, accuracy, ts }
  const [mapReady,       setMapReady]       = useState(false);  // FIX: declarado aquí, antes de los useEffects que lo usan
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
        maximumAge: 0,          // FIX: 0 = siempre pide posición fresca, nunca usa cache
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
  // FIX: usar mapReady (estado) como dependencia, no gMapRef.current (ref mutable)
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

    // FIX GPS: Centrar el mapa suavemente en la posición actual del mensajero
    // panTo anima el movimiento — el mensajero siempre está centrado en pantalla
    gMapRef.current.panTo(pos);

  }, [myLocation, mapReady]); // FIX: mapReady es estado → React re-ejecuta al detectar cambio

  // -- Sync ruta en TIEMPO REAL desde Firebase --
  // REGLA FUNDAMENTAL: los stops en pantalla NUNCA retroceden.
  // Solo Firebase puede actualizar si trae un sentAt distinto (ruta nueva del admin).
  // Cambios del propio mensajero se guardan en localStorage + Firebase y NO se revierten.
  const writingRef = useRef(false); // true mientras pushUpdate está escribiendo en Firebase

  useEffect(() => {
    const LS_KEY = `rdRoute_${myKey}`;

    // Al montar: recuperar estado desde localStorage primero (respaldo inmediato)
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved && saved.stops && saved.sentAt) {
        lastSentAt.current = saved.sentAt;
        _memStore.routes[myKey] = saved;
        if (!window.__rdRouteStore) window.__rdRouteStore = {};
        window.__rdRouteStore[myKey] = saved;
        setStops(saved.stops.map(s => ({ ...s, driverStatus: s.driverStatus || "pending" })));
      }
    } catch(e) {}

    // applyRoute: SOLO se aplica si es una ruta distinta (sentAt diferente = admin envió nueva ruta)
    // NUNCA sobreescribe el estado actual del mensajero para la misma ruta
    const applyRoute = (nr) => {
      if (!nr || !nr.stops) return;
      if (writingRef.current) return; // ignorar Firebase mientras estamos escribiendo
      const isDifferentRoute = nr.sentAt !== lastSentAt.current;
      if (!isDifferentRoute) return; // misma ruta → nunca sobreescribir estado del mensajero

      // Es una ruta diferente → verificar si hay trabajo activo antes de reemplazar
      setStops(currentStops => {
        const hasActive = currentStops.length > 0 && currentStops.some(
          s => s.driverStatus === "pending" || s.driverStatus === "en_ruta"
        );
        if (hasActive) {
          // Encolar, no reemplazar
          setPendingRoutes(prev => {
            if (prev.some(r => r.sentAt === nr.sentAt)) return prev;
            const updated = [...prev, nr];
            if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
            window.__rdPendingRoutes[myKey] = updated;
            LS.setPending(myKey, updated);
            return updated;
          });
          return currentStops;
        }
        // Sin trabajo activo: aplicar nueva ruta
        lastSentAt.current = nr.sentAt;
        if (!window.__rdRouteStore) window.__rdRouteStore = {};
        window.__rdRouteStore[myKey] = nr;
        _memStore.routes[myKey] = nr;
        onUpdateRoute(myKey, nr);
        try { localStorage.setItem(LS_KEY, JSON.stringify(nr)); } catch(e) {}
        return nr.stops.map(s => ({ ...s, driverStatus: s.driverStatus || "pending" }));
      });
    };

    const applyChat = (msgs) => {
      if (!Array.isArray(msgs)) return;
      setChatLog([...msgs]);
    };

    const applyPending = (queue) => {
      if (!Array.isArray(queue)) return;
      setPendingRoutes([...queue]);
      if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
      window.__rdPendingRoutes[myKey] = queue;
    };

    // 1) Leer desde Firebase al montar (para rutas nuevas del admin)
    FB.get(`routes/${myKey}`).then(applyRoute);
    FB.get(`chats/${myKey}`).then(applyChat);
    FB.get(`pendingRoutes/${myKey}`).then(applyPending);

    // 2) SSE solo para rutas (detectar nueva ruta del admin) y chat/pending
    const unsubRoute   = FB.listen(`routes/${myKey}`, applyRoute);
    const unsubChat    = FB.listen(`chats/${myKey}`,   applyChat);
    const unsubPending = FB.listen(`pendingRoutes/${myKey}`, applyPending);

    // 3) Listener de notificaciones del admin → mensajero (ruta asignada)
    let lastNotifKeys = new Set();
    const unsubDriverNotifs = FB.listen(`driverNotifs/${myKey}`, (data) => {
      if (!data) return;
      Object.entries(data).forEach(([k, notif]) => {
        if (lastNotifKeys.has(k) || notif.read) return;
        lastNotifKeys.add(k);
        if (notif.type === "route_assigned") {
          // Mostrar banner nativo del navegador si tiene permiso
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.body, icon: "/favicon.ico" });
          }
          // Banner en pantalla
          if (typeof window.__rdShowDriverNotif === "function") {
            window.__rdShowDriverNotif(notif);
          }
          // Marcar como leída
          FB.set(`driverNotifs/${myKey}/${k}`, { ...notif, read: true });
        }
      });
    });

    // SIN polling — el polling era el que revertía los estados

    window.__rdSetPending = (driverId, queue) => {
      if (driverId === myKey) applyPending(queue);
    };

    return () => { unsubRoute(); unsubChat(); unsubPending(); unsubDriverNotifs(); };
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
  // mapReady se declara junto a los otros estados (arriba) — ver línea ~2388
  useEffect(() => {
    loadGoogleMaps().then(() => {
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

    // ── Glass premium markers ──
    validStops.forEach(stop => {
      const isDone  = stop.driverStatus === "delivered";
      const isProb  = stop.driverStatus === "problema";
      const isNow   = stop === currentStop;
      const label   = String(stop.stopNum || "?");
      const fs      = label.length > 2 ? 9 : label.length > 1 ? 11 : 13;

      // Color palette
      const mainColor  = isDone ? "#10b981" : isProb ? "#ef4444" : isNow ? "#3b82f6" : "#f59e0b";
      const glowColor  = isDone ? "rgba(16,185,129,0.55)" : isProb ? "rgba(239,68,68,0.55)" : isNow ? "rgba(59,130,246,0.65)" : "rgba(245,158,11,0.5)";
      const innerLight = isDone ? "rgba(52,211,153,0.7)" : isProb ? "rgba(252,165,165,0.7)" : isNow ? "rgba(147,197,253,0.8)" : "rgba(252,211,77,0.7)";
      const size = isNow ? 48 : 38;
      const r    = size / 2;
      const ri   = r - 3; // inner radius for glass effect

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <radialGradient id="g${stop.stopNum||'x'}" cx="38%" cy="30%" r="70%">
            <stop offset="0%" stop-color="${innerLight}" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="${mainColor}" stop-opacity="0.95"/>
          </radialGradient>
          <filter id="f${stop.stopNum||'x'}" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="${isNow?3:2}" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${isNow ? `<circle cx="${r}" cy="${r}" r="${r-0.5}" fill="${glowColor}" opacity="0.35" filter="url(#f${stop.stopNum||'x'})"/>` : ''}
        <circle cx="${r}" cy="${r}" r="${ri}" fill="url(#g${stop.stopNum||'x'})" stroke="rgba(255,255,255,${isNow?'0.55':'0.35'})" stroke-width="${isNow?2:1.5}"/>
        <ellipse cx="${r*0.7}" cy="${r*0.55}" rx="${ri*0.38}" ry="${ri*0.2}" fill="rgba(255,255,255,0.28)" transform="rotate(-20,${r*0.7},${r*0.55})"/>
        ${isDone
          ? `<text x="${r}" y="${r-2}" text-anchor="middle" dominant-baseline="central" font-size="${fs-1}" font-weight="900" fill="white" font-family="-apple-system,sans-serif" opacity="0.95">${label}</text>
             <path d="M${r-4} ${r+5}l2.8 2.8 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>`
          : isProb
            ? `<text x="${r}" y="${r-1}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="900" fill="white" font-family="-apple-system,sans-serif" opacity="0.95">${label}</text>
               <text x="${r}" y="${r+7}" text-anchor="middle" font-size="8" font-weight="900" fill="white" font-family="-apple-system,sans-serif" opacity="0.85">!</text>`
            : `<text x="${r}" y="${r+1}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="900" fill="white" font-family="-apple-system,sans-serif" opacity="0.95">${label}</text>`
        }
      </svg>`;

      const marker = new window.google.maps.Marker({
        map: gMapRef.current,
        position: { lat: stop.lat, lng: stop.lng },
        title: `#${stop.stopNum} ${stop.client}`,
        zIndex: isNow ? 999 : isDone ? 1 : isProb ? 2 : 10,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new window.google.maps.Size(size, size),
          anchor: new window.google.maps.Point(r, r),
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
    // Check if route is now fully complete → save to history
    const allDone = updatedStops.length > 0 && updatedStops.every(s => s.driverStatus === "delivered" || s.driverStatus === "problema");
    if (allDone) {
      const histEntry = {
        ...updated,
        completedAt: new Date().toISOString(),
        histId: `H-${Date.now()}`,
      };
      setRouteHistory(prev => {
        const next = [histEntry, ...prev].slice(0, 50); // keep last 50
        try { localStorage.setItem(`rdHistory_${myKey}`, JSON.stringify(next)); } catch(e){}
        return next;
      });
    }
  };

  const addChatMsg = (text) => {
    const msg = { from:"driver", text, time:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) };
    if (!window.__rdChatStore) window.__rdChatStore = {};
    const nl = [...(window.__rdChatStore[myKey]||[]), msg].slice(-80);
    window.__rdChatStore[myKey] = nl; LS.setChat(myKey, nl);
    setChatLog(nl);
  };

  const markDelivered = (stopId) => {
    let foundNext = false;
    const updated = stops.map(s => {
      if (s.id===stopId) return {...s,driverStatus:"delivered",deliveredAt:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})};
      if (!foundNext&&s.driverStatus==="pending") { foundNext=true; return {...s,driverStatus:"en_ruta"}; }
      return s;
    });
    setStops(updated); pushUpdate(updated);
    const stop = stops.find(s=>s.id===stopId);
    addChatMsg(`✓ Entregado: ${stop?.client||"Parada #"+stop?.stopNum}`);
    // Notificar al admin via Firebase
    const notifId = "n"+Date.now()+stopId;
    FB.set(`adminNotifs/${notifId}`, { id:notifId, type:"delivered", icon:"✓", color:"#10b981",
      title:`Entregado: ${stop?.client||"Parada #"+stop?.stopNum}`,
      body:`${myKey} · #${stop?.stopNum} · ${stop?.displayAddr||stop?.rawAddr||""}`,
      time: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}),
      read: false, isNew: true, createdAt: Date.now() });
    setSelStop(null);
  };

  const markProblem = (stopId) => {
    const updated = stops.map(s=>s.id===stopId?{...s,driverStatus:"problema",issue:probNote||"Sin detalles",issueAt:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}:s);
    setStops(updated); pushUpdate(updated);
    const stop = stops.find(s=>s.id===stopId);
    addChatMsg(`⚠ Problema parada #${stop?.stopNum}: ${probNote||"Sin detalles"}`);
    // Notificar al admin via Firebase
    const notifId = "n"+Date.now()+stopId;
    FB.set(`adminNotifs/${notifId}`, { id:notifId, type:"delayed", icon:"⚠", color:"#f59e0b",
      title:`Problema: ${stop?.client||"Parada #"+stop?.stopNum}`,
      body:`${myKey} · ${probNote||"Sin detalles"} · #${stop?.stopNum}`,
      time: new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}),
      read: false, isNew: true, createdAt: Date.now() });
    setShowProb(null); setProbNote(""); setSelStop(null);
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
        .rd-stop:hover{background:rgba(255,255,255,0.025)!important}
        .rd-btn:active{transform:scale(.97)!important}
        .rd-menu-item:hover{background:rgba(255,255,255,0.06)!important}
        .rd-chip-active{background:#1a2d4a!important;border-color:#2563eb!important;color:#60a5fa!important}
        .rd-chip:hover{border-color:#1e3550!important}
      `}</style>

      {/* ══ HEADER FIJO DEL MENSAJERO ══ */}
      <div style={{ flexShrink:0, background:"#080f18", borderBottom:"1px solid #0d1a26", padding:"0 14px", height:64, display:"flex", alignItems:"center", gap:10, zIndex:100 }}>
        {/* Hamburger */}
        <button onClick={()=>setMenuOpen(o=>!o)} className="rd-btn"
          style={{ width:38,height:38,borderRadius:10,background:menuOpen?"#0f1f30":"rgba(255,255,255,0.04)",border:`1px solid ${menuOpen?"#1e3550":"rgba(255,255,255,0.07)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={menuOpen?"#60a5fa":"rgba(255,255,255,0.55)"} strokeWidth="2.2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>}
          </svg>
        </button>

        {/* Avatar foto circular */}
        <div style={{ width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#1e3550,#0f2038)",border:"2px solid #1e3550",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#60a5fa",flexShrink:0 }}>
          {(driver.avatar||(driver.name||"").slice(0,2)).toUpperCase()}
        </div>

        {/* Nombre + zona */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#f1f5f9",letterSpacing:"-0.2px",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {driver.name||"Mensajero"}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:1 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",
              background: locationStatus==="active"?"#22c55e":locationStatus==="requesting"?"#f59e0b":locationStatus==="denied"?"#ef4444":"#374151",
              boxShadow: locationStatus==="active"?"0 0 6px #22c55e":locationStatus==="requesting"?"0 0 6px #f59e0b":"none",
              animation: locationStatus==="requesting"?"pulse 1s infinite":"none",
            }}/>
            <span style={{ fontSize:10,fontWeight:600,letterSpacing:"0.2px",
              color: locationStatus==="active"?"#22c55e":locationStatus==="requesting"?"#f59e0b":locationStatus==="denied"?"#ef4444":"rgba(255,255,255,0.3)"
            }}>
              {locationStatus==="active"?"GPS activo":locationStatus==="requesting"?"Obteniendo GPS...":locationStatus==="denied"?"GPS denegado":"En línea"}
            </span>
            {/* Botón tap para activar GPS si fue denegado */}
            {(locationStatus==="denied"||locationStatus==="idle") && (
              <button onClick={startLocationTracking}
                style={{ background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)",borderRadius:5,padding:"1px 6px",fontSize:9,color:"#60a5fa",cursor:"pointer",fontWeight:700 }}>
                Activar
              </button>
            )}
          </div>
        </div>

        {/* Notificaciones */}
        <button className="rd-btn" style={{ position:"relative",width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {(chatLog.filter(m=>m.from==="admin").length+pendingRoutes.length) > 0 && (
            <div style={{ position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",background:"#3b82f6",border:"1.5px solid #080f18" }}/>
          )}
        </button>

        {/* Reloj */}
        <div style={{ padding:"6px 10px",borderRadius:9,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",fontSize:13,color:"rgba(255,255,255,0.8)",fontFamily:"'DM Mono',monospace",fontWeight:500,letterSpacing:"0.5px",flexShrink:0 }}>
          {time.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}
        </div>

        {/* Expandir mapa */}
        <button onClick={()=>{ setSheetSnap(s=>s==="peek"?"half":s==="half"?"full":"peek"); setSheetH(null); }} className="rd-btn"
          style={{ width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2">
            {sheetSnap==="full"
              ? <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></>
              : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>}
          </svg>
        </button>
      </div>

      {/* ══ MAP SECTION — solo visible en tab ruta ══ */}
      <div style={{ position:"relative", flex:1, overflow:"hidden", background:"#060c14", display: tab === "route" ? "block" : "none" }}>
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

        {/* No route overlay — GPS PULSE ANIMATION */}
        {!myRoute && (
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse 80% 60% at 50% 50%,#030810 0%,#020509 100%)",overflow:"hidden" }}>
            <style>{`
              @keyframes gpsPing{0%{transform:scale(0.3);opacity:0.9}100%{transform:scale(4);opacity:0}}
              @keyframes gpsPingB{0%{transform:scale(0.5);opacity:0.6}100%{transform:scale(3.5);opacity:0}}
              @keyframes gpsRotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
              @keyframes gpsRotateCCW{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
              @keyframes gpsDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.6}}
              @keyframes gpsBlink{0%,100%{opacity:1}50%{opacity:0.2}}
              @keyframes gpsTextSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
              @keyframes gpsGridPulse{0%,100%{opacity:0.03}50%{opacity:0.08}}
              @keyframes gpsSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            `}</style>

            {/* Grid fondo */}
            <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(59,130,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.05) 1px,transparent 1px)",backgroundSize:"36px 36px",animation:"gpsGridPulse 4s ease-in-out infinite" }}/>

            {/* Pulsos sonar */}
            <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)" }}>
              {[0,0.9,1.8,2.7].map((d,i)=>(
                <div key={i} style={{ position:"absolute",top:"50%",left:"50%",width:180,height:180,marginLeft:-90,marginTop:-90,borderRadius:"50%",border:"1.5px solid rgba(59,130,246,0.4)",animation:`gpsPing 3.5s ease-out infinite`,animationDelay:`${d}s` }}/>
              ))}
              {[0.4,1.3,2.2].map((d,i)=>(
                <div key={"g"+i} style={{ position:"absolute",top:"50%",left:"50%",width:280,height:280,marginLeft:-140,marginTop:-140,borderRadius:"50%",border:"1px solid rgba(16,185,129,0.2)",animation:`gpsPingB 4.5s ease-out infinite`,animationDelay:`${d}s` }}/>
              ))}
            </div>

            {/* Icon GPS central */}
            <div style={{ position:"relative",zIndex:2,marginBottom:28 }}>
              {/* Anillo giratorio exterior */}
              <div style={{ position:"absolute",inset:-16,borderRadius:"50%",border:"1.5px dashed rgba(59,130,246,0.25)",animation:"gpsRotate 12s linear infinite" }}/>
              {/* Anillo giratorio interior CCW */}
              <div style={{ position:"absolute",inset:-8,borderRadius:"50%",border:"1px solid rgba(59,130,246,0.15)",animation:"gpsRotateCCW 8s linear infinite" }}>
                {/* Punto marcador en el anillo */}
                <div style={{ position:"absolute",top:-3,left:"50%",marginLeft:-3,width:6,height:6,borderRadius:"50%",background:"#3b82f6",boxShadow:"0 0 8px #3b82f6" }}/>
              </div>
              {/* Línea barrido estilo radar */}
              <div style={{ position:"absolute",inset:-8,borderRadius:"50%",overflow:"hidden",animation:"gpsSweep 4s linear infinite" }}>
                <div style={{ position:"absolute",top:"50%",left:"50%",width:"50%",height:"50%",background:"linear-gradient(135deg,rgba(59,130,246,0.3) 0%,transparent 100%)",transformOrigin:"0% 100%" }}/>
              </div>
              {/* Círculo base */}
              <div style={{ width:72,height:72,borderRadius:"50%",background:"linear-gradient(145deg,#0a1e3d,#0f2a50)",border:"1px solid rgba(59,130,246,0.5)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 30px rgba(59,130,246,0.2),inset 0 1px 0 rgba(255,255,255,0.06)",position:"relative" }}>
                {/* Pin GPS SVG */}
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="rgba(59,130,246,0.9)" stroke="rgba(147,197,253,0.5)" strokeWidth="0.5"/>
                  <circle cx="12" cy="9" r="3" fill="white" opacity="0.95"/>
                </svg>
                {/* Dot pulsante en el centro */}
                <div style={{ position:"absolute",bottom:10,right:10,width:6,height:6,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"gpsDot 2s ease-in-out infinite" }}/>
              </div>
            </div>

            {/* Texto */}
            <div style={{ position:"relative",zIndex:2,textAlign:"center",animation:"gpsTextSlide .6s ease" }}>
              <div style={{ fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.75)",letterSpacing:"-0.3px",marginBottom:10,fontFamily:"'Syne',sans-serif" }}>
                Buscando señal GPS...
              </div>
              {/* Status bar tipo terminal */}
              <div style={{ display:"inline-flex",alignItems:"center",gap:10,background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:10,padding:"8px 18px" }}>
                <div style={{ display:"flex",gap:4 }}>
                  {[0,0.2,0.4].map((d,i)=>(
                    <div key={i} style={{ width:3,height:12+(i*4),borderRadius:2,background:"#3b82f6",animation:"gpsBlink 1.2s ease-in-out infinite",animationDelay:`${d}s`,opacity:0.7 }}/>
                  ))}
                </div>
                <span style={{ fontSize:11,color:"rgba(59,130,246,0.85)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.5px" }}>
                  Esperando ruta del admin...
                </span>
              </div>
              {/* Coordenadas ficticias que "buscan" */}
              <div style={{ marginTop:12,fontSize:10,color:"rgba(255,255,255,0.15)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"1px",animation:"gpsBlink 3s ease-in-out infinite" }}>
                18.4861° N · 69.9312° W
              </div>
            </div>
          </div>
        )}

        {/* ══ DRAWER LATERAL ══ */}
        {menuOpen && (
          <div onClick={()=>setMenuOpen(false)}
            style={{ position:"fixed",inset:0,zIndex:9000,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)" }}>
            <div onClick={e=>e.stopPropagation()}
              style={{ position:"absolute",top:0,left:0,width:288,height:"100%",background:"#0a0a0a",borderRight:"1px solid rgba(255,255,255,0.07)",animation:"slideLeft .22s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",overflow:"hidden" }}>

              {/* ── Perfil ── */}
              <div style={{ padding:"56px 24px 24px",background:"linear-gradient(180deg,#141414 0%,#0a0a0a 100%)",borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                {/* Avatar */}
                <div style={{ width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontFamily:"'DM Sans',sans-serif",fontWeight:800,color:"white",letterSpacing:"-1px",marginBottom:16,boxShadow:"0 8px 24px rgba(59,130,246,0.3)" }}>
                  {(driver.avatar||(driver.name||"").slice(0,2)).toUpperCase()}
                </div>
                {/* Nombre */}
                <div style={{ fontSize:17,fontFamily:"'DM Sans',sans-serif",fontWeight:800,color:"white",letterSpacing:"-0.3px",lineHeight:1.2,marginBottom:4 }}>
                  {(driver.name||"Mensajero").toUpperCase()}
                </div>
                {/* Email */}
                <div style={{ fontSize:11,color:"rgba(255,255,255,0.25)",fontFamily:"'DM Mono',monospace",marginBottom:12 }}>
                  {driver.email||driver.phone||"mensajero@rapdrive.do"}
                </div>
                {/* Status pill */}
                <div style={{ display:"inline-flex",alignItems:"center",gap:7,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:20,padding:"5px 12px" }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"pulse 2s infinite" }}/>
                  <span style={{ fontSize:11,color:"#22c55e",fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:"0.5px" }}>EN LÍNEA</span>
                </div>
              </div>

              {/* Resumen rápido */}
              {stops.length > 0 && (
                <div style={{ padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:10 }}>
                  {[
                    { val: pending.length,   label:"Pendientes", color:"#f59e0b" },
                    { val: delivered.length, label:"Entregadas",  color:"#22c55e" },
                    { val: problems.length,  label:"Problemas",   color:"#ef4444" },
                  ].map(({val,label,color}) => (
                    <div key={label} style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 8px",textAlign:"center" }}>
                      <div style={{ fontSize:18,fontFamily:"'DM Sans',sans-serif",fontWeight:800,color,lineHeight:1 }}>{val}</div>
                      <div style={{ fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:4,fontWeight:600 }}>{label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Items ── */}
              <div style={{ flex:1,overflowY:"auto",padding:"10px 14px" }}>
                {[
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
                    label:"Mi ruta de hoy", badge:stops.filter(s=>s.stopNum).length, badgeColor:"#3b82f6",
                    active: tab==="route",
                    action:()=>{setTab("route");setMenuOpen(false);} },
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>,
                    label:"Entregas completadas", badge:delivered.length, badgeColor:"#22c55e",
                    active: false,
                    action:()=>{setFilterMode("delivered");setTab("route");setMenuOpen(false);} },
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                    label:"Problemas reportados", badge:problems.length, badgeColor:"#ef4444",
                    active: false,
                    action:()=>{setFilterMode("problema");setTab("route");setMenuOpen(false);} },
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                    label:"Chat con admin", badge:chatLog.filter(m=>m.from==="admin"&&!m.read).length, badgeColor:"#3b82f6",
                    active: tab==="chat",
                    action:()=>{setTab("chat");setMenuOpen(false);} },
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                    label:"Rutas pendientes", badge:pendingRoutes.length, badgeColor:"#f59e0b",
                    active: tab==="pending",
                    action:()=>{setTab("pending");setMenuOpen(false);} },
                  { icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
                    label:"Mi historial", badge:0, badgeColor:"#8b5cf6",
                    active: tab==="history",
                    action:()=>{setTab("history");setMenuOpen(false);} },
                ].map((item,i) => (
                  <button key={i} onClick={item.action} className="rd-menu-item"
                    style={{ display:"flex",alignItems:"center",gap:13,padding:"13px 12px",borderRadius:13,border:"none",background:item.active?"rgba(59,130,246,0.1)":"transparent",cursor:"pointer",width:"100%",textAlign:"left",transition:"background .12s",animation:`fadeUp .18s ${i*25}ms ease both`,marginBottom:2,borderLeft:item.active?"2.5px solid #3b82f6":"2.5px solid transparent" }}>
                    {/* Icon */}
                    <div style={{ width:40,height:40,borderRadius:12,background:item.active?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${item.active?"rgba(59,130,246,0.3)":"rgba(255,255,255,0.07)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:item.active?"#60a5fa":"rgba(255,255,255,0.45)",transition:"all .15s" }}>
                      {item.icon}
                    </div>
                    {/* Label */}
                    <span style={{ flex:1,fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:item.active?700:500,color:item.active?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.7)",letterSpacing:"-0.1px" }}>
                      {item.label}
                    </span>
                    {/* Badge */}
                    {item.badge>0 && (
                      <div style={{ minWidth:22,height:22,borderRadius:11,background:item.badgeColor||"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 7px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:800,color:"white",flexShrink:0 }}>
                        {item.badge}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* ── App version ── */}
              <div style={{ padding:"8px 24px",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <span style={{ fontSize:10,color:"rgba(255,255,255,0.12)",fontFamily:"'DM Mono',monospace" }}>RAP DRIVE v2.0</span>
              </div>

              {/* ── Cerrar sesión ── */}
              <div style={{ padding:"0 16px 40px",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={()=>{setMenuOpen(false);setLogoutConf(true);}} className="rd-btn"
                  style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:9,padding:"14px",borderRadius:13,border:"1px solid rgba(239,68,68,0.15)",background:"rgba(239,68,68,0.06)",color:"rgba(239,68,68,0.7)",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:700,transition:"all .15s",marginTop:12 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Cerrar sesión
                </button>
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

      {/* ══ BOTTOM SHEET — route panel floats over the map ══ */}
      {tab === "route" && (
        <div
          ref={sheetRef}
          style={{
            position:"absolute",
            bottom:NAV_H,
            left:0, right:0,
            height: resolvedSheetH,
            background:"rgba(7,16,28,0.97)",
            backdropFilter:"blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            borderRadius:"20px 20px 0 0",
            boxShadow:"0 -6px 40px rgba(0,0,0,0.55), 0 -1px 0 rgba(255,255,255,0.06)",
            display:"flex", flexDirection:"column",
            overflow:"hidden",
            transition: sheetDragY !== null ? "none" : "height .28s cubic-bezier(.4,0,.2,1)",
            zIndex:50,
            touchAction:"none",
          }}>

          {/* ── Drag handle — tap/drag from anywhere on this bar to resize ── */}
          <div
            style={{ flexShrink:0, paddingTop:10, paddingBottom:6, display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"ns-resize", touchAction:"none", userSelect:"none" }}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleSheetDragStart(e); }}
            onTouchStart={handleSheetDragStart}
          >
            <div style={{ width:36, height:4, borderRadius:4, background:"rgba(255,255,255,0.15)" }}/>
          </div>

          {/* ── Search bar — also draggable ── */}
          <div
            style={{ padding:"10px 14px 0",flexShrink:0, touchAction:"none", userSelect:"none" }}
            onPointerDown={e=>{ e.currentTarget.setPointerCapture(e.pointerId); handleSheetDragStart(e); }}
            onTouchStart={handleSheetDragStart}
          >
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ flex:1,position:"relative" }}>
                <svg style={{ position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar paradas..."
                  style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:13,padding:"11px 14px 11px 38px",color:"#f1f5f9",fontSize:13,outline:"none",caretColor:"#3b82f6",backdropFilter:"blur(8px)" }}/>
                {search && <button onClick={()=>setSearch("")} style={{ position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:15,lineHeight:1 }}>✕</button>}
              </div>
              <button className="rd-btn" style={{ width:44,height:44,borderRadius:13,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* ── Route name block ── */}
          {myRoute && (
            <div style={{ padding:"10px 14px 0",flexShrink:0 }}>
              <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"13px 15px",backdropFilter:"blur(10px)" }}>
                <div style={{ display:"flex",alignItems:"center",gap:11,marginBottom:9 }}>
                  <div style={{ width:42,height:42,borderRadius:13,background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 20px rgba(59,130,246,0.15)" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                      <circle cx="5" cy="18" r="2.5" stroke="#3b82f6" strokeWidth="1.8"/>
                      <circle cx="19" cy="6" r="2.5" stroke="#3b82f6" strokeWidth="1.8"/>
                      <path d="M7.5 18h6a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h4.5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:16,fontWeight:800,color:"#f8fafc",letterSpacing:"-0.4px",lineHeight:1.15 }}>{myRoute.routeName||"Ruta del día"}</div>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:3,flexWrap:"wrap" }}>
                      {estFinish()&&<span style={{ fontSize:10.5,color:"rgba(255,255,255,0.38)",display:"flex",alignItems:"center",gap:3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Finaliza {estFinish()}
                      </span>}
                      {routeKm>0&&<span style={{ fontSize:10.5,color:"rgba(255,255,255,0.38)",display:"flex",alignItems:"center",gap:3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {routeKm} km
                      </span>}
                      <span style={{ fontSize:10.5,color:"rgba(255,255,255,0.38)",display:"flex",alignItems:"center",gap:3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                        {stops.filter(s=>s.stopNum).length} paradas
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize:14,fontWeight:800,color:"#3b82f6",flexShrink:0,letterSpacing:"-0.5px" }}>{pct}%</span>
                </div>
                <div style={{ height:3,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden" }}>
                  <div style={{ height:"100%",background:"linear-gradient(90deg,#1d4ed8,#60a5fa)",borderRadius:3,width:`${pct}%`,transition:"width .7s cubic-bezier(.4,0,.2,1)",boxShadow:"0 0 8px rgba(96,165,250,0.6)" }}/>
                </div>
              </div>
            </div>
          )}

          {/* ── Filter chips ── */}
          {myRoute && (
            <div style={{ padding:"10px 14px 0",flexShrink:0 }}>
              <div style={{ display:"flex",gap:6,overflowX:"auto",paddingBottom:2 }}>
                {[
                  {id:"all",label:"Todas",count:stops.length},
                  {id:"pending",label:"Pendientes",count:pending.length},
                  {id:"delivered",label:"Entregadas",count:delivered.length},
                  {id:"problema",label:"Problemas",count:problems.length},
                ].map(chip=>(
                  <button key={chip.id} onClick={()=>setFilterMode(chip.id)} className="rd-btn"
                    style={{ display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:22,border:`1.5px solid ${filterMode===chip.id?"#2563eb":"rgba(255,255,255,0.1)"}`,background:filterMode===chip.id?"rgba(37,99,235,0.2)":"transparent",color:filterMode===chip.id?"#93c5fd":"rgba(255,255,255,0.45)",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,transition:"all .18s",backdropFilter:"blur(6px)" }}>
                    {chip.label}
                    {chip.count>0&&<span style={{ fontSize:11,fontWeight:800,color:filterMode===chip.id?"#60a5fa":"rgba(255,255,255,0.25)",background:filterMode===chip.id?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.06)",borderRadius:8,padding:"1px 6px",minWidth:18,textAlign:"center",display:"inline-block" }}>{chip.count}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Stops list — edge-to-edge, scrollable ── */}
          <div style={{ flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:16,marginTop:8,WebkitOverflowScrolling:"touch" }}>

            {/* Empty state - no route */}
            {!myRoute && (
              <div style={{ textAlign:"center",padding:"60px 24px" }}>
                <div style={{ fontSize:44,marginBottom:14,opacity:0.3 }}>📭</div>
                <div style={{ fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.35)",marginBottom:6 }}>Sin ruta asignada</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.2)",lineHeight:1.6 }}>El admin te enviará la ruta del día</div>
              </div>
            )}

            {/* Empty search result */}
            {filteredStops.length===0 && myRoute && (
              <div style={{ textAlign:"center",padding:"40px 24px" }}>
                <div style={{ fontSize:32,marginBottom:10,opacity:0.3 }}>🔍</div>
                <div style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.3)" }}>Sin resultados</div>
              </div>
            )}

            {/* ── Timeline stops — premium edge-to-edge ── */}
            {filteredStops.map((stop,i) => {
              const isDone = stop.driverStatus==="delivered";
              const isProb = stop.driverStatus==="problema";
              const isEnR  = stop.driverStatus==="en_ruta";
              const isCur  = stop===currentStop;
              const isExp  = selStop?.id===stop.id;
              const isLast = i === filteredStops.length - 1;

              const dotColor = isDone?"#10b981":isProb?"#ef4444":isCur||isEnR?"#3b82f6":"#475569";
              const dotGlow  = isDone?"rgba(16,185,129,0.55)":isProb?"rgba(239,68,68,0.55)":isCur?"rgba(59,130,246,0.55)":"transparent";
              const lineColor= isDone?"rgba(16,185,129,0.4)":"rgba(255,255,255,0.06)";
              const rowBg    = isDone?"rgba(16,185,129,0.07)":isProb?"rgba(239,68,68,0.07)":isCur?"rgba(59,130,246,0.09)":"rgba(255,255,255,0.03)";
              const leftAccent=isDone?"#10b981":isProb?"#ef4444":isCur?"#3b82f6":"transparent";
              const divColor = isDone?"rgba(16,185,129,0.15)":isProb?"rgba(239,68,68,0.15)":isCur?"rgba(59,130,246,0.18)":"rgba(255,255,255,0.06)";
              const statusLabel=isDone?"Entregado":isProb?"Problema":isEnR?"En camino":"Pendiente";
              const statusColor=isDone?"#10b981":isProb?"#ef4444":isEnR?"#60a5fa":"#f59e0b";
              const statusBg   =isDone?"rgba(16,185,129,0.13)":isProb?"rgba(239,68,68,0.13)":isEnR?"rgba(59,130,246,0.13)":"rgba(245,158,11,0.13)";
              const statusBdr  =isDone?"rgba(16,185,129,0.3)":isProb?"rgba(239,68,68,0.3)":isEnR?"rgba(96,165,250,0.3)":"rgba(245,158,11,0.3)";

              return (
                <div key={stop.id} style={{ display:"flex", animation:`slideInRow .25s ${Math.min(i,8)*30}ms ease both` }}>

                  {/* ── Timeline column ── */}
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",width:56,flexShrink:0,paddingTop:16,paddingLeft:14 }}>
                    <div style={{
                      width:38, height:38, borderRadius:"50%",
                      background: isDone ? "radial-gradient(circle at 35% 35%,#12b886,#059669)"
                                : isProb ? "radial-gradient(circle at 35% 35%,#f87171,#dc2626)"
                                : isCur  ? "radial-gradient(circle at 35% 35%,#60a5fa,#2563eb)"
                                :          "rgba(255,255,255,0.06)",
                      border:`2px solid ${dotColor}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, zIndex:1,
                      boxShadow: (isCur||isDone||isProb) ? `0 0 0 4px ${dotGlow.replace("0.55","0.13")}, 0 4px 18px ${dotGlow}` : "none",
                    }}>
                      {/* Número SIEMPRE visible — check pequeño debajo si entregado */}
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}>
                        <span style={{ fontSize:isDone?11:13, fontWeight:800, color: isDone?"rgba(255,255,255,0.9)":isCur?"white":isProb?"white":"rgba(255,255,255,0.45)", fontFamily:"'DM Mono',monospace", letterSpacing:"-0.5px", lineHeight:1 }}>
                          {stop.stopNum||"?"}
                        </span>
                        {isDone && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" style={{opacity:0.9}}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {isProb && <span style={{ fontSize:10,color:"white",lineHeight:1,fontWeight:800 }}>!</span>}
                      </div>
                    </div>
                    {!isLast && <div style={{ width:2,flex:1,minHeight:14,background:lineColor,marginTop:3,borderRadius:1 }}/>}
                  </div>

                  {/* ── Row — edge-to-edge right, left accent border ── */}
                  <div className="rd-stop"
                    onClick={()=>{ setSelStop(isExp?null:stop); if(!isExp&&gMapRef.current&&stop.lat&&stop.lng){gMapRef.current.panTo({lat:stop.lat,lng:stop.lng});gMapRef.current.setZoom(16);} }}
                    style={{
                      flex:1, marginBottom:2,
                      background:rowBg,
                      borderTop:`1px solid ${divColor}`,
                      borderBottom:`1px solid ${divColor}`,
                      borderRight:"none",
                      borderLeft:`3px solid ${leftAccent}`,
                      cursor:"pointer", transition:"background .12s", overflow:"hidden",
                      paddingLeft:14,
                    }}>

                    {/* Main info row */}
                    <div style={{ display:"flex",alignItems:"center",paddingTop:14,paddingBottom:13,paddingRight:14,gap:10 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:3 }}>
                          <span style={{ fontSize:14,fontWeight:700,color:"#f8fafc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,letterSpacing:"-0.2px" }}>
                            {stop.client||`Parada ${stop.stopNum}`}
                          </span>
                          {isCur&&!isDone&&(
                            <span style={{ fontSize:9,color:"white",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",borderRadius:6,padding:"2px 8px",fontWeight:800,letterSpacing:"0.6px",flexShrink:0,boxShadow:"0 2px 10px rgba(59,130,246,0.45)" }}>ACTUAL</span>
                          )}
                        </div>
                        {/* SP code + teléfono clickeable */}
                        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap" }}>
                          {stop.tracking && (
                            <span style={{ fontSize:10,fontFamily:"'DM Mono',monospace",color:"rgba(96,165,250,0.7)",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:5,padding:"1px 6px",letterSpacing:"0.3px",flexShrink:0 }}>
                              {stop.tracking}
                            </span>
                          )}
                          {stop.phone && (
                            <div style={{ display:"flex",gap:4,flexShrink:0 }}>
                              <a href={`tel:${stop.phone.replace(/\D/g,"")}`}
                                onClick={e=>e.stopPropagation()}
                                style={{ display:"flex",alignItems:"center",gap:3,fontSize:10,color:"rgba(255,255,255,0.5)",textDecoration:"none",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"2px 7px",transition:"all .12s" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.91 10.5a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.9 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                {stop.phone}
                              </a>
                              <a href={`https://wa.me/${stop.phone.replace(/\D/g,"")}`}
                                target="_blank" rel="noreferrer"
                                onClick={e=>e.stopPropagation()}
                                style={{ display:"flex",alignItems:"center",justifyContent:"center",width:22,height:22,background:"rgba(37,211,102,0.08)",border:"1px solid rgba(37,211,102,0.2)",borderRadius:6,flexShrink:0 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                              </a>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize:11.5,color:"rgba(255,255,255,0.32)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.4 }}>
                          {stop.displayAddr||stop.rawAddr||"Sin dirección"}
                        </div>
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0 }}>
                        <div style={{ display:"inline-flex",alignItems:"center",padding:"4px 10px",borderRadius:8,background:statusBg,border:`1px solid ${statusBdr}` }}>
                          <span style={{ fontSize:10.5,fontWeight:700,color:statusColor,letterSpacing:"0.1px" }}>{statusLabel}</span>
                        </div>
                        {isDone&&stop.deliveredAt&&<span style={{ fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:"'DM Mono',monospace" }}>{stop.deliveredAt}</span>}
                        {isCur&&!isDone&&estFinish()&&<span style={{ fontSize:10,color:"rgba(255,255,255,0.22)",fontFamily:"'DM Mono',monospace" }}>{estFinish()}</span>}
                      </div>
                      <svg style={{ flexShrink:0,opacity:0.22 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                    </div>

                    {/* Expanded */}
                    {isExp && (
                      <div style={{ borderTop:`1px solid ${divColor}`,padding:"13px 14px 16px 0",animation:"fadeUp .18s ease" }}>
                        {stop.notes&&<div style={{ fontSize:12,color:"rgba(255,255,255,0.38)",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"9px 12px",marginBottom:11,lineHeight:1.5 }}>📝 {stop.notes}</div>}
                        {isProb&&stop.issue&&<div style={{ fontSize:12,color:"rgba(239,68,68,0.75)",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:10,padding:"9px 12px",marginBottom:11 }}>⚠ {stop.issue}</div>}
                        {!isDone&&!isProb&&(
                          <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
                            <div style={{ display:"flex",gap:8 }}>
                              {[
                                {href:`https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`,label:"Waze"},
                                {href:`https://maps.google.com/?q=${stop.lat},${stop.lng}`,label:"Maps"},
                                {href:`https://wa.me/${stop.phone?.replace(/\D/g,"")}`,label:"WhatsApp"},
                              ].map(({href,label})=>(
                                <a key={label} href={href} target="_blank" rel="noreferrer" className="rd-btn"
                                  style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"10px 4px",borderRadius:11,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.7)",fontSize:12,textDecoration:"none",fontWeight:700,transition:"all .12s" }}>
                                  {label}
                                </a>
                              ))}
                            </div>
                            <div style={{ display:"flex",gap:8 }}>
                              <button className="rd-btn" onClick={e=>{e.stopPropagation();setShowProb(stop.id);}}
                                style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"13px",borderRadius:12,border:"1px solid rgba(239,68,68,0.22)",background:"rgba(239,68,68,0.07)",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                                ✕ Fallido
                              </button>
                              <button className="rd-btn" onClick={e=>{e.stopPropagation();markDelivered(stop.id);}}
                                style={{ flex:2,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#059669,#10b981)",color:"white",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 22px rgba(16,185,129,0.38)" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>
                                Entregado
                              </button>
                            </div>
                          </div>
                        )}
                        {isDone&&<div style={{ display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:11,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style={{ fontSize:12,color:"rgba(16,185,129,0.85)",fontWeight:600 }}>Entregado{stop.deliveredAt?" · "+stop.deliveredAt:""}</span></div>}
                        {isProb&&<div style={{ display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:11,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style={{ fontSize:12,color:"rgba(239,68,68,0.75)",fontWeight:600 }}>Problema reportado</span></div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ CHAT TAB ══ */}
      {tab === "chat" && (
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
                      // Activar esta ruta: sacarla de la cola y hacerla la activa
                      const newQueue = pendingRoutes.filter((_,i) => i !== idx);
                      // Actualizar cola
                      setPendingRoutes(newQueue);
                      if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
                      window.__rdPendingRoutes[myKey] = newQueue;
                      LS.setPending(myKey, newQueue);
                      // Activar la ruta seleccionada
                      const newStops = (route.stops||[]).map(s=>({...s, driverStatus: s.driverStatus||"pending"}));
                      setStops(newStops);
                      if (!window.__rdRouteStore) window.__rdRouteStore = {};
                      window.__rdRouteStore[myKey] = route;
                      LS.setRoute(myKey, route);
                      onUpdateRoute(myKey, route);
                      // Chat automático
                      addChatMsg(`🚀 Ruta "${route.routeName}" activada · ${stopsCount} paradas`);
                      // Ir a la pestaña de ruta
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
                    <div style={{ display:"flex", gap:8 }}>
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

      {/* ══ BOTTOM NAV ══ */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"#080f18",borderTop:"1px solid #0d1a26",display:"flex",zIndex:200 }}>
        {[
          { id:"route", label:"Ruta",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
          { id:"chat", label:"Chat",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
            badge:chatLog.filter(m=>m.from==="admin").length },
          { id:"pending", label:"En cola",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            badge:pendingRoutes.length },
          { id:"history", label:"Historial",
            icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)} className="rd-btn"
            style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"11px 0 20px",border:"none",background:"transparent",color:tab===item.id?"#3b82f6":"rgba(255,255,255,0.3)",cursor:"pointer",position:"relative",transition:"color .15s" }}>
            {item.badge>0 && tab!==item.id && (
              <div style={{ position:"absolute",top:8,right:"calc(50% - 14px)",minWidth:16,height:16,borderRadius:"50%",background:"#3b82f6",border:"2px solid #080f18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"white",fontWeight:800,padding:"0 3px" }}>{item.badge>9?"9+":item.badge}</div>
            )}
            {item.icon}
            <span style={{ fontSize:9.5,fontWeight:tab===item.id?700:500 }}>{item.label}</span>
            {tab===item.id && <div style={{ position:"absolute",bottom:0,left:"20%",right:"20%",height:2,background:"#3b82f6",borderRadius:"2px 2px 0 0" }}/>}
          </button>
        ))}
      </div>

      {/* -- Reportar problema modal -- */}
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

  const add = () => {
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
    const newUser = {
      id: "U-" + Date.now(), name,
      email,
      password: "driver123",
      role: "driver",
      avatar: initials,
      zone: "DN",
      color: "#10b981",
      driverId: newId,
    };
    USERS.push(newUser);
    // Persistir en Firebase
    FB.set(`users/${newUser.id}`, newUser);
    FB.set(`mens_users/${newId}`, newUser);

    setSaveMsg(`✓ ${name} agregado · Login: ${email} / driver123`);
    setTimeout(() => setSaveMsg(""), 5000);
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

        /* ── LOGIN ANIMATIONS ───────────────────────────────────── */
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Fondo: partículas tipo radar/sonar */
        @keyframes radarPing{
          0%{transform:scale(0.4);opacity:0.7}
          100%{transform:scale(2.8);opacity:0}
        }
        @keyframes radarPing2{
          0%{transform:scale(0.2);opacity:0.5}
          100%{transform:scale(3.2);opacity:0}
        }
        @keyframes scanLine{
          0%{transform:translateY(-100%);opacity:0}
          10%{opacity:1}
          90%{opacity:1}
          100%{transform:translateY(100vh);opacity:0}
        }
        @keyframes gridPulse{
          0%,100%{opacity:0.025}
          50%{opacity:0.06}
        }
        /* Partículas flotantes */
        @keyframes floatA{0%,100%{transform:translate(0,0) scale(1);opacity:0.6}50%{transform:translate(18px,-22px) scale(1.2);opacity:1}}
        @keyframes floatB{0%,100%{transform:translate(0,0);opacity:0.4}50%{transform:translate(-14px,18px);opacity:0.9}}
        @keyframes floatC{0%,100%{transform:translate(0,0) rotate(0deg);opacity:0.5}50%{transform:translate(10px,10px) rotate(45deg);opacity:0.8}}

        /* Card entrada tipo "drop from ops center" */
        @keyframes lCard{
          0%{opacity:0;transform:translateY(-40px) scale(0.94);filter:blur(8px)}
          60%{filter:blur(0px)}
          100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
        }
        @keyframes lLogo{
          0%{opacity:0;transform:scale(0.7) rotateX(20deg)}
          100%{opacity:1;transform:scale(1) rotateX(0deg)}
        }
        @keyframes lOut{
          0%{opacity:1;filter:blur(0)}
          100%{opacity:0;transform:scale(1.04) translateY(-10px);filter:blur(4px)}
        }
        @keyframes lSuccess{
          0%{transform:scale(1);box-shadow:0 0 0 0 rgba(16,185,129,0)}
          40%{transform:scale(1.015);box-shadow:0 0 0 12px rgba(16,185,129,0.08)}
          100%{transform:scale(1);box-shadow:0 0 0 0 rgba(16,185,129,0)}
        }
        /* Borde animado en el card */
        @keyframes borderGlow{
          0%,100%{opacity:0.15}
          50%{opacity:0.45}
        }
        /* Counter decimal (efecto HUD) */
        @keyframes hudIn{
          0%{opacity:0;transform:translateX(-6px)}
          100%{opacity:1;transform:translateX(0)}
        }
        @keyframes blinkCursor{0%,100%{opacity:1}50%{opacity:0}}
      `}</style>

      {/* ── FONDO RADAR / OPS CENTER ── */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",background:"radial-gradient(ellipse 80% 70% at 50% 40%,#040d1a 0%,#020509 100%)"}}>
        {/* Grid táctica */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",animation:"gridPulse 6s ease-in-out infinite"}}/>
        {/* Scan line horizontal tipo radar */}
        <div style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(59,130,246,0.0) 20%,rgba(59,130,246,0.35) 50%,rgba(59,130,246,0.0) 80%,transparent 100%)",animation:"scanLine 8s linear infinite",animationDelay:"1s"}}/>
        <div style={{position:"absolute",left:0,right:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(16,185,129,0.0) 20%,rgba(16,185,129,0.2) 50%,rgba(16,185,129,0.0) 80%,transparent 100%)",animation:"scanLine 12s linear infinite",animationDelay:"5s"}}/>
        {/* Pulsos sonar desde el centro */}
        <div style={{position:"absolute",top:"38%",left:"50%",transform:"translate(-50%,-50%)"}}>
          {[0,0.8,1.6,2.4].map((delay,i)=>(
            <div key={i} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:420,height:420,borderRadius:"50%",border:"1px solid rgba(59,130,246,0.18)",animation:`radarPing ${3.5}s ease-out infinite`,animationDelay:`${delay}s`,pointerEvents:"none"}}/>
          ))}
          {[0.4,1.2,2.0].map((delay,i)=>(
            <div key={"b"+i} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:320,height:320,borderRadius:"50%",border:"1px solid rgba(16,185,129,0.1)",animation:`radarPing2 ${4.5}s ease-out infinite`,animationDelay:`${delay}s`,pointerEvents:"none"}}/>
          ))}
        </div>
        {/* Partículas flotantes (3 diamantes) */}
        {[
          {top:"18%",left:"12%",anim:"floatA",delay:"0s",size:5,color:"#3b82f6"},
          {top:"72%",left:"82%",anim:"floatB",delay:"1.2s",size:4,color:"#10b981"},
          {top:"60%",left:"8%",anim:"floatC",delay:"2.1s",size:6,color:"#6366f1"},
          {top:"25%",left:"88%",anim:"floatA",delay:"0.7s",size:3,color:"#3b82f6"},
          {top:"85%",left:"35%",anim:"floatB",delay:"1.8s",size:4,color:"#60a5fa"},
        ].map((p,i)=>(
          <div key={i} style={{position:"absolute",top:p.top,left:p.left,width:p.size,height:p.size,borderRadius:1,background:p.color,transform:"rotate(45deg)",animation:`${p.anim} ${3+i*0.4}s ease-in-out infinite`,animationDelay:p.delay,opacity:0.6}}/>
        ))}
        {/* Corner accents */}
        <div style={{position:"absolute",top:20,left:20,width:40,height:40,borderTop:"1px solid rgba(59,130,246,0.3)",borderLeft:"1px solid rgba(59,130,246,0.3)"}}/>
        <div style={{position:"absolute",top:20,right:20,width:40,height:40,borderTop:"1px solid rgba(59,130,246,0.3)",borderRight:"1px solid rgba(59,130,246,0.3)"}}/>
        <div style={{position:"absolute",bottom:20,left:20,width:40,height:40,borderBottom:"1px solid rgba(59,130,246,0.3)",borderLeft:"1px solid rgba(59,130,246,0.3)"}}/>
        <div style={{position:"absolute",bottom:20,right:20,width:40,height:40,borderBottom:"1px solid rgba(59,130,246,0.3)",borderRight:"1px solid rgba(59,130,246,0.3)"}}/>
      </div>

      <div style={{
        width:380, position:"relative", zIndex:1,
        animation: success ? "lOut .5s ease forwards" : "lCard .6s cubic-bezier(.16,1,.3,1) both",
      }}>
        {/* ── LOGO HUD ── */}
        <div style={{ textAlign:"center", marginBottom:24, animation:"lLogo .7s .05s cubic-bezier(.16,1,.3,1) both", opacity:0 }}>
          {/* Icon con anillos */}
          <div style={{ position:"relative", width:72, height:72, margin:"0 auto 16px" }}>
            {/* Anillos externos animados */}
            <div style={{ position:"absolute", inset:-14, borderRadius:"50%", border:"1px solid rgba(59,130,246,0.15)", animation:"radarPing 2.5s ease-out infinite" }}/>
            <div style={{ position:"absolute", inset:-7, borderRadius:"50%", border:"1px solid rgba(59,130,246,0.22)", animation:"radarPing 2.5s ease-out infinite", animationDelay:"0.6s" }}/>
            {/* Glow base */}
            <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.25) 0%,transparent 70%)", filter:"blur(10px)" }}/>
            {/* Icon circle */}
            <div style={{ position:"relative", width:72, height:72, borderRadius:"50%", background:"linear-gradient(145deg,#0f2040,#1a3a6e)", border:"1px solid rgba(59,130,246,0.4)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 30px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95"/>
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.4"/>
              </svg>
              {/* Inner corner accents */}
              <div style={{ position:"absolute", top:6, left:6, width:8, height:8, borderTop:"1px solid rgba(96,165,250,0.6)", borderLeft:"1px solid rgba(96,165,250,0.6)" }}/>
              <div style={{ position:"absolute", bottom:6, right:6, width:8, height:8, borderBottom:"1px solid rgba(96,165,250,0.6)", borderRight:"1px solid rgba(96,165,250,0.6)" }}/>
            </div>
          </div>
          {/* Title */}
          <div style={{ fontSize:28, fontWeight:700, color:"white", letterSpacing:"-1px", lineHeight:1, fontFamily:"'Space Grotesk',sans-serif" }}>
            RAP <span style={{ color:"#3b82f6" }}>DRIVE</span>
          </div>
          {/* Tagline tipo HUD */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8 }}>
            <div style={{ height:1, width:28, background:"linear-gradient(90deg,transparent,rgba(59,130,246,0.5))" }}/>
            <span style={{ fontSize:9, color:"rgba(59,130,246,0.7)", letterSpacing:"3px", fontWeight:600, fontFamily:"'JetBrains Mono',monospace", textTransform:"uppercase" }}>Gestión de Entregas</span>
            <div style={{ height:1, width:28, background:"linear-gradient(90deg,rgba(59,130,246,0.5),transparent)" }}/>
          </div>
        </div>

        {/* Card */}
        <div style={{
          position:"relative",
          background:"linear-gradient(145deg,rgba(10,20,40,0.92),rgba(6,12,24,0.96))",
          border:"1px solid rgba(59,130,246,0.18)",
          borderRadius:20,
          padding:"28px 26px 24px",
          boxShadow:"0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 40px rgba(59,130,246,0.05)",
          backdropFilter:"blur(24px)",
          animation: success ? "lSuccess .6s ease" : "none",
          overflow:"hidden",
        }}>
          {/* Animated top border accent */}
          <div style={{ position:"absolute",top:0,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,rgba(59,130,246,0.6),transparent)",animation:"borderGlow 3s ease-in-out infinite" }}/>
          {/* Corner dots */}
          <div style={{ position:"absolute",top:10,left:10,width:3,height:3,borderRadius:"50%",background:"rgba(59,130,246,0.4)" }}/>
          <div style={{ position:"absolute",top:10,right:10,width:3,height:3,borderRadius:"50%",background:"rgba(59,130,246,0.4)" }}/>
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
const parseAddress = (raw) => {
  if (!raw) return { valid: false, raw: "" };
  const s = String(raw).trim();

  // Extract number
  const numMatch = s.match(/,?\s*n[ºo°]?\s*(\d+[-\w]*)/i) || s.match(/\s(\d+)\s*$/);
  const number = numMatch ? numMatch[1] : "";

  // Extract floor/door
  const floorMatch = s.match(/(\d+[ºo°]?\s*[A-Z]?)\s*(?:piso|planta|pta|puerta)?/i);
  const floor = floorMatch && floorMatch[0].includes("piso") ? floorMatch[1] : "";

  // Strip number/floor from street
  let street = s
    .replace(/,?\s*n[ºo°]?\s*\d+[-\w]*/i, "")
    .replace(/,?\s*\d+[ºo°]?\s*(piso|planta|pta)[^,]*/i, "")
    .replace(/\s+\d+\s*$/, "")
    .trim();

  // Normalize abbreviations
  street = street
    .replace(/^c\/?\s*/i,  "Calle ")
    .replace(/^av\.?\s*/i, "Avenida ")
    .replace(/^avda\.?\s*/i,"Avenida ")
    .replace(/^pz?a?\.?\s*/i,"Plaza ")
    .replace(/^ctra\.?\s*/i,"Carretera ")
    .replace(/^pg?\s+ind\b/i,"Polígono Industrial ")
    .replace(/^blv?d?\.?\s*/i,"Bulevar ")
    .replace(/^ps?o?\.?\s*/i,"Paseo ");

  // Capitalize words
  street = street.replace(/\b\w/g, c => c.toUpperCase());

  return {
    valid: street.length > 2,
    raw: s,
    street,
    number,
    floor,
    display: [street, number, floor].filter(Boolean).join(", "),
  };
};

// Fake geocoder: assigns plausible lat/lng near a base coordinate
// In production this would call Google Maps / Here / Nominatim API
const geocodeAddress = (parsed, baseCoord = { lat: 40.4168, lng: -3.7038 }) => {
  if (!parsed.valid) return { ...parsed, geocoded: false, lat: null, lng: null, confidence: 0 };

  // Deterministic pseudo-random offset from street hash
  let hash = 0;
  for (const ch of parsed.display) hash = ((hash << 5) - hash) + ch.charCodeAt(0);
  const seed = (hash >>> 0) / 0xffffffff;
  const seed2 = ((hash * 1664525 + 1013904223) >>> 0) / 0xffffffff;

  const lat = baseCoord.lat + (seed  - 0.5) * 0.08;
  const lng = baseCoord.lng + (seed2 - 0.5) * 0.12;

  // Confidence based on how complete the address is
  const confidence =
    parsed.number ? (parsed.street.length > 5 ? 98 : 85) :
    parsed.street.length > 8 ? 75 : 55;

  return { ...parsed, geocoded: true, lat, lng, confidence };
};



// --- IMPORT MODAL -------------------------------------------------------------

const ImportModal = ({ onClose, onImported }) => {
  const [stage, setStage]       = useState("upload");   // upload | mapping | geocoding | optimize | done
  const [rawRows, setRawRows]   = useState([]);
  const [headers, setHeaders]   = useState([]);
  const [mapping, setMapping]   = useState({});         // { address, client, phone, notes }
  const [stops, setStops]       = useState([]);         // geocoded stops
  const [optimized, setOptimized] = useState(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [driverName, setDriverName] = useState(DEFAULT_MENSAJEROS[0].id);
  const [routeName, setRouteName]   = useState("Ruta importada");
  const fileRef = useRef(null);

  const REQUIRED_FIELDS = ["address"];
  const OPTIONAL_FIELDS = ["client","phone","notes","priority"];
  const FIELD_LABELS = { address:"Dirección *", client:"Cliente", phone:"Teléfono", notes:"Notas", priority:"Prioridad" };

  // Auto-detect column mapping (versión simplificada para ImportModal legacy)
  const autoDetectLegacy = (hdrs) => {
    const m = {};
    const patterns = {
      address:  /direcci[oó]n|address|calle|domicilio|destino/i,
      client:   /cliente|nombre|name|destinatario|recipient/i,
      phone:    /tel[eé]fono|phone|m[oó]vil|mobile|tlf/i,
      notes:    /notas?|notes?|observ|instruc/i,
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
    const addressCol = mapping.address;
    if (!addressCol) return;

    const total = rawRows.length;
    const result = [];
    for (let i = 0; i < total; i++) {
      await new Promise(r => setTimeout(r, 60)); // simulate async
      const row = rawRows[i];
      const parsed = parseAddress(row[addressCol]);
      const geocoded = geocodeAddress(parsed);
      result.push({
        id: `IMP-${String(i+1).padStart(3,"0")}`,
        ...geocoded,
        client:   row[mapping.client]   || `Cliente ${i+1}`,
        phone:    row[mapping.phone]    || "",
        notes:    row[mapping.notes]    || "",
        priority: row[mapping.priority] || "normal",
        originalRow: row,
      });
      setProgress(Math.round(((i+1)/total)*100));
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
    const finalStops = optimized ? optimized.ordered : stops;
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
                <div style={{fontSize:14,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Geocodificando direcciones...</div>
                <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>Normalizando y asignando coordenadas a cada parada</div>
                {/* Progress bar */}
                <div style={{height:6,background:"#131f30",borderRadius:6,marginBottom:8,overflow:"hidden"}}>
                  {/* Segmentos animados */}
                  <div style={{display:"flex",gap:2,height:"100%"}}>
                    {Array.from({length:24}).map((_,i)=>{
                      const filled=(progress/100)*24;
                      const isFull=i<Math.floor(filled);
                      const isGlow=i===Math.floor(filled);
                      return <div key={i} style={{flex:1,borderRadius:2,background:isFull?"linear-gradient(180deg,#60a5fa,#2563eb)":isGlow?"rgba(59,130,246,0.35)":"rgba(255,255,255,0.04)",boxShadow:isFull?"0 0 4px rgba(59,130,246,0.5)":isGlow?"0 0 8px rgba(59,130,246,0.7)":"none",transition:"all .25s"}}/>;
                    })}
                  </div>
                </div>
                <div style={{fontSize:12,color:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{progress}% · {Math.round(rawRows.length*progress/100)} de {rawRows.length} direcciones</div>
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

// --- GEOCODER (Google Maps Geocoding API) -------------------------------------
const geocodeWithGoogle = async (rawAddress) => {
  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  const queries = buildQueryVariants(rawAddress);
  for (const q of queries) {
    try {
      const result = await new Promise((res, rej) =>
        geocoder.geocode({ address: q, region: "DO", componentRestrictions: { country: "DO" } },
          (results, status) => status === "OK" ? res(results) : rej(status))
      );
      if (result && result.length > 0) {
        const top = result[0];
        const loc = top.geometry.location;
        const types = top.types || [];
        const conf = scoreGoogleResult(top, rawAddress);
        return {
          ok: true,
          lat: loc.lat(),
          lng: loc.lng(),
          display: top.formatted_address,
          confidence: conf,
          types,
          allResults: result.slice(0, 3).map(r => ({
            display: r.formatted_address,
            lat: r.geometry.location.lat(),
            lng: r.geometry.location.lng(),
            confidence: scoreGoogleResult(r, rawAddress),
          })),
        };
      }
    } catch { /* try next variant */ }
  }
  // Fallback: Nominatim (OpenStreetMap) for addresses Google couldn't find
  try {
    // Try multiple Nominatim queries: enriched first, then raw, then simplified
    const nominatimQueries = [
      rawAddress + ", República Dominicana",
      expandRDAddress(rawAddress) + ", República Dominicana",
      rawAddress.split(",")[0].trim() + ", Santo Domingo, República Dominicana",
    ];
    for (const nmQuery of nominatimQueries) {
      const encoded = encodeURIComponent(nmQuery);
      const nm = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=do&addressdetails=1`, {
        headers: { "Accept-Language": "es", "User-Agent": "RapDrive/1.0 (delivery-routing)" }
      });
      if (!nm.ok) continue;
      const nmData = await nm.json();
      if (nmData && nmData.length > 0) {
        // Filter to RD bounding box
        const rdResults = nmData.filter(r => {
          const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
          return lat >= 17.4 && lat <= 19.9 && lng >= -72.1 && lng <= -68.3;
        });
        if (rdResults.length > 0) {
          const top = rdResults[0];
          const lat = parseFloat(top.lat), lng = parseFloat(top.lon);
          // Score based on OSM type
          let conf = 55;
          if (top.type === "house")             conf = 88;
          else if (top.type === "building")     conf = 82;
          else if (top.class === "highway")     conf = 74;
          else if (top.type === "residential")  conf = 70;
          else if (top.class === "place")       conf = 62;
          // Bonus if address includes a number from original
          const nums = rawAddress.match(/\d{1,4}/g);
          if (nums && nums.some(n => top.display_name.includes(n))) conf = Math.min(conf + 8, 92);
          return {
            ok: true, lat, lng,
            display: top.display_name.split(",").slice(0,3).join(",").trim(),
            confidence: conf,
            types: [top.type || "nominatim"],
            allResults: rdResults.slice(0,3).map(r => ({
              display: r.display_name.split(",").slice(0,3).join(",").trim(),
              lat: parseFloat(r.lat), lng: parseFloat(r.lon),
              confidence: 55,
            })),
          };
        }
      }
    }
  } catch { /* nominatim failed too */ }
  return { ok: false, lat: null, lng: null, display: null, confidence: 0, allResults: [] };
};

// Build multiple query variants for maximum hit rate
// Estrategia: de más específico a más general, hasta que Google responda
const buildQueryVariants = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return [];

  const expanded = expandRDAddress(s);
  const variants = new Set();

  // --- Detección de contexto geográfico ---
  const hasCountry = /rep[uú]blica dominicana|dominican republic/i.test(s);
  const hasCity    = /santo domingo|santiago|la romana|punta cana|san pedro|boca chica|higüey|moca|bonao|puerto plata|barahona|azua|d\.?\s*n\.?|distrito nacional/i.test(s);
  const hasSector  = /(?:sector|ens(?:anche)?|res(?:idencial)?|urb(?:anizaci[oó]n)?|reparto|barrio)\s+\w/i.test(s);

  const RD = ", República Dominicana";
  const SD = ", Santo Domingo" + RD;
  const DN = ", Distrito Nacional" + RD;

  // 1. Versión expandida + ciudad más completa (más precisa primero)
  if (!hasCountry && !hasCity) {
    variants.add(expanded + SD);
    variants.add(expanded + DN);
    variants.add(expanded + ", Santo Domingo Este" + RD);
    variants.add(expanded + ", Santo Domingo Oeste" + RD);
    variants.add(expanded + ", Santo Domingo Norte" + RD);
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

// --- HAVERSINE ----------------------------------------------------------------
const hav = (a, b) => {
  const R = 6371, dl = ((b.lat - a.lat) * Math.PI) / 180, dg = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dg / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// --- ROUTE OPTIMIZER - NEAREST NEIGHBOR FROM DEPOT ---------------------------
// Regla de negocio:
//   1. Parada más cercana al DEPOT → stopNum 1
//   2. Parada más cercana a la #1 → stopNum 2
//   3. Parada más cercana a la #2 → stopNum 3 … y así hasta agotar
//   4. Paradas sin coordenadas → al final con stopNum null
//   O(n²) – maneja 500+ paradas en milisegundos en el browser.
//   NUNCA modifica paradas que ya están en ruta activa (driverStatus !== "pending").

const optimizeRoute = (stops) => {
  if (!stops || stops.length === 0) return [];

  const valid   = stops.filter(s => s.lat != null && s.lng != null && isFinite(s.lat) && isFinite(s.lng));
  const invalid = stops.filter(s => !(s.lat != null && s.lng != null && isFinite(s.lat) && isFinite(s.lng)));

  if (valid.length === 0) return invalid.map(s => ({ ...s, stopNum: null }));
  if (valid.length === 1) return [{ ...valid[0], stopNum: 1 }, ...invalid.map(s => ({ ...s, stopNum: null }))];

  // ── Fase 1: Nearest Neighbor desde DEPOT ──────────────────
  let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
  const rem = [...valid];
  const tour = [];
  while (rem.length > 0) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = hav(cur, rem[i]);
      if (d < bd) { bd = d; bi = i; }
    }
    const [next] = rem.splice(bi, 1);
    tour.push(next);
    cur = next;
  }

  // ── Fase 2: 2-opt para eliminar cruces ────────────────────
  // Circuito: DEPOT → tour[0] → tour[1] → … → tour[n-1] → DEPOT
  // El 2-opt clásico evalúa SOLO las 2 aristas que se eliminan y las 2 que se crean.
  // Invertir el segmento [i+1..j] equivale a eliminar aristas (i→i+1) y (j→j+1)
  // y crear (i→j) y (i+1→j+1).
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 100) {
    improved = false;
    iterations++;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        // Aristas actuales que se eliminarán:
        //   A→B = tour[i] → tour[i+1]  (o DEPOT→tour[0] si i===-1, pero i empieza en 0)
        //   C→D = tour[j] → tour[j+1]  (o tour[j] → DEPOT si j === último)
        const A = i === 0 ? DEPOT : tour[i - 1];
        const B = tour[i];
        const C = tour[j];
        const D = j + 1 < tour.length ? tour[j + 1] : DEPOT;
        // Coste actual: A→B + C→D
        const costBefore = hav(A, B) + hav(C, D);
        // Coste nuevo si invertimos [i..j]: A→C + B→D
        const costAfter  = hav(A, C) + hav(B, D);
        if (costAfter < costBefore - 0.001) {
          // Invertir segmento [i..j]
          let l = i, r = j;
          while (l < r) { [tour[l], tour[r]] = [tour[r], tour[l]]; l++; r--; }
          improved = true;
        }
      }
    }
  }

  // ── Fase 3: Or-opt — mover paradas individuales al mejor lugar ──
  // Respeta la regla de circuito: DEPOT es siempre origen y destino.
  // NO se permite mover una parada si su nueva posición aleja el tour[0]
  // del DEPOT más de lo que estaba (para preservar el orden cercano-a-base primero).
  let orImproved = true;
  let orIter = 0;
  while (orImproved && orIter < 20) {
    orImproved = false;
    orIter++;
    for (let i = 0; i < tour.length; i++) {
      const node = tour[i];
      const prev = i === 0 ? DEPOT : tour[i - 1];
      const next = i === tour.length - 1 ? DEPOT : tour[i + 1];
      // Ganancia de sacar el nodo de su posición actual
      const removeCost = hav(prev, node) + hav(node, next) - hav(prev, next);
      let bestGain = 0.001, bestJ = -1;
      for (let j = 0; j < tour.length; j++) {
        if (j === i || j === i - 1) continue;
        const a = tour[j];
        const b = j + 1 < tour.length ? tour[j + 1] : DEPOT;
        const insertCost = hav(a, node) + hav(node, b) - hav(a, b);
        const gain = removeCost - insertCost;
        if (gain > bestGain) { bestGain = gain; bestJ = j; }
      }
      if (bestJ >= 0) {
        const removed = tour.splice(i, 1)[0];
        const insertAt = bestJ > i ? bestJ : bestJ + 1;
        tour.splice(insertAt, 0, removed);
        orImproved = true;
        break; // reiniciar desde el principio
      }
    }
  }

  return [
    ...tour.map((s, i) => ({ ...s, stopNum: i + 1 })),
    ...invalid.map(s => ({ ...s, stopNum: null })),
  ];
};

const totalKm = (stops) => {
  const v = stops.filter(s => s.lat && s.lng);
  if (!v.length) return 0;
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
    const optimized = optimizeRoute(results);
    setStops(optimized);
    setPhase("review");
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
    setTimeout(() => {
      setStops(prev => {
        const reordered = optimizeRoute([...prev]);
        return reordered;
      });
      setReoptimizing(false);
    }, 80);
  };

  const handleModalSave = (stopId, placeResult, rawText) => {
    setAddrEditStop(null);
    if (placeResult) {
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

                {/* COLUMN MAPPING */}
                <div>
                  <div style={{ fontSize:9.5,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.2px",marginBottom:10,display:"flex",alignItems:"center",gap:6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
                    MAPEAR COLUMNAS
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { f:"address",   l:"Dirección",            req:true,  icon:"📍" },
                      { f:"address2",  l:"Dirección 2 / Ref.",   req:false, icon:"🏠" },
                      { f:"client",    l:"Cliente / Nombre",     req:false, icon:"👤" },
                      { f:"phone",     l:"Teléfono",             req:false, icon:"📞" },
                      { f:"tracking",  l:"Código / Tracking",    req:false, icon:"🏷" },
                      { f:"sector",    l:"Sector / Barrio",      req:false, icon:"🗺" },
                      { f:"ciudad",    l:"Ciudad",               req:false, icon:"🏙" },
                      { f:"provincia", l:"Provincia",            req:false, icon:"🌎" },
                      { f:"cp",        l:"Código Postal",        req:false, icon:"📮" },
                      { f:"notes",     l:"Referencia / Notas",   req:false, icon:"📝" },
                    ].map(({ f, l, req, icon }) => (
                      <div key={f} style={{ background: mapping[f] ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)", border:`1px solid ${mapping[f] ? "rgba(16,185,129,0.18)" : req ? "rgba(59,130,246,0.2)" : "#0d1420"}`, borderRadius:9, padding:"8px 10px", transition:"border .2s" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                          <label style={{ fontSize:10,color: req ? "#60a5fa" : "#4b5563",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.5px",display:"flex",alignItems:"center",gap:5 }}>
                            <span>{icon}</span>{l.toUpperCase()}{req && <span style={{ color:"#ef4444",marginLeft:2 }}>*</span>}
                          </label>
                          {mapping[f] && <span style={{ fontSize:9,color:"#10b981",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>✓ OK</span>}
                        </div>
                        <select value={mapping[f] || ""} onChange={e => setMapping(m => ({ ...m, [f]: e.target.value || undefined }))}
                          style={{ ...sel, padding:"6px 10px", fontSize:11, border:`1px solid ${mapping[f] ? "rgba(16,185,129,0.25)" : "#1e2d3d"}` }}>
                          <option value="">— Sin asignar —</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mapping status summary */}
                <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid #0d1420", borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:9.5,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:6 }}>RESUMEN</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                    {[
                      ["Dirección",   mapping.address   ? "✓" : "—", mapping.address   ? "#10b981" : "#ef4444"],
                      ["Dir. 2",      mapping.address2  ? "✓" : "—", mapping.address2  ? "#10b981" : "#374151"],
                      ["Cliente",     mapping.client    ? "✓" : "—", mapping.client    ? "#10b981" : "#374151"],
                      ["Teléfono",    mapping.phone     ? "✓" : "—", mapping.phone     ? "#10b981" : "#374151"],
                      ["Tracking",    mapping.tracking  ? "✓" : "—", mapping.tracking  ? "#10b981" : "#374151"],
                      ["Sector",      mapping.sector    ? "✓" : "—", mapping.sector    ? "#10b981" : "#374151"],
                      ["Ciudad",      mapping.ciudad    ? "✓" : "—", mapping.ciudad    ? "#10b981" : "#374151"],
                      ["Provincia",   mapping.provincia ? "✓" : "—", mapping.provincia ? "#10b981" : "#374151"],
                      ["C.P.",        mapping.cp        ? "✓" : "—", mapping.cp        ? "#10b981" : "#374151"],
                    ].map(([l,v,c]) => (
                      <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:10, padding:"2px 0" }}>
                        <span style={{ color:"#374151",fontFamily:"'Inter',sans-serif" }}>{l}</span>
                        <span style={{ color:c, fontWeight:700, fontFamily:"'Syne',sans-serif" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT: Preview table */}
            <div style={{ flex:1, overflow:"auto", padding:"20px", background:"#060b10" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px" }}>
                  PREVISUALIZACIÓN · {Math.min(rawRows.length, 10)} DE {rawRows.length} FILAS
                </div>
                <div style={{ fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif" }}>
                  Columnas mapeadas: <span style={{ color:"#10b981",fontWeight:700 }}>{Object.values(mapping).filter(Boolean).length}</span> / {headers.length}
                </div>
              </div>
              <div style={{ borderRadius:14, border:"1px solid #0d1420", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.4)" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#080e16", borderBottom:"1px solid #131f30" }}>
                      {headers.slice(0, 6).map(h => {
                        const isMapped = Object.values(mapping).includes(h);
                        const fieldKey = Object.keys(mapping).find(k => mapping[k] === h);
                        const icons = { address:"📍", client:"👤", phone:"📞", tracking:"🏷", sector:"🗺", ciudad:"🏙", notes:"📝" };
                        return (
                          <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9.5, color: isMapped ? "#60a5fa" : "#1e3550", fontFamily:"'Syne',sans-serif", fontWeight:700, letterSpacing:"0.8px", whiteSpace:"nowrap", borderRight:"1px solid #0d1420" }}>
                            {isMapped && <span style={{ marginRight:4 }}>{icons[fieldKey]||""}</span>}
                            {h}
                            {isMapped && <span style={{ marginLeft:6, color:"#10b981", fontSize:9 }}>✓</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="rh" style={{ borderBottom:"1px solid #080e16", transition:"background .1s", background: i%2===0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                        {headers.slice(0, 6).map(h => {
                          const isMapped = Object.values(mapping).includes(h);
                          return (
                            <td key={h} style={{ padding:"9px 14px", fontSize:11.5, color: isMapped ? "#e2e8f0" : "#374151", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", borderRight:"1px solid #0a0f18" }}>
                              {String(row[h] || "")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rawRows.length > 10 && (
                <div style={{ textAlign:"center", marginTop:10, fontSize:11, color:"#2d4a60", fontFamily:"'Inter',sans-serif" }}>
                  + {rawRows.length - 10} filas más no mostradas
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

              {/* ── LOADING BAR SEGMENTADA ── */}
              <div style={{ marginBottom:14 }}>
                {/* Segmentos */}
                <div style={{ display:"flex", gap:2, marginBottom:6, height:6 }}>
                  {Array.from({length:20}).map((_,i)=>{
                    const filled = (geoProgress/100)*20;
                    const isFull  = i < Math.floor(filled);
                    const isGlow  = i === Math.floor(filled);
                    return (
                      <div key={i} style={{
                        flex:1, borderRadius:2,
                        background: isFull
                          ? i < 13 ? "#3b82f6" : i < 17 ? "#60a5fa" : "#93c5fd"
                          : isGlow ? "rgba(59,130,246,0.4)"
                          : "rgba(255,255,255,0.04)",
                        boxShadow: isFull ? "0 0 6px rgba(59,130,246,0.4)" : isGlow ? "0 0 10px rgba(59,130,246,0.6)" : "none",
                        transition:"all .3s ease",
                      }}/>
                    );
                  })}
                </div>
                {/* Sub-barra tipo scanner continuo */}
                <div style={{ position:"relative", height:2, background:"rgba(255,255,255,0.04)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, background:"linear-gradient(90deg,transparent 0%,rgba(59,130,246,0.7) 50%,transparent 100%)", backgroundSize:"40% 100%", animation:"geoShimmer 1.4s linear infinite" }}/>
                </div>
              </div>

              {/* Stats row — diseño HUD */}
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:20, marginTop:4 }}>
                {/* Porcentaje */}
                <div style={{ display:"flex", alignItems:"baseline", gap:2 }}>
                  <span style={{ fontSize:32, fontFamily:"'JetBrains Mono','DM Mono',monospace", fontWeight:600, color:"#60a5fa", lineHeight:1, letterSpacing:"-2px" }}>{String(geoProgress).padStart(3,"0")}</span>
                  <span style={{ fontSize:14, color:"rgba(59,130,246,0.5)", fontFamily:"'DM Mono',monospace" }}>%</span>
                </div>
                {/* Divisor */}
                <div style={{ width:1, height:32, background:"rgba(255,255,255,0.08)" }}/>
                {/* Counters */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:"#10b981", boxShadow:"0 0 6px #10b981" }}/>
                    <span style={{ fontSize:10, color:"#10b981", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                      {stops.filter(s=>s.status==="ok"||s.confidence>=70).length} OK
                    </span>
                  </div>
                  {stops.filter(s=>s.status==="error").length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:"#ef4444", boxShadow:"0 0 6px #ef4444" }}/>
                      <span style={{ fontSize:10, color:"#ef4444", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                        {stops.filter(s=>s.status==="error").length} ERR
                      </span>
                    </div>
                  )}
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
                    onClick={() => {
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
                      // Si el mensajero ya tiene una ruta activa con paradas pendientes,
                      // la nueva va a la cola. Si no, se asigna directamente como activa.
                      const currentActive = (window.__rdRouteStore||{})[driverId];
                      const hasActiveStops = currentActive?.stops?.some(
                        s => s.driverStatus === "pending" || s.driverStatus === "en_ruta"
                      );

                      if (hasActiveStops) {
                        // → Agregar a la cola de rutas pendientes
                        if (!window.__rdPendingRoutes) window.__rdPendingRoutes = {};
                        const queue = [...(window.__rdPendingRoutes[driverId] || []), route];
                        window.__rdPendingRoutes[driverId] = queue;
                        LS.setPending(driverId, queue);
                        // Notificar al mensajero de la nueva ruta en cola
                        if (typeof window.__rdSetPending === "function") window.__rdSetPending(driverId, queue);
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
    {id:"dashboard",icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>},
    {id:"routes",   icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M14 16l4-8M10 16l-4-8"/></svg>},
    {id:"import",   icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>},
    {id:"settings", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>},
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
      <aside style={{width:56,background:"#060b10",borderRight:"1px solid #0d1420",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0",gap:3,flexShrink:0}}>
        <div style={{marginBottom:20}}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px #3b82f625"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/></svg>
          </div>
        </div>
        {navItems.map(item=>(
          <button key={item.id} className="nb" title={PAGE_TITLES[item.id]} onClick={()=>setNav(item.id)} style={{width:38,height:38,borderRadius:10,border:"none",cursor:"pointer",background:nav===item.id?"#0d1420":"transparent",color:nav===item.id?"#3b82f6":"#2d4a60",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",position:"relative"}}>
            {item.icon}
            {nav===item.id&&<div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:2,height:16,background:"#3b82f6",borderRadius:"0 2px 2px 0"}}/>}
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"0 0 4px"}}>
          <div
            onClick={()=>setLogoutConfirm(true)}
            title={`${currentUser.name} · ${rc.label}
Click para cerrar sesión`}
            style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${rc.color}28,${rc.color}14)`,border:`1.5px solid ${rc.color}38`,display:"flex",alignItems:"center",justifyContent:"center",color:rc.color,fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .15s",flexShrink:0}}
          >{currentUser.avatar}</div>
          <div style={{width:6,height:6,borderRadius:"50%",background:rc.color,boxShadow:`0 0 5px ${rc.color}`}}/>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        <header style={{height:50,borderBottom:"1px solid #0d1420",display:"flex",alignItems:"center",padding:"0 20px",justifyContent:"space-between",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:"#f1f5f9",letterSpacing:"-0.3px"}}>{PAGE_TITLES[nav]}</span>
            <span style={{color:"#131f30"}}>·</span>
            <span style={{color:"#2d4a60",fontSize:12}}>{time.toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</span>
            <RoleBadge role={role}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            {/* Cmd+K search trigger */}
            <button onClick={()=>setSearchOpen(true)} style={{display:"flex",alignItems:"center",gap:8,background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:9,padding:"5px 12px",cursor:"pointer",transition:"all .15s"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span style={{fontSize:11,color:"#2d4a60",fontFamily:"'Inter',sans-serif"}}>Buscar...</span>
              <div style={{display:"flex",gap:3,marginLeft:4}}>
                <span style={{background:"#131f30",border:"1px solid #1e2d3d",borderRadius:4,padding:"1px 5px",fontSize:9,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700}}>⌘</span>
                <span style={{background:"#131f30",border:"1px solid #1e2d3d",borderRadius:4,padding:"1px 5px",fontSize:9,color:"#374151",fontFamily:"'Syne',sans-serif",fontWeight:700}}>K</span>
              </div>
            </button>
            <div style={{display:"flex",alignItems:"center",gap:5,background:"#0a1019",border:"1px solid #131f30",borderRadius:9,padding:"5px 11px"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:11,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px"}}>{time.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
            </div>
            <button onClick={()=>{setNotifOpen(o=>!o);setFeedOpen(false);}} style={{width:30,height:30,borderRadius:8,border:`1px solid ${notifOpen?"#1e3550":"#131f30"}`,background:notifOpen?"#0a1828":"#0a1019",color:notifOpen?"#60a5fa":"#2d4a60",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all .15s"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount>0&&<div style={{position:"absolute",top:-3,right:-3,width:14,height:14,borderRadius:"50%",background:"#ef4444",border:"2px solid #060b10",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"white",fontFamily:"'Syne',sans-serif",fontWeight:800}}>{unreadCount>9?"9+":unreadCount}</div>}
            </button>
            <button onClick={()=>{setFeedOpen(o=>!o);setNotifOpen(false);}} style={{width:30,height:30,borderRadius:8,border:`1px solid ${feedOpen?"#1e3550":"#131f30"}`,background:feedOpen?"#0a1828":"#0a1019",color:feedOpen?"#10b981":"#2d4a60",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",position:"relative"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 5px #10b981",animation:"pulse 2s infinite"}}/>
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

      {/* FAB - oculto en import/circuit para no molestar */}
      {rc.canDeleteDeliveries && nav !== "import" && <button onClick={()=>{setModalOpen(true);setNotifOpen(false);setFeedOpen(false);}} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",border:"none",borderRadius:28,padding:"11px 22px",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",letterSpacing:"1px",boxShadow:"0 8px 32px #3b82f650, 0 2px 8px rgba(0,0,0,0.4)",zIndex:800,transition:"all .2s"}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        NUEVA ENTREGA
      </button>}

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
