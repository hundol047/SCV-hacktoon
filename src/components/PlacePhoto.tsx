'use client';
import {useState} from 'react';
import {ImageIcon} from 'lucide-react';
import {placePhotoURL} from '../domain/place-photo';
export default function PlacePhoto({name,url}:{name:string;url?:string}){
 const [failed,setFailed]=useState('');const safe=placePhotoURL(url);
 return <div className="course-place-photo">{safe&&failed!==safe?<img src={safe} alt={name+' 사진'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(safe)}/>:<span><ImageIcon size={22}/><small>사진 준비 중</small></span>}</div>;
}
