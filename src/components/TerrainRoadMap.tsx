'use client';
import {useEffect,useRef,useState} from 'react';
import type {Place} from '../data/demo';
import type {RoadRoute} from '../domain/road-route';
import type {Map as GLMap,Marker} from 'maplibre-gl';
export default function TerrainRoadMap({route,stops,onFallback}:{route:RoadRoute;stops:Place[];onFallback:()=>void}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<GLMap|null>(null);const [message,setMessage]=useState('3D 지도를 불러오고 있어요.');
 useEffect(()=>{let cancelled=false,map:GLMap|undefined,observer:ResizeObserver|undefined;let markers:Marker[]=[];let activePopup:import('maplibre-gl').Popup|undefined;
 import('maplibre-gl').then(M=>{
  if(cancelled||!host.current)return;
  M.setWorkerUrl('/vendor/maplibre-worker.mjs');M.setWorkerCount(2);
  try{map=new M.Map({container:host.current,style:{version:8,sources:{base:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'},terrain:{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],tileSize:256,encoding:'terrarium',maxzoom:15,attribution:'Terrain © Mapzen / AWS Open Data'}},layers:[{id:'base',type:'raster',source:'base'}]},center:[stops[0].longitude!,stops[0].latitude!],zoom:11,pitch:50,maxPitch:65,attributionControl:{compact:true}});}catch{onFallback();return;}
  mapRef.current=map;map.scrollZoom.disable();map.addControl(new M.NavigationControl({visualizePitch:true}),'top-right');
  const popup=(members:Place[],indexes:number[])=>{const el=document.createElement('div');members.forEach((p,i)=>{const row=document.createElement('p');row.textContent=`${indexes[i]+1}. ${p.name}`;el.append(row);});return el;};
  const draw=()=>{if(!map||cancelled)return;markers.forEach(m=>m.remove());markers=[];const groups:{point:{x:number;y:number};ids:number[]}[]=[];
   stops.forEach((p,i)=>{const point=map!.project([p.longitude!,p.latitude!]);const group=groups.find(g=>Math.hypot(g.point.x-point.x,g.point.y-point.y)<34);if(group)group.ids.push(i);else groups.push({point,ids:[i]});});
   groups.forEach(g=>{const p=stops[g.ids[0]],el=document.createElement('button');el.className='terrain-stop-marker';el.type='button';el.textContent=g.ids.length>1?`${g.ids.length}곳`:String(g.ids[0]+1);el.setAttribute('aria-label',g.ids.map(i=>`${i+1}. ${stops[i].name}`).join(', '));
    el.addEventListener('click',event=>{event.stopPropagation();if(!map)return;activePopup?.remove();activePopup=new M.Popup({offset:20,maxWidth:'240px',closeOnClick:false}).setLngLat([p.longitude!,p.latitude!]).setDOMContent(popup(g.ids.map(i=>stops[i]),g.ids)).addTo(map);if(g.ids.length>1)map.easeTo({center:[p.longitude!,p.latitude!],zoom:Math.min(18,map.getZoom()+2)});});
    markers.push(new M.Marker({element:el}).setLngLat([p.longitude!,p.latitude!]).addTo(map!));
   });
  };
  map.on('load',()=>{if(cancelled||!map)return;map.setTerrain({source:'terrain',exaggeration:1});map.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.points}}});map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#087e8b','line-width':5},layout:{'line-cap':'round','line-join':'round'}});const bounds=new M.LngLatBounds();route.points.forEach(p=>bounds.extend(p));map.fitBounds(bounds,{padding:45,maxZoom:14,pitch:50,duration:0});draw();setMessage('');});
  map.on('moveend',draw);map.on('error',e=>{if(cancelled)return;if(e.error?.message?.includes('WebGL'))onFallback();else setMessage('일부 지도 자료를 불러오지 못했어요. 2D 보기로 전환할 수 있어요.');});
  observer=new ResizeObserver(()=>{map?.resize();draw();});observer.observe(host.current);
 }).catch(()=>{if(!cancelled)onFallback();});
 return()=>{cancelled=true;observer?.disconnect();markers.forEach(m=>m.remove());map?.remove();mapRef.current=null;};
 },[route,stops,onFallback]);
 return <><div ref={host} className="road-map terrain-road-map" role="region" aria-label="3D 지형 이동 경로 지도"/><p className="road-note">마우스 오른쪽 드래그로 회전 · 장소 번호를 누르면 확대</p><div className="map-stop-picker" aria-label="지도에서 장소 선택">{stops.map((p,i)=><button key={p.id+':'+i} type="button" onClick={()=>mapRef.current?.flyTo({center:[p.longitude!,p.latitude!],zoom:16,pitch:55})}>{i+1}. {p.name}</button>)}</div>{message&&<p role="status" className="road-note">{message}</p>}</>;
}
