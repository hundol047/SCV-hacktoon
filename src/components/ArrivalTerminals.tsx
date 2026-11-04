'use client';
import {useEffect,useState} from 'react';
import {z} from 'zod';
const schema=z.object({locations:z.array(z.object({name:z.string().max(300),displayName:z.string().max(2000).optional(),latitude:z.number().min(33).max(39),longitude:z.number().min(124).max(132)})).max(5)});
type Terminal=z.infer<typeof schema>['locations'][number];
export default function ArrivalTerminals({region,destination}:{region:string;destination:string}){
 const [result,setResult]=useState<{region:string;terminals:Terminal[]}|null>(null);
 useEffect(()=>{const c=new AbortController();fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:region+' 버스터미널'}),signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return schema.parse(await r.json());}).then(data=>{if(!c.signal.aborted)setResult({region,terminals:data.locations.filter(t=>/터미널|정류장|정류소/.test(t.name)).slice(0,3)});}).catch(()=>{});return()=>c.abort();},[region]);
 if(result?.region!==region||!result.terminals.length)return null;
 return <div className="arrival-terminals"><p>도착 터미널 후보 · 예매표의 도착지와 같은 곳에서 내리세요.</p>{result.terminals.map(t=><div key={`${t.name}-${t.latitude}`}><strong>{t.name}</strong> → <a target="_blank" rel="noreferrer" href={'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:`${t.latitude},${t.longitude}`,destination,travelmode:'transit'})}>첫 장소까지 길찾기</a></div>)}</div>;
}
