import { useState, useEffect, useRef, useCallback } from "react";

// --- DATA ---------------------------------------------------------------------
// V37 CIRCUIT ROUTE UX: panel lateral más ancho, cards legibles y botones rediseñados sin tocar lógica.

const DELIVERIES = [];

const DRIVERS = [];

const CLIENTS = [];

const ROUTES = [];

const ANALYTICS_DATA = {
  weekly:    [88, 102, 114, 97, 123, 118, 128],
  monthly:   [320, 410, 395, 480, 520, 490, 560, 610, 580, 640, 700, 128],
  cancelled: [8, 5, 10, 7, 4, 6, 3],
  avgTime:   [42, 38, 44, 36, 39, 35, 33],
  zones:     [],
  drivers:   [],
};

// --- MENSAJEROS (MUTABLE via Admin) ------------------------------------------
const DEFAULT_MENSAJEROS = [];

const USERS = [
  { id:"SUPER-01", name:"Super Admin Rap Drive", email:"super@rapdrive.do", password:"RapDriveSuper2026@", role:"super_admin", avatar:"SA", color:"#2563eb" },
];

const ROLE_CONFIG = {
  super_admin: { label:"Super Admin", color:"#8b5cf6", canSeeAnalytics:true, canManageDrivers:true, canDeleteDeliveries:true, canExport:true },
  admin:  { label:"Administrador", color:"#3b82f6", canSeeAnalytics:true, canManageDrivers:true, canDeleteDeliveries:true, canExport:true  },
  driver: { label:"Mensajero",     color:"#10b981", canSeeAnalytics:false,canManageDrivers:false,canDeleteDeliveries:false,canExport:false },
};

// --- BRANDING: icono de mensajería, sin rayos -------------------------------
const RD_BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="bg" x1="72" y1="40" x2="440" y2="472" gradientUnits="userSpaceOnUse"><stop stop-color="#38bdf8"/><stop offset="0.55" stop-color="#2563eb"/><stop offset="1" stop-color="#1e40af"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#020617" flood-opacity="0.35"/></filter></defs><rect x="48" y="48" width="416" height="416" rx="112" fill="url(#bg)"/><g filter="url(#shadow)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="M132 300h34l28-74h122l38 74h30" stroke-width="24"/><path d="M205 226v-52h80l58 52" stroke-width="22"/><path d="M122 254h48" stroke-width="22" opacity="0.96"/><circle cx="194" cy="328" r="34" fill="#1d4ed8" stroke-width="22"/><circle cx="342" cy="328" r="34" fill="#1d4ed8" stroke-width="22"/><path d="M318 150h64v64h-64z" fill="#fff" stroke-width="14"/><path d="M318 174h64M350 150v64" stroke="#2563eb" stroke-width="10"/></g></svg>`;
const RD_BRAND_ICON = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(RD_BRAND_SVG);
const RD_MANIFEST = { name:"Rap Drive Mensajería", short_name:"Rap Drive", description:"Gestión de rutas, mensajeros y paquetes", start_url:"/", display:"standalone", background_color:"#050a12", theme_color:"#2563eb", icons:[{src:RD_BRAND_ICON,sizes:"192x192",type:"image/svg+xml",purpose:"any maskable"},{src:RD_BRAND_ICON,sizes:"512x512",type:"image/svg+xml",purpose:"any maskable"}] };
const installRapDriveBranding = () => {
  if (typeof document === "undefined") return;
  document.title = "Rap Drive Mensajería";
  const upsert = (selector, tag, attrs) => { let el=document.querySelector(selector); if(!el){el=document.createElement(tag); document.head.appendChild(el);} Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); };
  upsert('link[rel="icon"]','link',{rel:'icon',type:'image/svg+xml',href:RD_BRAND_ICON});
  upsert('link[rel="shortcut icon"]','link',{rel:'shortcut icon',type:'image/svg+xml',href:RD_BRAND_ICON});
  upsert('link[rel="apple-touch-icon"]','link',{rel:'apple-touch-icon',href:RD_BRAND_ICON});
  upsert('meta[name="theme-color"]','meta',{name:'theme-color',content:'#2563eb'});
  upsert('link[rel="manifest"]','link',{rel:'manifest',href:'data:application/manifest+json;charset=utf-8,'+encodeURIComponent(JSON.stringify(RD_MANIFEST))});
};

// --- PERSISTENT STORE (in-memory - compatible con entorno de artefacto) -------
// ─── FIREBASE REALTIME DATABASE ─────────────────────────────────────────────
// Puente real entre navegadores distintos (Chrome admin ↔ Brave mensajero)
// ⚠️  IMPORTANTE: Reemplaza esta URL con la de tu Firebase Realtime Database
// Pasos: console.firebase.google.com → Nuevo proyecto → Realtime Database → Crear → Copiar URL
// La URL tiene este formato: https://TU-PROYECTO-default-rtdb.firebaseio.com
// En las Reglas de Firebase pon: { "rules": { ".read": true, ".write": true } }
const FB_URL = "https://rapdrive-default-rtdb.firebaseio.com";

const RD = {
  officeId: () => {
    try {
      if (typeof window !== "undefined" && window.__rdOfficeId) return window.__rdOfficeId;
      if (typeof sessionStorage !== "undefined") {
        const s = JSON.parse(sessionStorage.getItem("rdSession") || "null");
        return s?.officeId || null;
      }
    } catch(e) {}
    return null;
  },
  path: (path) => {
    const clean = String(path || "").replace(/^\/+/, "");
    const oid = RD.officeId();
    return oid ? `oficinas/${oid}/${clean}` : clean;
  }
};

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
  // Borra un nodo en Firebase sin tocar los demás
  remove: async (path) => {
    try {
      await fetch(`${FB_URL}/${path}.json`, { method: "DELETE" });
    } catch(e) { console.warn("FB.remove error", e); }
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
const _memStore = { routes: {}, chats: {}, mens: null };

// Normaliza mensajeros para evitar duplicados cuando Firebase mezcla arrays y objetos.
// Prioridad: id -> email -> teléfono -> nombre. Mantiene un solo registro por mensajero.
const normalizeMensajeros = (data) => {
  const raw = Array.isArray(data)
    ? data
    : (data && typeof data === "object" ? Object.values(data).filter(Boolean) : []);

  const byKey = {};
  raw.filter(Boolean).forEach((m) => {
    const cleanName  = String(m.name || "").trim().toUpperCase();
    const cleanEmail = String(m.email || "").trim().toLowerCase();
    const cleanPhone = String(m.phone || "").replace(/\D/g, "");
    // Priorizar email/teléfono/nombre sobre id evita duplicados cuando un doble click genera IDs distintos.
    const key = cleanEmail || cleanPhone || cleanName || m.id;
    if (!key) return;

    if (!byKey[key]) {
      byKey[key] = { ...m, name: cleanName || m.name, email: cleanEmail || m.email, phone: cleanPhone || m.phone };
    } else {
      byKey[key] = { ...byKey[key], ...m, id: byKey[key].id || m.id, name: cleanName || byKey[key].name, email: cleanEmail || byKey[key].email, phone: cleanPhone || byKey[key].phone };
    }
  });

  return Object.values(byKey);
};

const mensajerosToMap = (arr) => {
  const map = {};
  normalizeMensajeros(arr).forEach((m) => { if (m && m.id) map[m.id] = m; });
  return map;
};

const LS = {
  getRoutes: () => ({ ..._memStore.routes }),
  setRoute:  (id, r) => {
    _memStore.routes[id] = r;
    FB.set(RD.path(`routes/${id}`), r);
  },
  getChats:  () => ({ ..._memStore.chats }),
  setChat:   (id, c) => {
    _memStore.chats[id] = c;
    FB.set(RD.path(`chats/${id}`), c);
  },
  getMens:   () => normalizeMensajeros(_memStore.mens ? [..._memStore.mens] : DEFAULT_MENSAJEROS),
  setMens:   (m) => {
    const clean = normalizeMensajeros(m);
    _memStore.mens = clean;
    if (typeof window !== "undefined") window.__rdMensajeros = clean;
    // Guardar como objeto por ID evita que se duplique al agregar también por ruta /mensajeros/{id}.
    FB.set(RD.path("mensajeros"), mensajerosToMap(clean));
  },
  // Sin cola: una sola ruta activa por mensajero.
  // Ubicaciones en tiempo real de mensajeros
  setLocation: (driverId, loc) => {
    if (!window.__rdLocations) window.__rdLocations = {};
    window.__rdLocations[driverId] = loc;
    FB.set(RD.path(`locations/${driverId}`), loc);
  },
  getLocations: () => window.__rdLocations || {},
};

if (typeof window !== "undefined") {
  window.__rdRouteStore    = LS.getRoutes();
  window.__rdChatStore     = LS.getChats();
  window.__rdMensajeros    = LS.getMens();


  // ── CARGA INICIAL DESDE FIREBASE ─────────────────────────────────────────
  FB.get(RD.path("routes")).then(data => {
    if (data) { _memStore.routes = data; window.__rdRouteStore = data; }
  });
  FB.get(RD.path("chats")).then(data => {
    if (data) { _memStore.chats = data; window.__rdChatStore = data; }
  });
  // Cargar mensajeros y usuarios desde Firebase (persisten mensajeros nuevos creados por admin)
  FB.get(RD.path("mensajeros")).then(data => {
    const arr = normalizeMensajeros(data);
    _memStore.mens = arr; window.__rdMensajeros = arr;
  });
  // Cargar nodo alternativo mensajeros/ (copia individual por id)
  FB.get(RD.path("mensajeros")).then(data => {
    const fromFB = normalizeMensajeros(data);
    _memStore.mens = fromFB;
    window.__rdMensajeros = fromFB;
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
  visited:   {label:"Visitado",   color:"#3b82f6", bg:"rgba(59,130,246,0.12)"},
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
    FB.get(RD.path("locations")).then(data => {
      if (data && typeof data === "object") {
        setLiveLocations(data);
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });
    // Real-time updates via SSE
    const unsub = FB.listen(RD.path("locations"), (data) => {
      if (data && typeof data === "object") {
        setLiveLocations(prev => ({ ...prev, ...data }));
        if (!window.__rdLocations) window.__rdLocations = {};
        Object.assign(window.__rdLocations, data);
      }
    });
    // Polling backup cada 3s para monitoreo operativo más vivo
    const t = setInterval(() => {
      FB.get(RD.path("locations")).then(data => {
        if (data && typeof data === "object") {
          setLiveLocations(prev => ({ ...prev, ...data }));
        }
      });
    }, 3000);
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
        gestureHandling: "greedy",
        clickableIcons: false,
        isFractionalZoomEnabled: false,
        tilt: 0,
        heading: 0,
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
        FB.get(RD.path("routeHistory")),
        FB.get(RD.path("routes")),
      ]);
      if (activeData) { _memStore.routes = activeData; window.__rdRouteStore = activeData; }
      mergeAndSet(histData, activeData);
    };
    load();
    // El listener del App notifica cuando hay cambios en routes (activas)
    window.__rdOnRoutesUpdated = (activeData) => {
      FB.get(RD.path("routeHistory")).then(histData => mergeAndSet(histData, activeData));
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
        const isDone    = stop.navStatus === "visited";
        const color     = isDone ? "#3b82f6" : "#f59e0b";
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
          
        </svg>`;
        const marker = new window.google.maps.Marker({
          map: gMapRef.current,
          position: { lat: stop.lat, lng: stop.lng },
          title: `#${stop.stopNum} ${stop.client||""}`,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            scaledSize: new window.google.maps.Size(40, 46),
            anchor: new window.google.maps.Point(20, 42),
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
    const visited = stops.filter(s => s.navStatus === "visited").length;
    const pending   = stops.filter(s => s.navStatus !== "visited").length;
    return { total: stops.length, visited, pending };
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
                    {stats.visited} visitados
                  </div>
                  {false && (
                    <div style={{ fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:700, padding:"4px 10px", borderRadius:7, background:"rgba(239,68,68,0.12)", color:"#ef4444", display:"flex", alignItems:"center", gap:5, border:"1px solid rgba(239,68,68,0.15)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                      {stats.problems} nota{stats.problems !== 1 ? "s" : ""}
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
                  {[["✓",s.visited,"#10b981"],["○",s.pending,"#f59e0b"],["📍",s.total,"#3b82f6"]].map(([ic,val,c])=>val>0||ic==="📍"?(
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
                const isDone = stop.navStatus === "visited";
                const c = isDone ? "#3b82f6" : "#f59e0b";
                return (
                  <div key={stop.id||i} style={{ display:"flex", gap:12, padding:"10px 16px", borderBottom:"1px solid #080e16", alignItems:"flex-start" }}>
                    <div style={{ width:26, height:26, borderRadius:7, background:`${c}18`, border:`1.5px solid ${c}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontFamily:"'Syne',sans-serif", fontWeight:700, color:c, flexShrink:0, marginTop:1, position:"relative" }}>
                      {stop.stopNum || i+1}
                      {isDone && <div style={{ position:"absolute", top:-4, right:-4, width:10, height:10, borderRadius:"50%", background:"#10b981", border:"1.5px solid #060e1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:6, color:"white", fontWeight:900 }}>✓</div>}
                      
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {/* Cliente primero, dirección debajo */}
                      <div style={{ fontSize:12.5, fontWeight:700, color: isDone?"#10b981":"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>
                        {stop.client || "—"}
                        {stop.phone && <span style={{ fontSize:11, color:"#4b5563", fontWeight:400 }}> · {stop.phone}</span>}
                      </div>
                      <div style={{ fontSize:11, color:"#4b5563", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {stop.displayAddr || stop.rawAddr || "Sin dirección"}
                      </div>
                      {stop.tracking && <div style={{ fontSize:10, color:"#2d4a60", marginTop:2 }}>#{stop.tracking}</div>}
                      {stop.visitedAt && <div style={{ fontSize:10, color:"#10b981", marginTop:2 }}>Visitado {stop.visitedAt}</div>}
                      
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
  const [drvForm,setDrvForm]=useState({name:"",phone:"",vehicle:"Moto"});
  const driver=drivers.find(d=>d.id===selDriver);
  const filtered=drivers.filter(d=>!search||[d.name,d.office,d.vehicle].some(s=>s&&s.toLowerCase().includes(search.toLowerCase())));
  const driverRoute=driver?ROUTES.find(r=>r.id===driver.activeRoute):null;
  const inp2={background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",width:"100%"};
  const addDriver=()=>{
    if(!drvForm.name.trim())return;
    const av=drvForm.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newId="M"+Date.now();
    setDrivers(p=>[...p,{id:newId,avatar:av,...drvForm,name:drvForm.name.trim(),status:"active",deliveries:0,success:0,rating:0,activeRoute:null,today:0,online:true}]);
    setDrvForm({name:"",phone:"",vehicle:"Moto"});
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
        <div style={{flex:1,overflow:"auto",padding:"14px 22px 18px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12}}>{filtered.map((d,i)=>{const s=STATUS[d.status]||STATUS.offline;const isSel=selDriver===d.id;return(<div key={d.id} className="si" onClick={()=>setSelDriver(isSel?null:d.id)} style={{background:isSel?"#091527":"linear-gradient(135deg,#0d1420,#0a1019)",border:`1px solid ${isSel?"#1e3550":"#131f30"}`,borderRadius:14,padding:"16px",cursor:"pointer",transition:"all .15s",animation:`fadeUp .4s ${i*40}ms ease both`,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,right:0,width:60,height:60,borderRadius:"0 14px 0 60px",background:`${s.color}06`}}/><div style={{position:"absolute",top:12,right:12}}><div style={{width:8,height:8,borderRadius:"50%",background:d.online?"#10b981":"#374151",boxShadow:d.online?"0 0 6px #10b981":"none"}}/></div><div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}><Avatar i={d.avatar} size={42} color={s.color}/><div><div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.3px"}}>{d.name}</div><div style={{fontSize:10,color:"#2d4a60",marginTop:2}}>{d.office} · {d.vehicle.split("·")[0].trim()}</div></div></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Badge status={d.status}/><span style={{fontSize:11,color:"#f59e0b",fontFamily:"'Syne',sans-serif",fontWeight:700}}>★ {d.rating}</span></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{[["HOY",d.today,"rutas","#3b82f6"],["TOTAL",d.deliveries,"hist.","#64748b"],["TASA",d.success+"%","éxito","#10b981"]].map(([l,v,s2,c])=><div key={l} style={{background:"#060b10",borderRadius:8,padding:"7px 8px",border:"1px solid #0d1420"}}><div style={{fontSize:8.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.8px",marginBottom:2}}>{l}</div><div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:c}}>{v}</div><div style={{fontSize:9,color:"#2d4a60"}}>{s2}</div></div>)}</div>{d.activeRoute&&<div style={{marginTop:10,padding:"6px 10px",background:"#060b10",border:"1px solid #0d1420",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:9.5,color:"#2d4a60"}}>Ruta activa</span><span style={{fontSize:9.5,color:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:700}}>{d.activeRoute}</span></div>}</div>);})}</div></div>
      </div>
      {driver&&<aside style={{width:275,borderLeft:"1px solid #0d1420",display:"flex",flexDirection:"column",background:"#060b10",flexShrink:0,overflow:"hidden",animation:"slideIn .2s ease"}}><div style={{padding:"16px 16px 12px",borderBottom:"1px solid #0d1420"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px"}}>PERFIL CONDUCTOR</span><button onClick={()=>setSelDriver(null)} style={{width:24,height:24,borderRadius:6,border:"1px solid #131f30",background:"transparent",color:"#374151",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✕</button></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:14}}><Avatar i={driver.avatar} size={56} color={STATUS[driver.status]?.color||"#3b82f6"}/><div style={{fontSize:16,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginTop:10}}>{driver.name}</div><div style={{fontSize:11,color:"#2d4a60",marginTop:2}}>{driver.vehicle}</div><div style={{marginTop:8}}><Badge status={driver.status}/></div></div><div style={{background:"#0a1019",border:"1px solid #0d1420",borderRadius:12,padding:"12px 14px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1px"}}>RENDIMIENTO</span><span style={{fontSize:11,color:"#f59e0b",fontFamily:"'Syne',sans-serif",fontWeight:700}}>★ {driver.rating}</span></div>{[["Tasa de éxito",driver.success,"#10b981"],["Rutas hoy",Math.round(driver.today/18*100),"#3b82f6"],["Puntualidad",driver.success-3,"#f59e0b"]].map(([l,v,c])=><div key={l} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"#4b5563"}}>{l}</span><span style={{fontSize:10,color:c,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{v}%</span></div><div style={{height:3,background:"#131f30",borderRadius:3}}><div style={{height:3,background:`linear-gradient(90deg,${c},${c}55)`,borderRadius:3,width:`${v}%`,transition:"width 1s"}}/></div></div>)}</div><div style={{display:"flex",gap:7,marginBottom:10}}>{[["📞","Llamar"],["💬","Mensaje"],["📍","Ubicar"]].map(([ic,l])=><button key={l} className="ab" style={{flex:1,padding:"8px 0",borderRadius:9,border:"1px solid #131f30",background:"transparent",color:"#4b5563",fontSize:10,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",transition:"all .1s"}}>{ic} {l}</button>)}</div></div><div style={{flex:1,overflow:"auto",padding:"10px 14px"}}>{driverRoute?(<><div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:10}}>RUTA ACTIVA · {driverRoute.id}</div><div style={{background:"#0a1019",border:`1px solid ${driverRoute.color}33`,borderRadius:12,padding:"12px 14px",marginBottom:10}}><div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginBottom:6}}>{driverRoute.name}</div><div style={{height:4,background:"#131f30",borderRadius:4,marginBottom:6}}><div style={{height:4,background:`linear-gradient(90deg,${driverRoute.color},${driverRoute.color}55)`,borderRadius:4,width:`${driverRoute.progress}%`}}/></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:driverRoute.color,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{driverRoute.progress}% · {driverRoute.done}/{driverRoute.stops}</span><span style={{fontSize:11,color:"#2d4a60"}}>ETA {driverRoute.eta}</span></div></div><div style={{fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",marginBottom:8}}>PRÓXIMAS PARADAS</div>{driverRoute.stops_list.filter(s=>s.status!=="visited").slice(0,4).map((stop,i)=><div key={stop.n} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid #0a1019"}}><div style={{width:22,height:22,borderRadius:"50%",background:"#0a1019",border:`1.5px solid ${stop.status==="on_route"?"#3b82f6":"#1e2d3d"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,flexShrink:0}}>{stop.n}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:11.5,color:stop.status==="on_route"?"#e2e8f0":"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stop.address}</div><div style={{fontSize:10,color:"#2d4a60",marginTop:1}}>{stop.client} · {stop.time}</div></div>{stop.status==="on_route"&&<Badge status="on_route"/>}</div>)}</>):(<div style={{padding:"30px 0",textAlign:"center",color:"#2d4a60",fontSize:13}}>Sin ruta activa</div>)}</div></aside>}
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
          <input value={drvForm.office} onChange={e=>setDrvForm(p=>({...p,office:e.target.value}))} placeholder="Oficina / Base" style={inp2}/>
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
  const [form, setForm] = useState({name:"",phone:"",notes:""});
  const client = clients.find(c=>c.id===selClient);
  const filtered = clients.filter(c=>!search||[c.name,c.phone,c.office].some(s=>s&&s.toLowerCase().includes(search.toLowerCase())));
  const inp = {background:"#0a1019",border:"1px solid #1e2d3d",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",width:"100%"};
  const addClient = () => {
    if (!form.name.trim()) return;
    const initials = form.name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    setClients(p=>[...p,{id:"CL-"+Date.now(),avatar:initials,...form,name:form.name.trim(),status:"active",deliveries:0,lastDelivery:"—",spend:"$0",rating:0}]);
    setForm({name:"",phone:"",notes:""});
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
              <thead><tr style={{borderBottom:"1px solid #0d1420",background:"#060b10"}}>{["Cliente","Teléfono","Oficina","Rutas","Notas",""].map(h=><th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:9.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.3px"}}>{h}</th>)}</tr></thead>
              <tbody>{filtered.map((cl,i)=>{const isSel=selClient===cl.id;return(<tr key={cl.id} className="tr" onClick={()=>setSelClient(isSel?null:cl.id)} style={{borderBottom:"1px solid #080e16",background:isSel?"#091527":"transparent",transition:"background .1s",cursor:"pointer"}}>
                <td style={{padding:"10px 13px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar i={cl.avatar} size={28} color="#3b82f6"/><span style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>{cl.name}</span></div></td>
                <td style={{padding:"10px 13px"}}><a href={"tel:"+cl.phone} onClick={e=>e.stopPropagation()} style={{fontSize:12,color:"#3b82f6",textDecoration:"none"}}>{cl.phone}</a></td>
                <td style={{padding:"10px 13px"}}><span style={{fontSize:11,color:"#4b5563"}}>{cl.office||"—"}</span></td>
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
            <input value={form.office} onChange={e=>setForm(p=>({...p,office:e.target.value}))} placeholder="Oficina / Base" style={inp}/>
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
  const zoneOffsets = ANALYTICS_DATA.offices.reduce((acc, z, i) => {
    acc.push(i === 0 ? 0 : acc[i-1] + ANALYTICS_DATA.offices[i-1].pct);
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
        <KPI label="Total rutas"  value={data.reduce((a,b)=>a+b,0)}  sub="+18% vs periodo ant." color="#3b82f6" spark={data.slice(-6)} delay="0ms"/>
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
              <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase"}}>Rutas por {period==="weekly"?"día":"mes"}</div>
              <div style={{fontSize:24,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9",marginTop:4}}>{data[data.length-1]} <span style={{fontSize:13,color:"#3b82f6"}}>hoy</span></div>
            </div>
          </div>
          <LineChart data={data} color="#3b82f6" height={110} label="Rutas:"/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingLeft:16,paddingRight:4}}>
            {labels.map((l,i)=><span key={i} style={{fontSize:8.5,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:600}}>{l}</span>)}
          </div>
        </div>

        {/* Donut - zones */}
        <div style={{background:"linear-gradient(135deg,#0d1420,#0a1019)",border:"1px solid #131f30",borderRadius:16,padding:"18px 20px",animation:"fadeUp .5s .1s ease both"}}>
          <div style={{fontSize:10,color:"#2d4a60",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:14}}>Rutas por zona</div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{flexShrink:0}}>
              <circle cx="40" cy="40" r="36" fill="none" stroke="#131f30" strokeWidth="10"/>
              {ANALYTICS_DATA.offices.map((z,i)=>(
                <DonutSlice key={i} pct={z.pct} offset={zoneOffsets[i]} color={z.color}/>
              ))}
              <text x="40" y="44" textAnchor="middle" fontSize="11" fontFamily="'Syne',sans-serif" fontWeight="800" fill="#f1f5f9">{ANALYTICS_DATA.offices[0].pct}%</text>
            </svg>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
              {ANALYTICS_DATA.offices.map(z=>(
                <div key={z.office} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:z.color,flexShrink:0}}/>
                  <span style={{fontSize:10,color:"#64748b",flex:1}}>{z.office}</span>
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

// --- PAGE: ADMIN DRIVERS PRO --------------------------------------------------

const DriverProfileCard = ({ m, route, user, onToggle, onRemove }) => {
  const active = m.active !== false;
  const stops = route?.stops || [];
  const visited = stops.filter(s => s.navStatus === "visited").length;
  const total = stops.length;
  const progress = total ? Math.round((visited / total) * 100) : 0;
  const initials = m.initials || m.avatar || (m.name||"M").split(" ").map(x=>x[0]).join("").slice(0,2);
  return (
    <div className="driverProCard" style={{position:"relative",overflow:"hidden",background:"linear-gradient(145deg,#0b1220,#070d16)",border:"1px solid rgba(148,163,184,0.11)",borderRadius:20,padding:18,boxShadow:"0 18px 60px rgba(0,0,0,.32)",minHeight:230,transition:"all .22s ease"}}>
      <div style={{position:"absolute",inset:"-40% -20% auto auto",width:150,height:150,borderRadius:"50%",background:active?"radial-gradient(circle,rgba(59,130,246,.18),transparent 68%)":"radial-gradient(circle,rgba(100,116,139,.12),transparent 68%)",pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"flex-start",gap:13,position:"relative"}}>
        <div style={{width:52,height:52,borderRadius:16,background:active?"linear-gradient(135deg,#1d4ed8,#60a5fa)":"linear-gradient(135deg,#1f2937,#334155)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:900,color:"white",fontSize:16,boxShadow:active?"0 10px 28px rgba(59,130,246,.28)":"none"}}>{initials}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:900,color:"#f8fafc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-.2px"}}>{m.name || "Mensajero"}</div>
            <div style={{width:7,height:7,borderRadius:"50%",background:active?"#22c55e":"#64748b",boxShadow:active?"0 0 10px #22c55e":"none",flexShrink:0}}/>
          </div>
          <div style={{fontSize:12,color:"#64748b",lineHeight:1.55}}>{m.phone || "Sin teléfono"} · {m.vehicle || "Moto"}</div>
          <div style={{fontSize:12,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email || user?.email || "Sin correo"}</div>
        </div>
        <button onClick={() => onToggle(m.id)} title={active?"Pausar":"Activar"} style={{width:34,height:34,borderRadius:12,border:"1px solid rgba(148,163,184,.14)",background:"rgba(255,255,255,.03)",color:active?"#22c55e":"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{active ? "●" : "○"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:18}}>
        {[[total,"Paradas"],[visited,"Visitadas"],[progress+"%","Progreso"]].map(([v,l])=>(
          <div key={l} style={{border:"1px solid rgba(148,163,184,.09)",background:"rgba(15,23,42,.62)",borderRadius:14,padding:"11px 10px",textAlign:"center"}}>
            <div style={{fontSize:18,color:"#f8fafc",fontFamily:"'Syne',sans-serif",fontWeight:900,lineHeight:1}}>{v}</div>
            <div style={{fontSize:10,color:"#475569",fontWeight:800,marginTop:6,letterSpacing:".4px",textTransform:"uppercase"}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:15,padding:12,borderRadius:15,background:route?"rgba(59,130,246,.08)":"rgba(15,23,42,.45)",border:`1px solid ${route?"rgba(59,130,246,.18)":"rgba(148,163,184,.08)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:11,color:route?"#60a5fa":"#64748b",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:".7px",textTransform:"uppercase"}}>{route ? "Ruta activa" : "Sin ruta activa"}</div>
            <div style={{fontSize:12,color:route?"#cbd5e1":"#475569",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{route?.routeName || route?.name || "Esperando asignación"}</div>
          </div>
        </div>
        <div style={{height:5,borderRadius:999,background:"rgba(148,163,184,.10)",overflow:"hidden",marginTop:10}}>
          <div style={{height:"100%",width:`${progress}%`,borderRadius:999,background:"linear-gradient(90deg,#2563eb,#22c55e)",transition:"width .35s ease"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <a href={m.phone?`tel:${m.phone}`:undefined} style={{flex:1,textDecoration:"none",textAlign:"center",padding:"9px 10px",borderRadius:12,border:"1px solid rgba(59,130,246,.18)",background:"rgba(59,130,246,.07)",color:"#93c5fd",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:900}}>Llamar</a>
        <a href={m.phone?`https://wa.me/1${String(m.phone).replace(/\D/g,"")}`:undefined} target="_blank" rel="noreferrer" style={{flex:1,textDecoration:"none",textAlign:"center",padding:"9px 10px",borderRadius:12,border:"1px solid rgba(34,197,94,.16)",background:"rgba(34,197,94,.06)",color:"#86efac",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:900}}>WhatsApp</a>
        <button onClick={() => onRemove(m.id, m.name)} style={{width:40,borderRadius:12,border:"1px solid rgba(239,68,68,.14)",background:"rgba(239,68,68,.05)",color:"#f87171",cursor:"pointer"}}>×</button>
      </div>
    </div>
  );
};

const PageDriversPro = ({ mensajeros, setMensajeros, currentUser, routes }) => {
  const [q,setQ]=useState("");
  const [filter,setFilter]=useState("all");
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",phone:"",email:"",vehicle:"Moto"});
  const [msg,setMsg]=useState("");
  const creatingDriverRef = useRef(false);
  const officeId=currentUser?.officeId;
  const list=(mensajeros||[]).filter(m=>{
    const text=`${m.name||""} ${m.phone||""} ${m.email||""} ${m.vehicle||""}`.toLowerCase();
    const okQ=!q || text.includes(q.toLowerCase());
    const hasRoute=!!(routes||{})[m.id];
    const active=m.active!==false;
    const okF=filter==="all" || (filter==="active"&&active) || (filter==="paused"&&!active) || (filter==="route"&&hasRoute);
    return okQ && okF;
  });
  const stats={total:mensajeros.length,active:mensajeros.filter(m=>m.active!==false).length,paused:mensajeros.filter(m=>m.active===false).length,onRoute:mensajeros.filter(m=>(routes||{})[m.id]).length};
  const inp={background:"#070d16",border:"1px solid rgba(148,163,184,.14)",borderRadius:12,padding:"11px 13px",color:"#e2e8f0",outline:"none",fontSize:13,width:"100%"};
  const add=async()=>{
    if (creatingDriverRef.current) return;
    creatingDriverRef.current = true;
    try {
    const name=form.name.trim().toUpperCase();
    const cleanPhone=form.phone.trim().replace(/\D/g, "");
    if(!name||!officeId){setMsg("Falta nombre u oficina.");return;}
    const email=form.email.trim().toLowerCase() || `${name.split(" ")[0].toLowerCase()}@rapdrive.do`;

    const alreadyExists = (mensajeros||[]).some(m =>
      String(m.email||"").toLowerCase() === email ||
      (cleanPhone && String(m.phone||"").replace(/\D/g, "") === cleanPhone) ||
      String(m.name||"").trim().toUpperCase() === name
    );
    if (alreadyExists) {
      setMsg(`⚠ ${name} ya existe en esta oficina. No se creó duplicado.`);
      setTimeout(()=>setMsg(""),5000);
      return;
    }

    const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2);
    const newId="M-"+Date.now();
    const newMens={id:newId,name,initials,phone:cleanPhone,email,vehicle:form.vehicle||"Moto",active:true,color:"#3b82f6",officeId,createdAt:Date.now()};
    const newUser={id:"U-"+Date.now(),name,email,password:"driver123",role:"driver",avatar:initials,officeId,officeName:currentUser?.officeName||currentUser?.officeId||"Oficina",color:"#10b981",driverId:newId,active:true};

    const updated = normalizeMensajeros([...(mensajeros||[]), newMens]);
    setMensajeros(updated);
    _memStore.mens = updated;
    if (typeof window !== "undefined") window.__rdMensajeros = updated;
    if (!USERS.find(u => u.email === email || u.driverId === newId)) USERS.push(newUser);

    await Promise.all([
      FB.set(`oficinas/${officeId}/mensajeros`, mensajerosToMap(updated)),
      FB.set(`oficinas/${officeId}/users/${newUser.id}`,newUser),
      FB.set(`users/${newUser.id}`,newUser)
    ]);
    setForm({name:"",phone:"",email:"",vehicle:"Moto"}); setAdding(false); setMsg(`✓ ${name} creado · Login: ${email} / driver123`); setTimeout(()=>setMsg(""),6000);
    } finally {
      creatingDriverRef.current = false;
    }
  };
  const toggle=(id)=>setMensajeros(prev=>{const updated=normalizeMensajeros(prev.map(m=>m.id===id?{...m,active:!(m.active!==false)}:m)); LS.setMens(updated); return updated;});
  const remove=(id,name)=>{if(!window.confirm(`¿Eliminar ${name}?`))return; const u=USERS.find(u=>u.driverId===id); setMensajeros(prev=>{const updated=normalizeMensajeros(prev.filter(m=>m.id!==id)); LS.setMens(updated); return updated;}); if(officeId&&u)FB.set(`oficinas/${officeId}/users/${u.id}`,null); if(u)FB.set(`users/${u.id}`,null);};
  return (
    <div style={{flex:1,overflow:"auto",padding:"24px",background:"radial-gradient(circle at top left,rgba(37,99,235,.10),transparent 32%),#060b10"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:15,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,rgba(37,99,235,.28),rgba(14,165,233,.08))",border:"1px solid rgba(96,165,250,.26)",boxShadow:"0 18px 42px rgba(37,99,235,.16)"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2.2c0-1.55-1.25-2.8-2.8-2.8H6.8C5.25 16 4 17.25 4 18.8V21"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 8v5"/><path d="M17.5 10.5h5"/></svg>
          </div>
          <div>
            <div style={{fontSize:22,color:"#f8fafc",fontFamily:"'Syne',sans-serif",fontWeight:950,letterSpacing:"-.5px"}}>Drivers</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:3}}>Control de mensajeros, accesos y rutas activas</div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:16}}>
        {[["Total",stats.total,"#60a5fa","M3 11h3l2-5h8l3 5h2M7 16h10M7 16a3 3 0 1 0 0 .01M17 16a3 3 0 1 0 0 .01M10 6v-3h5l3 3"],["Activos",stats.active,"#22c55e","M20 6 9 17l-5-5"],["Pausados",stats.paused,"#f97316","M8 5v14M16 5v14"],["En ruta",stats.onRoute,"#a78bfa","M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"]].map(([l,v,c,d])=>(
          <div key={l} style={{border:"1px solid rgba(148,163,184,.10)",background:"linear-gradient(145deg,#0b1220,#070d16)",borderRadius:18,padding:"15px 16px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-24,width:90,height:90,borderRadius:"50%",background:`${c}12`,filter:"blur(2px)"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",background:`${c}12`,border:`1px solid ${c}26`}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d={d}/>{l==="En ruta"&&<circle cx="12" cy="10" r="2.2"/>}</svg>
              </div>
              <div style={{width:7,height:7,borderRadius:"50%",background:c,boxShadow:`0 0 14px ${c}`}}/>
            </div>
            <div style={{fontSize:28,color:"#fff",fontFamily:"'Syne',sans-serif",fontWeight:950,lineHeight:1}}>{v}</div>
            <div style={{fontSize:10,color:"#7c8da7",fontWeight:900,textTransform:"uppercase",letterSpacing:"1px",marginTop:8}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"minmax(260px,520px) 170px auto",gap:10,alignItems:"center",marginBottom:18}}>
        <div style={{position:"relative"}}>
          <svg style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar driver..." style={{...inp,width:"100%",paddingLeft:38}}/>
        </div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...inp,width:170}}><option value="all">Todos</option><option value="active">Activos</option><option value="paused">Pausados</option><option value="route">Con ruta</option></select>
        <button onClick={()=>setAdding(true)} style={{justifySelf:"end",display:"inline-flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:14,border:"1px solid rgba(59,130,246,.38)",background:"linear-gradient(135deg,#2563eb,#4f46e5)",color:"white",fontFamily:"'Syne',sans-serif",fontWeight:950,cursor:"pointer",boxShadow:"0 16px 36px rgba(37,99,235,.25)",whiteSpace:"nowrap"}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo driver
        </button>
      </div>
      {msg&&<div style={{marginBottom:14,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(34,197,94,.18)",background:"rgba(34,197,94,.08)",color:"#86efac",fontSize:13}}>{msg}</div>}
      {adding&&(<div style={{marginBottom:18,border:"1px solid rgba(59,130,246,.18)",background:"linear-gradient(145deg,#0b1220,#070d16)",borderRadius:20,padding:18}}><div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,color:"#f8fafc",marginBottom:14}}>Nuevo driver</div><div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr 1.3fr .8fr",gap:10}}><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre completo" style={inp}/><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="Teléfono" style={inp}/><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Correo login" style={inp}/><select value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})} style={inp}><option>Moto</option><option>Carro</option><option>Furgoneta</option><option>Camión</option></select></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:14}}><button onClick={()=>setAdding(false)} style={{padding:"9px 14px",borderRadius:12,border:"1px solid rgba(148,163,184,.16)",background:"transparent",color:"#94a3b8",cursor:"pointer"}}>Cancelar</button><button onClick={add} disabled={creatingDriverRef.current} style={{padding:"9px 14px",borderRadius:12,border:"none",background:"#2563eb",color:"white",fontWeight:900,cursor:creatingDriverRef.current?"not-allowed":"pointer",opacity:creatingDriverRef.current ? .6 : 1}}>Guardar driver</button></div></div>)}
      {list.length===0 ? <div style={{padding:"50px",textAlign:"center",border:"1px dashed rgba(148,163,184,.16)",borderRadius:22,color:"#64748b"}}>No hay drivers para mostrar.</div> : (<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:14}}>{list.map(m=><DriverProfileCard key={m.id} m={m} route={(routes||{})[m.id]} user={USERS.find(u=>u.driverId===m.id)} onToggle={toggle} onRemove={remove}/>)}</div>)}
    </div>
  );
};


// --- PAGE: SETTINGS -----------------------------------------------------------


const PageSettings = ({ mensajeros, setMensajeros, currentUser, role, rc }) => {
  const [activeTab, setActiveTab] = useState("passwords");
  const [fbUrl, setFbUrl]         = useState(FB_URL);
  const [fbSaved, setFbSaved]     = useState(false);
  const [depot, setDepot]         = useState({ lat: DEPOT.lat, lng: DEPOT.lng, label: DEPOT.label });
  const [depotSaved, setDepotSaved] = useState(false);
  const [passwords, setPasswords]   = useState([]);
  useEffect(() => {
    if (role !== "admin" || !currentUser?.officeId) { setPasswords([]); return; }
    FB.get(`oficinas/${currentUser.officeId}/users`).then(data => {
      const list = Object.values(data || {}).filter(u => u && u.role === "driver");
      setPasswords(list.map(u => ({ id:u.id, name:u.name, email:u.email, driverId:u.driverId, newPwd:"", confirm:"", saved:false, error:"" })));
    });
  }, [role, currentUser?.officeId, mensajeros.length]);
  const [notifSettings, setNotifSettings] = useState({
    onRouteAssigned: true,
    onDelivered: true,
    onProblem: true,
    onDriverOnline: false,
    soundEnabled: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  const tabs = role === "admin" ? [
    { id:"passwords",  label:"Contraseñas" },
    { id:"depot",      label:"Base / DEPOT" },
    { id:"account",    label:"Mi Cuenta" },
  ] : [
    { id:"account", label:"Mi Cuenta" },
  ];

  useEffect(() => {
    if (role !== "admin" || !currentUser?.officeId) return;
    FB.get(`oficinas/${currentUser.officeId}/ubicacionBase`).then(base => {
      if (base && typeof base === "object") {
        const next = { lat: base.lat ?? DEPOT.lat, lng: base.lng ?? DEPOT.lng, label: base.direccion || base.label || DEPOT.label };
        setDepot(next);
        if (!isNaN(parseFloat(next.lat))) DEPOT.lat = parseFloat(next.lat);
        if (!isNaN(parseFloat(next.lng))) DEPOT.lng = parseFloat(next.lng);
        DEPOT.label = next.label;
      }
    });
  }, [role, currentUser?.officeId]);

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
          <MensajeroManager mensajeros={mensajeros} setMensajeros={setMensajeros} currentUser={currentUser}/>
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
                    const updatedUser = { ...(u || {}), id:p.id, name:p.name, email:p.email, role:"driver", driverId:p.driverId, officeId:currentUser.officeId, password:p.newPwd };
                    FB.set(`oficinas/${currentUser.officeId}/users/${p.id}`, updatedUser);
                    FB.set(`users/${p.id}`, updatedUser);
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
              if (currentUser?.officeId) FB.set(`oficinas/${currentUser.officeId}/ubicacionBase`, { lat, lng, direccion: depot.label });
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
                { key:"onDelivered",     label:"Parada visitada",             desc:"Cuando un mensajero marca visitado" },
                { key:"onProblem",       label:"Nota registrada",             desc:"Cuando hay incidencia en una parada" },
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
// - Nota registrada por mensajero

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
    client:"", address:"", priority:"normal",
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
                  <select value={form.office} onChange={e=>set("zone",e.target.value)} style={selectStyle}>
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
                  {DRIVERS.filter(d=>d.online).map(d=><option key={d.id} value={d.name}>{d.name} · {d.office} · {d.today} rutas hoy</option>)}
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
                  ["Oficina",       form.office],
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
      [d.id, d.client, d.driver, d.address, d.office].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(d => ({ type: "delivery", icon: "📦", label: d.id, sub: `${d.client} · ${d.address}`, status: d.status, data: d })),
    ...DRIVERS.filter(d =>
      [d.name, d.office, d.vehicle].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(d => ({ type: "driver", icon: "🚗", label: d.name, sub: `${d.office} · ${d.vehicle.split("·")[0].trim()}`, status: d.status, data: d })),
    ...CLIENTS.filter(c =>
      [c.name, c.office, c.email].some(s => s.toLowerCase().includes(q.toLowerCase()))
    ).map(c => ({ type: "client", icon: "👤", label: c.name, sub: `${c.office} · ${c.email}`, status: c.status, data: c })),
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
            placeholder="Buscar rutas, conductores, clientes, rutas..."
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
    { time:"11:45", label:"Visitado",             detail:"Ana Torres firmó recepción",        done:true,  icon:"✓" },
  ],
  "RD-1016": [
    { time:"12:00", label:"Pedido creado",         detail:"Sistema · prioridad normal",        done:true,  icon:"＋" },
    { time:"12:05", label:"Asignado a conductor",  detail:"Einar Kovač · Moto",                done:true,  icon:"◎" },
    { time:"12:20", label:"En ruta",               detail:"Salida hacia Pl. Central, 28",      done:true,  icon:"→" },
    { time:"12:48", label:"Intento no gestionado",       detail:"Cliente no disponible",             done:true,  icon:"⚠",  warn:true },
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
            <div style={{ fontSize:12,color:"#4b5563" }}>{d.address} · {d.office}</div>
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
            {l:"⚠ Agregar nota",  c:"rgba(245,158,11,0.1)", tc:"#f59e0b", bc:"rgba(245,158,11,0.2)", fn:()=>alert("Nota registrada para "+d.id)},
            {l:"✓ Marcar visitado",   c:"rgba(16,185,129,0.1)", tc:"#10b981",  bc:"rgba(16,185,129,0.2)", fn:()=>alert("Marcado como visitado: "+d.id)},
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

        /* V28 FULL ENTERPRISE — elevar columnas/revisión/ruta sin cambiar lógica */
        .rd-circuit-v28{--glass:rgba(8,19,35,.74);--glass2:rgba(10,24,42,.86);--stroke:rgba(96,165,250,.16);--stroke2:rgba(148,163,184,.10);--blue:#3b82f6;--cyan:#38bdf8;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--text:#eaf2ff;--muted:#7890ad;}
        .rd-circuit-v28 > div:nth-of-type(2){position:relative;z-index:2;background:linear-gradient(135deg,rgba(5,10,18,.72),rgba(7,18,32,.82));}
        .rd-circuit-v28 > div:nth-of-type(2):before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 20%,rgba(59,130,246,.10),transparent 24%),radial-gradient(circle at 88% 82%,rgba(16,185,129,.07),transparent 28%);}
        .rd-circuit-v28 > div:nth-of-type(2) > div{position:relative;z-index:1;}
        .rd-circuit-v28 [style*="width: 320px"], .rd-circuit-v28 [style*="width:320px"]{width:370px!important;background:linear-gradient(180deg,rgba(6,14,26,.98),rgba(4,10,18,.98))!important;border-right:1px solid rgba(96,165,250,.18)!important;box-shadow:18px 0 50px rgba(0,0,0,.25)!important;}
        .rd-circuit-v28 [style*="borderRight: \"1px solid #0d1420\""]{border-right-color:rgba(96,165,250,.18)!important;}
        .rd-circuit-v28 [style*="Configurar ruta"]{letter-spacing:.2px!important;}
        .rd-circuit-v28 select, .rd-circuit-v28 input{box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;}
        .rd-circuit-v28 .enterprise-panel{background:linear-gradient(145deg,rgba(15,30,52,.86),rgba(5,12,22,.92))!important;border:1px solid rgba(96,165,250,.18)!important;border-radius:20px!important;box-shadow:0 18px 50px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.045)!important;}
        .rd-circuit-v28 .enterprise-table-shell{border-radius:24px!important;border:1px solid rgba(96,165,250,.16)!important;background:linear-gradient(180deg,rgba(8,18,34,.78),rgba(3,8,15,.86))!important;box-shadow:0 28px 80px rgba(0,0,0,.36), inset 0 1px 0 rgba(255,255,255,.045)!important;overflow:hidden!important;}
        .rd-circuit-v28 th{height:54px!important;vertical-align:middle!important;text-transform:uppercase!important;}
        .rd-circuit-v28 td{height:48px!important;vertical-align:middle!important;}
        .rd-circuit-v28 tbody tr{transition:transform .14s ease, filter .14s ease!important;}
        .rd-circuit-v28 tbody tr:hover{filter:brightness(1.18)!important;}
        .rd-circuit-v28 .route-card-pro{background:linear-gradient(145deg,rgba(10,22,40,.94),rgba(5,12,22,.98))!important;border:1px solid rgba(96,165,250,.17)!important;border-radius:22px!important;box-shadow:0 18px 44px rgba(0,0,0,.33), inset 0 1px 0 rgba(255,255,255,.045)!important;}
        .rd-circuit-v28 .route-card-pro:hover{border-color:rgba(59,130,246,.35)!important;transform:translateY(-1px)!important;}
        .rd-circuit-v28 .rd-map-chrome{background:linear-gradient(145deg,rgba(5,10,18,.88),rgba(10,22,40,.78))!important;border:1px solid rgba(96,165,250,.18)!important;border-radius:18px!important;box-shadow:0 18px 52px rgba(0,0,0,.34)!important;backdrop-filter:blur(18px)!important;}
        .rd-circuit-v28 .rd-sticky-action{box-shadow:0 16px 42px rgba(37,99,235,.28)!important;}
        .rd-circuit-v28 .rd-chip-pro{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.16);color:#93c5fd;font-size:10px;font-family:'Syne',sans-serif;font-weight:900;letter-spacing:.5px;}
        /* V37 Route side panel UX upgrade */
        .rd-circuit-v28 .route-side-pro{width:min(430px,42vw)!important;background:linear-gradient(180deg,rgba(7,17,31,.98),rgba(4,10,18,.99))!important;border-right:1px solid rgba(96,165,250,.20)!important;box-shadow:22px 0 60px rgba(0,0,0,.34)!important;}
        .rd-circuit-v28 .route-action-pro{min-height:44px!important;border-radius:14px!important;font-size:12px!important;letter-spacing:.2px!important;}
        .rd-circuit-v28 .route-search-pro{min-height:46px!important;border-radius:16px!important;font-size:13px!important;color:#eaf2ff!important;background:linear-gradient(180deg,#0b1728,#07111f)!important;border:1px solid rgba(96,165,250,.24)!important;}
        .rd-circuit-v28 .route-search-pro::placeholder{color:#6f88a6!important;opacity:1!important;}
        .rd-circuit-v28 .route-card-v37{margin:10px 12px!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(10,23,42,.96),rgba(5,12,22,.98))!important;border:1px solid rgba(96,165,250,.18)!important;border-left:4px solid rgba(59,130,246,.45)!important;box-shadow:0 14px 34px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.035)!important;}
        .rd-circuit-v28 .route-card-v37:hover{border-color:rgba(96,165,250,.38)!important;transform:translateY(-1px)!important;}
        .rd-circuit-v28 .route-client-v37{font-size:15px!important;line-height:1.25!important;color:#f8fafc!important;font-weight:800!important;white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;}
        .rd-circuit-v28 .route-address-v37{font-size:12.5px!important;line-height:1.45!important;color:#9fb2c8!important;white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;}
        .rd-circuit-v28 .route-phone-v37{font-size:12.5px!important;color:#60a5fa!important;font-weight:700!important;}
        .rd-circuit-v28 .route-track-v37{background:rgba(59,130,246,.08)!important;border-color:rgba(96,165,250,.22)!important;border-radius:8px!important;padding:4px 10px!important;}
        .rd-circuit-v28 .route-track-v37 span{font-size:11.5px!important;color:#93c5fd!important;font-weight:700!important;}

        @keyframes rdPulseLine{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes rdGlassIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
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
    return (r?.stops||[]).map((s,i)=>({...s, navStatus: s.navStatus || (i===0 ? "active" : "pending")}));
  });
  const [tab,        setTab]        = useState("route"); // "route" | "chat" | "pending" | "history"
  const [chatMsg,    setChatMsg]    = useState("");
  const [chatLog,    setChatLog]    = useState(() => (window.__rdChatStore||{})[myKey]||[]);
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
  const [mapPinPopup, setMapPinPopup] = useState(null); // stop shown in map popup
  const [driverMapTheme, setDriverMapTheme] = useState(() => {
    try { return localStorage.getItem(`rdDriverMapTheme_${myKey}`) || "dark"; } catch { return "dark"; }
  });

  const driverMapStyles = {
    dark: [
      {elementType:"geometry",stylers:[{color:"#07101b"}]},
      {elementType:"labels.text.fill",stylers:[{color:"#64748b"}]},
      {elementType:"labels.text.stroke",stylers:[{color:"#07101b"}]},
      {featureType:"road",elementType:"geometry",stylers:[{color:"#122033"}]},
      {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#172b45"}]},
      {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#1d3a5f"}]},
      {featureType:"water",elementType:"geometry",stylers:[{color:"#03101b"}]},
      {featureType:"landscape",elementType:"geometry",stylers:[{color:"#08111f"}]},
      {featureType:"poi",stylers:[{visibility:"off"}]},
      {featureType:"transit",stylers:[{visibility:"off"}]},
    ],
    light: [
      {featureType:"poi",stylers:[{visibility:"off"}]},
      {featureType:"transit",stylers:[{visibility:"off"}]},
      {featureType:"road",elementType:"geometry",stylers:[{color:"#ffffff"}]},
      {featureType:"road.arterial",elementType:"geometry",stylers:[{color:"#f1f5f9"}]},
      {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#e2e8f0"}]},
      {featureType:"water",elementType:"geometry",stylers:[{color:"#cdeffc"}]},
      {featureType:"landscape",elementType:"geometry",stylers:[{color:"#f8fafc"}]},
      {featureType:"administrative",elementType:"geometry.stroke",stylers:[{color:"#cbd5e1"}]},
      {elementType:"labels.text.fill",stylers:[{color:"#334155"}]},
      {elementType:"labels.text.stroke",stylers:[{color:"#ffffff"}]},
    ],
  };

  const toggleDriverMapTheme = () => {
    setDriverMapTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(`rdDriverMapTheme_${myKey}`, next); } catch {}
      return next;
    });
  };

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
  // Cola eliminada: una sola ruta activa por mensajero.
  // Historial de rutas completadas (guardado localmente)
  const [routeHistory, setRouteHistory] = useState(() => {
    // Limpieza producción: elimina historiales viejos del mensajero una sola vez.
    try {
      const cleanKey = `rdHistoryCleanedNavOnly_${myKey}`;
      if (!localStorage.getItem(cleanKey)) {
        localStorage.removeItem(`rdHistory_${myKey}`);
        localStorage.setItem(cleanKey, "1");
        return [];
      }
      return JSON.parse(localStorage.getItem(`rdHistory_${myKey}`) || "[]");
    } catch{ return []; }
  });
  const [histSelRoute, setHistSelRoute] = useState(null);
  const completedBannerTimer = useRef(null);
  const mapRef   = useRef(null);
  const gMapRef  = useRef(null);
  const markersRef = useRef([]);
  const stopMarkersRef = useRef({}); // markers persistentes: no recrear en zoom/polling
  const routeLinesRef = useRef({ glow:null, core:null });
  const pinIconCacheRef = useRef({}); // cache de iconos: evita reconstruir SVGs y parpadeo en zoom
  const mapUserInteractingRef = useRef(false);
  const routeFitKeyRef = useRef(null); // evita re-centrar mapa mientras el mensajero hace zoom
  const chatEndRef = useRef(null);
  const lastSentAt = useRef(myRoute?.sentAt || null);
  const routeStopsSigRef = useRef(""); // evita refrescar/recontraer el mapa con polling de la misma ruta
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
        maximumAge: 1000,       // GPS más fresco para admin en tiempo real
        timeout: 10000,          // timeout más corto para reaccionar rápido
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

  // Heartbeat GPS: mantiene visible al mensajero aunque esté detenido.
  useEffect(() => {
    if (!myLocation || locationStatus !== "active") return;
    const hb = setInterval(() => {
      LS.setLocation(myKey, { ...myLocation, ts: Date.now(), online: true, routeName: myRoute?.routeName || null });
    }, 10000);
    return () => clearInterval(hb);
  }, [myLocation, locationStatus, myKey, myRoute?.routeName]);

  // Actualizar el marker del mensajero en el mapa cuando cambia su posición
  useEffect(() => {
    if (!myLocation || !gMapRef.current || !window.google) return;
    const { lat, lng, accuracy } = myLocation;
    const pos = { lat, lng };

// En producción NO usamos círculo de precisión en el mapa del mensajero.
// Ese círculo se escala con el zoom y visualmente parece que los pines crecen/encogen.
if (locationAccuracyRef.current) {
  try { locationAccuracyRef.current.setMap(null); } catch(e) {}
  locationAccuracyRef.current = null;
}

// Icono fijo de ubicación del mensajero: sin filtros, sin pulso, sin animación.
const motorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <circle cx="17" cy="17" r="15" fill="#2563eb" stroke="white" stroke-width="2"/>
  <text x="17" y="22" text-anchor="middle" font-size="15" font-weight="900" fill="white" font-family="Arial, sans-serif">🏍</text>
</svg>`;

    if (locationMarkerRef.current) {
      locationMarkerRef.current.setPosition(pos);
    } else {
      locationMarkerRef.current = new window.google.maps.Marker({
        map: gMapRef.current,
        position: pos,
        zIndex: 9999,
        title: driver.name || "Mi ubicación",
        optimized: true,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(motorSvg),
          scaledSize: new window.google.maps.Size(34, 34),
          anchor: new window.google.maps.Point(17, 17),
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
    const LS_KEY      = `rdRoute_${myKey}`;
    const LS_SEEN_KEY = `rdSeen_${myKey}`;

    const saveSeenIds = () => {
      try { localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...seenRouteIds.current])); } catch(e) {}
    };

    const addToHistoryOnce = (route) => {
      if (!route?.stops?.length) return;
      const completedRoute = {
        ...route,
        completedAt: route.completedAt || new Date().toISOString(),
        histId: route.histId || `H-${Date.now()}`,
      };

      setRouteHistory(prev => {
        const exists = prev.some(r =>
          (completedRoute.routeId && r.routeId === completedRoute.routeId) ||
          (completedRoute.sentAt && r.sentAt === completedRoute.sentAt)
        );
        const next = exists ? prev : [completedRoute, ...prev].slice(0, 50);
        try { localStorage.setItem(`rdHistory_${myKey}`, JSON.stringify(next)); } catch(e) {}
        return next;
      });

      if (completedRoute.routeId) FB.set(RD.path(`routeHistory/${completedRoute.routeId}`), completedRoute);
    };

    const clearActiveRouteLocal = (route) => {
      const routeKey = route?.routeId || route?.sentAt;
      if (routeKey) seenRouteIds.current.add(routeKey);
      if (route?.sentAt) seenRouteIds.current.add(route.sentAt);
      saveSeenIds();

      lastSentAt.current = null;
      routeFitKeyRef.current = null;
      setStops([]);
      setSelStop(null);
      setTab("route");

      if (window.__rdRouteStore) delete window.__rdRouteStore[myKey];
      delete _memStore.routes[myKey];
      onUpdateRoute(myKey, null);

      try { localStorage.removeItem(LS_KEY); } catch(e) {}
      FB.set(RD.path(`routes/${myKey}`), null);
    };

    const activateRoute = (nr) => {
      if (!nr?.stops || writingRef.current) return;

      const normalizedStops = Array.isArray(nr.stops) ? nr.stops : Object.values(nr.stops);
      const route = {
        ...nr,
        stops: normalizedStops.map((s, i) => ({
          ...s,
          stopNum: s.stopNum || i + 1,
          navStatus: s.navStatus || (i === 0 ? "active" : "pending"),
        })),
      };

      const routeKey = route.routeId || route.sentAt;
      if (!routeKey) return;

      // Si ya fue completada anteriormente, no resucitarla.
      if (seenRouteIds.current.has(routeKey) || (route.sentAt && seenRouteIds.current.has(route.sentAt))) return;

      const allDone = route.stops.length > 0 && route.stops.every(
        s => s.navStatus === "visited"
      );

      if (allDone) {
        addToHistoryOnce(route);
        clearActiveRouteLocal(route);
        return;
      }

      // SIN COLA: cualquier ruta nueva que llegue reemplaza directamente la ruta activa.
      const previousSentAt = lastSentAt.current;
      lastSentAt.current = route.sentAt || routeKey;
      const isNewRoute = previousSentAt !== lastSentAt.current;
      if (isNewRoute) routeFitKeyRef.current = null;

      const nextSig = route.stops.map(s => `${s.stopNum||""}:${s.lat||""}:${s.lng||""}:${s.navStatus||""}`).join("|");
      const sameStops = routeStopsSigRef.current === nextSig;

      if (!window.__rdRouteStore) window.__rdRouteStore = {};
      window.__rdRouteStore[myKey] = route;
      _memStore.routes[myKey] = route;
      onUpdateRoute(myKey, route);

      // No mandar al mensajero de vuelta a la lista cuando está usando el mapa.
      // Solo abrir lista automáticamente cuando llega una ruta NUEVA.
      if (!sameStops) {
        routeStopsSigRef.current = nextSig;
        setStops(route.stops);
      }
      if (isNewRoute) setTab("route");
      try { localStorage.setItem(LS_KEY, JSON.stringify(route)); } catch(e) {}
    };

    // 1) Cargar rutas ya completadas/vistas.
    try {
      const seen = JSON.parse(localStorage.getItem(LS_SEEN_KEY) || "[]");
      seen.forEach(id => seenRouteIds.current.add(id));
    } catch(e) {}

    // 2) Cargar ruta local si existe y todavía no está completada.
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved?.stops && saved?.sentAt) {
        const savedStops = saved.stops.map((s, i) => ({
          ...s,
          stopNum: s.stopNum || i + 1,
          navStatus: s.navStatus || (i === 0 ? "active" : "pending"),
        }));
        const savedRoute = { ...saved, stops: savedStops };
        const savedAllDone = savedStops.length > 0 && savedStops.every(
          s => s.navStatus === "visited"
        );
        if (savedAllDone) {
          addToHistoryOnce(savedRoute);
          clearActiveRouteLocal(savedRoute);
        } else {
          lastSentAt.current = savedRoute.sentAt;
          _memStore.routes[myKey] = savedRoute;
          if (!window.__rdRouteStore) window.__rdRouteStore = {};
          window.__rdRouteStore[myKey] = savedRoute;
          setStops(savedStops);
        }
      }
    } catch(e) {}

    const applyChat = (msgs) => {
      if (Array.isArray(msgs)) setChatLog([...msgs]);
    };

    FB.get(RD.path(`routes/${myKey}`)).then(activateRoute);
    FB.get(`chats/${myKey}`).then(applyChat);

    const unsubRoute = FB.listen(RD.path(`routes/${myKey}`), activateRoute);
    const unsubChat  = FB.listen(`chats/${myKey}`, applyChat);

    window.__rdSetRoute = (driverId, route) => {
      if (driverId === myKey) activateRoute(route);
    };
    window.__rdSetPending = () => {}; // cola eliminada

    // Notificaciones del admin → mensajero.
    let lastNotifKeys = new Set();
    const handleNotifs = (data) => {
      if (!data) return;
      Object.entries(data).forEach(([k, notif]) => {
        if (lastNotifKeys.has(k) || notif.read) return;
        lastNotifKeys.add(k);
        if (notif.type === "route_assigned") {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(notif.title, { body: notif.body, icon: RD_BRAND_ICON });
          }
          if (typeof window.__rdShowDriverNotif === "function") {
            window.__rdShowDriverNotif(notif);
          }
          FB.set(`driverNotifs/${myKey}/${k}`, { ...notif, read: true });
        }
      });
    };

    const unsubDriverNotifs = FB.listen(`driverNotifs/${myKey}`, handleNotifs);
    const pollInterval = setInterval(() => {
      FB.get(RD.path(`routes/${myKey}`)).then(activateRoute);
      FB.get(`driverNotifs/${myKey}`).then(handleNotifs);
    }, 8000);

    FB.get(`driverNotifs/${myKey}`).then(handleNotifs);

    return () => {
      unsubRoute();
      unsubChat();
      unsubDriverNotifs();
      clearInterval(pollInterval);
    };
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
        gestureHandling: "greedy",
        clickableIcons: false,
        isFractionalZoomEnabled: false,
        tilt: 0,
        heading: 0,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        styles: driverMapStyles[driverMapTheme] || driverMapStyles.dark,
      });
      gMapRef.current.addListener("dragstart", () => { mapUserInteractingRef.current = true; });
      gMapRef.current.addListener("zoom_changed", () => { mapUserInteractingRef.current = true; });
      gMapRef.current.addListener("idle", () => {
        window.setTimeout(() => { mapUserInteractingRef.current = false; }, 1200);
      });
    });
  }, []);

  useEffect(() => {
    if (!gMapRef.current) return;
    gMapRef.current.setOptions({ styles: driverMapStyles[driverMapTheme] || driverMapStyles.dark });
  }, [driverMapTheme]);

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
    if (!gMapRef.current || !window.google) return;
    const validStops = stops.filter(s => s.lat && s.lng);

    // Sin paradas: limpiar todo una sola vez.
    if (!validStops.length) {
      Object.values(stopMarkersRef.current || {}).forEach((m) => { try { m.setMap(null); } catch(e){} });
      stopMarkersRef.current = {};
      Object.values(routeLinesRef.current || {}).forEach((l) => { try { l?.setMap(null); } catch(e){} });
      routeLinesRef.current = { glow:null, core:null };
      markersRef.current = [];
      routeFitKeyRef.current = null;
      return;
    }

    const ordered = validStops.filter(s=>s.stopNum).sort((a,b)=>a.stopNum-b.stopNum);
    const path = ordered.map(s=>({lat:s.lat,lng:s.lng}));

    // Líneas persistentes: actualizar path, NO destruir/recrear en cada polling.
    if (ordered.length > 1) {
      if (!routeLinesRef.current.glow) {
        routeLinesRef.current.glow = new window.google.maps.Polyline({
          map: gMapRef.current,
          path,
          strokeColor: "#2563eb",
          strokeOpacity: 0,
          strokeWeight: 0,
          zIndex: 1,
          clickable: false,
        });
      } else {
        routeLinesRef.current.glow.setPath(path);
      }
      if (!routeLinesRef.current.core) {
        routeLinesRef.current.core = new window.google.maps.Polyline({
          map: gMapRef.current,
          path,
          strokeColor: "#2563eb",
          strokeOpacity: 0.80,
          strokeWeight: 3,
          zIndex: 2,
          clickable: false,
        });
      } else {
        routeLinesRef.current.core.setPath(path);
      }
    }

    const makeFixedPinIcon = (stop) => {
      const isDone = stop.navStatus === "visited";
      const label = String(stop.stopNum || "?");
      const cacheKey = `${isDone ? "done" : "pending"}:${label}`;
      if (pinIconCacheRef.current[cacheKey]) return pinIconCacheRef.current[cacheKey];

      const color = isDone ? "#22c55e" : "#2563eb";
      const dark  = isDone ? "#16a34a" : "#1d4ed8";
      const fs = label.length > 2 ? 9 : 11;
      // MISMO CONCEPTO DEL MAPA ADMIN: pin azul numerado, sólido, tamaño fijo.
      // Sin animación, sin pulso, sin CSS filter, sin círculo de precisión y sin dependencia del zoom.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="46" viewBox="0 0 40 46">
        <path d="M20 44s14-12.4 14-24A14 14 0 0 0 6 20c0 11.6 14 24 14 24z" fill="${color}" stroke="rgba(255,255,255,.96)" stroke-width="1.4"/>
        <circle cx="20" cy="20" r="10.4" fill="${dark}" opacity=".92"/>
        <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
        <text x="20" y="24" text-anchor="middle" font-size="${fs}" font-weight="900" fill="white" font-family="Arial, sans-serif">${label}</text>
      </svg>`;
      const icon = {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new window.google.maps.Size(40, 46),
        anchor: new window.google.maps.Point(20, 44),
      };
      pinIconCacheRef.current[cacheKey] = icon;
      return icon;
    };

    const bounds = new window.google.maps.LatLngBounds();
    const seen = new Set();

    validStops.forEach((stop, idx) => {
      const key = String(stop.id || stop.tracking || stop.stopNum || idx);
      seen.add(key);
      const pos = { lat: stop.lat, lng: stop.lng };
      const statusKey = `${stop.navStatus || "pending"}:${stop.stopNum || idx}`;
      let marker = stopMarkersRef.current[key];

      if (!marker) {
        marker = new window.google.maps.Marker({
          map: gMapRef.current,
          position: pos,
          title: `#${stop.stopNum} ${stop.client || ""}`,
          zIndex: stop.navStatus === "visited" ? 5 : 20,
          optimized: true,
          clickable: true,
          icon: makeFixedPinIcon(stop),
        });
        marker.__rdStatusKey = statusKey;
        marker.addListener("click", () => {
          setSelStop(stop);
          setMapPinPopup(stop);
        });
        stopMarkersRef.current[key] = marker;
      } else {
        const current = marker.getPosition?.();
        if (!current || Math.abs(current.lat() - stop.lat) > 0.000001 || Math.abs(current.lng() - stop.lng) > 0.000001) {
          marker.setPosition(pos);
        }
        marker.setTitle(`#${stop.stopNum} ${stop.client || ""}`);
        marker.setZIndex(stop.navStatus === "visited" ? 5 : 20);
        if (marker.__rdStatusKey !== statusKey) {
          marker.setIcon(makeFixedPinIcon(stop));
          marker.__rdStatusKey = statusKey;
        }
      }
      bounds.extend(pos);
    });

    // Quitar markers que ya no pertenecen a la ruta, sin tocar los existentes.
    Object.keys(stopMarkersRef.current).forEach((key) => {
      if (!seen.has(key)) {
        try { stopMarkersRef.current[key].setMap(null); } catch(e) {}
        delete stopMarkersRef.current[key];
      }
    });

    markersRef.current = [
      ...Object.values(stopMarkersRef.current),
      routeLinesRef.current.glow,
      routeLinesRef.current.core,
    ].filter(Boolean);

    const fitKey = `${lastSentAt.current || ""}|${validStops.length}|${validStops.map(s => `${s.lat},${s.lng}`).join("|")}`;
    if (routeFitKeyRef.current !== fitKey && !mapUserInteractingRef.current) {
      gMapRef.current.fitBounds(bounds, { top:24, right:24, bottom:24, left:24 });
      routeFitKeyRef.current = fitKey;
    }
  }, [stops, mapReady]);

  // -- Centrar en parada seleccionada --------------------------------------------
  useEffect(() => {
    if (selStop?.lat && gMapRef.current) {
      gMapRef.current.panTo({ lat: selStop.lat, lng: selStop.lng });
      gMapRef.current.setZoom(16);
    }
  }, [selStop]);

  // -- Helpers -------------------------------------------------------------------
  const visited   = stops.filter(s=>s.navStatus==="visited");
  const problems    = stops.filter(s=>false);
  const pending     = stops.filter(s=>s.navStatus!=="visited");
  const currentStop = stops.find(s=>s.navStatus==="active") || stops.find(s=>s.navStatus!=="visited");
  const pct         = stops.length>0 ? Math.round((visited.length/stops.length)*100) : 0;

  const filteredStops = stops.filter(s => {
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

    const allDone = updatedStops.length > 0 && updatedStops.every(
      s => s.navStatus === "visited"
    );

    // 1) Actualizar memoria local INMEDIATAMENTE.
    if (!window.__rdRouteStore) window.__rdRouteStore = {};
    window.__rdRouteStore[myKey] = updated;
    _memStore.routes[myKey] = updated;
    onUpdateRoute(myKey, updated);

    // 2) Guardar progreso local y en Firebase mientras la ruta siga activa.
    try { localStorage.setItem(`rdRoute_${myKey}`, JSON.stringify(updated)); } catch(e) {}

    writingRef.current = true;

    if (allDone) {
      const histEntry = { ...updated, completedAt: new Date().toISOString(), histId: `H-${Date.now()}` };

      setRouteHistory(prev => {
        const exists = prev.some(r =>
          (histEntry.routeId && r.routeId === histEntry.routeId) ||
          (histEntry.sentAt && r.sentAt === histEntry.sentAt)
        );
        const next = exists ? prev : [histEntry, ...prev].slice(0, 50);
        try { localStorage.setItem(`rdHistory_${myKey}`, JSON.stringify(next)); } catch(e){}
        return next;
      });

      if (histEntry.routeId) FB.set(RD.path(`routeHistory/${histEntry.routeId}`), histEntry);

      // Marcar esta ruta como vista/completada para que no reviva.
      const routeKey = histEntry.routeId || histEntry.sentAt;
      if (routeKey) seenRouteIds.current.add(routeKey);
      if (histEntry.sentAt) seenRouteIds.current.add(histEntry.sentAt);
      try { localStorage.setItem(`rdSeen_${myKey}`, JSON.stringify([...seenRouteIds.current])); } catch(e) {}

      // SIN COLA: al completarse todas las paradas, borrar ruta activa y dejar pantalla esperando nueva ruta.
      setStops([]);
      setSelStop(null);
      setShowCompletedBanner(true);
      setTab("route");

      if (window.__rdRouteStore) delete window.__rdRouteStore[myKey];
      delete _memStore.routes[myKey];
      onUpdateRoute(myKey, null);
      try { localStorage.removeItem(`rdRoute_${myKey}`); } catch(e) {}

      Promise.all([
        FB.set(RD.path(`routes/${myKey}`), null),
        histEntry.routeId ? FB.set(RD.path(`routeHistory/${histEntry.routeId}`), histEntry) : Promise.resolve(),
      ]).finally(() => {
        writingRef.current = false;
      });

      return;
    }

    Promise.all([
      FB.set(RD.path(`routes/${myKey}`), updated),
      updated.routeId ? FB.set(RD.path(`routeHistory/${updated.routeId}`), updated) : Promise.resolve(),
    ]).finally(() => {
      writingRef.current = false;
    });
  };

  const markStopVisited = (stop) => {
    if (!stop || stop.navStatus === "visited") return;
    const now = new Date().toLocaleTimeString("es-DO", { hour:"2-digit", minute:"2-digit" });
    const updatedStops = stops.map(s => {
      const same = (s.id && stop.id && s.id === stop.id) || (s.stopNum && stop.stopNum && s.stopNum === stop.stopNum);
      if (!same) return s;
      return { ...s, navStatus:"visited", visitedAt: s.visitedAt || now };
    }).map((s, i, arr) => {
      if (s.navStatus === "visited") return s;
      const firstPendingIndex = arr.findIndex(x => x.navStatus !== "visited");
      return i === firstPendingIndex ? { ...s, navStatus:"active" } : { ...s, navStatus:s.navStatus || "pending" };
    });
    setStops(updatedStops);
    const nextSelected = updatedStops.find(s => (s.id && stop.id && s.id === stop.id) || (s.stopNum && stop.stopNum && s.stopNum === stop.stopNum));
    setSelStop(nextSelected || null);
    setMapPinPopup(null);
    pushUpdate(updatedStops);
  };

  const finalizeCurrentRoute = () => {
    if (!myRoute || !stops.length) return;
    const now = new Date().toLocaleTimeString("es-DO", { hour:"2-digit", minute:"2-digit" });
    const updatedStops = stops.map(s => ({ ...s, navStatus:"visited", visitedAt: s.visitedAt || now }));
    setStops(updatedStops);
    setSelStop(null);
    setMapPinPopup(null);
    pushUpdate(updatedStops);
  };

  const addChatMsg = (text) => {
    const msg = { from:"driver", text, time:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}) };
    if (!window.__rdChatStore) window.__rdChatStore = {};
    const nl = [...(window.__rdChatStore[myKey]||[]), msg].slice(-80);
    window.__rdChatStore[myKey] = nl; LS.setChat(myKey, nl);
    setChatLog(nl);
  };



  const sendChat = () => { if (!chatMsg.trim()) return; addChatMsg(chatMsg.trim()); setChatMsg(""); };

  // -- Auto-dismiss "Ruta completada" banner + sugerir siguiente pendiente ------
  useEffect(() => {
    const allDone = stops.length > 0 && stops.every(s => s.navStatus === "visited");
    if (allDone) {
      setShowCompletedBanner(true);
      clearTimeout(completedBannerTimer.current);
      const delay = 6000;
      completedBannerTimer.current = setTimeout(() => setShowCompletedBanner(false), delay);
    } else {
      setShowCompletedBanner(false);
    }
    return () => clearTimeout(completedBannerTimer.current);
  }, [stops]);


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
      style={{ position:"fixed",inset:0,background:"linear-gradient(180deg,#050914 0%,#07111f 48%,#050914 100%)",display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif",color:"#f1f5f9",overflow:"hidden" }}
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
        .rd-driver-shell{background:linear-gradient(180deg,#050914,#07111f)!important}
        .rd-glass{background:rgba(8,16,30,.86)!important;border:1px solid rgba(148,163,184,.12)!important;box-shadow:0 16px 45px rgba(0,0,0,.34)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
        .rd-soft-card{background:linear-gradient(145deg,rgba(15,30,55,.92),rgba(8,16,30,.95))!important;border:1px solid rgba(96,165,250,.16)!important;box-shadow:0 12px 34px rgba(2,6,23,.4)!important}
      `}</style>

      {/* ══ HEADER PREMIUM ══ */}
      <div style={{ flexShrink:0, position:"relative", background:"linear-gradient(180deg,#08111f 0%,#050914 100%)", borderBottom:"1px solid rgba(96,165,250,0.14)", height:78, display:"flex", alignItems:"center", paddingLeft:14, paddingRight:14, gap:12, zIndex:100, overflow:"visible", boxShadow:"0 10px 30px rgba(0,0,0,.28)" }}>
        <div style={{ position:"absolute", top:-30, left:-20, width:120, height:80, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(59,130,246,0.18) 0%,transparent 70%)", pointerEvents:"none" }}/>

        {/* Menu button */}
        <button onClick={()=>setMenuOpen(o=>!o)} className="rd-btn"
          style={{ width:46, height:46, borderRadius:15, flexShrink:0, cursor:"pointer", border:"none", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
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
            width:48, height:48, borderRadius:16, overflow:"hidden", cursor:"pointer",
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
        {stops.length > 0 && tab === "route" && (
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
          style={{ width:46, height:46, borderRadius:15, border:`1px solid ${tab==="mapa"?"rgba(59,130,246,0.48)":"rgba(255,255,255,0.09)"}`, background:tab==="mapa"?"linear-gradient(135deg,rgba(37,99,235,.34),rgba(59,130,246,.18))":"rgba(255,255,255,0.045)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, transition:"all .15s", boxShadow:tab==="mapa"?"0 8px 24px rgba(37,99,235,.22)":"none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tab==="mapa"?"#60a5fa":"rgba(255,255,255,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11Z"/>
            <circle cx="12" cy="10" r="2.4"/>
          </svg>
        </button>
      </div>

      {/* ══ DRAWER RESTAURADO ══ */}
      {menuOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:9000, pointerEvents:"auto" }}>
          <div onClick={()=>setMenuOpen(false)} style={{ position:"absolute", inset:0, background:"rgba(2,6,23,.62)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)" }}/>
          <aside style={{ position:"absolute", top:0, left:0, bottom:0, width:"min(318px,86vw)", background:"linear-gradient(180deg,#07111f,#040814)", borderRight:"1px solid rgba(96,165,250,.18)", boxShadow:"28px 0 80px rgba(0,0,0,.62)", padding:"18px 14px", animation:"slideLeft .22s ease", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 2px 10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <div style={{ width:42, height:42, borderRadius:15, background:"linear-gradient(135deg,#1d4ed8,#38bdf8)", display:"grid", placeItems:"center", color:"white", fontWeight:950, boxShadow:"0 12px 32px rgba(37,99,235,.28)" }}>{(driver.avatar||(driver.name||"RD").slice(0,2)).toUpperCase()}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, color:"#f8fafc", fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{driver.name||"Mensajero"}</div>
                  <div style={{ fontSize:10.5, color:"rgba(148,163,184,.62)", marginTop:2 }}>Panel de mensajero</div>
                </div>
              </div>
              <button onClick={()=>setMenuOpen(false)} className="rd-btn" style={{ width:34, height:34, borderRadius:12, border:"1px solid rgba(148,163,184,.12)", background:"rgba(255,255,255,.045)", color:"rgba(226,232,240,.72)", cursor:"pointer", display:"grid", placeItems:"center" }}>✕</button>
            </div>

            {[
              ["route","Ruta","M8 6h8M8 12h8M8 18h5"],
              ["mapa","Mapa","M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11Z"],
              ["history","Historial","M8 7h8M8 12h8M8 17h5"],
            ].map(([id,label,path]) => {
              const active = tab === id;
              return (
                <button key={id} onClick={()=>{ setTab(id); setMenuOpen(false); }} className="rd-menu-item" style={{ width:"100%", border:"1px solid rgba(148,163,184,.10)", background:active?"linear-gradient(135deg,rgba(37,99,235,.22),rgba(14,165,233,.10))":"rgba(255,255,255,.035)", color:active?"#dbeafe":"rgba(226,232,240,.72)", borderRadius:16, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontWeight:850, fontSize:13 }}>
                  <span style={{ width:34, height:34, borderRadius:12, display:"grid", placeItems:"center", background:active?"rgba(59,130,246,.18)":"rgba(255,255,255,.045)", color:active?"#93c5fd":"rgba(226,232,240,.48)", flexShrink:0 }}>
                    {id === "mapa" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/><circle cx="12" cy="10" r="2.4"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d={path}/></svg>
                    )}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}

            <div style={{ marginTop:"auto", paddingTop:12, borderTop:"1px solid rgba(148,163,184,.10)" }}>
              <button onClick={()=>{ setMenuOpen(false); setLogoutConf(true); }} className="rd-btn" style={{ width:"100%", border:"1px solid rgba(239,68,68,.18)", background:"rgba(239,68,68,.08)", color:"#fca5a5", borderRadius:16, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontWeight:850, fontSize:13 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg>
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ══ DRIVER COMMAND STRIP — solo en Rutas ══ */}
      <div style={{ flexShrink:0, padding: tab === "route" ? "10px 12px" : 0, height: tab === "route" ? "auto" : 0, background:"linear-gradient(180deg,rgba(5,9,20,.98),rgba(7,17,31,.94))", borderBottom: tab === "route" ? "1px solid rgba(96,165,250,.10)" : "none", display: tab === "route" ? "grid" : "none", gridTemplateColumns:stops.length?"1.4fr .8fr .8fr":"1fr", gap:8 }}>
        {stops.length > 0 ? (
          <>
            <div style={{ borderRadius:16, padding:"10px 12px", background:"linear-gradient(135deg,rgba(37,99,235,.18),rgba(8,16,30,.88))", border:"1px solid rgba(96,165,250,.18)", minWidth:0 }}>
              <div style={{ fontSize:9, color:"rgba(147,197,253,.72)", fontWeight:900, letterSpacing:"1.4px", textTransform:"uppercase", marginBottom:4 }}>Ruta activa</div>
              <div style={{ fontSize:14, color:"#f8fafc", fontWeight:900, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{myRoute?.routeName || "Ruta del día"}</div>
            </div>
            <div style={{ borderRadius:16, padding:"10px 12px", background:"rgba(15,23,42,.74)", border:"1px solid rgba(148,163,184,.10)", textAlign:"center" }}>
              <div style={{ fontSize:18, color:"#60a5fa", fontWeight:1000, lineHeight:1 }}>{pct}%</div>
              <div style={{ fontSize:9, color:"rgba(148,163,184,.62)", fontWeight:800, letterSpacing:".8px", marginTop:3 }}>PROGRESO</div>
            </div>
            <div style={{ borderRadius:16, padding:"10px 12px", background:"rgba(15,23,42,.74)", border:"1px solid rgba(148,163,184,.10)", textAlign:"center" }}>
              <div style={{ fontSize:18, color:locationStatus==="active"?"#22c55e":"#f59e0b", fontWeight:1000, lineHeight:1 }}>{pending.length}</div>
              <div style={{ fontSize:9, color:"rgba(148,163,184,.62)", fontWeight:800, letterSpacing:".8px", marginTop:3 }}>PENDIENTES</div>
            </div>
          </>
        ) : (
          <div style={{ borderRadius:16, padding:"12px 14px", background:"rgba(15,23,42,.74)", border:"1px solid rgba(148,163,184,.10)", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:9, height:9, borderRadius:"50%", background:locationStatus==="active"?"#22c55e":"#64748b", boxShadow:locationStatus==="active"?"0 0 12px #22c55e70":"none" }}/>
            <div style={{ fontSize:13, color:"rgba(226,232,240,.82)", fontWeight:800 }}>Esperando asignación de ruta</div>
          </div>
        )}
      </div>

      {/* ══ MAP SECTION — solo en tab mapa ══ */}
      <div style={{ position:"relative", flex:1, overflow:"hidden", background:"#060c14", display: tab === "mapa" ? "flex" : "none", flexDirection:"column" }}>
        <div ref={mapRef} style={{ position:"absolute", inset:0, touchAction:"manipulation", transform:"translateZ(0)", backfaceVisibility:"hidden" }}/>

        {/* Controles suaves: no molestan el mapa */}
        <div style={{ position:"absolute", top:12, right:12, zIndex:180, display:"flex", gap:8 }}>
          <button onClick={toggleDriverMapTheme} className="rd-btn" title="Cambiar tema del mapa"
            style={{ height:38, padding:"0 12px", borderRadius:14, background:driverMapTheme==="dark"?"rgba(8,16,30,.88)":"rgba(255,255,255,.92)", backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)", border:driverMapTheme==="dark"?"1px solid rgba(147,197,253,.22)":"1px solid rgba(15,23,42,.12)", color:driverMapTheme==="dark"?"#e2e8f0":"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", gap:7, cursor:"pointer", boxShadow:"0 10px 26px rgba(2,6,23,.22)", fontSize:11, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
            {driverMapTheme==="dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            )}
            {driverMapTheme==="dark" ? "Dark" : "Claro"}
          </button>
        </div>

        {/* ── MAP PIN POPUP ── aparece cuando se toca un pin */}
        {mapPinPopup && (() => {
          const s = mapPinPopup;
          const isDone = s.navStatus === "visited";
          const isProb = false;
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
                      {/* Estado si visitado/note */}
                      {(isDone || isProb) && (
                        <div style={{ fontSize:10, color:ac, fontWeight:600, marginTop:2 }}>
                          {isDone ? `✓ Visitado${s.visitedAt ? " · " + s.visitedAt : ""}` : `⚠ Nota`}
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
            <div style={{ width:64,height:64,borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30 }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,.86)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg></div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.6)",marginBottom:6 }}>Sin ruta asignada</div>
              <div style={{ display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 16px" }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.3)",animation:"pulse 2s infinite" }}/>
                <span style={{ fontSize:12,color:"rgba(255,255,255,0.35)" }}>Esperando que el admin envíe una ruta...</span>
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
        {showCompletedBanner && tab === "route" && (
          <div style={{ position:"absolute",bottom:14,left:14,right:14,background:"rgba(6,12,20,0.98)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"16px",textAlign:"center",backdropFilter:"blur(20px)",boxShadow:"0 8px 32px rgba(0,0,0,0.8)",animation:"popIn .3s cubic-bezier(.4,0,.2,1)",zIndex:50 }}>
            <button onClick={()=>setShowCompletedBanner(false)} style={{ position:"absolute",top:8,right:10,background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:16,cursor:"pointer",lineHeight:1,padding:4 }}>✕</button>
            <div style={{ fontSize:30,marginBottom:6 }}>🎉</div>
            <div style={{ fontSize:15,fontFamily:"'DM Sans',sans-serif",fontWeight:700,color:"white" }}>¡Ruta completada!</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:3 }}>{visited.length} rutas · {problems.length > 0 ? `${problems.length} con notas` : "ruta visitada"}</div>
            <div style={{ marginTop:10,height:2,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden" }}>
              <div style={{ height:2,background:"white",borderRadius:2,width:"100%",animation:"countdown 6s linear forwards" }}/>
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
            background:"linear-gradient(180deg,#07111f,#050914)",
          }}>



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
                    <button onClick={(e)=>{ e.stopPropagation(); markStopVisited(currentStop); }}
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:11, background:"linear-gradient(135deg,#059669,#10b981)", border:"1px solid rgba(16,185,129,0.35)", color:"white", fontSize:13, fontWeight:800, cursor:"pointer", boxShadow:"0 3px 12px rgba(16,185,129,0.25)", fontFamily:"'DM Sans',sans-serif" }}>
                      ✓ Visitado
                    </button>
                    {/* Waze */}
                    <a href={`https://waze.com/ul?ll=${currentStop.lat},${currentStop.lng}&navigate=yes`}
                      target="_blank" rel="noreferrer"
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:11, background:"linear-gradient(135deg,#1d4ed8,#3b82f6)", textDecoration:"none", boxShadow:"0 3px 12px rgba(59,130,246,0.3)", transition:"all .12s" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      <span style={{ fontSize:13, fontWeight:700, color:"white" }}>Waze</span>
                    </a>
                    {/* WhatsApp */}
                    <a href={`https://wa.me/1${String(currentStop.phone||'').replace(/\D/g,'')}`}
                      target="_blank" rel="noreferrer"
                      style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px", borderRadius:11, background:"linear-gradient(135deg,#047857,#22c55e)", textDecoration:"none", boxShadow:"0 3px 12px rgba(34,197,94,0.25)", transition:"all .12s" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 8.8c.3 2.8 2.1 4.9 5 6 .6.2 1.3-.3 1.6-.9l.3-.7"/></svg>
                      <span style={{ fontSize:13, fontWeight:700, color:"white" }}>WhatsApp</span>
                    </a>
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
                  <button onClick={finalizeCurrentRoute}
                    style={{ fontSize:10, fontWeight:800, color:"#10b981", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:8, padding:"5px 9px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    Finalizar ruta
                  </button>
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
              const isDone = stop.navStatus==="visited";
              const isProb = false;
              const isEnR  = stop.navStatus==="active";
              const isCur  = stop===currentStop;
              const isExp  = selStop?.id===stop.id;

              const dotColor = isDone?"#10b981":isProb?"#ef4444":isCur||isEnR?"#3b82f6":"#374151";
              const statusLabel= isDone?"VISITADO":isEnR?"EN CAMINO":"PENDIENTE";
              const statusColor= isDone?"#10b981":isEnR?"#60a5fa":"rgba(255,255,255,0.3)";
              const statusBg   = isDone?"rgba(16,185,129,0.1)":isEnR?"rgba(59,130,246,0.1)":"transparent";

              // Distancia desde DEPOT (estimada por stopNum)
              const distKm = stop.stopNum ? (stop.stopNum * 0.6).toFixed(1) : null;

              return (
                <div key={stop.id} style={{
                  margin:"6px 10px",
                  borderRadius:16,
                  background: isExp
                    ? "rgba(255,255,255,0.045)"
                    : isCur
                    ? "rgba(255,255,255,0.04)"
                    : isDone
                    ? "rgba(10,20,14,0.5)"
                    : isProb
                    ? "rgba(30,10,10,0.5)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isExp ? "rgba(255,255,255,0.10)"
                    : isCur ? "rgba(255,255,255,0.08)"
                    : isDone ? "rgba(16,185,129,0.15)"
                    : isProb ? "rgba(239,68,68,0.18)"
                    : "rgba(255,255,255,0.06)"}`,
                  boxShadow: "none",
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
                      boxShadow: isDone ? "0 0 10px rgba(16,185,129,0.10)" : "none",
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
                      {isDone && stop.visitedAt && (
                        <div style={{ fontSize:10, color:"#10b981", marginTop:4, fontFamily:"'DM Mono',monospace", display:"flex", alignItems:"center", gap:4 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          {stop.visitedAt}
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
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.91 10.5a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.9 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
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
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          {/* Visitado se marca solo desde parada actual; esta card no muestra botón de visitado. */}
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

      {/* ══ TAB: HISTORIAL PREMIUM ══ */}
      {tab === "history" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"linear-gradient(180deg,#050914,#07111f)", paddingBottom:0 }}>
          <div style={{ flexShrink:0, padding:"14px 16px 12px", borderBottom:"1px solid rgba(148,163,184,.10)", background:"rgba(2,6,23,.72)", backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={()=>setTab("route")} className="rd-btn" style={{ width:40, height:40, borderRadius:14, border:"1px solid rgba(148,163,184,.14)", background:"rgba(255,255,255,.045)", color:"rgba(226,232,240,.76)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:18, fontWeight:900, color:"#f8fafc", letterSpacing:"-.5px" }}>Historial de rutas</div>
                <div style={{ fontSize:11, color:"rgba(148,163,184,.72)", marginTop:2 }}>{routeHistory.length} ruta{routeHistory.length!==1?"s":""} completada{routeHistory.length!==1?"s":""}</div>
              </div>
              <div style={{ width:42, height:42, borderRadius:15, background:"linear-gradient(135deg,rgba(37,99,235,.30),rgba(14,165,233,.12))", border:"1px solid rgba(96,165,250,.22)", color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5v5h5"/><path d="M5.8 10A7.5 7.5 0 1 0 8 5.1"/><path d="M12 8v4l3 2"/></svg>
              </div>
            </div>
          </div>

          {routeHistory.length === 0 ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", textAlign:"center" }}>
              <div style={{ maxWidth:320 }}>
                <div style={{ width:76, height:76, margin:"0 auto 18px", borderRadius:26, background:"linear-gradient(135deg,rgba(37,99,235,.20),rgba(14,165,233,.08))", border:"1px solid rgba(96,165,250,.18)", display:"flex", alignItems:"center", justifyContent:"center", color:"#93c5fd" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5v5h5"/><path d="M5.8 10A7.5 7.5 0 1 0 8 5.1"/><path d="M12 8v4l3 2"/></svg>
                </div>
                <div style={{ fontSize:17, fontWeight:900, color:"#f8fafc", marginBottom:8 }}>Aún no hay historial</div>
                <div style={{ fontSize:13, lineHeight:1.5, color:"rgba(148,163,184,.72)" }}>Cuando finalices una ruta, aparecerá aquí. Mientras esperas al admin, esta pantalla se mantiene limpia.</div>
              </div>
            </div>
          ) : histSelRoute ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(148,163,184,.09)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                <button onClick={()=>setHistSelRoute(null)} className="rd-btn" style={{ width:36, height:36, borderRadius:13, border:"1px solid rgba(148,163,184,.12)", background:"rgba(255,255,255,.04)", color:"rgba(226,232,240,.72)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:900, color:"#f8fafc", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{histSelRoute.routeName||"Ruta completada"}</div>
                  <div style={{ fontSize:10.5, color:"rgba(148,163,184,.62)", marginTop:2 }}>{histSelRoute.completedAt ? new Date(histSelRoute.completedAt).toLocaleString("es-DO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—"}</div>
                </div>
              </div>
              <div style={{ flex:1, overflow:"auto", padding:"12px 12px 18px" }}>
                {(histSelRoute.stops||[]).sort((a,b)=>(a.stopNum||99)-(b.stopNum||99)).map((stop,i)=>{
                  const isDone = stop.navStatus === "visited";
                  const track = String(stop.tracking || "").replace(/^SP[-\s]*/i,"SP");
                  return (
                    <div key={stop.id||i} style={{ display:"grid", gridTemplateColumns:"38px 1fr", gap:10, padding:"10px 10px", marginBottom:8, borderRadius:16, background:"rgba(255,255,255,.035)", border:"1px solid rgba(148,163,184,.08)" }}>
                      <div style={{ width:34, height:34, borderRadius:13, background:isDone?"rgba(34,197,94,.12)":"rgba(245,158,11,.12)", border:`1px solid ${isDone?"rgba(34,197,94,.22)":"rgba(245,158,11,.22)"}`, color:isDone?"#86efac":"#fbbf24", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:12, fontFamily:"'DM Mono',monospace" }}>{stop.stopNum||i+1}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <div style={{ flex:1, minWidth:0, fontSize:13, color:"#f8fafc", fontWeight:850, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{stop.client||"Cliente"}</div>
                          {track && <div style={{ fontSize:10, color:"#93c5fd", background:"rgba(37,99,235,.13)", border:"1px solid rgba(96,165,250,.18)", borderRadius:999, padding:"3px 7px", fontFamily:"'DM Mono',monospace", fontWeight:800 }}>{track}</div>}
                        </div>
                        <div style={{ fontSize:11.5, lineHeight:1.35, color:"rgba(203,213,225,.62)" }}>{stop.displayAddr || stop.rawAddr || "Sin dirección"}</div>
                        {stop.visitedAt && <div style={{ marginTop:5, fontSize:10.5, color:"#86efac", fontWeight:750 }}>Visitado · {stop.visitedAt}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ flex:1, overflow:"auto", padding:"14px 12px 20px" }}>
              {routeHistory.map((r,i)=>{
                const stopsR = r.stops || [];
                const done = stopsR.filter(s=>s.navStatus==="visited").length;
                const total = stopsR.length;
                const when = r.completedAt ? new Date(r.completedAt).toLocaleString("es-DO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
                return (
                  <button key={r.histId||r.routeId||i} onClick={()=>setHistSelRoute(r)} className="rd-btn" style={{ width:"100%", textAlign:"left", border:"1px solid rgba(148,163,184,.10)", background:"linear-gradient(145deg,rgba(15,23,42,.82),rgba(8,16,30,.92))", borderRadius:20, padding:"14px", marginBottom:10, color:"inherit", cursor:"pointer", boxShadow:"0 12px 28px rgba(2,6,23,.24)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:46, height:46, borderRadius:16, background:"linear-gradient(135deg,rgba(34,197,94,.18),rgba(59,130,246,.10))", border:"1px solid rgba(34,197,94,.20)", color:"#86efac", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, color:"#f8fafc", fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.routeName || "Ruta completada"}</div>
                        <div style={{ fontSize:11, color:"rgba(148,163,184,.68)", marginTop:4 }}>{when}</div>
                        <div style={{ display:"flex", gap:8, marginTop:9 }}>
                          <span style={{ fontSize:10.5, color:"#86efac", background:"rgba(34,197,94,.10)", border:"1px solid rgba(34,197,94,.18)", borderRadius:999, padding:"4px 8px", fontWeight:800 }}>✓ {done} visitadas</span>
                        </div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ BOTTOM NAV PREMIUM ══ */}
      <div style={{ flexShrink:0, background:"linear-gradient(180deg,rgba(3,7,18,.94),rgba(2,6,23,.99))", borderTop:"1px solid rgba(148,163,184,.14)", display:"grid", gridTemplateColumns:"repeat(3,1fr)", zIndex:200, boxShadow:"0 -18px 44px rgba(0,0,0,.38)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", padding:"7px 8px calc(10px + env(safe-area-inset-bottom))" }}>
        {[
          { id:"route", label:"Ruta", icon:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 13h5M8 17h7"/></svg> },
          { id:"mapa", label:"Mapa", icon:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-4.7 7-11a7 7 0 1 0-14 0c0 6.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg> },
          { id:"history", label:"Historial", icon:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="4"/><path d="M8 3v4M16 3v4M8 11h8M8 15h5"/></svg> },
        ].map(item=>{
          const active = tab===item.id;
          return (
            <button key={item.id} onClick={()=>setTab(item.id)} className="rd-btn"
              style={{ minHeight:58, border:"none", borderRadius:18, background:active?"linear-gradient(135deg,rgba(37,99,235,.30),rgba(14,165,233,.13))":"transparent", color:active?"#dbeafe":"rgba(226,232,240,.46)", cursor:"pointer", position:"relative", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, transition:"all .18s ease", boxShadow:active?"inset 0 0 0 1px rgba(96,165,250,.22), 0 10px 26px rgba(37,99,235,.16)":"none" }}>
              <div style={{ width:28, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>{item.icon}</div>
              <span style={{ fontSize:10.5, fontWeight:800, letterSpacing:".15px" }}>{item.label}</span>
              {active && <div style={{ position:"absolute", top:6, width:18, height:3, borderRadius:99, background:"linear-gradient(90deg,#38bdf8,#2563eb)" }}/>} 
            </button>
          );
        })}
      </div>

      {/* -- Agregar nota modal -- */}

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
const MensajeroManager = ({ mensajeros, setMensajeros, currentUser }) => {
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
    const officeId = currentUser?.officeId;
    if (!officeId) { setSaveMsg("No se encontró la oficina de este admin."); return; }
    const newMens  = { id: newId, name, initials, phone: newPhone.trim(), email, active: true, color: "#3b82f6", officeId };

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
      officeId,
      officeName: currentUser?.officeName || currentUser?.officeId || "Oficina",
      color: "#10b981",
      driverId: newId,  // mismo que mensajero.id — el admin usará este para enviar rutas
      active: true,
    };
    USERS.push(newUser);
    // Persistir en Firebase — esperar escritura antes de mostrar éxito
    await Promise.all([
      FB.set(`oficinas/${officeId}/users/${newUser.id}`, newUser),
      FB.set(`oficinas/${officeId}/mensajeros/${newId}`, newMens),
      FB.set(`users/${newUser.id}`, newUser),
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
    // Persistir edición dentro de la oficina actual
    const officeId = currentUser?.officeId;
    const u = USERS.find(u => u.driverId === id);
    if (u) { u.name = editName.trim().toUpperCase(); if (editEmail.trim()) u.email = editEmail.trim().toLowerCase(); }
    const edited = { id, name: editName.trim().toUpperCase(), phone: editPhone.trim(), email: editEmail.trim().toLowerCase(), initials: editName.trim().toUpperCase().split(" ").map(w=>w[0]).join("").slice(0,2), active: true, color:"#3b82f6", officeId };
    if (officeId) FB.set(`oficinas/${officeId}/mensajeros/${id}`, edited);
    if (officeId && u) FB.set(`oficinas/${officeId}/users/${u.id}`, u);
    if (u) FB.set(`users/${u.id}`, u);
    setEditId(null);
  };

  const remove = (id, name) => {
    if (!window.confirm(`¿Eliminar ${name}?`)) return;
    setMensajeros(prev => {
      const updated = prev.filter(m => m.id !== id);
      LS.setMens(updated);
      return updated;
    });
    const officeId = currentUser?.officeId;
    const u = USERS.find(u => u.driverId === id);
    if (officeId) FB.set(`oficinas/${officeId}/mensajeros/${id}`, null);
    if (officeId && u) FB.set(`oficinas/${officeId}/users/${u.id}`, null);
    if (u) FB.set(`users/${u.id}`, null);
  };

  const toggle = (id) => setMensajeros(prev => {
    const updated = prev.map(m => m.id === id ? { ...m, active: !m.active } : m);
    LS.setMens(updated);
    const officeId = currentUser?.officeId;
    const changed = updated.find(m => m.id === id);
    if (officeId && changed) FB.set(`oficinas/${officeId}/mensajeros/${id}`, changed);
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

// --- PAGE: SUPER ADMIN --------------------------------------------------------

const PageSuperAdmin = ({ currentUser, onLogout }) => {
  const [offices, setOffices] = useState({});
  const [users, setUsers] = useState([...USERS]);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openActions, setOpenActions] = useState(null);
  const [form, setForm] = useState({ nombre:"", codigo:"", responsable:"", telefono:"", direccion:"", lat:"18.4861", lng:"-69.9312", adminName:"", adminEmail:"", adminPassword:"" });

  const load = useCallback(async () => {
    const [of, rootUsers] = await Promise.all([FB.get("oficinas"), FB.get("users")]);
    const cleanOffices = of && typeof of === "object" ? of : {};
    setOffices(cleanOffices);
    const allUsers = Object.values(rootUsers || {}).filter(Boolean);
    const merged = [...USERS];
    allUsers.forEach(u => { if (u?.id && !merged.find(x => x.id === u.id)) merged.push(u); });
    Object.values(cleanOffices || {}).forEach(o => {
      Object.values(o?.users || {}).forEach(u => { if (u?.id && !merged.find(x => x.id === u.id)) merged.push(u); });
    });
    setUsers(merged);
  }, []);

  useEffect(() => { load(); }, [load]);

  const slugify = (txt) => (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const countObj = (v) => Array.isArray(v) ? v.length : (v && typeof v === "object" ? Object.values(v).filter(Boolean).length : 0);
  const officeList = Object.entries(offices || {}).map(([id, o]) => ({ id, ...o })).sort((a,b) => (a.nombre || a.id).localeCompare(b.nombre || b.id));
  const filteredOffices = officeList.filter(o => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [o.nombre, o.id, o.responsable, o.telefono, o.ubicacionBase?.direccion].some(v => String(v || "").toLowerCase().includes(q));
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? o.activa !== false : o.activa === false);
    return matchesQuery && matchesStatus;
  });

  const stats = {
    total: officeList.length,
    active: officeList.filter(o => o.activa !== false).length,
    disabled: officeList.filter(o => o.activa === false).length,
    admins: users.filter(u => (u.role === "admin" || u.role === "office_admin") && u.officeId).length,
    drivers: officeList.reduce((n,o)=>n+countObj(o.mensajeros),0),
    routes: officeList.reduce((n,o)=>n+countObj(o.routes),0),
  };

  const selectedOffice = selected ? offices[selected] : null;
  const selectedAdmins = users.filter(u => u.officeId === selected && (u.role === "admin" || u.role === "office_admin"));
  const health = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  const resetForm = () => setForm({ nombre:"", codigo:"", responsable:"", telefono:"", direccion:"", lat:"18.4861", lng:"-69.9312", adminName:"", adminEmail:"", adminPassword:"" });

  const saveOffice = async () => {
    const nombre = form.nombre.trim();
    const id = slugify(form.codigo || nombre);
    if (!nombre || !id) { setMsg("Escribe el nombre de la oficina."); return; }
    if (!form.adminEmail.trim() || !form.adminPassword.trim()) { setMsg("Crea el login del admin de esta oficina."); return; }
    setSaving(true); setMsg("");
    const now = new Date().toISOString();
    const admin = {
      id:`OA-${id}-${Date.now()}`,
      name:form.adminName.trim() || `Admin ${nombre}`,
      email:form.adminEmail.trim().toLowerCase(),
      password:form.adminPassword,
      role:"admin",
      avatar:(form.adminName.trim() || nombre).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
      color:"#3b82f6",
      officeId:id,
      officeName:nombre,
      active:true
    };
    const currentOffice = await FB.get(`oficinas/${id}`);
    if (currentOffice) { setSaving(false); setMsg("Ya existe una oficina con ese código. Usa otro código."); return; }
    const office = {
      id,
      nombre,
      codigo:id,
      activa:true,
      responsable:form.responsable.trim(),
      telefono:form.telefono.trim(),
      createdAt:now,
      updatedAt:now,
      createdBy:currentUser?.email || "super_admin",
      ubicacionBase:{ direccion:form.direccion.trim(), lat:Number(form.lat)||18.4861, lng:Number(form.lng)||-69.9312 },
      mensajeros:{},
      routes:{},
      routeHistory:{},
      locations:{},
      users:{ [admin.id]: admin }
    };
    await Promise.all([
      FB.set(`oficinas/${id}`, office),
      FB.set(`oficinas/${id}/users/${admin.id}`, admin),
      FB.set(`users/${admin.id}`, admin)
    ]);
    if (!USERS.find(u => u.id === admin.id)) USERS.push(admin);
    resetForm();
    setShowCreate(false);
    await load();
    setSelected(id);
    setMsg(`Oficina ${nombre} creada correctamente.`);
    setSaving(false);
  };

  const toggleOffice = async (id, next) => {
    await FB.set(`oficinas/${id}/activa`, next);
    await FB.set(`oficinas/${id}/updatedAt`, new Date().toISOString());
    await load();
    setMsg(next ? "Oficina habilitada." : "Oficina pausada.");
  };

  const deleteOffice = async (id) => {
    const o = offices[id];
    if (!confirm(`¿Eliminar la oficina ${o?.nombre || id}? Esta acción no se puede deshacer.`)) return;
    await FB.set(`oficinas/${id}`, null);
    await load();
    if (selected === id) setSelected(null);
    setMsg("Oficina eliminada.");
  };

  const confirmLogout = () => {
    if (confirm("¿Quieres cerrar la sesión del Super Admin?")) onLogout?.();
  };

  const ui = {
    bg:"#060b10", panel:"#0b1320", panel2:"#0f1b2d", card:"#0f1726", card2:"#111d30", line:"#1f314c",
    text:"#f8fafc", muted:"#8fa7c7", soft:"#dbeafe", blue:"#3b82f6", green:"#22c55e", red:"#fb7185", amber:"#f59e0b", purple:"#a78bfa", cyan:"#22d3ee"
  };

  const SvgIcon = ({ name, color=ui.blue, size=20 }) => {
    const common = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", stroke:color, strokeWidth:2.15, strokeLinecap:"round", strokeLinejoin:"round" };
    const paths = {
      office:<><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16"/><path d="M9 21v-4h3v4"/><path d="M8 7h1M12 7h1M8 11h1M12 11h1M19 21V10h1a1 1 0 0 1 1 1v10"/></>,
      active:<><path d="M20 6 9 17l-5-5"/></>,
      pause:<><path d="M10 4H6v16h4V4Z"/><path d="M18 4h-4v16h4V4Z"/></>,
      users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
      route:<><path d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M8.5 14.5 15.5 9.5"/></>,
      shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></>,
      search:<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
      plus:<><path d="M12 5v14M5 12h14"/></>,
      logout:<><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5"/></>,
      dots:<><path d="M12 12h.01M19 12h.01M5 12h.01"/></>,
      base:<><path d="M12 21s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
      pulse:<><path d="M3 12h4l3-7 4 14 3-7h4"/></>
    };
    return <svg {...common}>{paths[name] || paths.office}</svg>;
  };

  const card = { background:`linear-gradient(180deg,rgba(17,29,48,.98),rgba(11,19,32,.98))`, border:`1px solid ${ui.line}`, borderRadius:18, boxShadow:"0 18px 44px rgba(0,0,0,.22)" };
  const input = { height:44, border:`1px solid ${ui.line}`, borderRadius:13, background:"#07111f", color:ui.text, padding:"0 14px", fontSize:14, outline:"none", width:"100%" };
  const btn = { height:42, borderRadius:13, border:`1px solid ${ui.line}`, background:"#0b1322", color:ui.soft, padding:"0 15px", fontWeight:900, cursor:"pointer" };
  const primary = { ...btn, border:"none", color:"white", background:"linear-gradient(135deg,#2563eb,#4f46e5)", boxShadow:"0 14px 34px rgba(37,99,235,.35)" };
  const label = { display:"block", fontSize:11, color:ui.muted, fontWeight:900, marginBottom:7, letterSpacing:".7px", textTransform:"uppercase" };
  const statusBadge = (active) => <span style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"6px 10px", borderRadius:999, color:active?"#bbf7d0":"#fecdd3", background:active?"rgba(34,197,94,.12)":"rgba(251,113,133,.12)", border:`1px solid ${active?"rgba(34,197,94,.32)":"rgba(251,113,133,.32)"}`, fontSize:12, fontWeight:900 }}><span style={{ width:7, height:7, borderRadius:999, background:active?ui.green:ui.red, boxShadow:`0 0 10px ${active?ui.green:ui.red}` }}/>{active ? "Activa" : "Pausada"}</span>;

  const metricCards = [
    { label:"Oficinas", value:stats.total, note:"Total", icon:"office", color:ui.blue },
    { label:"Activas", value:stats.active, note:"Operando", icon:"active", color:ui.green },
    { label:"Pausadas", value:stats.disabled, note:"Bloqueadas", icon:"pause", color:ui.red },
    { label:"Admins", value:stats.admins, note:"Accesos", icon:"shield", color:ui.purple },
    { label:"Mensajeros", value:stats.drivers, note:"Registrados", icon:"users", color:ui.cyan },
    { label:"Rutas", value:stats.routes, note:"Activas", icon:"route", color:ui.amber },
  ];

  const riskItems = [
    { label:"Oficinas pausadas", value:stats.disabled, tone:ui.red },
    { label:"Sin mensajeros", value:officeList.filter(o=>countObj(o.mensajeros)===0).length, tone:ui.amber },
    { label:"Sin base definida", value:officeList.filter(o=>!o.ubicacionBase?.direccion).length, tone:ui.purple },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:`radial-gradient(circle at 10% -10%,rgba(37,99,235,.20),transparent 34%), radial-gradient(circle at 90% 10%,rgba(124,58,237,.14),transparent 30%), ${ui.bg}`, color:ui.text, fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden" }}>
      <style>{`
        .rdSA *{box-sizing:border-box}.rdSA button,.rdSA input,.rdSA select{font-family:inherit}.rdSA ::placeholder{color:#627896}.rdSA .rdHover{transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}.rdSA .rdHover:hover{transform:translateY(-2px);border-color:#31527e;box-shadow:0 18px 55px rgba(0,0,0,.28)}.rdSA .rdBtn{transition:transform .14s ease,filter .14s ease,background .14s ease}.rdSA .rdBtn:hover{transform:translateY(-1px);filter:brightness(1.08)}.rdSA .rdInput:focus{border-color:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.13)}.rdSA .rdRow:hover{background:rgba(59,130,246,.055)}.rdSA .rdScroll::-webkit-scrollbar{width:10px;height:10px}.rdSA .rdScroll::-webkit-scrollbar-thumb{background:#233a59;border-radius:999px}.rdSA .rdScroll::-webkit-scrollbar-track{background:transparent}
      `}</style>
      <div className="rdSA" style={{ display:"grid", gridTemplateColumns:"292px 1fr", height:"100%" }}>
        <aside style={{ background:"linear-gradient(180deg,#0b1322,#070d16)", borderRight:`1px solid ${ui.line}`, padding:22, display:"flex", flexDirection:"column", gap:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:13 }}>
            <div style={{ width:46, height:46, borderRadius:14, display:"grid", placeItems:"center", background:"linear-gradient(135deg,#2563eb,#60a5fa)", boxShadow:"0 14px 34px rgba(37,99,235,.28)", fontWeight:1000 }}>RD</div>
            <div><div style={{ fontWeight:1000, fontSize:18 }}>Rap Drive</div><div style={{ color:ui.muted, fontSize:12, marginTop:4 }}>Centro de control</div></div>
          </div>
          <nav style={{ display:"grid", gap:9, marginTop:8 }}>
            {[
              ["office","Oficinas",stats.total,ui.blue],
              ["pulse","Actividad",officeList.length,ui.green],
              ["shield","Riesgos",riskItems.reduce((n,r)=>n+r.value,0),ui.red],
              ["users","Accesos",stats.admins,ui.purple],
            ].map(([ic,labelText,val,color],i)=><div key={labelText} className="rdHover" style={{ height:54, borderRadius:15, border:`1px solid ${i===0?"#31527e":ui.line}`, background:i===0?"rgba(59,130,246,.12)":"rgba(255,255,255,.03)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px" }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><SvgIcon name={ic} color={color} size={18}/><span style={{ fontWeight:900 }}>{labelText}</span></div><b style={{ color, fontSize:18 }}>{val}</b></div>)}
          </nav>
          <div style={{ ...card, padding:16, marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}><span style={{ color:ui.muted, fontSize:12, fontWeight:900 }}>Salud operativa</span><b>{health}%</b></div>
            <div style={{ height:9, background:"#101a2b", borderRadius:999, overflow:"hidden" }}><div style={{ height:"100%", width:`${health}%`, background:"linear-gradient(90deg,#22c55e,#3b82f6)", borderRadius:999 }}/></div>
            <div style={{ color:ui.muted, fontSize:12, marginTop:12 }}>{stats.active} activas · {stats.routes} rutas activas</div>
          </div>
          <div style={{ marginTop:"auto", display:"grid", gap:12 }}>
            <div style={{ ...card, padding:16 }}><div style={{ color:ui.muted, fontSize:11, fontWeight:1000, letterSpacing:1, textTransform:"uppercase" }}>Sesión actual</div><div style={{ marginTop:10, fontWeight:900, color:ui.soft, overflow:"hidden", textOverflow:"ellipsis" }}>{currentUser?.email}</div></div>
            <button className="rdBtn" onClick={confirmLogout} style={{ ...btn, width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><SvgIcon name="logout" color={ui.soft} size={17}/> Cerrar sesión</button>
          </div>
        </aside>

        <main className="rdScroll" style={{ overflow:"auto", padding:24 }}>
          <div style={{ maxWidth:1480, margin:"0 auto" }}>
            <section style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:14, marginBottom:16 }}>
              {metricCards.map(m => <div key={m.label} className="rdHover" style={{ ...card, minHeight:116, padding:17, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", right:-18, top:-18, width:92, height:92, borderRadius:30, background:`radial-gradient(circle,${m.color}26,transparent 65%)` }}/>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ color:ui.muted, fontSize:13, fontWeight:1000 }}>{m.label}</span><div style={{ width:34, height:34, display:"grid", placeItems:"center", borderRadius:12, background:`${m.color}14`, border:`1px solid ${m.color}32` }}><SvgIcon name={m.icon} color={m.color} size={18}/></div></div>
                <div style={{ fontSize:36, fontWeight:1000, lineHeight:1, marginTop:14 }}>{m.value}</div>
                <div style={{ color:ui.muted, fontSize:12, marginTop:7 }}>{m.note}</div>
              </div>)}
            </section>

            {msg && <div style={{ marginBottom:14, padding:"12px 14px", borderRadius:14, background:"rgba(34,197,94,.10)", border:"1px solid rgba(34,197,94,.25)", color:"#bbf7d0", fontWeight:800 }}>{msg}</div>}

            <section style={{ ...card, overflow:"visible" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:20, borderBottom:`1px solid ${ui.line}` }}>
                <div><div style={{ fontSize:22, fontWeight:1000 }}>Oficinas</div><div style={{ color:ui.muted, fontSize:13, marginTop:5 }}>{filteredOffices.length} resultado{filteredOffices.length!==1?"s":""}</div></div>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ position:"relative", width:360 }}><div style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)" }}><SvgIcon name="search" color={ui.muted} size={17}/></div><input className="rdInput" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar oficina, código, responsable..." style={{ ...input, paddingLeft:42 }}/></div>
                  <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...input, width:150 }}><option value="all">Todas</option><option value="active">Activas</option><option value="paused">Pausadas</option></select>
                  <button className="rdBtn" onClick={()=>setShowCreate(true)} style={{ ...primary, display:"flex", alignItems:"center", gap:8 }}><SvgIcon name="plus" color="white" size={18}/> Nueva oficina</button>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1.25fr .75fr 1.25fr .55fr .55fr 70px", padding:"0 20px", height:48, alignItems:"center", color:ui.muted, fontSize:11, fontWeight:1000, textTransform:"uppercase", letterSpacing:.7, borderBottom:`1px solid ${ui.line}` }}>
                <div>Oficina</div><div>Admin</div><div>Estado</div><div>Base</div><div>Mens.</div><div>Rutas</div><div style={{ textAlign:"right" }}>Acción</div>
              </div>

              {filteredOffices.length === 0 ? <div style={{ padding:54, textAlign:"center", color:ui.muted }}><SvgIcon name="office" color={ui.blue} size={42}/><div style={{ fontWeight:1000, color:ui.text, marginTop:14, fontSize:18 }}>No hay oficinas para mostrar</div><div style={{ marginTop:6 }}>Crea la primera oficina desde el botón “Nueva oficina”.</div></div> : filteredOffices.map(o => {
                const admins = users.filter(u => u.officeId === o.id && (u.role === "admin" || u.role === "office_admin"));
                const admin = admins[0];
                return <div key={o.id} className="rdRow" onClick={()=>setSelected(o.id)} style={{ display:"grid", gridTemplateColumns:"1.5fr 1.25fr .75fr 1.25fr .55fr .55fr 70px", padding:"15px 20px", alignItems:"center", borderBottom:`1px solid ${ui.line}`, cursor:"pointer", position:"relative" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}><div style={{ width:42, height:42, borderRadius:14, background:"linear-gradient(135deg,#1d4ed8,#60a5fa)", display:"grid", placeItems:"center", fontWeight:1000, boxShadow:"0 12px 28px rgba(37,99,235,.25)" }}>{(o.nombre||o.id).slice(0,2).toUpperCase()}</div><div style={{ minWidth:0 }}><div style={{ fontSize:16, fontWeight:1000, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{o.nombre || o.id}</div><div style={{ color:ui.muted, fontSize:12, marginTop:4 }}>{o.responsable || "Sin responsable"}</div></div></div>
                  <div style={{ color:ui.soft, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{admin?.email || "Sin admin"}</div>
                  <div>{statusBadge(o.activa !== false)}</div>
                  <div style={{ color:ui.soft, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:7 }}><SvgIcon name="base" color={ui.muted} size={16}/>{o.ubicacionBase?.direccion || "Sin base"}</div>
                  <div style={{ fontWeight:1000 }}>{countObj(o.mensajeros)}</div>
                  <div style={{ fontWeight:1000 }}>{countObj(o.routes)}</div>
                  <div style={{ textAlign:"right", position:"relative" }} onClick={e=>e.stopPropagation()}><button className="rdBtn" onClick={()=>setOpenActions(openActions===o.id?null:o.id)} style={{ ...btn, width:40, padding:0 }}><SvgIcon name="dots" color={ui.soft}/></button>{openActions===o.id && <div style={{ position:"absolute", right:0, top:46, zIndex:10, minWidth:170, ...card, padding:7 }}><button className="rdBtn" onClick={()=>{setSelected(o.id);setOpenActions(null);}} style={{ ...btn, width:"100%", textAlign:"left", marginBottom:6 }}>Ver detalle</button><button className="rdBtn" onClick={()=>{toggleOffice(o.id, o.activa===false);setOpenActions(null);}} style={{ ...btn, width:"100%", textAlign:"left", marginBottom:6 }}>{o.activa===false?"Habilitar":"Pausar"}</button><button className="rdBtn" onClick={()=>{deleteOffice(o.id);setOpenActions(null);}} style={{ ...btn, width:"100%", textAlign:"left", color:"#fecdd3" }}>Eliminar</button></div>}</div>
                </div>
              })}
            </section>

            <div style={{ display:"grid", gridTemplateColumns:selectedOffice?"1fr 430px":"1fr", gap:16, marginTop:16 }}>
              <section style={{ ...card, padding:18 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}><div style={{ fontSize:18, fontWeight:1000 }}>Actividad operacional</div><SvgIcon name="pulse" color={ui.green}/></div>
                <div style={{ display:"grid", gap:10 }}>
                  {(officeList.length ? officeList.slice(0,6) : [{ nombre:"Aún no hay actividad registrada", activa:true }]).map((o,i)=><div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:13, border:`1px solid ${ui.line}`, borderRadius:15, background:"rgba(255,255,255,.03)" }}><span style={{ width:10, height:10, borderRadius:999, background:o.activa===false?ui.red:ui.green, boxShadow:`0 0 12px ${o.activa===false?ui.red:ui.green}` }}/><div><div style={{ fontWeight:900 }}>{o.activa===false?"Oficina pausada":"Oficina operativa"}</div><div style={{ color:ui.muted, fontSize:13, marginTop:3 }}>{o.nombre}</div></div></div>)}
                </div>
              </section>

              {selectedOffice && <aside style={{ ...card, padding:18 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:16 }}><div><div style={{ color:ui.muted, fontSize:11, fontWeight:1000, textTransform:"uppercase" }}>Detalle oficina</div><div style={{ fontSize:22, fontWeight:1000, marginTop:6 }}>{selectedOffice.nombre}</div><div style={{ color:ui.muted, fontSize:12, marginTop:5 }}>ID: {selected}</div></div><button className="rdBtn" onClick={()=>setSelected(null)} style={{ ...btn, width:36, height:36, padding:0 }}>×</button></div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                  {[ ["Estado", statusBadge(selectedOffice.activa !== false)], ["Mensajeros", countObj(selectedOffice.mensajeros)], ["Rutas", countObj(selectedOffice.routes)], ["Admins", selectedAdmins.length] ].map(([k,v])=><div key={k} style={{ padding:13, borderRadius:15, border:`1px solid ${ui.line}`, background:"rgba(255,255,255,.035)" }}><div style={{ color:ui.muted, fontSize:12, fontWeight:900 }}>{k}</div><div style={{ marginTop:7, fontWeight:1000, fontSize:typeof v === "number" ? 24 : 13 }}>{v}</div></div>)}
                </div>
                <div style={{ padding:14, borderRadius:15, border:`1px solid ${ui.line}`, background:"rgba(255,255,255,.035)", marginBottom:12 }}><div style={{ color:ui.muted, fontSize:11, fontWeight:1000, textTransform:"uppercase" }}>Base / DEPOT</div><div style={{ marginTop:8, fontWeight:900 }}>{selectedOffice.ubicacionBase?.direccion || "Sin dirección"}</div><div style={{ color:ui.muted, fontSize:12, marginTop:5 }}>Lat {selectedOffice.ubicacionBase?.lat || "—"} · Lng {selectedOffice.ubicacionBase?.lng || "—"}</div></div>
                <div style={{ padding:14, borderRadius:15, border:`1px solid ${ui.line}`, background:"rgba(255,255,255,.035)", marginBottom:14 }}><div style={{ color:ui.muted, fontSize:11, fontWeight:1000, textTransform:"uppercase" }}>Admin</div>{selectedAdmins.length ? selectedAdmins.map(a=><div key={a.id} style={{ marginTop:10 }}><b>{a.name}</b><div style={{ color:ui.muted, fontSize:12, marginTop:3 }}>{a.email}</div></div>) : <div style={{ color:ui.muted, marginTop:8 }}>Sin admin asignado.</div>}</div>
                <div style={{ display:"flex", gap:9 }}><button className="rdBtn" onClick={()=>toggleOffice(selected, selectedOffice.activa === false)} style={{ flex:1, ...primary, background:selectedOffice.activa===false?"linear-gradient(135deg,#16a34a,#22c55e)":"linear-gradient(135deg,#ea580c,#f59e0b)" }}>{selectedOffice.activa===false?"Habilitar":"Pausar"}</button><button className="rdBtn" onClick={()=>deleteOffice(selected)} style={{ ...btn, color:"#fecdd3" }}>Eliminar</button></div>
              </aside>}
            </div>
          </div>
        </main>
      </div>

      {showCreate && <div style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(0,0,0,.65)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", padding:22 }}><div style={{ width:"min(820px,100%)", maxHeight:"92vh", overflow:"auto", ...card, boxShadow:"0 40px 120px rgba(0,0,0,.62)" }}><div style={{ padding:22, borderBottom:`1px solid ${ui.line}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}><div><div style={{ fontSize:24, fontWeight:1000 }}>Nueva oficina</div><div style={{ color:ui.muted, marginTop:6 }}>La oficina inicia con 0 mensajeros. El admin los crea luego.</div></div><button className="rdBtn" onClick={()=>{setShowCreate(false); resetForm();}} style={{ ...btn, width:38, height:38, padding:0 }}>×</button></div><div style={{ padding:22 }}><div style={{ display:"grid", gridTemplateColumns:"1fr 180px", gap:14 }}><div><label style={label}>Nombre oficina</label><input className="rdInput" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value,codigo:form.codigo||slugify(e.target.value)})} placeholder="Ej. Oficina Herrera" style={input}/></div><div><label style={label}>Código</label><input className="rdInput" value={form.codigo} onChange={e=>setForm({...form,codigo:slugify(e.target.value)})} placeholder="herrera" style={input}/></div></div><div style={{ display:"grid", gridTemplateColumns:"1fr 180px", gap:14, marginTop:14 }}><div><label style={label}>Responsable</label><input className="rdInput" value={form.responsable} onChange={e=>setForm({...form,responsable:e.target.value})} placeholder="Nombre responsable" style={input}/></div><div><label style={label}>Teléfono</label><input className="rdInput" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} placeholder="809..." style={input}/></div></div><div style={{ marginTop:14 }}><label style={label}>Base / DEPOT</label><input className="rdInput" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} placeholder="Dirección base de la oficina" style={input}/></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:14 }}><div><label style={label}>Latitud</label><input className="rdInput" value={form.lat} onChange={e=>setForm({...form,lat:e.target.value})} style={input}/></div><div><label style={label}>Longitud</label><input className="rdInput" value={form.lng} onChange={e=>setForm({...form,lng:e.target.value})} style={input}/></div></div><div style={{ height:1, background:ui.line, margin:"22px 0" }}/><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}><div><label style={label}>Nombre admin</label><input className="rdInput" value={form.adminName} onChange={e=>setForm({...form,adminName:e.target.value})} placeholder="Admin oficina" style={input}/></div><div><label style={label}>Correo admin</label><input className="rdInput" value={form.adminEmail} onChange={e=>setForm({...form,adminEmail:e.target.value})} placeholder="admin@oficina.com" style={input}/></div></div><div style={{ marginTop:14 }}><label style={label}>Contraseña inicial</label><input className="rdInput" value={form.adminPassword} onChange={e=>setForm({...form,adminPassword:e.target.value})} placeholder="Contraseña para esa oficina" style={input}/></div><div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:22 }}><button className="rdBtn" onClick={()=>{setShowCreate(false); resetForm();}} style={btn}>Cancelar</button><button className="rdBtn" onClick={saveOffice} disabled={saving} style={{ ...primary, opacity:saving?.7:1 }}>{saving?"Guardando...":"Crear oficina y admin"}</button></div></div></div></div>}
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
        const [usersData, mensUsersData, officeData] = await Promise.all([
          FB.get("users"),
          FB.get("mens_users"),
          FB.get("oficinas"),
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
        if (officeData && typeof officeData === "object") {
          Object.values(officeData).forEach(of => {
            if (of?.users && typeof of.users === "object") {
              Object.values(of.users).forEach(u => {
                if (u && u.id && !USERS.find(x => x.id === u.id)) USERS.push(u);
              });
            }
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
          const [usersData, mensUsersData, officeData] = await Promise.all([
            FB.get("users"),
            FB.get("mens_users"),
            FB.get("oficinas"),
          ]);
          const officeUsers = [];
          if (officeData && typeof officeData === "object") {
            Object.values(officeData).forEach(of => {
              if (of?.users && typeof of.users === "object") officeUsers.push(...Object.values(of.users));
            });
          }
          const allFB = [
            ...Object.values(usersData || {}),
            ...Object.values(mensUsersData || {}),
            ...officeUsers,
          ];
          user = allFB.find(u => u && u.email === email.trim().toLowerCase() && u.password === password);
          // Si encontró en Firebase, agrégalo a USERS local para futuras búsquedas
          if (user && !USERS.find(x => x.id === user.id)) USERS.push(user);
        } catch(e) {}
      }
      if (user) {
        if ((user.role === "admin" || user.role === "driver") && user.officeId) {
          try {
            const office = await FB.get(`oficinas/${user.officeId}`);
            if (!office || office.activa === false) {
              setError("Esta oficina está deshabilitada. Contacta al Super Admin.");
              setLoading(false);
              return;
            }
            user.officeName = office.nombre || user.officeName;
          } catch(e) {}
        }
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
          <div style={{ fontSize:10,color:"rgba(255,255,255,0.22)",marginTop:5,letterSpacing:"3px",fontWeight:600,textTransform:"uppercase" }}>Gestión de Rutas</div>
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
  "el palmar de herrera","palmar de herrera","colinas del norte","residencial colinas del norte",
  "colinas de herrera","cumbre del paraiso","cumbre del paraíso","las orquideas","las orquídeas",
  "residencial cumbre del paraiso","residencial cumbre del paraíso","residencial colinas del oeste",
  "los jardines de herrera","los pinos de herrera","reparto rosa","reparto oriental","colinas del oeste",
  "los alcarrizos","pueblo nuevo los alcarrizos","los americanos","los libertadores","barrio landia",
  "la piña","la pina","la union","la unión","savica los alcarrizos","invi","invi cea",
  "nuevo amanecer","los barrancones","km 14","kilometro 14","km 13","kilometro 13",
  "km 17","kilometro 17","km 18","kilometro 18","km 22","kilometro 22",
  "lebron","nazareno","villa linda","los rieles","24 de abril","nuevo horizonte",
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
  const originalAddress = String(rawAddress || "").trim();
  rawAddress = aiNormalizeAddress(originalAddress);
  const cacheKey = (originalAddress || rawAddress).trim().toLowerCase();

  // ── CAPA 0A: Cache aprendido (correcciones manuales del admin, persistidas en Firebase)
  if (_learnedCache.has(cacheKey)) {
    const l = _learnedCache.get(cacheKey);
    return { ok: true, lat: l.lat, lng: l.lng, display: l.display, confidence: 99, allResults: [], source: "learned" };
  }

  // ── CAPA 0B: Cache en-memoria (evita llamadas repetidas a Google)
  if (_geoCache.has(cacheKey)) return _geoCache.get(cacheKey);

  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  let queries = buildQueryVariants(rawAddress);
  const smartExpanded = rdSmartExpandLocationContext(rawAddress);
  if (smartExpanded && smartExpanded !== rawAddress) queries = [smartExpanded, ...queries];
  queries = [...new Set(queries)].slice(0, 22);

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

      // Si hay anchor local, NO aceptar resultados que salten a otro sector.
      // En SDO el sector del Excel pesa fuerte: si no aparece la calle, mejor caer cerca
      // del sector/referencia que mandar el paquete a Herrera/Los Ríos/otro lugar.
      if (anchor) {
        const dlat = top.geometry.location.lat() - anchor.lat;
        const dlng = top.geometry.location.lng() - anchor.lng;
        const distKm = Math.sqrt(dlat*dlat + dlng*dlng) * 111;
        const radiusKm = anchor.city === "Santo Domingo Oeste" ? (String(anchor.key||"").length >= 9 ? 4.5 : 7.0) : 10;
        if (distKm > radiusKm) continue;
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
      allResults: allCandidates.slice(0, 8).map(({ r, score }) => ({
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
        allResults: rdResults.slice(0, 8).map(r => ({
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
      display: `${rawAddress} (aprox. sector/referencia: ${lastAnchor.key || lastAnchor.city})`,
      confidence: 45,
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

  const expanded = rdSmartExpandLocationContext(expandRDAddress(s));
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

  // V32: variantes por referencia humana + sector.
  // Ej.: "Calle K" + "Los Girasoles" + "frente al colmado" → Google recibe todas las pistas.
  const refHints = rdReferenceHints(s);
  const anchorMatchesV32 = rdAnchorCandidatesFromText(s);
  for (const m of anchorMatchesV32) {
    variants.add(`${expanded}, ${m.key}, ${m.anchor.city}, República Dominicana`);
    variants.add(`${s}, ${m.key}, ${m.anchor.city}, República Dominicana`);
    for (const ref of refHints) variants.add(`${ref}, ${m.key}, ${m.anchor.city}, República Dominicana`);
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

  // 3. Sector/residencial solo como CONTEXTO: nunca como query principal.
  // Antes el motor probaba solo el sector y eso movía paquetes al centro del barrio.
  const secMatch = s.match(/(?:sector|ens(?:anche)?|res(?:idencial)?|urb(?:anizaci[oó]n)?|reparto)\s+([^,]+)/i);
  if (secMatch) {
    const sec = secMatch[1].trim();
    const calleMatch = expanded.match(/(?:Calle|Avenida|Av\.|Prolongación|Residencial|Urbanización)\s+[^,]+/i);
    if (calleMatch) {
      variants.add(calleMatch[0].trim() + ", " + sec + SD);
      variants.add(calleMatch[0].trim() + ", " + sec + DN);
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
  return [...new Set([...variants])].filter(v => v && v.trim().length > 7).slice(0, 18); // cap at 18 queries
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
    [/\bcolinas\s+de\s+los\s+r[ií]os\b/gi, "Colinas de Los Ríos, Distrito Nacional"],
    [/\blos\s+r[ií]os\b/gi,     "Los Ríos, Distrito Nacional"],
    [/\blos\s+girasoles\s*(?:iii|3|tercero)\b/gi, "Los Girasoles III, Distrito Nacional"],
    [/\blos\s+girasoles\s*(?:ii|2|segundo)\b/gi, "Los Girasoles II, Distrito Nacional"],
    [/\blos\s+girasoles\s*(?:i|1|primero)?\b/gi, "Los Girasoles I, Distrito Nacional"],
    [/\bciudad\s+real\s*(?:ii|2)?\b/gi, "Ciudad Real II, Distrito Nacional"],
    [/\baltos\s+de\s+arroyo\s+hondo\b/gi, "Altos de Arroyo Hondo, Distrito Nacional"],
    [/\barroyo\s+manzano\b/gi, "Arroyo Manzano, Distrito Nacional"],
    [/\bvilla\s+marina\b/gi, "Villa Marina, Distrito Nacional"],
    [/\bla\s+esperanza\b/gi, "La Esperanza, Distrito Nacional"],
    [/\bmonumental\b/gi, "Avenida Monumental, Distrito Nacional"],

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


// --- FASE IA MOTOR: normalización predictiva y alias locales ------------------
const RD_AI_ALIAS_RULES = [
  [/\balcarizo?s?\b/gi, "Los Alcarrizos"],
  [/\blos\s+alca\b/gi, "Los Alcarrizos"],
  [/\bkm\s*9\b/gi, "Kilómetro 9 Autopista Duarte"],
  [/\bkilometro\s*9\b/gi, "Kilómetro 9 Autopista Duarte"],
  [/\bkm\s*12\b/gi, "Kilómetro 12 Autopista Duarte"],
  [/\bmanogua\s*yabo\b/gi, "Manoguayabo"],
  [/\bmanoguayavo\b/gi, "Manoguayabo"],
  [/\blas\s+palma\b/gi, "Las Palmas de Herrera"],
  [/\bpalmas\s+herrera\b/gi, "Las Palmas de Herrera"],
  [/\bbuenos\s+aire\s+herrera\b/gi, "Buenos Aires de Herrera"],
  [/\bb\.\s*a\.\s*herrera\b/gi, "Buenos Aires de Herrera"],
  [/\bcarmen\s+renata\s*1\b/gi, "Residencial Carmen Renata I"],
  [/\bcarmen\s+renata\s*i\b/gi, "Residencial Carmen Renata I"],
  [/\bcarmen\s+renata\s*2\b/gi, "Residencial Carmen Renata II"],
  [/\bduarte\s+vieja\b/gi, "Autopista Duarte Vieja"],
  [/\b27\s+feb\b/gi, "27 de Febrero"],
  [/\bprol\s+27\b/gi, "Prolongación 27 de Febrero"],
  [/\bprol\s+inde?pendencia\b/gi, "Prolongación Independencia"],
  [/\bisabel\s+aguilar\b/gi, "Isabel Aguiar"],
  [/\biv[aá]n\s+guzm[aá]n\b/gi, "Iván Guzmán Klang"],
  [/\bvinicio\s+calbenti\b/gi, "Hospital Vinicio Calventi"],
  [/\bmarcelino\s+velez\b/gi, "Hospital Marcelino Vélez Santana"],
  [/\bplaza\s+duarte\b/gi, "Plaza Duarte Herrera"],
  [/\bprice\s*smart\b/gi, "PriceSmart Herrera"],
  [/\boccidental\s+mall\b/gi, "Occidental Mall"],
  [/\bcarrefour\b/gi, "Carrefour Autopista Duarte"],
  [/\bmegacentro\b/gi, "MegaCentro Santo Domingo Este"],
];

const aiNormalizeAddress = (raw) => {
  let t = String(raw || "").trim();
  if (!t) return t;
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  t = t.replace(/[;|]+/g, ", ").replace(/\s{2,}/g, " ");
  for (const [re, repl] of RD_AI_ALIAS_RULES) t = t.replace(re, repl);
  // Si no trae ciudad, sesga al Gran Santo Domingo; si trae SDO/Los Alcarrizos, prioriza Oeste.
  const low = t.toLowerCase();
  if (!/santo domingo|distrito nacional|rep[uú]blica dominicana|los alcarrizos|pedro brand|pantoja/i.test(t)) {
    if (/herrera|bayona|engombe|manoguayabo|caobas|palmas|carmen renata|isabel aguiar|hato nuevo|caballona|duarte/i.test(t)) {
      t += ", Santo Domingo Oeste";
    } else {
      t += ", Santo Domingo";
    }
  }
  return expandRDAddress(t);
};

const aiTokens = (txt) => String(txt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(w=>w.length>2);
const aiCandidateBoost = (formatted, original) => {
  const a = new Set(aiTokens(formatted));
  const b = aiTokens(original);
  if (!b.length) return 0;
  let hit = 0;
  b.forEach(w => { if (a.has(w)) hit += 1; });
  return Math.min(12, Math.round((hit / b.length) * 12));
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

  const addrTokens = new Set(rdAddrTokens(addr));
  const origTokens = rdAddrTokens(original);
  if (origTokens.length) {
    const important = origTokens.filter(w => !/^\d+$/.test(w));
    const hits = important.filter(w => addrTokens.has(w) || addrLower.includes(w)).length;
    score += Math.min(14, Math.round((hits / Math.max(important.length,1)) * 14));
    if (hits === 0 && important.length >= 2) score -= 18;
  }

  const anchor = rdContextHint(original);
  if (anchor) {
    const dAnchor = hav({lat,lng}, anchor);
    if (dAnchor <= 1.2) score += 16;
    else if (dAnchor <= 3) score += 10;
    else if (dAnchor <= 6) score += 4;
    else if (dAnchor > 12) score -= 32;
    else if (dAnchor > 8) score -= 18;
  }
  // Si hay múltiples referencias locales en el texto, escoger resultados cercanos a cualquiera de ellas.
  const rdAnchorMatches = rdAnchorCandidatesFromText(original);
  if (rdAnchorMatches.length) {
    const minD = Math.min(...rdAnchorMatches.map(x => hav({lat,lng}, x.anchor)));
    if (minD <= 1.5) score += 12;
    else if (minD <= 3) score += 7;
    else if (minD > 10) score -= 24;
  }

  score += rdBaseDistanceBonus(lat, lng);

  // Penalizar si el resultado es solo país/provincia/sector genérico (demasiado vago)
  if (types.includes("country") || types.includes("administrative_area_level_1")) score = Math.min(score, 20);
  if ((types.includes("neighborhood") || types.includes("sublocality")) && /calle|avenida|av\.?|#|no\.?|residencial|edificio/i.test(original)) score = Math.min(score, 67);

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

const rdNormText = (v) => String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const rdAddrTokens = (v) => rdNormText(v).split(" ").filter(w => w.length > 2 && !["santo","domingo","republica","dominicana","distrito","nacional","calle","avenida","sector","residencial","edificio","apartamento","apto","casa"].includes(w));
const rdContextHint = (txt) => findAnchor(txt) || null;
const rdBaseDistanceBonus = (lat, lng) => {
  const d = hav({lat,lng}, DEPOT);
  if (d <= 2.5) return 12;
  if (d <= 5) return 9;
  if (d <= 8) return 6;
  if (d <= 12) return 2;
  if (d > 35) return -18;
  if (d > 20) return -8;
  return 0;
};
const rdBuildStrictStopQuery = (raw, sector, ciudad, provincia, cp, addr2="") => {
  const clean = [raw, sector, ciudad, provincia, cp].filter(Boolean).join(", ");
  const ref = addr2 ? ` referencia ${addr2}` : "";
  return `${clean}${ref}`.replace(/\s+/g," ").trim();
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
      // Chunk no gestionado → mantener orden Haversine para ese chunk
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
      const pinColor = isSelected ? "#2563eb" : col;
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="0 0 44 50">
        <defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="${pinColor}" flood-opacity=".34"/></filter></defs>
        ${clusterRing}
        <g filter="url(#s)">
          <path d="M22 47s15-13 15-26A15 15 0 0 0 7 21c0 13 15 26 15 26z" fill="${pinColor}"/>
          <circle cx="22" cy="21" r="11" fill="#07101b" opacity=".28"/>
          <text x="22" y="25" text-anchor="middle" font-size="${fs}" font-weight="900" fill="white" font-family="Arial">${label}</text>
        </g>
      </svg>`;
      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: stop.lat, lng: stop.lng },
        icon: { url: "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(pinSvg), scaledSize: new window.google.maps.Size(44, 50), anchor: new window.google.maps.Point(22, 47) },
        zIndex: isSelected ? 100 : 10,
        optimized: true,
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

const AddressEditModal = ({ stop, onSave, onCancel }) => {
  const inputRef = useRef(null);
  const acRef    = useRef(null);
  const [saving,  setSaving]  = useState(false);
  const [found,   setFound]   = useState(null);  // { display, lat, lng, confidence }
  const [options, setOptions] = useState([]);    // alternativas Google / motor
  const [errMsg,  setErrMsg]  = useState("");
  const [query,   setQuery]   = useState("");

  // Limpia textos que vienen de chips/sugerencias anteriores. Nunca se manda a Google con
  // prefijos visuales como "Buscar dirección del Excel:".
  const cleanAddressText = (value) => String(value || "")
    .replace(/^\s*(buscar\s+)?direcci[oó]n\s+del\s+excel\s*:\s*/i, "")
    .replace(/^\s*buscar\s+(solo\s+)?en\s+el\s+sector\s*:\s*/i, "")
    .replace(/^\s*direcci[oó]n\s*2\s*\/\s*referencia\s*:\s*/i, "")
    .replace(/^\s*referencia\s*:\s*/i, "")
    .replace(/^\s*sector\s*:\s*/i, "")
    .replace(/^\s*pegar\s+coordenadas.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/,\s*,+/g, ",")
    .trim();

  const joinQuery = (...parts) => {
    const out = [];
    parts.flat().forEach(part => {
      const clean = cleanAddressText(part);
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!out.some(x => x.toLowerCase() === key)) out.push(clean);
    });
    return out.join(", ").replace(/\s+/g, " ").trim();
  };

  const mappedText   = cleanAddressText(stop.displayAddr || "");
  const looksMappedResult = (v="") => {
    const t = cleanAddressText(v).toLowerCase();
    return /^([a-z0-9+]{4,}\+|[-+]?\d{1,2}\.\d+)/i.test(t) || /rep[uú]blica dominicana/i.test(t) && !stop.excelRawAddr && !stop.excelAddr2;
  };
  const excelAddressRaw = cleanAddressText(stop.excelRawAddr || stop.originalRawAddr || stop.originalAddress || stop.addressExcel || stop.rawExcelAddress || stop.address || stop.direccion || stop.rawAddr || "");
  const excelAddress = cleanAddressText(excelAddressRaw && !looksMappedResult(excelAddressRaw) ? excelAddressRaw : (stop.rawAddr && !looksMappedResult(stop.rawAddr) ? stop.rawAddr : ""));
  const excelAddr2   = cleanAddressText(stop.excelAddr2 || stop.addr2 || stop.address2 || stop.direccion2 || stop.referencia || "");
  const excelSector  = cleanAddressText(stop.excelSector || stop.sector || "");
  const excelCity    = cleanAddressText(stop.excelCity || stop.city || stop.ciudad || "");
  const excelProvince= cleanAddressText(stop.excelProvince || stop.provincia || "");
  const excelCp      = cleanAddressText(stop.excelCp || stop.cp || stop.postalCode || "");

  const currentText = mappedText || excelAddress || "Sin dirección";
  // Estas tres sugerencias son EXACTAMENTE campos del Excel. No se mezclan con la dirección mapeada.
  const excelDirectionQuery = excelAddress;
  const address2Query = excelAddr2;
  const sectorQuery = joinQuery(excelSector, excelCity, excelProvince, excelCp, "República Dominicana");

  const buildGoogleMapsQuery = () => {
    // Abrir Google Maps con la dirección original del Excel, no con la ubicación ya mapeada.
    return excelAddress || joinQuery(excelSector, excelCity, excelProvince, excelCp, "República Dominicana") || currentText || "Santo Domingo Oeste, República Dominicana";
  };

  const openGoogleMaps = () => {
    const q = encodeURIComponent(buildGoogleMapsQuery());
    if (q) window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const applyFound = (candidate) => {
    if (!candidate) return;
    const clean = {
      display: cleanAddressText(candidate.display),
      lat: Number(candidate.lat),
      lng: Number(candidate.lng),
      confidence: candidate.confidence || 92,
    };
    setFound(clean);
    setErrMsg("");
  };

  // Estilo claro forzado para input + Google Places. La barra NO queda dark.
  useEffect(() => {
    const id = "rd-address-modal-light-style-v35";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        .rd-address-search-input,
        .rd-address-search-input:focus,
        .rd-address-search-input:active,
        .rd-address-search-input:hover {
          background:#ffffff!important;
          background-color:#ffffff!important;
          color:#0f172a!important;
          -webkit-text-fill-color:#0f172a!important;
          caret-color:#2563eb!important;
          color-scheme:light!important;
          -webkit-appearance:none!important;
          appearance:none!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.92), 0 0 0 4px rgba(37,99,235,.08)!important;
          filter:none!important;
          mix-blend-mode:normal!important;
        }
        .rd-address-search-input::placeholder { color:#94a3b8!important; -webkit-text-fill-color:#94a3b8!important; opacity:1!important; }
        .rd-address-search-input:-webkit-autofill,
        .rd-address-search-input:-webkit-autofill:hover,
        .rd-address-search-input:-webkit-autofill:focus {
          -webkit-box-shadow:0 0 0 1000px #ffffff inset!important;
          -webkit-text-fill-color:#0f172a!important;
          transition:background-color 9999s ease-in-out 0s!important;
        }
        .pac-container { z-index:99999!important; background:#fff!important; border:1px solid #dbeafe!important; border-radius:16px!important; box-shadow:0 18px 46px rgba(15,23,42,0.16)!important; margin-top:8px!important; font-family:'Inter',sans-serif!important; overflow:hidden!important; padding:6px!important; }
        .pac-item { background:#fff!important; color:#334155!important; padding:12px 14px!important; cursor:pointer!important; border-top:1px solid #eff6ff!important; font-size:13px!important; border-radius:10px!important; font-family:'Inter',sans-serif!important; }
        .pac-item:first-child { border-top:0!important; }
        .pac-item:hover,.pac-item-selected { background:#eff6ff!important; }
        .pac-item-query { color:#0f172a!important; font-size:13px!important; font-weight:750!important; font-family:'Inter',sans-serif!important; }
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
          const result = {
            display: place.formatted_address || place.name,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            confidence: 98,
          };
          applyFound(result);
          setOptions([result]);
        }
      });
      setTimeout(() => inputRef.current?.focus(), 80);
    });
    return () => { if (acRef.current) { window.google?.maps?.event?.clearInstanceListeners(acRef.current); acRef.current = null; } };
  }, []);

  const handleSearch = async () => {
    const text = cleanAddressText(inputRef.current?.value || query);
    if (!text) return;
    setFound(null); setOptions([]); setErrMsg(""); setSaving(true);

    const coords = detectCoords(text);
    if (coords) {
      const result = { display: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`, lat: coords.lat, lng: coords.lng, confidence: 99 };
      applyFound(result); setOptions([result]); setSaving(false); return;
    }

    if (isPlusCode(text)) {
      const r = await decodePlusCodeGoogle(text);
      if (r.ok) {
        const result = { display: r.display || text, lat: r.lat, lng: r.lng, confidence: 99 };
        applyFound(result); setOptions([result]); setSaving(false); return;
      }
    }

    // Búsqueda escalonada desde el modal: texto elegido/escrito → Dirección 2 → Sector.
    // Las sugerencias visuales siguen siendo solo campos limpios del Excel.
    const searchVariants = [
      text,
      joinQuery(text, excelSector, excelCity || "Santo Domingo Oeste", excelProvince, excelCp, "República Dominicana"),
      address2Query ? joinQuery(address2Query, excelSector, excelCity || "Santo Domingo Oeste", excelProvince, excelCp, "República Dominicana") : "",
      sectorQuery,
    ].filter(Boolean);

    const uniqueVariants = [...new Set(searchVariants.map(cleanAddressText).filter(Boolean))].slice(0, 4);
    const collected = [];
    let firstOk = null;

    for (const qv of uniqueVariants) {
      try {
        const r = await geocodeWithGoogle(qv);
        if (!r.ok) continue;
        if (!firstOk) firstOk = r;
        collected.push({ display: r.display, lat: r.lat, lng: r.lng, confidence: r.confidence || 92 });
        (r.allResults || []).forEach(x => {
          if (x && x.lat && x.lng && x.display) collected.push({ display: x.display, lat: x.lat, lng: x.lng, confidence: x.confidence || 80 });
        });
      } catch (_) {}
    }

    setSaving(false);
    if (firstOk || collected.length) {
      const merged = collected
        .filter(x => x && x.display && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)))
        .map(x => ({ ...x, display: cleanAddressText(x.display) }))
        .filter((x, idx, arr) => idx === arr.findIndex(y => {
          const sameText = String(y.display).toLowerCase() === String(x.display).toLowerCase();
          const sameCoord = Math.abs(Number(y.lat)-Number(x.lat)) < 0.00008 && Math.abs(Number(y.lng)-Number(x.lng)) < 0.00008;
          return sameText || sameCoord;
        }))
        .sort((a,b) => (b.confidence||0) - (a.confidence||0))
        .slice(0, 12);
      const main = merged[0] || { display: firstOk.display, lat: firstOk.lat, lng: firstOk.lng, confidence: firstOk.confidence || 92 };
      applyFound(main);
      setOptions(merged.length ? merged : [main]);
    } else {
      setErrMsg("No encontrada. Prueba con Dirección del Excel, Dirección 2, Sector, coordenadas o Plus Code.");
    }
  };

  const quickFill = (value) => {
    const clean = cleanAddressText(value);
    if (inputRef.current) inputRef.current.value = clean;
    setQuery(clean);
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleConfirm = () => { if (found) onSave(found); };

  const quickChips = [
    excelDirectionQuery && { label:"1. Dirección del Excel", value: excelDirectionQuery, icon:"📍", hint:"Usar dirección principal" },
    address2Query && { label:"2. Dirección 2 / Referencia", value: address2Query, icon:"🏷️", hint:"Usar referencia como apoyo" },
    sectorQuery && { label:"3. Sector", value: sectorQuery, icon:"🌐", hint:"Buscar dentro del sector" },
  ].filter(Boolean);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(15,23,42,0.48)", backdropFilter:"blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>

      <style>{`@keyframes addrPop{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ width:620, maxWidth:"94vw", background:"#ffffff", borderRadius:24, boxShadow:"0 30px 90px rgba(15,23,42,0.28)", overflow:"hidden", animation:"addrPop .22s cubic-bezier(.4,0,.2,1)", border:"1px solid rgba(219,234,254,0.9)" }}>

        {/* HEADER PREMIUM LIGHT */}
        <div style={{ background:"linear-gradient(135deg,#2563eb 0%,#1d4ed8 58%,#1e3a8a 100%)", padding:"20px 24px", display:"flex", alignItems:"center", gap:14, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-50, top:-50, width:150, height:150, borderRadius:"50%", background:"rgba(255,255,255,0.11)" }}/>
          <div style={{ width:44,height:44,borderRadius:14,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.25)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div style={{ flex:1, minWidth:0, position:"relative" }}>
            <div style={{ fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:900,color:"white",letterSpacing:"-.3px" }}>Corregir ubicación</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.78)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {stop.client} · Parada #{stop.stopNum || "?"} · Dirección Excel, referencia o sector
            </div>
          </div>
          <button onClick={onCancel} style={{ width:36,height:36,borderRadius:12,border:"1px solid rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.12)",color:"white",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0, position:"relative" }}>✕</button>
        </div>

        <div style={{ padding:"22px 24px 24px", background:"linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)" }}>

          {/* DIRECCIÓN ACTUAL */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:10, marginBottom:16 }}>
            <div style={{ fontSize:10,color:"#64748b",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1.2px" }}>DIRECCIÓN ACTUAL EN EL SISTEMA</div>
            <div style={{ background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:16,padding:"14px 15px",display:"flex",gap:11,alignItems:"flex-start",boxShadow:"0 10px 26px rgba(15,23,42,0.04)" }}>
              <div style={{ width:34,height:34,borderRadius:11,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>📍</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:14,color:"#0f172a",fontWeight:700,lineHeight:1.45 }}>{currentText || "Sin dirección"}</div>
                {stop.lat && <div style={{ fontSize:11,color:"#94a3b8",marginTop:4,fontFamily:"monospace" }}>{stop.lat?.toFixed(5)}, {stop.lng?.toFixed(5)}</div>}
              </div>
            </div>
          </div>

          {/* BUSCADOR CLARO */}
          <div style={{ marginBottom:14, background:"#ffffff", border:"1px solid #dbeafe", borderRadius:18, padding:14, boxShadow:"0 18px 40px rgba(37,99,235,0.08)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10 }}>
              <div>
                <div style={{ fontSize:11,color:"#2563eb",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1px" }}>NUEVA DIRECCIÓN</div>
                <div style={{ fontSize:11,color:"#64748b",marginTop:3 }}>Elige una sugerencia limpia o escribe igual que en Google Maps.</div>
              </div>
              <button onClick={openGoogleMaps}
                style={{ border:"1px solid #bfdbfe", background:"linear-gradient(180deg,#eff6ff,#dbeafe)", color:"#1d4ed8", borderRadius:12, padding:"9px 11px", fontSize:11, fontFamily:"'Syne',sans-serif", fontWeight:900, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:6 }}>
                <span>🗺️</span> Google Maps
              </button>
            </div>

            <div style={{ display:"flex",gap:10,alignItems:"stretch" }}>
              <div style={{ flex:1, position:"relative", background:"#ffffff", backgroundColor:"#ffffff", borderRadius:14, colorScheme:"light" }}>
                <svg style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", zIndex:2 }} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  ref={inputRef}
                  className="rd-address-search-input"
                  defaultValue=""
                  onChange={e => setQuery(cleanAddressText(e.target.value))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } if (e.key === "Escape") onCancel(); }}
                  placeholder="Ej: Calle Segunda, Caballona / Plus Code / 18.x,-70.x"
                  autoComplete="off"
                  spellCheck="false"
                  style={{ width:"100%", boxSizing:"border-box", background:"#ffffff", backgroundColor:"#ffffff", border:"2px solid #bfdbfe", borderRadius:14, padding:"14px 15px 14px 44px", color:"#0f172a", WebkitTextFillColor:"#0f172a", fontSize:14, fontFamily:"'Inter',sans-serif", fontWeight:600, outline:"none", caretColor:"#2563eb", colorScheme:"light", WebkitAppearance:"none", appearance:"none" }}
                />
              </div>
              <button onClick={handleSearch} disabled={saving}
                style={{ padding:"0 18px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"white",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:saving?"not-allowed":"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:7,opacity:saving?0.75:1,boxShadow:"0 12px 28px rgba(37,99,235,0.28)" }}>
                {saving ? <div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"white",borderRadius:"50%",animation:"spin .8s linear infinite" }}/> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
                {saving ? "Buscando" : "Buscar"}
              </button>
            </div>

            <div style={{ display:"grid", gap:8, marginTop:12 }}>
              {quickChips.map((chip, idx) => (
                <button key={idx} onClick={() => quickFill(chip.value)}
                  style={{ border:"1px solid #dbeafe", background:idx===0?"#eff6ff":"#ffffff", color:"#0f172a", borderRadius:14, padding:"10px 12px", fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight:650, cursor:"pointer", lineHeight:1.35, textAlign:"left", display:"flex", gap:10, alignItems:"flex-start", boxShadow:"0 8px 18px rgba(15,23,42,0.035)" }}>
                  <span style={{ width:26,height:26,borderRadius:9,background:idx===0?"#2563eb":"#f1f5f9",color:idx===0?"white":"#2563eb",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{chip.icon}</span>
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:"block",fontSize:11,color:"#2563eb",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:".3px" }}>{chip.label}</span>
                    <span style={{ display:"block",marginTop:3,color:"#334155",fontWeight:600,whiteSpace:"normal" }}>{chip.value}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* OPCIONES / RESULTADOS */}
          {options.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                <div style={{ fontSize:10,color:"#64748b",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1px" }}>OPCIONES ENCONTRADAS</div>
                <div style={{ fontSize:10,color:"#2563eb",fontFamily:"'Syne',sans-serif",fontWeight:800 }}>{options.length} resultado{options.length!==1?"s":""}</div>
              </div>
              <div style={{ display:"grid", gap:8, maxHeight:190, overflow:"auto", paddingRight:2 }}>
                {options.map((opt, idx) => {
                  const active = found && Math.abs(found.lat-opt.lat)<0.000001 && Math.abs(found.lng-opt.lng)<0.000001;
                  return (
                    <button key={`${opt.display}-${idx}`} onClick={() => applyFound(opt)}
                      style={{ textAlign:"left", border:active?"2px solid #2563eb":"1px solid #e2e8f0", background:active?"#eff6ff":"#ffffff", borderRadius:14, padding:"11px 12px", cursor:"pointer", boxShadow:active?"0 10px 24px rgba(37,99,235,0.10)":"0 6px 18px rgba(15,23,42,0.04)", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:30,height:30,borderRadius:10,background:active?"#2563eb":"#f1f5f9",color:active?"white":"#2563eb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:900,flexShrink:0 }}>{idx+1}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,color:"#0f172a",fontWeight:650,lineHeight:1.45,fontFamily:"'Inter',sans-serif" }}>{cleanAddressText(opt.display)}</div>
                        <div style={{ marginTop:4,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                          <span style={{ fontSize:10,color:"#64748b",fontFamily:"monospace" }}>{Number(opt.lat).toFixed(5)}, {Number(opt.lng).toFixed(5)}</span>
                          <span style={{ fontSize:10,color:opt.confidence>=80?"#16a34a":"#f59e0b",background:opt.confidence>=80?"#dcfce7":"#fef3c7",padding:"2px 7px",borderRadius:999,fontFamily:"'Syne',sans-serif",fontWeight:900 }}>{opt.confidence}%</span>
                        </div>
                      </div>
                      {active && <div style={{ color:"#2563eb",fontWeight:900 }}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {found && options.length === 0 && (
            <div style={{ background:"#f0fdf4",border:"1px solid #86efac",borderRadius:14,padding:"13px 14px",marginBottom:14,animation:"addrPop .2s ease" }}>
              <div style={{ fontSize:10,color:"#16a34a",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1px",marginBottom:6 }}>✓ DIRECCIÓN ENCONTRADA</div>
              <div style={{ fontSize:13,color:"#111827",fontWeight:700,marginBottom:3 }}>{found.display}</div>
              <div style={{ fontSize:11,color:"#4b5563",fontFamily:"monospace" }}>{found.lat?.toFixed(5)}, {found.lng?.toFixed(5)}</div>
            </div>
          )}

          {errMsg && (
            <div style={{ background:"#fff7ed",border:"1px solid #fdba74",borderRadius:14,padding:"12px 14px",marginBottom:14,fontSize:12,color:"#9a3412",lineHeight:1.45 }}>
              ⚠ {errMsg}
              <div style={{ marginTop:8 }}><button onClick={openGoogleMaps} style={{ border:"1px solid #fed7aa",background:"white",color:"#ea580c",borderRadius:10,padding:"7px 10px",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:"pointer" }}>Abrir búsqueda en Google Maps</button></div>
            </div>
          )}

          <div style={{ display:"flex",gap:10,marginTop:4 }}>
            <button onClick={onCancel}
              style={{ flex:1,padding:"12px",borderRadius:14,border:"1px solid #dbe3ef",background:"#ffffff",color:"#64748b",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:"pointer" }}>
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={!found}
              style={{ flex:2,padding:"12px",borderRadius:14,border:"none",background:found?"linear-gradient(135deg,#16a34a,#059669)":"#e5e7eb",color:found?"white":"#94a3b8",fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:found?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .15s",boxShadow:found?"0 12px 30px rgba(22,163,74,0.26)":"none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7"><path d="M20 6L9 17l-5-5"/></svg>
              {found ? "Guardar ubicación seleccionada" : "Selecciona o busca una ubicación"}
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
      style={{ width:"100%", background:"#ffffff", backgroundColor:"#ffffff", border:"1px solid #93c5fd", borderRadius:9, padding:"10px 13px", color:"#0f172a", WebkitTextFillColor:"#0f172a", fontSize:12, fontFamily:"'Inter',sans-serif", outline:"none", caretColor:"#2563eb", colorScheme:"light", boxShadow:"0 0 0 3px rgba(59,130,246,0.10)" }} autoFocus/>
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
  const [driverName, setDriverName] = useState("");
  const [routeName, setRouteName]   = useState("Ruta importada");
  const fileRef = useRef(null);

  const REQUIRED_FIELDS = ["address"];
  const OPTIONAL_FIELDS = ["client","phone","notes","sector","address2","priority"];
  const FIELD_LABELS = { address:"Dirección *", client:"Cliente", phone:"Teléfono", notes:"Notas", sector:"Sector/Base", address2:"Dirección 2 / Referencia", priority:"Prioridad" };

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
              <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9"}}>Importar rutas</div>
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
                    <div style={{fontSize:12,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#60a5fa"}}>📦 Motor de mensajería</div>
                    <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>Vecino más cercano desde la base · Mínima distancia total</div>
                  </div>
                  <button onClick={runOptimize} style={{padding:"8px 16px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",color:"white",fontSize:11,fontFamily:"'Syne',sans-serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px #3b82f630"}}>
                    📦 Optimizar
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
              {stage==="upload"?"":stage==="mapping"?"Validar y geocodificar →":stage==="optimize"?"✓ Crear ruta":""}
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
                  📦 Analizar {bulkText.split("\n").filter(l=>l.trim()).length} direcciones
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
  "los rios":                        { lat: 18.5058, lng: -69.9758, city: "Distrito Nacional" },
  "los ríos":                        { lat: 18.5058, lng: -69.9758, city: "Distrito Nacional" },
  "colinas de los rios":             { lat: 18.5085, lng: -69.9810, city: "Distrito Nacional" },
  "colinas de los ríos":             { lat: 18.5085, lng: -69.9810, city: "Distrito Nacional" },
  "los girasoles i":                 { lat: 18.5310, lng: -69.9960, city: "Distrito Nacional" },
  "los girasoles ii":                { lat: 18.5335, lng: -69.9990, city: "Distrito Nacional" },
  "los girasoles iii":               { lat: 18.5360, lng: -70.0020, city: "Distrito Nacional" },
  "los girasoles":                   { lat: 18.5325, lng: -69.9980, city: "Distrito Nacional" },
  "ciudad real":                     { lat: 18.5372, lng: -69.9840, city: "Distrito Nacional" },
  "ciudad real ii":                  { lat: 18.5385, lng: -69.9865, city: "Distrito Nacional" },
  "altos de arroyo hondo":           { lat: 18.5265, lng: -69.9690, city: "Distrito Nacional" },
  "arroyo manzano":                  { lat: 18.5460, lng: -69.9790, city: "Distrito Nacional" },
  "villa marina":                    { lat: 18.5108, lng: -69.9925, city: "Distrito Nacional" },
  "la esperanza":                    { lat: 18.5075, lng: -69.9720, city: "Distrito Nacional" },
  "residencial monumental":          { lat: 18.5320, lng: -69.9965, city: "Distrito Nacional" },
  "avenida monumental":              { lat: 18.5305, lng: -69.9960, city: "Distrito Nacional" },
  "monumental":                      { lat: 18.5305, lng: -69.9960, city: "Distrito Nacional" },
  "carrefour autopista duarte":      { lat: 18.5018, lng: -69.9826, city: "Distrito Nacional" },
  "republica de colombia":           { lat: 18.5300, lng: -69.9700, city: "Distrito Nacional" },

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
  "los girasoles norte":             { lat: 18.5700, lng: -69.9700, city: "Santo Domingo Norte" },
  "el almirante":                    { lat: 18.5750, lng: -69.9600, city: "Santo Domingo Norte" },
  "sabana perdida":                  { lat: 18.6000, lng: -69.9400, city: "Santo Domingo Norte" },
  "guaricano":                       { lat: 18.5550, lng: -69.9800, city: "Santo Domingo Norte" },
  "pantoja":                         { lat: 18.5500, lng: -70.0100, city: "Santo Domingo Norte" },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR RD SMART LOCATION PACK v29
// Expande el diccionario local sin cambiar la lógica de rutas/Firebase.
// Más sectores, residenciales, calles, colegios, negocios y referencias comunes
// de SDO + DN para que Google reciba mejor contexto y el fallback quede cerca.
// ─────────────────────────────────────────────────────────────────────────────
const RD_LOCATION_BOOSTERS = {
  "los girasoles": { lat:18.5325, lng:-69.9980, city:"Distrito Nacional" },
  "los girasoles 1": { lat:18.5310, lng:-69.9960, city:"Distrito Nacional" },
  "los girasoles i": { lat:18.5310, lng:-69.9960, city:"Distrito Nacional" },
  "los girasoles 2": { lat:18.5335, lng:-69.9990, city:"Distrito Nacional" },
  "los girasoles ii": { lat:18.5335, lng:-69.9990, city:"Distrito Nacional" },
  "los girasoles 3": { lat:18.5360, lng:-70.0020, city:"Distrito Nacional" },
  "los girasoles iii": { lat:18.5360, lng:-70.0020, city:"Distrito Nacional" },
  "avenida monumental los girasoles": { lat:18.5315, lng:-69.9965, city:"Distrito Nacional" },
  "residencial monumental": { lat:18.5320, lng:-69.9965, city:"Distrito Nacional" },
  "residencial carmen renata": { lat:18.5368, lng:-69.9925, city:"Distrito Nacional" },
  "ciudad real": { lat:18.5372, lng:-69.9840, city:"Distrito Nacional" },
  "ciudad real ii": { lat:18.5385, lng:-69.9865, city:"Distrito Nacional" },
  "arroyo manzano": { lat:18.5460, lng:-69.9790, city:"Distrito Nacional" },
  "pantoja": { lat:18.5500, lng:-70.0100, city:"Santo Domingo Oeste" },
  "los peralejos": { lat:18.5268, lng:-69.9938, city:"Distrito Nacional" },
  "brisas del norte": { lat:18.5265, lng:-69.9985, city:"Distrito Nacional" },
  "los rios": { lat:18.5058, lng:-69.9758, city:"Distrito Nacional" },
  "los ríos": { lat:18.5058, lng:-69.9758, city:"Distrito Nacional" },
  "colinas de los rios": { lat:18.5085, lng:-69.9810, city:"Distrito Nacional" },
  "colinas de los ríos": { lat:18.5085, lng:-69.9810, city:"Distrito Nacional" },
  "villa marina": { lat:18.5108, lng:-69.9925, city:"Distrito Nacional" },
  "la esperanza": { lat:18.5075, lng:-69.9720, city:"Distrito Nacional" },
  "arroyo hondo": { lat:18.4910, lng:-69.9650, city:"Distrito Nacional" },
  "altos de arroyo hondo": { lat:18.5265, lng:-69.9690, city:"Distrito Nacional" },
  "cuesta hermosa": { lat:18.5142, lng:-69.9675, city:"Distrito Nacional" },
  "cuesta brava": { lat:18.5097, lng:-69.9655, city:"Distrito Nacional" },
  "jardin botanico": { lat:18.4949, lng:-69.9519, city:"Distrito Nacional" },
  "gbc los rios": { lat:18.5059, lng:-69.9761, city:"Distrito Nacional" },
  "colegio mi nido de amor": { lat:18.5068, lng:-69.9765, city:"Distrito Nacional" },
  "cristo rey": { lat:18.4960, lng:-69.9530, city:"Distrito Nacional" },
  "la agustinita": { lat:18.5030, lng:-69.9490, city:"Distrito Nacional" },
  "ensanche la fe": { lat:18.5010, lng:-69.9430, city:"Distrito Nacional" },
  "ensanche luperon": { lat:18.5030, lng:-69.9600, city:"Distrito Nacional" },
  "ensanche espaillat": { lat:18.4840, lng:-69.9450, city:"Distrito Nacional" },
  "villa juana": { lat:18.4940, lng:-69.9360, city:"Distrito Nacional" },
  "villa consuelo": { lat:18.4895, lng:-69.9200, city:"Distrito Nacional" },
  "capotillo": { lat:18.5040, lng:-69.9360, city:"Distrito Nacional" },
  "gualey": { lat:18.5010, lng:-69.9280, city:"Distrito Nacional" },
  "guachupita": { lat:18.5050, lng:-69.9200, city:"Distrito Nacional" },
  "herrera": { lat:18.4890, lng:-70.0023, city:"Santo Domingo Oeste" },
  "el palmar de herrera": { lat:18.4815, lng:-70.0068, city:"Santo Domingo Oeste" },
  "palmar de herrera": { lat:18.4815, lng:-70.0068, city:"Santo Domingo Oeste" },
  "colegio arcoiris azul": { lat:18.4820, lng:-70.0062, city:"Santo Domingo Oeste" },
  "colegio arcoiris": { lat:18.4820, lng:-70.0062, city:"Santo Domingo Oeste" },
  "respaldo jose reyes": { lat:18.4824, lng:-70.0068, city:"Santo Domingo Oeste" },
  "respaldo josé reyes": { lat:18.4824, lng:-70.0068, city:"Santo Domingo Oeste" },
  "buenos aires de herrera": { lat:18.4865, lng:-70.0105, city:"Santo Domingo Oeste" },
  "las palmas de herrera": { lat:18.4840, lng:-70.0060, city:"Santo Domingo Oeste" },
  "el cafe de herrera": { lat:18.4820, lng:-70.0180, city:"Santo Domingo Oeste" },
  "el café de herrera": { lat:18.4820, lng:-70.0180, city:"Santo Domingo Oeste" },
  "zona industrial herrera": { lat:18.4830, lng:-70.0200, city:"Santo Domingo Oeste" },
  "avenida isabel aguiar": { lat:18.5050, lng:-70.0280, city:"Santo Domingo Oeste" },
  "prolongacion 27 de febrero": { lat:18.4780, lng:-70.0050, city:"Santo Domingo Oeste" },
  "prolongación 27 de febrero": { lat:18.4780, lng:-70.0050, city:"Santo Domingo Oeste" },
  "residencial cumbre del paraiso": { lat:18.4860, lng:-70.0128, city:"Santo Domingo Oeste" },
  "cumbre del paraiso": { lat:18.4860, lng:-70.0128, city:"Santo Domingo Oeste" },
  "las orquideas": { lat:18.4852, lng:-70.0136, city:"Santo Domingo Oeste" },
  "las orquídeas": { lat:18.4852, lng:-70.0136, city:"Santo Domingo Oeste" },
  "mr signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "mr. signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "publicitaria mr signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "las caobas": { lat:18.5020, lng:-70.0180, city:"Santo Domingo Oeste" },
  "las caobitas": { lat:18.5040, lng:-70.0200, city:"Santo Domingo Oeste" },
  "bayona": { lat:18.5120, lng:-70.0320, city:"Santo Domingo Oeste" },
  "manoguayabo": { lat:18.5200, lng:-70.0450, city:"Santo Domingo Oeste" },
  "buenos aires de manoguayabo": { lat:18.5180, lng:-70.0470, city:"Santo Domingo Oeste" },
  "engombe": { lat:18.5250, lng:-70.0600, city:"Santo Domingo Oeste" },
  "altos de engombe": { lat:18.5280, lng:-70.0630, city:"Santo Domingo Oeste" },
  "hato nuevo": { lat:18.5350, lng:-70.0750, city:"Santo Domingo Oeste" },
  "batey bienvenido": { lat:18.5400, lng:-70.0800, city:"Santo Domingo Oeste" },
  "la venta": { lat:18.5100, lng:-70.0300, city:"Santo Domingo Oeste" },
  "km 9 autopista duarte": { lat:18.5030, lng:-69.9900, city:"Distrito Nacional" },
  "kilometro 9 autopista duarte": { lat:18.5030, lng:-69.9900, city:"Distrito Nacional" },
  "km9": { lat:18.5030, lng:-69.9900, city:"Distrito Nacional" },
  "autopista duarte": { lat:18.5100, lng:-70.0500, city:"Santo Domingo Oeste" },
  "avenida republica de colombia": { lat:18.5300, lng:-69.9700, city:"Distrito Nacional" },
  "república de colombia": { lat:18.5300, lng:-69.9700, city:"Distrito Nacional" },
};
Object.assign(SDO_ANCHORS, RD_LOCATION_BOOSTERS);

// ─────────────────────────────────────────────────────────────────────────────
// V32: REFUERZO SDO / LOS ALCARRIZOS
// Solo alimenta el motor de búsqueda y fallback. No toca rutas, Firebase ni UI admin.
// Regla: si el Excel trae sector SDO, Google recibe sector + ciudad; si no encuentra
// la calle exacta, el paquete queda dentro del sector o cerca de la referencia.
// ─────────────────────────────────────────────────────────────────────────────
const RD_SDO_EXTRA_ANCHORS = {
  // Los Alcarrizos / corredor Duarte
  "los alcarrizos": { lat:18.5462, lng:-70.1066, city:"Santo Domingo Oeste" },
  "pueblo nuevo los alcarrizos": { lat:18.5455, lng:-70.1015, city:"Santo Domingo Oeste" },
  "pueblo nuevo de los alcarrizos": { lat:18.5455, lng:-70.1015, city:"Santo Domingo Oeste" },
  "los americanos": { lat:18.5485, lng:-70.1125, city:"Santo Domingo Oeste" },
  "barrio landia": { lat:18.5480, lng:-70.1160, city:"Santo Domingo Oeste" },
  "los libertadores": { lat:18.5510, lng:-70.1035, city:"Santo Domingo Oeste" },
  "la piña": { lat:18.5520, lng:-70.1085, city:"Santo Domingo Oeste" },
  "la pina": { lat:18.5520, lng:-70.1085, city:"Santo Domingo Oeste" },
  "la union los alcarrizos": { lat:18.5488, lng:-70.0992, city:"Santo Domingo Oeste" },
  "la unión los alcarrizos": { lat:18.5488, lng:-70.0992, city:"Santo Domingo Oeste" },
  "savica los alcarrizos": { lat:18.5440, lng:-70.1045, city:"Santo Domingo Oeste" },
  "invi los alcarrizos": { lat:18.5417, lng:-70.1090, city:"Santo Domingo Oeste" },
  "invi cea": { lat:18.5417, lng:-70.1090, city:"Santo Domingo Oeste" },
  "nuevo amanecer los alcarrizos": { lat:18.5395, lng:-70.1115, city:"Santo Domingo Oeste" },
  "los barrancones": { lat:18.5375, lng:-70.1055, city:"Santo Domingo Oeste" },
  "nazareno los alcarrizos": { lat:18.5502, lng:-70.1083, city:"Santo Domingo Oeste" },
  "lebron los alcarrizos": { lat:18.5468, lng:-70.1185, city:"Santo Domingo Oeste" },
  "km 14 autopista duarte": { lat:18.5368, lng:-70.0806, city:"Santo Domingo Oeste" },
  "kilometro 14 autopista duarte": { lat:18.5368, lng:-70.0806, city:"Santo Domingo Oeste" },
  "km 17 autopista duarte": { lat:18.5515, lng:-70.1110, city:"Santo Domingo Oeste" },
  "kilometro 17 autopista duarte": { lat:18.5515, lng:-70.1110, city:"Santo Domingo Oeste" },
  "entrada los alcarrizos": { lat:18.5448, lng:-70.1005, city:"Santo Domingo Oeste" },
  "puente los alcarrizos": { lat:18.5448, lng:-70.1005, city:"Santo Domingo Oeste" },
  "hospital vinicio calventi": { lat:18.5488, lng:-70.1115, city:"Santo Domingo Oeste" },
  "vinicio calventi": { lat:18.5488, lng:-70.1115, city:"Santo Domingo Oeste" },
  "multicentro la sirena los alcarrizos": { lat:18.5460, lng:-70.1040, city:"Santo Domingo Oeste" },
  "la sirena los alcarrizos": { lat:18.5460, lng:-70.1040, city:"Santo Domingo Oeste" },
  "ole los alcarrizos": { lat:18.5469, lng:-70.1062, city:"Santo Domingo Oeste" },
  "supermercado ole los alcarrizos": { lat:18.5469, lng:-70.1062, city:"Santo Domingo Oeste" },

  // Herrera / SDO fino
  "residencial colinas del norte": { lat:18.5162, lng:-70.0079, city:"Santo Domingo Oeste" },
  "colinas del norte": { lat:18.5162, lng:-70.0079, city:"Santo Domingo Oeste" },
  "calle f16 colinas del norte": { lat:18.5162, lng:-70.0079, city:"Santo Domingo Oeste" },
  "residencial colinas del oeste": { lat:18.4770, lng:-70.0200, city:"Santo Domingo Oeste" },
  "colinas del oeste": { lat:18.4770, lng:-70.0200, city:"Santo Domingo Oeste" },
  "reparto rosa": { lat:18.4805, lng:-70.0050, city:"Santo Domingo Oeste" },
  "el palmar de herrera": { lat:18.4815, lng:-70.0068, city:"Santo Domingo Oeste" },
  "palmar de herrera": { lat:18.4815, lng:-70.0068, city:"Santo Domingo Oeste" },
  "calle respaldo jose reyes": { lat:18.4824, lng:-70.0068, city:"Santo Domingo Oeste" },
  "respaldo jose reyes": { lat:18.4824, lng:-70.0068, city:"Santo Domingo Oeste" },
  "colegio arcoiris azul": { lat:18.4820, lng:-70.0062, city:"Santo Domingo Oeste" },
  "colegio arcoiris": { lat:18.4820, lng:-70.0062, city:"Santo Domingo Oeste" },
  "cumbre del paraiso": { lat:18.4860, lng:-70.0128, city:"Santo Domingo Oeste" },
  "cumbre del paraíso": { lat:18.4860, lng:-70.0128, city:"Santo Domingo Oeste" },
  "residencial cumbre del paraiso": { lat:18.4860, lng:-70.0128, city:"Santo Domingo Oeste" },
  "las orquideas herrera": { lat:18.4852, lng:-70.0136, city:"Santo Domingo Oeste" },
  "las orquídeas herrera": { lat:18.4852, lng:-70.0136, city:"Santo Domingo Oeste" },
  "mr signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "mr. signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "publicitaria mr signs": { lat:18.4860, lng:-70.0082, city:"Santo Domingo Oeste" },
  "plaza comercial herrera": { lat:18.4895, lng:-70.0030, city:"Santo Domingo Oeste" },
  "jardines de herrera": { lat:18.4872, lng:-70.0158, city:"Santo Domingo Oeste" },
  "los jardines de herrera": { lat:18.4872, lng:-70.0158, city:"Santo Domingo Oeste" },
  "los pinos de herrera": { lat:18.4808, lng:-70.0165, city:"Santo Domingo Oeste" },
  "villa marina herrera": { lat:18.4868, lng:-70.0175, city:"Santo Domingo Oeste" },
  "puerta de hierro herrera": { lat:18.4828, lng:-70.0108, city:"Santo Domingo Oeste" },
  "plaza duarte herrera": { lat:18.4915, lng:-70.0018, city:"Santo Domingo Oeste" },
  "price smart herrera": { lat:18.5005, lng:-69.9910, city:"Santo Domingo Oeste" },
  "pricesmart herrera": { lat:18.5005, lng:-69.9910, city:"Santo Domingo Oeste" },
  "occidental mall": { lat:18.4900, lng:-70.0165, city:"Santo Domingo Oeste" },
  "hospital marcelino velez": { lat:18.4770, lng:-70.0107, city:"Santo Domingo Oeste" },
  "marcelino velez": { lat:18.4770, lng:-70.0107, city:"Santo Domingo Oeste" },

  // Caobas / Bayona / Manoguayabo / Engombe
  "residencial las caobas": { lat:18.5020, lng:-70.0180, city:"Santo Domingo Oeste" },
  "urbanizacion las caobas": { lat:18.5025, lng:-70.0175, city:"Santo Domingo Oeste" },
  "la isabela sdo": { lat:18.5500, lng:-70.0900, city:"Santo Domingo Oeste" },
  "arroyo bonito sdo": { lat:18.5050, lng:-70.0250, city:"Santo Domingo Oeste" },
  "arroyo bonito manoguayabo": { lat:18.5120, lng:-70.0365, city:"Santo Domingo Oeste" },
  "villa linda sdo": { lat:18.5150, lng:-70.0380, city:"Santo Domingo Oeste" },
  "villa linda manoguayabo": { lat:18.5150, lng:-70.0380, city:"Santo Domingo Oeste" },
  "los rieles manoguayabo": { lat:18.5175, lng:-70.0420, city:"Santo Domingo Oeste" },
  "la ciénaga manoguayabo": { lat:18.5220, lng:-70.0470, city:"Santo Domingo Oeste" },
  "la cienaga manoguayabo": { lat:18.5220, lng:-70.0470, city:"Santo Domingo Oeste" },
  "hato nuevo manoguayabo": { lat:18.5350, lng:-70.0750, city:"Santo Domingo Oeste" },
  "batey bienvenido manoguayabo": { lat:18.5400, lng:-70.0800, city:"Santo Domingo Oeste" },
};
Object.assign(SDO_ANCHORS, RD_SDO_EXTRA_ANCHORS);

const RD_LOCATION_ALIASES = [
  [/\bkm\s*9\b/gi, "kilometro 9 autopista duarte"],
  [/\bkm\s*1?4\b/gi, "km 14 autopista duarte"],
  [/\bkm\s*1?7\b/gi, "km 17 autopista duarte"],
  [/\baut\.?\s*duarte\b/gi, "autopista duarte"],
  [/\bautop\.?\s*duarte\b/gi, "autopista duarte"],
  [/\bres\.?\s+/gi, "residencial "],
  [/\burb\.?\s+/gi, "urbanizacion "],
  [/\bprol\.?\s+/gi, "prolongacion "],
  [/\bc\/?\s+(?=[a-z0-9])/gi, "calle "],
  [/\bcll?e?\.?\s+/gi, "calle "],
  [/\bav\.?\s+/gi, "avenida "],
  [/\bave\.?\s+/gi, "avenida "],
  [/\bno\.?\s*/gi, "numero "],
  [/\bfrente\s+a\b/gi, "frente a"],
  [/\bal\s+lado\s+de\b/gi, "cerca de"],
  [/\bcerca\s+del\b/gi, "cerca de"],
  [/\blos\s+alcarrizo\b/gi, "los alcarrizos"],
  [/\balcarrizo\b/gi, "los alcarrizos"],
  [/\bpalmar\s+herrera\b/gi, "palmar de herrera"],
  [/\bcolinas\s+norte\b/gi, "colinas del norte"],
  [/\bcumbre\s+paraiso\b/gi, "cumbre del paraiso"],
  [/\bmr\s*signs?\b/gi, "mr signs"],
  [/\bvinicio\s+calbenti\b/gi, "vinicio calventi"],
  [/\bmarcelino\s+velez\b/gi, "marcelino velez"],
];

const rdFold = (value="") => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9+\s.-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const rdReferenceHints = (value="") => {
  const t = String(value || "");
  const hints = [];
  const patterns = [
    /(?:frente\s+a(?:l)?|al\s+lado\s+de(?:l)?|cerca\s+de(?:l)?|detr[aá]s\s+de(?:l)?|pr[oó]ximo\s+a(?:l)?|por\s+el)\s+([^,;.]+)/gi,
    /(?:colegio|escuela|liceo|colmado|supermercado|plaza|iglesia|farmacia|bomba|ferreter[ií]a|repuesto|taller|residencial|urbanizaci[oó]n)\s+([^,;.]+)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t))) {
      const v = (m[0] || m[1] || "").trim();
      if (v && v.length > 3) hints.push(v);
    }
  }
  return [...new Set(hints)].slice(0, 4);
};

const rdSmartExpandLocationContext = (value="") => {
  let out = String(value || "");
  RD_LOCATION_ALIASES.forEach(([re, rep]) => { out = out.replace(re, rep); });
  out = out.replace(/\s+/g, " ").trim();
  const norm = rdFold(out);
  const matches = Object.keys(SDO_ANCHORS)
    .filter(k => norm.includes(rdFold(k)))
    .sort((a,b) => b.length - a.length)
    .slice(0, 4);
  const refs = rdReferenceHints(out).filter(x => !matches.some(m => rdFold(x).includes(rdFold(m))));
  if (matches.length) {
    const cities = [...new Set(matches.map(k => SDO_ANCHORS[k]?.city).filter(Boolean))];
    const ctx = [...matches, ...refs, ...cities, "Republica Dominicana"].join(", ");
    if (!norm.includes("republica dominicana")) out = out + ", " + ctx;
  } else if (refs.length && !norm.includes("republica dominicana")) {
    out = out + ", " + refs.join(", ") + ", Santo Domingo Oeste, Republica Dominicana";
  }
  return out;
};

const rdAnchorCandidatesFromText = (value="") => {
  const t = rdFold(value);
  return Object.keys(SDO_ANCHORS)
    .map(k => ({ key:k, norm:rdFold(k), anchor:{ ...SDO_ANCHORS[k], key:k } }))
    .filter(x => t.includes(x.norm))
    .sort((a,b) => b.norm.length - a.norm.length)
    .slice(0, 7);
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
  const t = rdFold(rawAddress);
  // Buscar de más específico a más general (mayor longitud de clave = más específico)
  const keys = Object.keys(SDO_ANCHORS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const kn = rdFold(k);
    if (t.includes(kn)) return { ...SDO_ANCHORS[k], key:k };
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

  // Intentar varias queries: dirección enriquecida, referencias locales, raw y simplificada.
  // Se agrega contexto local sin cambiar el flujo: mejora Google Places para colegios,
  // residenciales, colmados, negocios y referencias escritas por clientes.
  const smartRaw = rdSmartExpandLocationContext(rawAddress);
  const anchorMatches = rdAnchorCandidatesFromText(rawAddress);
  const anchorQueries = anchorMatches.map(x => `${rawAddress}, ${x.key}, ${x.anchor.city}, República Dominicana`);
  const queries = [...new Set([
    smartRaw,
    rdSmartExpandLocationContext(expandRDAddress(rawAddress)),
    ...anchorQueries,
    expandRDAddress(rawAddress) + ", República Dominicana",
    rawAddress + ", Santo Domingo, República Dominicana",
    rawAddress.split(",")[0].trim() + ", Santo Domingo",
  ].filter(Boolean))].slice(0, 18);

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
        const anchor = findAnchor(rawAddress);
        const ranked = valid.map(place => {
          const loc = place.geometry.location;
          const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
          const types = place.types || [];
          let score = 62;
          if (types.includes("street_address") || types.includes("premise")) score = 88;
          else if (types.includes("establishment") || types.includes("point_of_interest")) score = 78;
          else if (types.includes("neighborhood") || types.includes("sublocality")) score = 68;
          else if (types.includes("locality")) score = 60;
          const nameLow = (place.name || "").toLowerCase();
          const rawLow  = rawAddress.toLowerCase();
          if (rawLow.split(" ").some(w => w.length > 3 && nameLow.includes(w))) score = Math.min(score + 8, 96);
          if (anchor) {
            const d = hav({lat,lng}, anchor);
            if (anchor.city === "Santo Domingo Oeste" && d > (String(anchor.key||"").length >= 9 ? 4.5 : 7.0)) score -= 60;
            else if (d <= 1.2) score += 14;
            else if (d <= 3) score += 8;
            else if (d > 10) score -= 28;
          }
          return { place, lat, lng, score: Math.max(1, Math.min(99, score)) };
        }).sort((a,b) => b.score - a.score);

        const best = ranked[0];
        if (!best || best.score < 35) continue;
        const top = best.place;
        const types = top.types || [];
        const conf = best.score;

        return {
          ok: true, lat: best.lat, lng: best.lng,
          display: top.formatted_address || top.name,
          confidence: conf,
          types,
          source: "places_text_search",
          allResults: ranked.slice(0, 5).map(r => ({
            display: r.place.formatted_address || r.place.name,
            lat: r.lat, lng: r.lng,
            confidence: r.score,
          })),
        };
      }
    } catch { /* try next query */ }
  }
  return null;
};

// --- GEOCODER (Google Maps Geocoding API + Places Text Search + Nominatim) ----
// V36: Address modal Excel strict + búsqueda escalonada dirección/ref/sector; rutas/Firebase intactos.
const CircuitEngine = () => {
  const [phase, setPhase]         = useState("upload");
  const [rawRows, setRawRows]     = useState([]);
  const [headers, setHeaders]     = useState([]);
  const [mapping, setMapping]     = useState({});
  const [stops, setStops]         = useState([]);
  const [routeName, setRouteName] = useState("Nuevo circuito");
  const [driverName, setDriverName] = useState(() => (window.__rdMensajeros || DEFAULT_MENSAJEROS).find(m=>m.active)?.id || "");
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
  const [routeSentModal, setRouteSentModal] = useState(null);
  const [sendingRoute, setSendingRoute] = useState(false);
  const [addStopModal, setAddStopModal] = useState(false);
  const [addStopSaving, setAddStopSaving] = useState(false);
  const [addStopForm, setAddStopForm] = useState({ client:"", tracking:"", phone:"", address:"" });
  const [addStopPreview, setAddStopPreview] = useState(null);

  const fileRef = useRef(null);
  const addStopInputRef = useRef(null);
  const addStopPlaceRef = useRef(null);

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
    setDriverName(allMens.find(m=>m.active)?.id || "");
    setPhase("route");
  };
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true));
    loadSheetJS();
  }, []);

  useEffect(() => {
    if (!addStopModal) return;
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !window.google || !addStopInputRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(addStopInputRef.current, {
        componentRestrictions: { country: "DO" },
        fields: ["formatted_address", "geometry", "name", "plus_code"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const loc = place.geometry.location;
        const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
        const display = place.formatted_address || place.name || addStopInputRef.current?.value || "";
        addStopPlaceRef.current = { lat, lng, display, confidence: 98, source: "google_autocomplete" };
        setAddStopForm(f => ({ ...f, address: display }));
        setAddStopPreview({ lat, lng, display, confidence: 98 });
      });
    });
    return () => { cancelled = true; addStopPlaceRef.current = null; };
  }, [addStopModal]);

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
        if (!window.XLSX) { console.warn("SheetJS no cargado. Recarga e intenta de nuevo"); return; }
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
      // Build enriched query: la ubicación del Excel manda. Sector es contexto, dirección 2 solo referencia al final.
      const enrichedRaw = rdBuildStrictStopQuery(raw, sector, ciudad, provincia, cp, addr2);
      const stop = {
        id:          `S${String(i + 1).padStart(3, "0")}`,
        stopNum:     null,
        rawAddr:     raw,
        excelRawAddr: raw,
        excelAddr2:   addr2,
        excelSector:  sector,
        excelCity:    ciudad,
        excelProvince: provincia,
        excelCp:      cp,
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
            // Búsqueda escalonada sin romper la lógica:
            // 1) Dirección principal del Excel, 2) Dirección 2 / referencia, 3) Sector.
            // Dirección 2 ayuda cuando contiene puntos reconocibles en Google (ej: paradita aduanera, colegio, negocio).
            const layeredQueries = [
              rdBuildStrictStopQuery(raw, sector, ciudad, provincia, cp, ""),
              addr2 ? rdBuildStrictStopQuery(addr2, sector, ciudad, provincia, cp, "") : "",
              sector ? rdBuildStrictStopQuery(sector, ciudad || "Santo Domingo Oeste", provincia, cp, "") : "",
              enrichedRaw,
            ].map(x => String(x || "").trim()).filter(Boolean);
            const uniqueLayered = [...new Set(layeredQueries.map(x => x.toLowerCase()))]
              .map(low => layeredQueries.find(x => x.toLowerCase() === low));
            let r = { ok:false };
            let fallbackOk = null;
            for (const qv of uniqueLayered) {
              const rr = await geocodeWithGoogle(qv);
              if (!rr.ok) continue;
              if (!fallbackOk) fallbackOk = rr;
              if ((rr.confidence || 0) >= 70) { r = rr; break; }
            }
            if (!r.ok && fallbackOk) r = fallbackOk;
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
          displayAddr: placeResult.display,
          confidence: placeResult.confidence || 95, status: "ok", issue: null, allResults: [],
        });
        return optimizeRoute(updated);
      });
      return;
    }

    // Manual text → re-geocode
    setStops(prev => prev.map(s => s.id !== stopId ? s : { ...s, status: "pending", confidence: 0, displayAddr: newAddr }));
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

  const reprocessLowConfidence = async () => {
    const targets = stops.filter(s => !s.geocoded || s.status === "error" || (s.confidence || 0) < 75);
    if (!targets.length) { setRoutesOptStatus("✓ No hay ubicaciones críticas"); setTimeout(()=>setRoutesOptStatus(""),2500); return; }
    setReoptimizing(true);
    setRoutesOptStatus(`Reprocesando ${targets.length} ubicaciones con prioridad al Excel…`);
    const updates = {};
    for (let i=0; i<targets.length; i++) {
      const s = targets[i];
      const query = rdBuildStrictStopQuery(s.rawAddr || s.displayAddr, s.sector, s.ciudad, s.provincia, s.cp, s.addr2 || s.notes || "");
      try {
        const r = await geocodeWithGoogle(query);
        if (r.ok && (r.confidence || 0) >= Math.max(55, s.confidence || 0)) {
          updates[s.id] = { lat:r.lat, lng:r.lng, displayAddr:r.display || query, confidence:r.confidence, status:r.confidence>=70?"ok":"warning", issue:r.confidence<70?"Revisar: confianza media":"", allResults:r.allResults||[], geocoded:true, source:r.source||"reprocess" };
        }
      } catch(e) {}
      setRoutesOptStatus(`Reprocesando ${i+1}/${targets.length} ubicaciones…`);
      await new Promise(r=>setTimeout(r,35));
    }
    setStops(prev => optimizeRoute(prev.map(s => updates[s.id] ? { ...s, ...updates[s.id] } : s)));
    setRoutesOptStatus("✓ Ubicaciones críticas reprocesadas");
    setTimeout(()=>setRoutesOptStatus(""),3500);
    setReoptimizing(false);
  };

  const deleteStop = (stopId) => {
    setStops(prev => optimizeRoute(prev.filter(s => s.id !== stopId)));
    if (selectedId === stopId) setSelectedId(null);
  };

  const openAddStopModal = () => {
    setAddStopForm({ client:"", tracking:"", phone:"", address:"" });
    setAddStopPreview(null);
    addStopPlaceRef.current = null;
    setAddStopModal(true);
    setTimeout(() => addStopInputRef.current?.focus(), 120);
  };

  const handleAddStopSave = async () => {
    const client = addStopForm.client.trim();
    const tracking = addStopForm.tracking.trim();
    const phone = addStopForm.phone.trim();
    const address = addStopForm.address.trim();
    if (!client || !tracking || !phone || !address || addStopSaving) return;

    setAddStopSaving(true);
    try {
      let place = addStopPlaceRef.current || addStopPreview;
      if (!place?.lat || !place?.lng) {
        const r = await geocodeWithGoogle(address);
        if (r?.ok) place = { lat:r.lat, lng:r.lng, display:r.display || address, confidence:r.confidence || 90, source:r.source || "google_geocode" };
      }
      if (!place?.lat || !place?.lng) {
        setRoutesOptStatus("No se encontró esa dirección. Elige una sugerencia de Google o escribe más detalles.");
        setTimeout(() => setRoutesOptStatus(""), 4200);
        return;
      }

      const newStopId = `S-MANUAL-${Date.now()}`;
      setStops(prev => {
        const current = Array.isArray(prev) ? prev : [];
        const nextNum = Math.max(0, ...current.map(s => Number(s.stopNum || 0))) + 1;
        const newStop = {
          id: newStopId,
          stopNum: nextNum,
          rawAddr: address,
          excelRawAddr: address,
          displayAddr: place.display || address,
          client,
          phone,
          notes: "Agregada manualmente",
          tracking,
          codigo: tracking,
          code: tracking,
          sector: "", ciudad: "", provincia: "", cp: "", addr2: "",
          lat: place.lat, lng: place.lng,
          confidence: place.confidence || 97,
          status: "ok",
          driverStatus: "pending",
          navStatus: "pending",
          allResults: [],
          issue: null,
          source: place.source || "manual_google",
          addedManual: true,
        };
        return optimizeRoute([...current, newStop]);
      });
      setSelectedId(newStopId);
      setClientSearch("");
      setAddStopModal(false);
      setRoutesOptStatus(`✓ Parada agregada: ${client}`);
      setTimeout(() => setRoutesOptStatus(""), 3000);
    } finally {
      setAddStopSaving(false);
    }
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
    <div className="rd-circuit-v28" style={{ display:"flex", flexDirection:"column", height:"100%", background:"#060b10", fontFamily:"'Inter',sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
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
        
        /* V27 Circuit Enterprise UI - solo visual, sin tocar lógica */
        .rd-circuit-v28{position:relative;background:radial-gradient(circle at 15% 0%,rgba(37,99,235,.16),transparent 30%),radial-gradient(circle at 82% 18%,rgba(14,165,233,.10),transparent 28%),linear-gradient(135deg,#030712 0%,#07111f 54%,#050a12 100%)!important;}
        .rd-circuit-v28:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(96,165,250,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.035) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.18));}
        .rd-circuit-v28:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 105%,rgba(59,130,246,.13),transparent 35%);}
        .rd-circuit-v28 > div:first-of-type{height:68px!important;background:linear-gradient(180deg,rgba(7,15,28,.96),rgba(5,10,18,.86))!important;backdrop-filter:blur(22px)!important;border-bottom:1px solid rgba(96,165,250,.16)!important;box-shadow:0 18px 55px rgba(0,0,0,.34)!important;z-index:5!important;}
        .rd-circuit-v28 > div:first-of-type > div:first-child:after{content:"OPERACIÓN DE RUTAS";font-size:9px;letter-spacing:1.8px;color:#3b82f6;font-weight:900;margin-left:8px;font-family:'Syne',sans-serif;}
        .rd-circuit-v28 button{transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, opacity .16s ease!important;}
        .rd-circuit-v28 button:hover{transform:translateY(-1px)!important;box-shadow:0 14px 30px rgba(0,0,0,.22)!important;}
        .rd-circuit-v28 input,.rd-circuit-v28 select{background:linear-gradient(180deg,#081323,#060d18)!important;border-color:rgba(96,165,250,.18)!important;border-radius:13px!important;min-height:42px!important;color:#eaf2ff!important;}
        .rd-circuit-v28 input:focus,.rd-circuit-v28 select:focus{border-color:rgba(59,130,246,.55)!important;box-shadow:0 0 0 3px rgba(59,130,246,.11)!important;}
        .rd-circuit-v28 table{border-collapse:separate!important;border-spacing:0!important;background:rgba(5,10,18,.42)!important;}
        .rd-circuit-v28 thead th{position:sticky!important;top:0!important;z-index:5!important;background:linear-gradient(180deg,#091426,#07111f)!important;box-shadow:0 1px 0 rgba(96,165,250,.14)!important;}
        .rd-circuit-v28 tbody td{background:rgba(3,7,18,.30)!important;}
        .rd-circuit-v28 tbody tr:nth-child(even) td{background:rgba(15,23,42,.25)!important;}
        .rd-circuit-v28 tbody tr:hover td{background:rgba(59,130,246,.075)!important;}
        @keyframes rdRadarSweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes rdScanPulse{0%,100%{transform:scale(.92);opacity:.72}50%{transform:scale(1.045);opacity:1}}
        @keyframes rdSoftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes rdRouteDash{to{stroke-dashoffset:-120}}
        @keyframes rdBeam{0%{transform:translateX(-120%);opacity:0}12%{opacity:.8}88%{opacity:.8}100%{transform:translateX(120%);opacity:0}}
        @keyframes rdGridPulse{0%,100%{opacity:.45}50%{opacity:.9}}
        @keyframes rdPinPop{0%{transform:scale(.88);opacity:.55}50%{transform:scale(1.04);opacity:1}100%{transform:scale(.96);opacity:.9}}
      `}</style>

      {/* -- TOPBAR -- */}
      <div style={{ height: 50, borderBottom: "1px solid #0d1420", display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between", flexShrink: 0, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/><path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/></svg>
          </div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Rap Drive</span>
          <span style={{ color: "#131f30" }}>·</span>
          <span className="rd-chip-pro">Circuit Mode Enterprise</span>
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
            <div style={{ maxWidth: 640, width: "100%", animation: "fadeUp .4s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 8px 24px rgba(59,130,246,0.4)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div style={{ fontSize: 22, fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: 8, letterSpacing:"-0.5px" }}>Circuit Mode Enterprise</div>
                <div style={{ fontSize: 12, color: "#4b5563", lineHeight:1.6 }}>Carga, valida, corrige y despacha rutas con flujo operativo premium.</div>
              </div>

              {/* Feature pills */}
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:22, flexWrap:"wrap" }}>
                {[["📍","Dirección real"],["🔢","Orden inteligente"],["📦","Sin cola"],["📱","Enviar ruta al mensajero"]].map(([ic,lb])=>(
                  <div key={lb} style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.15)",borderRadius:20,padding:"4px 12px" }}>
                    <span style={{ fontSize:11 }}>{ic}</span>
                    <span style={{ fontSize:10,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:700 }}>{lb}</span>
                  </div>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                {[
                  ["01","Subir","Excel / CSV"],
                  ["02","Columnas","auto detect"],
                  ["03","Ruta","mapa listo"]
                ].map(([n,t,d])=>(
                  <div key={n} style={{background:"rgba(255,255,255,.035)",border:"1px solid rgba(96,165,250,.12)",borderRadius:16,padding:"12px 14px",textAlign:"left",boxShadow:"inset 0 1px 0 rgba(255,255,255,.03)"}}>
                    <div style={{fontSize:10,color:"#3b82f6",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1px"}}>{n}</div>
                    <div style={{fontSize:13,color:"#eaf2ff",fontFamily:"'Syne',sans-serif",fontWeight:900,marginTop:4}}>{t}</div>
                    <div style={{fontSize:10,color:"#536783",marginTop:2}}>{d}</div>
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? "#3b82f6" : "#1e2d3d"}`, borderRadius: 24, padding: "50px 34px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.01)", transition: "all .2s", marginBottom: 14, position:"relative", overflow:"hidden" }}>
                {dragOver && <div style={{ position:"absolute",inset:0,background:"rgba(59,130,246,0.04)",animation:"pulse .8s ease infinite" }}/>}
                <div style={{ fontSize: 42, marginBottom: 12, filter:"grayscale(0.05)" }}>📁</div>
                <div style={{ fontSize: 15, fontFamily: "'Syne',sans-serif", fontWeight: 800, marginBottom: 6 }}>{dragOver?"¡Suelta aquí!":"Subir archivo de ruta"}</div>
                <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>Arrastra tu Excel o CSV para iniciar la ruta</div>
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
            <div style={{ width: 370, borderRight: "1px solid rgba(96,165,250,.18)", padding: "0", overflow: "auto", flexShrink: 0, display: "flex", flexDirection: "column", background:"linear-gradient(180deg,rgba(6,14,26,.98),rgba(4,10,18,.98))", boxShadow:"18px 0 50px rgba(0,0,0,.25)" }}>

              {/* Panel header */}
              <div className="enterprise-panel" style={{ margin:"14px 14px 12px", padding:"16px", borderBottom:"1px solid rgba(96,165,250,.12)", background:"linear-gradient(145deg,rgba(10,22,40,.95),rgba(5,12,22,.98))" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(59,130,246,0.4)",flexShrink:0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#f1f5f9" }}>Centro de configuración</div>
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
                    {mapping.address ? "Validar y geocodificar →" : "Asigna Dirección primero"}
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex:1, overflow:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:12 }}>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{background:"linear-gradient(135deg,rgba(59,130,246,.12),rgba(59,130,246,.03))",border:"1px solid rgba(59,130,246,.20)",borderRadius:14,padding:"11px 12px"}}>
                    <div style={{fontSize:9,color:"#60a5fa",fontWeight:900,letterSpacing:"1px",fontFamily:"'Syne',sans-serif"}}>FILAS</div>
                    <div style={{fontSize:20,color:"#f8fafc",fontWeight:1000,fontFamily:"'Syne',sans-serif",marginTop:3}}>{rawRows.length}</div>
                  </div>
                  <div style={{background:"linear-gradient(135deg,rgba(16,185,129,.10),rgba(16,185,129,.025))",border:"1px solid rgba(16,185,129,.18)",borderRadius:14,padding:"11px 12px"}}>
                    <div style={{fontSize:9,color:"#34d399",fontWeight:900,letterSpacing:"1px",fontFamily:"'Syne',sans-serif"}}>COLUMNAS</div>
                    <div style={{fontSize:20,color:"#f8fafc",fontWeight:1000,fontFamily:"'Syne',sans-serif",marginTop:3}}>{headers.length}</div>
                  </div>
                </div>

                {/* MENSAJERO + RUTA */}
                <div className="enterprise-panel" style={{ background:"linear-gradient(145deg,rgba(59,130,246,.10),rgba(5,12,22,.96))", border:"1px solid rgba(96,165,250,.18)", borderRadius:18, padding:"15px" }}>
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
                  <div className="enterprise-panel" style={{ background:"linear-gradient(145deg,rgba(8,18,34,.92),rgba(5,12,22,.94))",border:"1px solid rgba(96,165,250,.14)",borderRadius:18,padding:"12px",marginBottom:12 }}>
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
                        <div key={f} style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 12px", borderRadius:16, background: mapped ? `linear-gradient(135deg,${color}12,rgba(5,12,22,.94))` : "linear-gradient(145deg,rgba(15,30,52,.55),rgba(5,12,22,.92))", border:`1px solid ${mapped ? color+"38" : req ? "rgba(59,130,246,0.24)" : "rgba(96,165,250,.10)"}`, transition:"all .15s", boxShadow: mapped ? `0 10px 28px ${color}10` : "inset 0 1px 0 rgba(255,255,255,.03)" }}>
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
            <div style={{ flex:1, overflow:"auto", padding:"22px", background:"radial-gradient(circle at 20% 0%,rgba(59,130,246,.08),transparent 28%),#050b14" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:10,color:"#1e3550",fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"1.5px" }}>
                    CONTROL DE DATOS DEL EXCEL
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
              <div className="enterprise-table-shell" style={{ borderRadius:24, border:"1px solid rgba(96,165,250,.16)", overflow:"hidden", boxShadow:"0 28px 80px rgba(0,0,0,.36)" }}>
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
          <div style={{ flex: 1, position:"relative", overflow:"hidden", display:"grid", placeItems:"center", background:"radial-gradient(circle at 50% 30%,rgba(37,99,235,.18),transparent 36%),linear-gradient(135deg,#030712,#06101d)" }}>
            <style>{`
              @keyframes ceMapPan{0%{background-position:0 0,0 0}100%{background-position:90px 58px,58px 90px}}
              @keyframes ceSweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
              @keyframes ceTravel{0%{offset-distance:0%;opacity:.15}12%{opacity:1}90%{opacity:1}100%{offset-distance:100%;opacity:.15}}
              @keyframes cePulsePin{0%,100%{transform:scale(.94);box-shadow:0 0 0 0 rgba(59,130,246,.35)}50%{transform:scale(1.04);box-shadow:0 0 0 10px rgba(59,130,246,0)}}
              @keyframes ceProgressGlow{0%{filter:drop-shadow(0 0 5px rgba(59,130,246,.35))}50%{filter:drop-shadow(0 0 18px rgba(59,130,246,.75))}100%{filter:drop-shadow(0 0 5px rgba(59,130,246,.35))}}
              @keyframes ceFadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
            `}</style>

            {/* Enterprise map grid background */}
            <div style={{position:"absolute",inset:0,opacity:.72,backgroundImage:"linear-gradient(rgba(96,165,250,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,.055) 1px,transparent 1px)",backgroundSize:"58px 58px",animation:"ceMapPan 9s linear infinite",maskImage:"radial-gradient(circle at center,black 0%,transparent 76%)"}} />
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.32}} viewBox="0 0 1200 700" preserveAspectRatio="none">
              <defs>
                <filter id="ceGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <linearGradient id="ceLine" x1="0" x2="1"><stop stopColor="#2563eb"/><stop offset=".55" stopColor="#60a5fa"/><stop offset="1" stopColor="#22c55e"/></linearGradient>
              </defs>
              <path d="M95 520 C210 350 300 470 420 270 S650 180 760 350 950 410 1110 170" fill="none" stroke="url(#ceLine)" strokeWidth="5" strokeLinecap="round" strokeDasharray="14 14" style={{animation:"rdRouteDash 2.4s linear infinite"}} filter="url(#ceGlow)"/>
              {[95,270,420,620,760,930,1110].map((x,i)=><circle key={i} cx={x} cy={[520,380,270,215,350,390,170][i]} r="8" fill={i < Math.max(1, Math.round((geoProgress/100)*7)) ? "#22c55e" : "#1e3a5f"} stroke="#93c5fd" strokeWidth="2"/>)}
            </svg>

            <div style={{width:"min(980px,92vw)",display:"grid",gridTemplateColumns:"360px 1fr",gap:22,position:"relative",zIndex:2,animation:"ceFadeSlide .35s ease both"}}>
              {/* Left operational status */}
              <div style={{background:"linear-gradient(145deg,rgba(7,17,31,.96),rgba(5,10,18,.92))",border:"1px solid rgba(96,165,250,.18)",borderRadius:28,padding:26,boxShadow:"0 30px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                  <div style={{width:46,height:46,borderRadius:16,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#1d4ed8,#3b82f6)",boxShadow:"0 18px 45px rgba(37,99,235,.35)"}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div>
                    <div style={{fontSize:10,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1.6px"}}>MOTOR DE GEOLOCALIZACIÓN</div>
                    <div style={{fontSize:18,color:"#f8fafc",fontFamily:"'Syne',sans-serif",fontWeight:1000,marginTop:3}}>Procesando ruta</div>
                  </div>
                </div>

                <div style={{position:"relative",height:210,display:"grid",placeItems:"center",marginBottom:20}}>
                  <div style={{position:"absolute",width:190,height:190,borderRadius:"50%",border:"1px solid rgba(96,165,250,.18)"}} />
                  <div style={{position:"absolute",width:150,height:150,borderRadius:"50%",border:"1px solid rgba(96,165,250,.26)"}} />
                  <div style={{position:"absolute",width:108,height:108,borderRadius:"50%",background:"conic-gradient(from 0deg,rgba(59,130,246,0),rgba(96,165,250,.9),rgba(34,197,94,.75),rgba(59,130,246,0))",animation:"ceSweep 2.2s linear infinite",filter:"blur(.2px)"}} />
                  <div style={{position:"absolute",width:104,height:104,borderRadius:"50%",background:"#07111f"}} />
                  <div style={{width:78,height:78,borderRadius:24,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#2563eb,#60a5fa)",boxShadow:"0 0 55px rgba(59,130,246,.55)",animation:"cePulsePin 2s ease-in-out infinite"}}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s7-5.3 7-12A7 7 0 1 0 5 10c0 6.7 7 12 7 12Z"/><circle cx="12" cy="10" r="2.4"/></svg>
                  </div>
                  <div style={{position:"absolute",left:18,top:34,width:10,height:10,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 18px #22c55e"}} />
                  <div style={{position:"absolute",right:30,bottom:42,width:8,height:8,borderRadius:"50%",background:"#60a5fa",boxShadow:"0 0 18px #60a5fa"}} />
                  <div style={{position:"absolute",right:54,top:24,width:7,height:7,borderRadius:"50%",background:"#f59e0b",boxShadow:"0 0 18px #f59e0b"}} />
                </div>

                <div style={{height:10,background:"rgba(15,23,42,.9)",border:"1px solid rgba(96,165,250,.12)",borderRadius:999,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${geoProgress}%`,background:"linear-gradient(90deg,#2563eb,#60a5fa,#22c55e)",borderRadius:999,transition:"width .45s cubic-bezier(.4,0,.2,1)",animation:"ceProgressGlow 1.8s ease-in-out infinite"}} />
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12}}>
                  <div style={{fontSize:34,lineHeight:1,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:1000}}>{geoProgress}%</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:"#22c55e",fontWeight:900}}>Google Maps + referencias RD</div>
                    <div style={{fontSize:10,color:"#526782",marginTop:3}}>Sin bloquear la interfaz</div>
                  </div>
                </div>
              </div>

              {/* Right live feed */}
              <div style={{background:"linear-gradient(145deg,rgba(7,17,31,.90),rgba(5,10,18,.88))",border:"1px solid rgba(96,165,250,.16)",borderRadius:28,padding:24,boxShadow:"0 30px 90px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
                    <div>
                      <div style={{fontSize:10,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1.6px"}}>ANÁLISIS EN VIVO</div>
                      <div style={{fontSize:24,color:"#f8fafc",fontFamily:"'Syne',sans-serif",fontWeight:1000,letterSpacing:"-.6px",marginTop:4}}>Ubicaciones inteligentes</div>
                    </div>
                    <div style={{padding:"8px 12px",borderRadius:999,background:"rgba(34,197,94,.09)",border:"1px solid rgba(34,197,94,.22)",fontSize:11,color:"#22c55e",fontWeight:900}}>Activo</div>
                  </div>

                  <div style={{height:78,borderRadius:18,background:"rgba(3,7,18,.56)",border:"1px solid rgba(96,165,250,.13)",padding:"14px 16px",overflow:"hidden",position:"relative",marginBottom:18}}>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(96,165,250,.08),transparent)",animation:"rdBeam 2.6s linear infinite"}} />
                    <div style={{fontSize:10,color:"#526782",fontWeight:900,letterSpacing:"1.2px",fontFamily:"'Syne',sans-serif"}}>DIRECCIÓN ACTUAL</div>
                    <div key={geoStatus} style={{fontSize:14,color:"#bfdbfe",fontWeight:800,marginTop:9,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",animation:"ceFadeSlide .28s ease both"}}>{geoStatus || "Preparando lectura del Excel..."}</div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                    {[
                      ["Procesadas", Math.round((geoProgress/100)*rawRows.length), "#60a5fa"],
                      ["Total", rawRows.length, "#e2e8f0"],
                      ["Restantes", Math.max(0, rawRows.length - Math.round((geoProgress/100)*rawRows.length)), "#f59e0b"],
                    ].map(([k,v,c])=><div key={k} style={{background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.07)",borderRadius:18,padding:"16px 14px"}}><div style={{fontSize:10,color:"#526782",fontWeight:900,letterSpacing:"1px",fontFamily:"'Syne',sans-serif"}}>{k}</div><div style={{fontSize:26,color:c,fontFamily:"'Syne',sans-serif",fontWeight:1000,marginTop:6}}>{v}</div></div>)}
                  </div>
                </div>

                <div style={{marginTop:20,borderTop:"1px solid rgba(96,165,250,.12)",paddingTop:18,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {[
                    ["1","Normaliza"],["2","Sectoriza"],["3","Geocodifica"],["4","Ordena"]
                  ].map(([n,t])=><div key={n} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:8,background:"rgba(59,130,246,.16)",border:"1px solid rgba(96,165,250,.24)",display:"grid",placeItems:"center",fontSize:10,color:"#93c5fd",fontWeight:900}}>{n}</div><div style={{fontSize:10,color:"#93a4bd",fontWeight:800}}>{t}</div></div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {routeSentModal && (
          <div style={{position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(2,6,13,.72)",backdropFilter:"blur(10px)",padding:20}}>
            <div style={{width:"min(470px,92vw)",background:"linear-gradient(145deg,#0b1422,#07101b)",border:"1px solid rgba(59,130,246,.28)",borderRadius:24,boxShadow:"0 30px 120px rgba(0,0,0,.65)",overflow:"hidden",color:"#eaf2ff"}}>
              <div style={{height:6,background:"linear-gradient(90deg,#22c55e,#3b82f6)"}} />
              <div style={{padding:26,textAlign:"center"}}>
                <div style={{width:78,height:78,borderRadius:22,margin:"0 auto 16px",display:"grid",placeItems:"center",background:"linear-gradient(135deg,rgba(34,197,94,.18),rgba(59,130,246,.20))",border:"1px solid rgba(96,165,250,.32)",boxShadow:"0 0 45px rgba(59,130,246,.22)"}}>
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/><path d="M3 18h4l3-8h7l3 8h1" stroke="#60a5fa"/><circle cx="8" cy="19" r="1.5" stroke="#60a5fa"/><circle cx="18" cy="19" r="1.5" stroke="#60a5fa"/></svg>
                </div>
                <div style={{fontSize:22,fontFamily:"'Syne',sans-serif",fontWeight:1000,letterSpacing:"-.5px"}}>Ruta enviada correctamente</div>
                <div style={{marginTop:8,fontSize:13,color:"#93a4bd",lineHeight:1.55}}>La ruta ya está activa en el panel del mensajero.</div>
                <div style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,textAlign:"left"}}>
                  {[["Mensajero",routeSentModal.driver],["Ruta",routeSentModal.routeName],["Paradas",routeSentModal.stops],["Distancia",`${routeSentModal.km} km`]].map(([k,v])=><div key={k} style={{background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"12px 14px"}}><div style={{fontSize:10,color:"#536783",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>{k}</div><div style={{marginTop:5,fontSize:14,fontWeight:900,color:"#f8fafc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div></div>)}
                </div>
                <button onClick={()=>setRouteSentModal(null)} style={{marginTop:22,width:"100%",border:0,borderRadius:15,padding:"14px 18px",background:"linear-gradient(135deg,#2563eb,#4f46e5)",color:"white",fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:"pointer",boxShadow:"0 18px 45px rgba(37,99,235,.28)"}}>Entendido</button>
              </div>
            </div>
          </div>
        )}

        {addStopModal && (
          <div style={{position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(2,6,13,.74)",backdropFilter:"blur(12px)",padding:18}}>
            <div style={{width:"min(560px,94vw)",background:"linear-gradient(145deg,#081427,#06101d)",border:"1px solid rgba(96,165,250,.28)",borderRadius:26,boxShadow:"0 32px 120px rgba(0,0,0,.70)",overflow:"hidden",color:"#eaf2ff"}}>
              <div style={{height:7,background:"linear-gradient(90deg,#22c55e,#3b82f6,#6366f1)"}} />
              <div style={{padding:"22px 24px 20px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,marginBottom:18}}>
                  <div style={{display:"flex",gap:13,alignItems:"center"}}>
                    <div style={{width:54,height:54,borderRadius:18,display:"grid",placeItems:"center",background:"linear-gradient(135deg,rgba(34,197,94,.20),rgba(59,130,246,.20))",border:"1px solid rgba(96,165,250,.28)",boxShadow:"0 0 34px rgba(59,130,246,.18)"}}>
                      <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/><path d="M3 18h4l3-8h7l3 8h1" stroke="#60a5fa"/></svg>
                    </div>
                    <div>
                      <div style={{fontSize:21,fontFamily:"'Syne',sans-serif",fontWeight:1000,letterSpacing:"-.4px"}}>Agregar parada a la ruta</div>
                      <div style={{fontSize:12,color:"#93a4bd",marginTop:5,lineHeight:1.45}}>Se agregará como parada #{Math.max(0, ...stops.map(s => Number(s.stopNum || 0))) + 1} y quedará lista para enviarla al mensajero.</div>
                    </div>
                  </div>
                  <button onClick={()=>setAddStopModal(false)} style={{width:38,height:38,borderRadius:13,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",color:"#9fb2cc",cursor:"pointer",display:"grid",placeItems:"center",fontSize:20}}>×</button>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <label style={{display:"grid",gap:6}}>
                    <span style={{fontSize:10,color:"#6f88a6",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>Nombre del cliente</span>
                    <input value={addStopForm.client} onChange={e=>setAddStopForm(f=>({...f,client:e.target.value}))} placeholder="Ej: Ana Pérez" style={{background:"#f8fbff",border:"1px solid #c9dbf2",borderRadius:14,padding:"13px 14px",color:"#0f172a",fontSize:14,fontWeight:700,outline:"none",width:"100%"}} />
                  </label>
                  <label style={{display:"grid",gap:6}}>
                    <span style={{fontSize:10,color:"#6f88a6",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>Código SP</span>
                    <input value={addStopForm.tracking} onChange={e=>setAddStopForm(f=>({...f,tracking:e.target.value}))} placeholder="SP070..." style={{background:"#f8fbff",border:"1px solid #c9dbf2",borderRadius:14,padding:"13px 14px",color:"#0f172a",fontSize:14,fontWeight:800,outline:"none",width:"100%"}} />
                  </label>
                  <label style={{display:"grid",gap:6}}>
                    <span style={{fontSize:10,color:"#6f88a6",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>Teléfono</span>
                    <input value={addStopForm.phone} onChange={e=>setAddStopForm(f=>({...f,phone:e.target.value}))} placeholder="8090000000" style={{background:"#f8fbff",border:"1px solid #c9dbf2",borderRadius:14,padding:"13px 14px",color:"#0f172a",fontSize:14,fontWeight:700,outline:"none",width:"100%"}} />
                  </label>
                  <div style={{display:"grid",gap:6}}>
                    <span style={{fontSize:10,color:"#6f88a6",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>Ubicación Google</span>
                    <div style={{height:46,borderRadius:14,border:"1px solid rgba(34,197,94,.26)",background:"rgba(16,185,129,.08)",display:"flex",alignItems:"center",gap:9,padding:"0 12px",color:"#86efac",fontSize:12,fontWeight:800}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:addStopPreview?"#22c55e":"#64748b",boxShadow:addStopPreview?"0 0 10px #22c55e":"none"}} />
                      {addStopPreview ? "Dirección ubicada" : "Pendiente de selección"}
                    </div>
                  </div>
                </div>

                <label style={{display:"grid",gap:6,marginTop:13}}>
                  <span style={{fontSize:10,color:"#6f88a6",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase"}}>Dirección con Google Autocomplete</span>
                  <div style={{display:"flex",alignItems:"center",gap:10,background:"#f8fbff",border:"1px solid #c9dbf2",borderRadius:16,padding:"0 13px",boxShadow:"0 10px 30px rgba(15,23,42,.10)"}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    <input ref={addStopInputRef} value={addStopForm.address} onChange={e=>{addStopPlaceRef.current=null;setAddStopPreview(null);setAddStopForm(f=>({...f,address:e.target.value}));}} placeholder="Escribe la dirección como en Google Maps..." style={{flex:1,background:"transparent",border:0,outline:0,color:"#0f172a",fontSize:14,fontWeight:700,padding:"14px 0",width:"100%"}} />
                  </div>
                </label>

                {addStopPreview && (
                  <div style={{marginTop:12,border:"1px solid rgba(96,165,250,.18)",background:"rgba(59,130,246,.08)",borderRadius:16,padding:"12px 13px"}}>
                    <div style={{fontSize:10,color:"#93c5fd",fontWeight:900,letterSpacing:"1px",textTransform:"uppercase",marginBottom:4}}>Vista previa</div>
                    <div style={{fontSize:13,color:"#eaf2ff",fontWeight:800,lineHeight:1.35}}>{addStopPreview.display}</div>
                    <div style={{fontSize:11,color:"#8aa2bd",marginTop:5}}>{Number(addStopPreview.lat).toFixed(5)}, {Number(addStopPreview.lng).toFixed(5)}</div>
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:12,marginTop:18}}>
                  <button onClick={()=>setAddStopModal(false)} style={{border:"1px solid rgba(148,163,184,.22)",borderRadius:15,padding:"13px 16px",background:"rgba(255,255,255,.04)",color:"#cbd5e1",fontFamily:"'Syne',sans-serif",fontWeight:900,cursor:"pointer"}}>Cancelar</button>
                  <button onClick={handleAddStopSave} disabled={addStopSaving || !addStopForm.client.trim() || !addStopForm.tracking.trim() || !addStopForm.phone.trim() || !addStopForm.address.trim()} style={{border:0,borderRadius:15,padding:"13px 16px",background:"linear-gradient(135deg,#16a34a,#2563eb)",color:"white",fontFamily:"'Syne',sans-serif",fontWeight:1000,cursor:"pointer",opacity:(addStopSaving || !addStopForm.client.trim() || !addStopForm.tracking.trim() || !addStopForm.phone.trim() || !addStopForm.address.trim()) ? .75 : 1,boxShadow:"0 18px 45px rgba(37,99,235,.25)"}}>
                    {addStopSaving ? "Agregando..." : "Agregar a la ruta"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ REVIEW + ROUTE ════ */}
        {(phase === "review" || phase === "route") && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Left panel: stops list */}
            <div className="route-side-pro" style={{ width: 430, borderRight: "1px solid rgba(96,165,250,.20)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              {/* Header */}
              <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(96,165,250,.14)", flexShrink: 0, background:"linear-gradient(180deg,rgba(15,30,52,.55),rgba(7,17,31,.20))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 17, fontFamily: "'Syne',sans-serif", fontWeight: 900, color:"#f8fafc", letterSpacing:"-.2px" }}>{routeName || "Nueva Ruta"}</div>
                    {driverName && <div style={{ fontSize: 12, color: "#8aa2bd", marginTop:4, fontWeight:600 }}>{(window.__rdMensajeros||DEFAULT_MENSAJEROS).find(m=>m.id===driverName)?.name || driverName}</div>}
                  </div>
                  <div style={{ textAlign: "right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <div style={{ fontSize: 16, fontFamily: "'Syne',sans-serif", fontWeight: 900, color: "#60a5fa" }}>{stops.filter(s => s.stopNum).length} paradas</div>
                    {km > 0 && <div style={{ fontSize: 11, color: "#6f88a6", marginTop:2 }}>{km} km</div>}
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
              <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(96,165,250,.12)", display: "grid", gridTemplateColumns:"1fr 1fr", gap: 10, flexShrink: 0 }}>
                <button onClick={() => { setPhase("upload"); setStops([]); setRawRows([]); setHeaders([]); setMapping({}); setRouteName("Nuevo circuito"); setSelectedId(null); setClientSearch(""); }} className="gh route-action-pro"
                  style={{ flex: 1, padding: "11px 14px", borderRadius: 14, border: "1px solid rgba(96,165,250,.25)", background: "linear-gradient(135deg,rgba(59,130,246,.14),rgba(14,165,233,.08))", color: "#93c5fd", fontSize: 12, fontFamily: "'Syne',sans-serif", fontWeight: 900, cursor: "pointer", transition: "all .1s", minWidth: 150, display:"flex", alignItems:"center", justifyContent:"center", gap:7, boxShadow:"inset 0 1px 0 rgba(255,255,255,.05)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Nueva Ruta
                </button>
                <button onClick={() => setPhase(phase === "review" ? "route" : "review")} className="route-action-pro" style={{ flex: 1, padding: "11px 14px", borderRadius: 14, border: "1px solid rgba(16,185,129,.35)", background: "linear-gradient(135deg,#047857,#10b981)", color: "white", fontSize: 12, fontFamily: "'Syne',sans-serif", fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 28px rgba(16,185,129,.22)", minWidth: 150 }}>
                  {phase === "review" ? "Ver ruta →" : "← Revisar datos"}
                </button>
                {phase === "review" && (statsWarn > 0 || statsError > 0) && <button onClick={reprocessLowConfidence} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid rgba(245,158,11,.35)", background: "rgba(245,158,11,.10)", color: "#fbbf24", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 800, cursor: "pointer", minWidth: 128 }}>
                  Reprocesar bajas
                </button>}
                {phase === "review" && (statsWarn > 0 || statsError > 0) && <button onClick={() => setClientSearch("__LOW__")} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid rgba(239,68,68,.35)", background: "rgba(239,68,68,.08)", color: "#fca5a5", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 800, cursor: "pointer", minWidth: 118 }}>
                  Ver problemas
                </button>}
                {phase === "route" && (
                  <button
                    onClick={openAddStopModal}
                    className="route-action-pro"
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(34,197,94,.36)", background: "linear-gradient(135deg,rgba(16,185,129,.16),rgba(5,150,105,.10))", color: "#86efac", fontSize: 12, fontFamily: "'Syne',sans-serif", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 150, boxShadow:"0 4px 20px rgba(16,185,129,.12)", letterSpacing:"0.2px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7"><path d="M12 5v14M5 12h14"/></svg>
                    Agregar parada
                  </button>
                )}
                  {phase === "route" && (
                  <button
                    onClick={async () => {
                      if (sendingRoute) return;
                      setSendingRoute(true);
                      try {
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

                      // ── SIN COLA: la ruta nueva llega directo como ruta activa ──
                      // Si el mensajero tenía una ruta abierta, esta nueva ruta la reemplaza.
                      if (!window.__rdRouteStore) window.__rdRouteStore = {};
                      window.__rdRouteStore[driverId] = route;
                      LS.setRoute(driverId, route);
                      // Guardar también en historial de rutas (keyed by routeId, no por driverId)
                      FB.set(RD.path(`routeHistory/${route.routeId}`), { ...route, sentAt: route.sentAt });
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

                      setRouteSentModal({ driver: mensajero?.name || driverId, routeName, stops: confirmed.length, km, routeId: route.routeId, sentAt: new Date().toISOString() });
                      } finally { setSendingRoute(false); }
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", color: "white", fontSize: 12, fontFamily: "'Syne',sans-serif", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 150, boxShadow:"0 4px 20px #3b82f650", letterSpacing:"0.3px", position:"relative", overflow:"hidden" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Enviar ruta al mensajero
                  </button>
                )}
              </div>

              {/* -- CLIENT SEARCH -- */}
              {stops.length > 0 && (
                <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(96,165,250,.12)", flexShrink:0, background:"rgba(3,7,18,.18)" }}>
                  <div style={{ position:"relative" }}>
                    <svg style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2d4a60" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="Buscar cliente, código SP, teléfono o dirección..."
                      className="route-search-pro"
                      style={{ width:"100%", background:"linear-gradient(180deg,#0b1728,#07111f)", border:"1px solid rgba(96,165,250,.24)", borderRadius:16, padding:"12px 38px 12px 40px", color:"#eaf2ff", fontSize:13, fontFamily:"'Inter',sans-serif", fontWeight:600, outline:"none", caretColor:"#3b82f6" }}
                    />
                    {clientSearch && <button onClick={() => setClientSearch("")} style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#374151", cursor:"pointer", fontSize:12, padding:0, lineHeight:1 }}>✕</button>}
                  </div>
                </div>
              )}

              {/* -- STOPS LIST -- */}
              <div style={{ flex:1, overflow:"auto" }}>
                {(() => {
                  const q = clientSearch.trim().toLowerCase();
                  const list = q === "__low__"
                    ? stops.filter(s => s.status === "error" || (s.confidence || 0) < 75)
                    : q
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
                        className="rh route-card-v37"
                        style={{ margin:"10px 12px", border:"1px solid rgba(59,130,246,.18)", borderRadius:18, background: isSelected ? "linear-gradient(145deg,#0d2038,#07101b)" : "linear-gradient(145deg,rgba(10,23,42,.96),rgba(5,12,22,.98))", cursor:"pointer", transition:"transform .12s, border-color .12s, background .12s", animation:`slideR .2s ${Math.min(i,20)*20}ms ease both`, borderLeft: isSelected ? "4px solid #3b82f6" : `4px solid ${stop.status==="error"?"#ef4444":"rgba(59,130,246,.45)"}`, boxShadow:isSelected?"0 18px 42px rgba(0,0,0,.34), 0 0 0 1px rgba(96,165,250,.14)":"0 14px 34px rgba(0,0,0,.28)" }}>
                        <div style={{ padding:"16px 16px", display:"flex", gap:14, alignItems:"flex-start" }}>
                          {/* Stop number bubble */}
                          <div style={{ width:38, height:38, borderRadius:12, background:stop.status==="error"?"rgba(239,68,68,0.14)":isSelected?"linear-gradient(135deg,#2563eb,#60a5fa)":"#0d1a28", border:`1.5px solid ${stop.status==="error"?"rgba(239,68,68,0.35)":isSelected?"rgba(147,197,253,.8)":"#1e3550"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:stop.status==="error"?"#ef4444":isSelected?"white":"#60a5fa", fontFamily:"'Inter',sans-serif", fontWeight:800, flexShrink:0, letterSpacing:"-0.3px", boxShadow:isSelected?"0 10px 24px rgba(59,130,246,.35)":"none" }}>
                            {stop.status==="pending"
                              ? <div style={{ width:9, height:9, border:"2px solid #37415055", borderTopColor:"#6b7280", borderRadius:"50%", animation:"spin .9s linear infinite" }}/>
                              : stop.stopNum || "✕"}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            {/* CLIENT NAME */}
                            <div className="route-client-v37" style={{ fontSize:15, fontFamily:"'Inter',sans-serif", fontWeight:800, color:"#f8fafc", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"normal", marginBottom:5, letterSpacing:"-0.1px" }}>
                              {stop.client || `Parada ${stop.stopNum||"?"}`}
                            </div>
                            {/* TRACKING CODE — solo el código, sin prefijo duplicado */}
                            {stop.tracking && (
                              <div className="route-track-v37" style={{ display:"inline-flex", alignItems:"center", gap:0, background:"rgba(59,130,246,.08)", border:"1px solid rgba(96,165,250,.22)", borderRadius:8, padding:"4px 10px", marginBottom:8 }}>
                                <span style={{ fontSize:11.5, color:"#93c5fd", fontFamily:"'Inter',monospace", fontWeight:700, letterSpacing:"0.3px" }}>{stop.tracking}</span>
                              </div>
                            )}
                            {/* ADDRESS */}
                            <div
                              onClick={e => { e.stopPropagation(); setAddrEditStop(stop); setSelectedId(stop.id); }}
                              title="Clic para corregir con Google Maps"
                              className="route-address-v37" style={{ fontSize:12.5, color:stop.status==="error"?"#fca5a5":"#9fb2c8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"normal", marginBottom:stop.phone?6:0, cursor:"pointer", letterSpacing:"0.05px", lineHeight:1.45 }}>
                              {stop.displayAddr}
                            </div>
                            {/* PHONE */}
                            {stop.phone && (
                              <div className="route-phone-v37" style={{ fontSize:12.5, color:"#60a5fa", fontFamily:"'Inter',sans-serif", fontWeight:700, letterSpacing:"0.2px", marginTop:2 }}>
                                {stop.phone}
                              </div>
                            )}
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                              <span style={{fontSize:9.5,color:"#93c5fd",background:"rgba(59,130,246,.09)",border:"1px solid rgba(59,130,246,.18)",borderRadius:999,padding:"3px 7px"}}>IA {stop.confidence||0}%</span>
                              {stop.sector && <span style={{fontSize:9.5,color:"#86efac",background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.16)",borderRadius:999,padding:"3px 7px"}}>{stop.sector}</span>}
                              {stop.source && <span style={{fontSize:9.5,color:"#c4b5fd",background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.16)",borderRadius:999,padding:"3px 7px"}}>{stop.source}</span>}
                            </div>
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
              <div className="rd-map-chrome" style={{position:"absolute",left:16,top:16,zIndex:10,background:"rgba(5,10,18,.78)",border:"1px solid rgba(96,165,250,.14)",borderRadius:18,padding:"12px 15px",backdropFilter:"blur(18px)",boxShadow:"0 18px 52px rgba(0,0,0,.34)",pointerEvents:"none"}}>
                <div style={{fontSize:10,color:"#60a5fa",fontFamily:"'Syne',sans-serif",fontWeight:900,letterSpacing:"1.2px"}}>MAPA DE OPERACIÓN</div>
                <div style={{fontSize:11,color:"#93a4bd",marginTop:3}}>secuencia · zonas · revisión visual</div>
              </div>
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
                <div style={{ position:"absolute", top:12, right:12, background:"rgba(6,11,16,0.88)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:"12px 18px", display:"flex", gap:22, boxShadow:"0 18px 52px rgba(0,0,0,.34)", border:"1px solid rgba(96,165,250,.16)" }}>
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


// --- ADMIN V5 ENTERPRISE PANELS ----------------------------------------------
const v5 = { bg:'#050a12', panel:'#08111e', panel2:'#0b1626', line:'#15243a', text:'#eaf2ff', soft:'#93a4bd', muted:'#536783', blue:'#3b82f6', green:'#22c55e', amber:'#f59e0b', red:'#ef4444', violet:'#8b5cf6' };
const V5Icon = ({type, size=18, color='currentColor'}) => {
  const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,strokeWidth:1.9,strokeLinecap:'round',strokeLinejoin:'round'};
  const icons={
    route:<svg {...common}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 6h5a5 5 0 0 1 5 5v4"/><path d="M6 8v10"/></svg>,
    engine:<svg {...common}><path d="M4 14h3l2-5h7l3 5h2"/><circle cx="8" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M10 9V5h5l3 4"/><rect x="13" y="3" width="5" height="5" rx="1"/></svg>,
    depot:<svg {...common}><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-7h6v7"/><path d="M9 10h.01M15 10h.01"/></svg>,
    lock:<svg {...common}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>,
    chart:<svg {...common}><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>,
    pin:<svg {...common}><path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>,
    search:<svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>,
  };
  return icons[type] || icons.chart;
};
const V5Card = ({title,value,sub,icon,color}) => <div style={{background:`linear-gradient(145deg,${v5.panel2},${v5.panel})`,border:`1px solid ${v5.line}`,borderRadius:18,padding:18,boxShadow:'0 18px 60px rgba(0,0,0,.25)',position:'relative',overflow:'hidden'}}><div style={{position:'absolute',right:-28,top:-28,width:88,height:88,borderRadius:'50%',background:`${color}18`,filter:'blur(4px)'}}/><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><div style={{fontSize:12,color:v5.soft,fontWeight:900,letterSpacing:'.5px'}}>{title}</div><div style={{width:36,height:36,borderRadius:12,background:`${color}17`,border:`1px solid ${color}32`,display:'grid',placeItems:'center',color}}>{icon}</div></div><div style={{fontSize:34,lineHeight:1,fontWeight:1000,color:v5.text,letterSpacing:'-1px'}}>{value}</div><div style={{marginTop:8,fontSize:12,color:v5.muted,fontWeight:700}}>{sub}</div></div>;
const routeStatsV5 = (routesObj) => { const arr=Object.values(routesObj||{}).filter(Boolean); const stops=arr.flatMap(r=>r.stops||[]); return { active:arr.length, stops:stops.length, visited:stops.filter(s=>s.navStatus==='visited').length, pending:stops.filter(s=>s.navStatus!=='visited').length }; };
const AdminRoutesV5 = ({ routes }) => {
  const [history,setHistory]=useState([]), [active,setActive]=useState(routes||{}), [selected,setSelected]=useState(null), [query,setQuery]=useState(''), [routeStopQuery,setRouteStopQuery]=useState('');
  const [routeDeleteModal, setRouteDeleteModal] = useState(null);
  const [routeToast, setRouteToast] = useState(null);
  const mapRef=useRef(null), gMapRef=useRef(null), markersRef=useRef([]), routeScannerInputRef=useRef(null);
  const loadRoutesV5 = useCallback(async()=>{ const [h,a]=await Promise.all([FB.get(RD.path("routeHistory")),FB.get(RD.path("routes"))]); const activeData=a||{}; setActive(activeData); const all={}; Object.values(h||{}).filter(Boolean).forEach(r=>{all[r.routeId||`${r.driverId}_${r.sentAt}`]=r}); Object.values(activeData||{}).filter(Boolean).forEach(r=>{all[r.routeId||`${r.driverId}_${r.sentAt}`]={...r,isActive:true}}); setHistory(Object.values(all).sort((x,y)=>new Date(y.sentAt||0)-new Date(x.sentAt||0))); },[]);
  const deleteHistoryRoute = async (r) => { if(!r) return; setRouteDeleteModal(r); };
  const resendRouteV5 = async (r) => {
    if(!r || !r.driverId) { setRouteToast({ title:'No se pudo reenviar', message:'La ruta no tiene mensajero asignado.' }); window.setTimeout(()=>setRouteToast(null), 2800); return; }
    const clean = { ...r, isActive:false, resentAt:new Date().toISOString(), sentAt:new Date().toISOString() };
    delete clean.isActive;
    await FB.set(RD.path(`routes/${r.driverId}`), clean);
    _memStore.routes[r.driverId] = clean;
    if (typeof window !== 'undefined') window.__rdRouteStore = { ...(window.__rdRouteStore||{}), [r.driverId]: clean };
    setRouteToast({ title:'Ruta reenviada', message:`${r.routeName||'Ruta'} fue enviada nuevamente al mensajero.` });
    window.setTimeout(()=>setRouteToast(null), 3000);
    await loadRoutesV5();
  };
  const confirmDeleteHistoryRoute = async () => {
    const r = routeDeleteModal;
    if(!r) return;
    const key=r.routeId||`${r.driverId}_${r.sentAt}`;
    if(r.isActive && r.driverId){
      await FB.remove(RD.path(`routes/${r.driverId}`));
      delete _memStore.routes[r.driverId];
      if (typeof window !== 'undefined' && window.__rdRouteStore) delete window.__rdRouteStore[r.driverId];
    }
    if(r.routeId || !r.isActive) await FB.remove(RD.path(`routeHistory/${key}`));
    if(selected===r) setSelected(null);
    setRouteDeleteModal(null);
    setRouteToast({ title:'Ruta eliminada', message:r.isActive ? 'La ruta activa fue eliminada correctamente.' : 'La ruta fue eliminada del historial correctamente.' });
    window.setTimeout(()=>setRouteToast(null), 2800);
    await loadRoutesV5();
  };
  useEffect(()=>{ loadRoutesV5(); const t=setInterval(loadRoutesV5,6000); return()=>clearInterval(t); },[loadRoutesV5]);
  useEffect(()=>{ if(!selected) return; loadGoogleMaps().then(()=>{ if(!mapRef.current) return; if(!gMapRef.current){ gMapRef.current=new window.google.maps.Map(mapRef.current,{center:{lat:DEPOT.lat,lng:DEPOT.lng},zoom:12,disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:window.google.maps.ControlPosition.RIGHT_BOTTOM},styles:[{elementType:'geometry',stylers:[{color:'#07101b'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#14243a'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#1b3658'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#03070d'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{elementType:'labels.text.fill',stylers:[{color:'#5d708d'}]},{elementType:'labels.text.stroke',stylers:[{color:'#07101b'}]}]}); } markersRef.current.forEach(m=>{try{m.setMap(null)}catch(e){}}); markersRef.current=[]; const stops=(selected.stops||[]).filter(s=>s.lat&&s.lng).sort((a,b)=>(a.stopNum||0)-(b.stopNum||0)); const bounds=new window.google.maps.LatLngBounds(); const depotMarker=new window.google.maps.Marker({map:gMapRef.current,position:{lat:DEPOT.lat,lng:DEPOT.lng},title:'Base / DEPOT',icon:{url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><rect x="7" y="7" width="32" height="32" rx="12" fill="#2563eb" stroke="white" stroke-width="2"/><path d="M15 29V18l8-5 8 5v11" fill="none" stroke="white" stroke-width="2"/><path d="M20 29v-7h6v7" fill="none" stroke="white" stroke-width="2"/></svg>`),scaledSize:new window.google.maps.Size(46,46),anchor:new window.google.maps.Point(23,23)}}); markersRef.current.push(depotMarker); bounds.extend({lat:DEPOT.lat,lng:DEPOT.lng}); if(stops.length>1){const line=new window.google.maps.Polyline({map:gMapRef.current,path:[{lat:DEPOT.lat,lng:DEPOT.lng},...stops.map(s=>({lat:s.lat,lng:s.lng})),{lat:DEPOT.lat,lng:DEPOT.lng}],strokeColor:'#3b82f6',strokeOpacity:.8,strokeWeight:3}); markersRef.current.push(line);} stops.forEach(stop=>{ const done=stop.navStatus==='visited'; const color=done?'#22c55e':'#3b82f6'; const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="0 0 44 50"><defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="${color}" flood-opacity=".35"/></filter></defs><g filter="url(#s)"><path d="M22 47s15-13 15-26A15 15 0 0 0 7 21c0 13 15 26 15 26z" fill="${color}"/><circle cx="22" cy="21" r="11" fill="#07101b" opacity=".28"/><text x="22" y="25" text-anchor="middle" font-size="11" font-weight="900" fill="white" font-family="Arial">${stop.stopNum||''}</text></g></svg>`; const marker=new window.google.maps.Marker({map:gMapRef.current,position:{lat:stop.lat,lng:stop.lng},title:`#${stop.stopNum} ${stop.client||''}`,icon:{url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),scaledSize:new window.google.maps.Size(44,50),anchor:new window.google.maps.Point(22,47)}}); markersRef.current.push(marker); bounds.extend({lat:stop.lat,lng:stop.lng}); }); if(stops.length) gMapRef.current.fitBounds(bounds,{top:60,right:60,bottom:60,left:60}); }); },[selected]);
  const stats=routeStatsV5(active); const filtered=history.filter(r=>!query||`${r.routeName||''} ${r.driverName||''} ${(r.stops||[]).map(s=>`${s.client||''} ${s.phone||''} ${s.tracking||''} ${s.codigo||''} ${s.code||''} ${s.displayAddr||s.rawAddr||''}`).join(' ')}`.toLowerCase().includes(query.toLowerCase())); const cleanRouteSearch=(v)=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); const compactRouteSearch=(v)=>cleanRouteSearch(v).replace(/\s/g,''); const selectedStopResults=selected?(selected.stops||[]).filter(s=>{const q=cleanRouteSearch(routeStopQuery); const qc=compactRouteSearch(routeStopQuery); if(!q) return true; const blob=cleanRouteSearch(`${s.stopNum||''} ${s.client||''} ${s.phone||''} ${s.tracking||''} ${s.codigo||''} ${s.code||''} ${s.displayAddr||''} ${s.rawAddr||''}`); return blob.includes(q)||compactRouteSearch(s.tracking||'').includes(qc)||compactRouteSearch(s.codigo||'').includes(qc)||compactRouteSearch(s.code||'').includes(qc)||compactRouteSearch(s.phone||'').includes(qc);}).sort((a,b)=>(a.stopNum||99)-(b.stopNum||99)):[]; const focusRouteStop=(stop)=>{ if(!stop||!gMapRef.current||!stop.lat||!stop.lng) return; gMapRef.current.panTo({lat:stop.lat,lng:stop.lng}); gMapRef.current.setZoom(Math.max(gMapRef.current.getZoom()||15,16)); };
  return <div style={{flex:1,display:'flex',flexDirection:'column',background:v5.bg,color:v5.text,overflow:'hidden'}}><div style={{padding:24,borderBottom:`1px solid ${v5.line}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{color:v5.blue,fontSize:11,fontWeight:1000,letterSpacing:'2px',textTransform:'uppercase'}}>Operación logística</div><h1 style={{margin:'6px 0 0',fontSize:28,fontWeight:1000,letterSpacing:'-.8px'}}>Rutas</h1></div><div style={{display:'flex',alignItems:'center',gap:8,background:v5.panel,border:`1px solid ${v5.line}`,borderRadius:14,padding:'0 14px',minWidth:340}}><V5Icon type="search" size={16} color={v5.muted}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ruta, mensajero, cliente o tracking..." style={{background:'transparent',border:0,outline:0,color:v5.text,fontSize:13,width:'100%'}}/></div></div><div style={{padding:22,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}><V5Card title="Rutas activas" value={stats.active} sub="En campo ahora" color={v5.blue} icon={<V5Icon type="route"/>}/><V5Card title="Paradas" value={stats.stops} sub="Asignadas hoy" color={v5.violet} icon={<V5Icon type="pin"/>}/><V5Card title="Visitadas" value={stats.visited} sub="Progreso interno" color={v5.green} icon={<V5Icon type="chart"/>}/><V5Card title="Pendientes" value={stats.pending} sub="Por visitar" color={v5.amber} icon={<V5Icon type="route"/>}/></div><div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'420px 1fr',gap:0,borderTop:`1px solid ${v5.line}`}}><div style={{borderRight:`1px solid ${v5.line}`,overflow:'auto'}}>{filtered.length===0?<div style={{padding:42,textAlign:'center',color:v5.muted}}>No hay rutas para mostrar</div>:filtered.map((r,i)=>{const st=routeStatsV5({x:r});const sel=selected===r;return <button key={(r.routeId||r.sentAt||i)+i} onClick={()=>{setSelected(r); setRouteStopQuery(''); setTimeout(()=>routeScannerInputRef.current?.focus(),120);}} style={{width:'100%',textAlign:'left',padding:18,border:0,borderBottom:`1px solid ${v5.line}`,background:sel?'#0d1f35':'transparent',cursor:'pointer',color:v5.text}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div style={{fontSize:15,fontWeight:1000}}>{r.routeName||'Ruta sin nombre'}</div><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:10,fontWeight:1000,padding:'5px 9px',borderRadius:999,background:r.isActive?'rgba(34,197,94,.12)':'rgba(148,163,184,.08)',color:r.isActive?v5.green:v5.muted}}>{r.isActive?'ACTIVA':'HISTORIAL'}</span>{!r.isActive&&<span onClick={(e)=>{e.stopPropagation();resendRouteV5(r);}} title='Reenviar esta ruta al mensajero' style={{width:28,height:28,borderRadius:9,display:'grid',placeItems:'center',background:'rgba(59,130,246,.10)',border:'1px solid rgba(59,130,246,.24)',color:v5.blue,cursor:'pointer'}}><svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M21 12a9 9 0 1 1-2.64-6.36'/><path d='M21 3v6h-6'/></svg></span>}<span onClick={(e)=>{e.stopPropagation();deleteHistoryRoute(r);}} title={r.isActive?'Eliminar ruta activa':'Eliminar historial'} style={{width:28,height:28,borderRadius:9,display:'grid',placeItems:'center',background:'rgba(239,68,68,.09)',border:'1px solid rgba(239,68,68,.22)',color:v5.red,cursor:'pointer'}}><svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M3 6h18'/><path d='M8 6V4h8v2'/><path d='M19 6l-1 14H6L5 6'/><path d='M10 11v5M14 11v5'/></svg></span></div></div><div style={{marginTop:7,color:v5.soft,fontSize:12}}>{r.driverName||'Sin mensajero'} · {(r.stops||[]).length} paradas</div><div style={{marginTop:12,height:7,background:'#06101d',borderRadius:999,overflow:'hidden'}}><div style={{height:'100%',width:`${st.stops?Math.round(st.visited/st.stops*100):0}%`,background:`linear-gradient(90deg,${v5.blue},${v5.green})`}}/></div><div style={{display:'flex',gap:12,marginTop:10,color:v5.muted,fontSize:11,fontWeight:800}}><span>{st.visited} visitadas</span><span>{st.pending} pendientes</span></div></button>})}</div><div style={{position:'relative',minHeight:0}}>{selected?<><div ref={mapRef} style={{position:'absolute',inset:0}}/><div style={{position:'absolute',top:18,left:18,width:390,maxWidth:'calc(100% - 36px)',background:'rgba(5,10,18,.90)',border:`1px solid ${v5.line}`,borderRadius:18,padding:14,backdropFilter:'blur(14px)',boxShadow:'0 20px 70px rgba(0,0,0,.42)'}}><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}><div><div style={{fontWeight:1000,fontSize:15}}>{selected.routeName||'Ruta'}</div><div style={{color:v5.soft,fontSize:12,marginTop:4}}>{selected.driverName||'Mensajero'} · {(selected.stops||[]).length} paradas</div></div><div style={{fontSize:10,fontWeight:1000,padding:'6px 9px',borderRadius:999,background:selected.isActive?'rgba(34,197,94,.13)':'rgba(148,163,184,.10)',color:selected.isActive?v5.green:v5.soft}}>{selected.isActive?'ACTIVA':'HISTORIAL'}</div></div><div style={{marginTop:12,display:'flex',alignItems:'center',gap:8,background:'#06101d',border:`1px solid ${v5.line}`,borderRadius:13,padding:'9px 11px'}}><V5Icon type='search' size={15} color={v5.blue}/><input ref={routeScannerInputRef} value={routeStopQuery} onChange={e=>{setRouteStopQuery(e.target.value); const q=e.target.value; setTimeout(()=>{const n=(selected?.stops||[]).find(s=>{const blob=compactRouteSearch(`${s.client||''} ${s.phone||''} ${s.tracking||''} ${s.codigo||''} ${s.code||''}`); return compactRouteSearch(q)&&blob.includes(compactRouteSearch(q));}); if(n) focusRouteStop(n);},0);}} onKeyDown={e=>{if(e.key==='Enter'&&selectedStopResults[0]) focusRouteStop(selectedStopResults[0]);}} placeholder='Escanear SP o buscar cliente, teléfono, código...' style={{flex:1,background:'transparent',border:0,outline:0,color:v5.text,fontSize:12}}/><button onClick={()=>{setRouteStopQuery(''); routeScannerInputRef.current?.focus();}} style={{border:0,background:'transparent',color:v5.muted,cursor:'pointer',fontWeight:900}}>×</button></div><div style={{fontSize:10,color:v5.muted,marginTop:7}}>Scanner listo: enfoca este campo y lee el código SP. También busca por nombre, teléfono o tracking.</div>{routeStopQuery&&<div style={{marginTop:10,maxHeight:260,overflow:'auto',display:'grid',gap:8}}>{selectedStopResults.length===0?<div style={{padding:12,border:`1px solid ${v5.line}`,borderRadius:12,color:v5.amber,fontSize:12}}>No encontré esa parada en esta ruta.</div>:selectedStopResults.slice(0,12).map(st=><button key={st.id||st.tracking||st.stopNum} onClick={()=>focusRouteStop(st)} style={{textAlign:'left',border:`1px solid ${v5.line}`,background:'rgba(8,17,30,.92)',color:v5.text,borderRadius:12,padding:'10px 11px',cursor:'pointer'}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:38,height:38,borderRadius:13,background:'rgba(59,130,246,.18)',border:'1px solid rgba(59,130,246,.34)',display:'grid',placeItems:'center',fontWeight:1000,color:v5.blue,fontSize:17,boxShadow:'0 8px 24px rgba(59,130,246,.16)'}}>{st.stopNum||'?'}</span><div style={{minWidth:0}}><div style={{fontSize:12,fontWeight:1000,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.client||'Sin cliente'}</div><div style={{fontSize:10,color:v5.soft,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.tracking||st.codigo||st.code||'Sin SP'} · {st.phone||'sin teléfono'}</div></div></div><div style={{fontSize:10,color:v5.muted,marginTop:7,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{st.displayAddr||st.rawAddr||'Sin dirección'}</div></button>)}</div>}</div></>:<div style={{height:'100%',display:'grid',placeItems:'center',color:v5.muted}}>Selecciona una ruta para ver mapa y pines premium</div>}</div></div>{routeDeleteModal&&<div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.64)',backdropFilter:'blur(8px)',display:'grid',placeItems:'center'}}><div style={{width:420,maxWidth:'92vw',background:'linear-gradient(145deg,#0b1626,#07101b)',border:`1px solid ${v5.line}`,borderRadius:24,padding:24,boxShadow:'0 30px 90px rgba(0,0,0,.65)'}}><div style={{width:48,height:48,borderRadius:16,background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.28)',display:'grid',placeItems:'center',color:v5.red,marginBottom:16}}><svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><path d='M3 6h18'/><path d='M8 6V4h8v2'/><path d='M19 6l-1 14H6L5 6'/><path d='M10 11v5M14 11v5'/></svg></div><div style={{fontSize:22,fontWeight:1000,color:v5.text,marginBottom:8}}>{routeDeleteModal.isActive?'Eliminar ruta activa':'Eliminar ruta del historial'}</div><div style={{fontSize:13,lineHeight:1.55,color:v5.soft,marginBottom:20}}>Esta acción eliminará <b style={{color:v5.text}}>{routeDeleteModal.routeName||'Ruta sin nombre'}</b> {routeDeleteModal.isActive?'de las rutas activas del mensajero.':'del historial de esta oficina.'}</div><div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button onClick={()=>setRouteDeleteModal(null)} style={{border:`1px solid ${v5.line}`,background:'transparent',color:v5.soft,borderRadius:14,padding:'11px 15px',fontWeight:900,cursor:'pointer'}}>Cancelar</button><button onClick={confirmDeleteHistoryRoute} style={{border:0,background:v5.red,color:'white',borderRadius:14,padding:'11px 15px',fontWeight:1000,cursor:'pointer'}}>Eliminar</button></div></div></div>}{routeToast&&<div style={{position:'fixed',right:22,bottom:22,zIndex:9998,background:'linear-gradient(145deg,#062015,#07101b)',border:'1px solid rgba(34,197,94,.28)',borderRadius:18,padding:'14px 16px',boxShadow:'0 18px 55px rgba(0,0,0,.5)',color:v5.text}}><div style={{fontWeight:1000,fontSize:14}}>{routeToast.title}</div><div style={{fontSize:12,color:v5.soft,marginTop:3}}>{routeToast.message}</div></div>}</div>;
};
const AdminMotorV5 = () => {
  return (
    <div style={{flex:1, background:"#03070b", color:"#f8fafc", overflow:"hidden"}}>
      <CircuitEngine />
    </div>
  );
};
const AdminConfigV5 = ({ currentUser }) => {
  const [base,setBase]=useState({lat:DEPOT.lat,lng:DEPOT.lng,label:DEPOT.label}); const [pw,setPw]=useState({actual:'',nueva:'',confirmar:''});
  useEffect(()=>{FB.get(`oficinas/${currentUser?.officeId}/ubicacionBase`).then(b=>{if(b)setBase({lat:b.lat||DEPOT.lat,lng:b.lng||DEPOT.lng,label:b.direccion||b.label||DEPOT.label})})},[currentUser?.officeId]);
  const saveBase=async()=>{ const lat=parseFloat(base.lat), lng=parseFloat(base.lng); if(isNaN(lat)||isNaN(lng)) return alert('Latitud/longitud inválidas'); DEPOT.lat=lat; DEPOT.lng=lng; DEPOT.label=base.label; await FB.set(`oficinas/${currentUser.officeId}/ubicacionBase`,{lat,lng,direccion:base.label,label:base.label,updatedAt:Date.now()}); alert('Base / DEPOT actualizado'); };
  const changePw=async()=>{ if(!pw.nueva||pw.nueva!==pw.confirmar) return alert('Confirma la nueva contraseña'); await FB.set(RD.path(`users/${currentUser.id}/password`),pw.nueva); alert('Contraseña actualizada'); setPw({actual:'',nueva:'',confirmar:''}); };
  const input={background:'#06101d',border:`1px solid ${v5.line}`,borderRadius:14,padding:'13px 14px',color:v5.text,outline:0,width:'100%',fontSize:14}; const label={color:v5.soft,fontSize:12,fontWeight:900,marginBottom:7,display:'block'};
  return <div style={{flex:1,background:v5.bg,color:v5.text,overflow:'auto'}}><div style={{padding:26,borderBottom:`1px solid ${v5.line}`}}><div style={{color:v5.blue,fontSize:11,fontWeight:1000,letterSpacing:'2px',textTransform:'uppercase'}}>Administración de oficina</div><h1 style={{margin:'6px 0 4px',fontSize:30,fontWeight:1000}}>Config</h1><div style={{color:v5.soft,fontSize:13}}>Solo cuenta, contraseña y base de operaciones. Los mensajeros ahora viven en Drivers.</div></div><div style={{padding:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}><div style={{background:v5.panel,border:`1px solid ${v5.line}`,borderRadius:22,padding:22}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}><V5Icon type="depot" color={v5.blue}/><div style={{fontSize:18,fontWeight:1000}}>Base / DEPOT</div></div><label style={label}>Nombre o dirección base</label><input style={input} value={base.label} onChange={e=>setBase({...base,label:e.target.value})}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}><div><label style={label}>Latitud</label><input style={input} value={base.lat} onChange={e=>setBase({...base,lat:e.target.value})}/></div><div><label style={label}>Longitud</label><input style={input} value={base.lng} onChange={e=>setBase({...base,lng:e.target.value})}/></div></div><button onClick={saveBase} style={{marginTop:18,border:0,borderRadius:14,padding:'13px 16px',background:v5.blue,color:'white',fontWeight:1000,cursor:'pointer'}}>Guardar base</button></div><div style={{background:v5.panel,border:`1px solid ${v5.line}`,borderRadius:22,padding:22}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}><V5Icon type="lock" color={v5.violet}/><div style={{fontSize:18,fontWeight:1000}}>Contraseña</div></div><label style={label}>Contraseña actual</label><input type="password" style={input} value={pw.actual} onChange={e=>setPw({...pw,actual:e.target.value})}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}><div><label style={label}>Nueva</label><input type="password" style={input} value={pw.nueva} onChange={e=>setPw({...pw,nueva:e.target.value})}/></div><div><label style={label}>Confirmar</label><input type="password" style={input} value={pw.confirmar} onChange={e=>setPw({...pw,confirmar:e.target.value})}/></div></div><button onClick={changePw} style={{marginTop:18,border:0,borderRadius:14,padding:'13px 16px',background:v5.violet,color:'white',fontWeight:1000,cursor:'pointer'}}>Actualizar contraseña</button></div><div style={{gridColumn:'1 / -1',background:v5.panel,border:`1px solid ${v5.line}`,borderRadius:22,padding:22}}><div style={{display:'flex',alignItems:'center',gap:16}}><Avatar i={currentUser?.avatar||'AD'} size={58} color={v5.blue}/><div><div style={{fontSize:20,fontWeight:1000}}>{currentUser?.name}</div><div style={{color:v5.soft,marginTop:4}}>{currentUser?.email} · {currentUser?.officeName||currentUser?.officeId}</div></div></div></div></div></div>;
};

export default function RapDrive() {
  useEffect(() => {
    try { installRapDriveBranding(); } catch(e) {}
  }, []);
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
  const [mensajeros, setMensajeros] = useState([]);

  // Sincronizar mensajeros desde Firebase al montar (por si llegaron después del init)
  useEffect(() => {
    if (typeof window !== "undefined") window.__rdOfficeId = currentUser?.officeId || null;
    if (!currentUser?.officeId) { setMensajeros([]); _memStore.mens = []; window.__rdMensajeros = []; return; }
    FB.get(`oficinas/${currentUser.officeId}/mensajeros`).then(data => {
      const arr = normalizeMensajeros(data);
      setMensajeros(arr);
      _memStore.mens = arr;
      window.__rdMensajeros = arr;
      // Si Firebase tenía mezcla array+objeto, se corrige una sola vez al entrar.
      FB.set(`oficinas/${currentUser.officeId}/mensajeros`, mensajerosToMap(arr));
    });
  }, [currentUser?.officeId]);

  // -- Datos persistentes entre navegaciones --
  const [drivers,      setDrivers]      = useState(DRIVERS);
  const [clients,      setClients]      = useState([]);
  const [globalRoutes, setGlobalRoutes] = useState({});

  // globalRoutes se sincroniza dentro del useEffect de notificaciones (un solo FB.listen)

  const handleUpdateRoute = (driverId, route) => {
    setGlobalRoutes(prev => ({ ...prev, [driverId]: route }));
    if (typeof window !== "undefined") { window.__rdRouteStore = window.__rdRouteStore || {}; window.__rdRouteStore[driverId] = route; LS.setRoute(driverId, route); }
  };

  const handleLogin  = async (user) => {
    if (user?.role !== "super_admin") {
      if (!user?.officeId) { alert("Este usuario no tiene oficina asignada. Contacta al super admin."); return; }
      const office = await FB.get(`oficinas/${user.officeId}`);
      if (!office || office.activa === false) { alert("Esta oficina está deshabilitada. Contacta al super admin."); return; }
      user.officeName = office.nombre || user.officeName || user.officeId;
      user.officeBase = office.ubicacionBase || null;
    }
    if (typeof window !== "undefined") window.__rdOfficeId = user?.officeId || null;
    try { sessionStorage.setItem("rdSession", JSON.stringify(user)); } catch(e) {}
    setCurrentUser(user);
  };
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
      (route.stops||[]).forEach(s => { stopsMap[s.id] = s.navStatus || "pending"; });
      lastRouteSnapRef.current[driverId] = {
        sentAt: route.sentAt,
        stops: stopsMap,
        routeCompletedNotified: (route.stops||[]).every(s => s.navStatus === "visited"),
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
          const newStatus  = stop.navStatus || "pending";
          snap.stops[stop.id] = newStatus; // actualizar snapshot
          if (!prevStatus || prevStatus === newStatus) return;
          anyChange = true;
          const clientLabel = stop.client || `Parada #${stop.stopNum}`;
          const trackLabel  = stop.tracking ? ` · ${stop.tracking}` : "";
          if (newStatus === "visited") {
            pushEvent({ id:"e"+Date.now()+stop.id, type:"visited", icon:"✓", color:"#10b981",
              title:`Visitado: ${clientLabel}${trackLabel}`,
              body:`${driverLabel} · #${stop.stopNum} · ${stop.displayAddr||stop.rawAddr||""}`,
              time: now, read: false, isNew: true });
          } else if (newStatus === "note") {
            pushEvent({ id:"e"+Date.now()+stop.id, type:"delayed", icon:"⚠", color:"#f59e0b",
              title:`Nota: ${clientLabel}${trackLabel}`,
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
          const allDone = route.stops.every(s => s.navStatus === "visited");
          if (allDone) {
            snap.routeCompletedNotified = true;
            const del  = route.stops.filter(s => s.navStatus === "visited").length;
            const prob = route.stops.filter(s => false).length;
            pushEvent({ id:"e"+Date.now()+"done"+driverId, type:"visited", icon:"🏁", color:"#10b981",
              title:`Ruta completada: ${driverLabel}`,
              body:`${del} visitados · ${prob} notas · ${route.stops.length} paradas totales`,
              time: now, read: false, isNew: true });
          }
        }
      });
    };

    // 1) Carga inicial desde Firebase: inicializar snapshot sin disparar notificaciones
    FB.get(RD.path("routes")).then(data => {
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
    const unsubRoutes = FB.listen(RD.path("routes"), processChanges);

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
    const poll = setInterval(() => FB.get(RD.path("routes")).then(d => { if(d) processChanges(d); }), 5000);

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

  const PAGE_TITLES={dashboard:"Dashboard",routes:"Rutas",drivers:"Drivers",import:"Motor",settings:"Config"};
  if(typeof window!=="undefined") window.__rdOpenModal=()=>setModalOpen(true);

  const navItems=[
    {id:"dashboard",label:"Dashboard",icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>},
    {id:"routes",   label:"Rutas",    icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v6a4 4 0 0 0 4 4h6"/><path d="M19 5v8"/></svg>},
    {id:"drivers", label:"Drivers", icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2.2c0-1.55-1.25-2.8-2.8-2.8H6.8C5.25 16 4 17.25 4 18.8V21"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 8v5"/><path d="M17.5 10.5h5"/></svg>},
    {id:"import",   label:"Motor",    icon:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3l2-4h6l2 4h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 10V7h5l2 3"/><path d="M4 10h3"/><path d="M14 5h3l3 4v3"/><path d="M10 3h4v4h-4z"/></svg>},
    {id:"settings", label:"Config",   icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>},
  ];

  // Show login when not authenticated
  if (!currentUser) return <LoginScreen onLogin={handleLogin}/>;

  const role = currentUser.role;
  const rc   = ROLE_CONFIG[role] || ROLE_CONFIG.driver;

  // -- Panel Super Admin --
  if (role === "super_admin") {
    return <PageSuperAdmin currentUser={currentUser} onLogout={handleLogout}/>;
  }

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
        .driverProCard:hover{transform:translateY(-3px);border-color:rgba(96,165,250,.35)!important;box-shadow:0 24px 80px rgba(0,0,0,.48)!important}
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
          <AdminRoutesV5 routes={globalRoutes}/>
        </div>
        <div style={{display:nav==="drivers"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <PageDriversPro mensajeros={mensajeros} setMensajeros={setMensajeros} currentUser={currentUser} routes={globalRoutes}/>
        </div>

        <div style={{display:nav==="import"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <AdminMotorV5/>
        </div>
        <div style={{display:nav==="settings"?"flex":"none",flex:1,overflow:"hidden",flexDirection:"column"}}>
          <AdminConfigV5 currentUser={currentUser}/>
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
