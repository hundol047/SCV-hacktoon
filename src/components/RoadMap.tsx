'use client';
import {useEffect,useRef,useState} from 'react';
import type {Place} from '../data/demo';
import type {RoadRoute} from '../domain/road-route';
// Adapted from HYUNDAI nearby-map.js: bounded tiles, safe labels, resize cleanup,
// and longitude alignment across the date line. Route geometry is never a straight-line fallback.
export default function RoadMap({from,to,route}:{from:Place;to:Place;route:RoadRoute}){
  const host=useRef<HTMLDivElement>(null),[message,setMessage]=useState('도로 지도 불러오는 중…');
  useEffect(()=>{
    let cancelled=false,map:import('leaflet').Map|undefined,observer:ResizeObserver|undefined;
    import('leaflet').then(L=>{
      if(cancelled||!host.current)return;
      const longitude=(lon:number,ref:number)=>lon+360*Math.round((ref-lon)/360);
      let ref=from.longitude!;
      const points=route.points.map(([lon,lat])=>{ref=longitude(lon,ref);return [lat,ref] as [number,number];});
      map=L.map(host.current,{trackResize:false,minZoom:1,maxZoom:19,scrollWheelZoom:false});
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'});
      let failed=false;
      tiles.on('tileerror',()=>{failed=true;if(!cancelled)setMessage('지도 배경 일부를 불러오지 못했습니다. 경로선과 거리 정보는 유지됩니다.');});
      tiles.on('load',()=>{if(!cancelled&&!failed)setMessage('도로 지도 표시 완료');});tiles.addTo(map);
      const line=L.polyline(points,{color:'#174f41',weight:5}).addTo(map);
      for(const [place,color] of [[from,'#174f41'],[to,'#b56b1a']] as const){const label=document.createElement('span');label.textContent=place.name;L.circleMarker([place.latitude!,longitude(place.longitude!,points[0][1])],{radius:8,color,fillOpacity:1}).bindTooltip(label).addTo(map);}
      map.fitBounds(line.getBounds(),{padding:[24,24],maxZoom:16});
      observer=new ResizeObserver(()=>map?.invalidateSize({animate:false}));observer.observe(host.current);
    }).catch(()=>{if(!cancelled)setMessage('지도 화면을 열지 못했습니다. 아래 거리·시간을 확인하세요.');});
    return()=>{cancelled=true;observer?.disconnect();map?.remove();};
  },[from,to,route]);
  return <><div className="road-map" ref={host} role="region" aria-label={`${from.name}에서 ${to.name}까지 자동차 경로 지도`}/><p role="status">{message}</p></>;
}
