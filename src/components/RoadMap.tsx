'use client';
import {useEffect,useRef,useState} from 'react';
import type {Place} from '../data/demo';
import type {RoadRoute} from '../domain/road-route';
export default function RoadMap({from,to,route,stops}:{from:Place;to:Place;route:RoadRoute;stops?:Place[]}){
 const host=useRef<HTMLDivElement>(null),retry=useRef<()=>void>(()=>{}),[message,setMessage]=useState('도로 지도 불러오는 중…'),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let cancelled=false,map:import('leaflet').Map|undefined,observer:ResizeObserver|undefined,timer:ReturnType<typeof setTimeout>|undefined,frame:number|undefined;
  import('leaflet').then(L=>{
   if(cancelled||!host.current)return;
   const longitude=(lon:number,ref:number)=>lon+360*Math.round((ref-lon)/360);let ref=from.longitude!;
   const points=route.points.map(([lon,lat])=>{ref=longitude(lon,ref);return [lat,ref] as [number,number];});
   map=L.map(host.current,{trackResize:false,minZoom:1,maxZoom:19,scrollWheelZoom:false});
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'});
   const warn=()=>{if(!cancelled){setFailed(true);setMessage('지도 배경을 불러오지 못했습니다. 경로와 거리 정보는 유지됩니다.');}};
   const sample=()=>{
    if(cancelled||!host.current)return;const r=host.current.getBoundingClientRect();
    const visible=[...tiles.getContainer()!.querySelectorAll('img')].filter(img=>{const b=img.getBoundingClientRect();return b.right>r.left&&b.left<r.right&&b.bottom>r.top&&b.top<r.bottom;});
    if(visible.length&&visible.every(img=>img.complete&&img.naturalWidth>0)){clearTimeout(timer);setFailed(false);setMessage('');}
   };
   const loading=()=>{clearTimeout(timer);timer=setTimeout(warn,12000);};
   tiles.on('tileerror',warn).on('load',sample).on('tileload',sample).on('loading',loading).addTo(map);
   map.on('moveend',()=>{if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(sample);});
   retry.current=()=>{setFailed(false);setMessage('도로 지도 다시 불러오는 중…');loading();tiles.redraw();};
   const line=L.polyline(points,{color:'#174f41',weight:5}).addTo(map);
   for(const [i,place] of (stops??[from,to]).entries()){
    const label=document.createElement('span');label.textContent=`${i+1}. ${place.name}`;
    const marker=L.divIcon({className:'route-number-marker',html:`<span>${i+1}</span>`,iconSize:[28,28],iconAnchor:[14,14]});
    L.marker([place.latitude!,longitude(place.longitude!,points[0][1])],{icon:marker,title:label.textContent!,keyboard:true}).bindTooltip(label,{direction:'top'}).bindPopup(label.cloneNode(true) as HTMLElement).addTo(map);
   }
   map.fitBounds(line.getBounds(),{padding:[30,30],maxZoom:16});loading();
   observer=new ResizeObserver(()=>{map?.invalidateSize({animate:false});sample();});observer.observe(host.current);
  }).catch(()=>{if(!cancelled)setMessage('지도 화면을 열지 못했습니다. 거리·시간을 확인하세요.');});
  return()=>{cancelled=true;clearTimeout(timer);if(frame)cancelAnimationFrame(frame);retry.current=()=>{};observer?.disconnect();map?.remove();};
 },[from,to,route,stops]);
 return <><div className="road-map" ref={host} role="region" aria-label={stops?'하루 전체 자동차 코스 지도':`${from.name}에서 ${to.name}까지 자동차 경로 지도`}/>{message&&<p role="status" className="road-note">{message}</p>}{failed&&<button type="button" onClick={()=>retry.current()}>지도 다시 불러오기</button>}</>;
}
