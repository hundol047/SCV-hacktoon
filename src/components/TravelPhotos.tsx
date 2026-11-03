'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Plus,Trash2} from 'lucide-react';
import {listPhotos,savePhotos,preparePhoto,deletePhoto,PHOTO_LIMIT,type TravelPhoto} from '../adapters/photo-storage';
import type {Trip} from '../domain/schema';
export default function TravelPhotos({current}:{current:Trip|null}){
 const [photos,setPhotos]=useState<(TravelPhoto&{url:string})[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null),generation=useRef(0);
 useEffect(()=>{let alive=true,urls:string[]=[];const load=async()=>{const g=++generation.current;try{const rows=await listPhotos();if(!alive||g!==generation.current)return;urls.forEach(URL.revokeObjectURL);const next=rows.map(p=>({...p,url:URL.createObjectURL(p.blob)}));urls=next.map(p=>p.url);setPhotos(next);}catch(e){if(alive)setMessage((e as Error).message);}};void load();window.addEventListener('yeohaengit:photos',load);return()=>{alive=false;urls.forEach(URL.revokeObjectURL);window.removeEventListener('yeohaengit:photos',load);};},[]);
 async function upload(files:File[]){if(!files.length||busy)return;setBusy(true);setMessage('사진을 보관하는 중입니다…');try{
  if(photos.length+files.length>PHOTO_LIMIT)throw Error('사진은 전체 40장까지 보관할 수 있습니다.');
  const rows:TravelPhoto[]=[];for(const file of files){const blob=await preparePhoto(file);rows.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),tripId:current?.id??null,tripTitle:current?.basics.title??'나의 여행 사진',name:file.name,createdAt:new Date().toISOString(),blob});}
  await savePhotos(rows);setMessage(`${rows.length}장의 사진을 보관했습니다.`);
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);if(input.current)input.current.value='';}}
 const visible=photos;
 return <div className="travel-photos" aria-busy={busy}>
  <div className="photo-toolbar"><div><h3>사진으로 남기는 여행</h3><p>{current?`‘${current.basics.title}’ 여행에 사진을 추가합니다.`:'다녀온 풍경과 함께한 순간을 모아 보세요.'}</p></div><button type="button" className="primary" disabled={busy} onClick={()=>input.current?.click()}><Plus size={18} aria-hidden="true"/>{busy?'사진 보관 중…':'사진 올리기'}</button></div>
  <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="여행 사진 선택" disabled={busy} onChange={e=>void upload(Array.from(e.target.files??[]))}/>
  {visible.length?<div className="photo-grid">{visible.map(p=><figure className="travel-photo" key={p.id}><img src={p.url} alt={p.name} loading="lazy" width="400" height="300"/><figcaption><strong>{p.tripTitle}</strong><span>{p.name}</span><button type="button" className="secondary" disabled={busy} aria-label={`${p.name} 사진 삭제`} onClick={async()=>{try{await deletePhoto(p.id);setMessage('사진을 삭제했습니다.');}catch(e){setMessage((e as Error).message);}}}><Trash2 size={16} aria-hidden="true"/>삭제</button></figcaption></figure>)}</div>:<button type="button" className="photo-empty" disabled={busy} onClick={()=>input.current?.click()}><Camera size={36} aria-hidden="true"/><strong>첫 여행 사진을 올려 보세요</strong><span>사진을 선택하면 이곳에 차곡차곡 보관됩니다</span></button>}
  <p className="photo-storage-note">JPG·PNG·WebP · 한 장 10MB 이하 · 전체 {photos.length}/40장<br/>사진은 이 기기의 브라우저에만 보관됩니다. 브라우저 데이터 삭제 시 함께 지워지니 원본은 따로 보관하세요.</p>
  <p role="status">{message}</p>
 </div>;
}
