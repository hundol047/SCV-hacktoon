'use client';
import {useState} from 'react';
import {ImageIcon} from 'lucide-react';
import {placePhotoURL} from '../domain/place-photo';
export default function PlacePhoto({name,url,urls=[]}:{name:string;url?:string;urls?:string[]}){
 const [failed,setFailed]=useState<string[]>([]);
 const candidates=[...new Set([url,...urls].map(placePhotoURL).filter((s):s is string=>!!s))];
 const safe=candidates.find(s=>!failed.includes(s));
 return <div className="course-place-photo">{safe?<img src={safe} alt={name+' 사진'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>[...previous,safe])}/>:<span><ImageIcon size={22}/><small>등록된 사진 없음</small></span>}</div>;
}
