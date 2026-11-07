'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {Place} from '../data/demo';
import type {DayRoad} from '../domain/road-day';
const snapshotSchema=z.object({key:z.string(),at:z.string().datetime(),points:z.array(z.tuple([z.number().min(-180).max(180),z.number().min(-85).max(85)])).min(2).max(20000),stops:z.array(z.object({name:z.string().max(300),latitude:z.number(),longitude:z.number()})).max(25)});
type Snapshot=z.infer<typeof snapshotSchema>;
const storageKey='yeohaengit:offline-route:v1';
export default function OfflineRoute({places,road}:{places:Place[];road?:DayRoad}){
 const key=JSON.stringify(places.map(p=>[p.id,p.latitude,p.longitude])),[saved,setSaved]=useState<Snapshot|null>(null),[message,setMessage]=useState(''),svg=useRef<SVGSVGElement>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(storageKey);const data=raw?snapshotSchema.parse(JSON.parse(raw)):null;setSaved(data?.key===key?data:null);}catch{setSaved(null);}},[key]);
 const current=road?snapshotSchema.safeParse({key,at:road.fetchedAt,points:road.points,stops:places.map(p=>({name:p.name,latitude:p.latitude,longitude:p.longitude}))}):null;
 const data=current?.success?current.data:saved?.key===key?saved:null;const points=data?.points??[];
 const project=([lon,lat]:number[])=>[lon,180/Math.PI*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
 const projected=points.map(project),xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(600/Math.max(.00001,maxX-minX),280/Math.max(.00001,maxY-minY));
 const xy=(p:number[])=>{const [x,y]=project(p);return [40+(x-minX)*scale,320-(y-minY)*scale];};
 function save(){if(!data)return;try{localStorage.setItem(storageKey,JSON.stringify(data));setSaved(data);setMessage('현재 경로 조각을 기기에 저장했습니다. 새 경로를 저장하면 이전 조각을 교체합니다.');}catch{setMessage('기기 저장 공간이 부족합니다. SVG 파일로 저장하세요.');}}
 function download(){if(!svg.current)return;const blob=new Blob([new XMLSerializer().serializeToString(svg.current)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='yeohaengit-route.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <details className="travel-panel"><summary>오프라인 경로 조각 저장</summary><p>조회한 도로선과 방문 위치를 저장합니다. 지도 배경·실시간 길안내는 포함하지 않습니다. SVG 파일은 인터넷 없이 열 수 있습니다.</p>{data?<><svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 410" role="img" aria-label="저장 가능한 여행 경로 지도" style={{width:'100%',background:'#f2f4eb'}}><rect width="680" height="410" fill="#f2f4eb"/><text x="25" y="30" fill="#203d32" fontSize="18">여행잇 · 도로 경로와 방문 위치</text><polyline points={points.map(p=>xy(p).join(',')).join(' ')} fill="none" stroke="#285846" strokeWidth="4"/>{data.stops.map((p,i)=>{const [x,y]=xy([p.longitude,p.latitude]);return <g key={i}><circle cx={x} cy={y} r="7" fill="#b56b1a"/><text x={x+10} y={y-8} fontSize="12" fill="#203d32">{i+1}. {p.name}</text></g>;})}<text x="25" y="385" fontSize="12" fill="#203d32">{data.at.slice(0,10)} 저장 자료 · 도로선 OSRM / OpenStreetMap contributors</text></svg><div className="schedule-actions"><button onClick={save}>현재 경로 기기에 저장</button><button onClick={download}>SVG 파일로 저장</button><button onClick={()=>{try{localStorage.removeItem(storageKey);setSaved(null);setMessage('저장한 경로 조각을 삭제했습니다.');}catch{setMessage('삭제하지 못했습니다. 브라우저 저장 설정을 확인하세요.');}}}>기기 캐시 삭제</button></div></>:<p>온라인에서 위 이동 경로를 먼저 조회한 뒤 저장하세요.</p>}{message&&<p role="status">{message}</p>}</details>;
}
