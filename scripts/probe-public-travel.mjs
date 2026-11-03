// Read-only probes; no credentials, billing or notifications. Keep inherited proxy/CA.
const requests=[
 ['OSRM Seoul road','https://router.project-osrm.org/route/v1/driving/126.972512,37.554704;126.977893,37.567005?overview=full&geometries=geojson&steps=false',async r=>{const d=await r.json();return d.code==='Ok'&&d.routes?.[0]?.geometry?.coordinates?.length>1;}],
 ['Open-Meteo Seoul forecast','https://api.open-meteo.com/v1/forecast?latitude=37.55&longitude=126.97&timezone=auto&forecast_days=2&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&current=temperature_2m',async r=>{const d=await r.json();return d.daily?.time?.length===2&&Number.isFinite(d.current?.temperature_2m);}],
 ['OSM single map tile','https://tile.openstreetmap.org/0/0/0.png',async r=>{const b=new Uint8Array(await r.arrayBuffer());return b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71;}],
];
let failed=false;
for(const [name,url,valid] of requests){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error',headers:{'User-Agent':'Yeohaengit/0.11.0 (+https://github.com/hundol047/SCV-hacktoon)'}});if(!r.ok||!await valid(r))throw Error();console.log('PASS '+name);}catch{failed=true;console.log('FAIL '+name+' — network policy, provider response or availability requires inspection');}}
process.exitCode=failed?1:0;
