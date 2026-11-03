export type TravelPhoto={id:string;tripId:string|null;tripTitle:string;name:string;createdAt:string;blob:Blob};
const database='yeohaengit-photos-v1',store='photos';
export const PHOTO_LIMIT=40;
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 const request=indexedDB.open(database,1);
 request.onupgradeneeded=()=>request.result.createObjectStore(store,{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(Error('사진 저장 공간을 열 수 없습니다. 브라우저 저장 설정을 확인하세요.'));
});}
export async function listPhotos():Promise<TravelPhoto[]>{const db=await openDB();return new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readonly'),request=tx.objectStore(store).getAll();
 tx.oncomplete=()=>{db.close();resolve((request.result as TravelPhoto[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));};
 tx.onabort=tx.onerror=()=>{db.close();reject(Error('보관한 사진을 읽지 못했습니다.'));};
});}
export async function savePhotos(photos:TravelPhoto[]){const db=await openDB();return new Promise<void>((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);let full=false;
 const count=s.count();count.onsuccess=()=>{if(count.result+photos.length>PHOTO_LIMIT){full=true;tx.abort();return;}photos.forEach(p=>s.add(p));};
 tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('yeohaengit:photos'));resolve();};
 tx.onabort=tx.onerror=()=>{db.close();reject(Error(full?'사진은 최대 40장까지 보관할 수 있습니다. 일부 사진을 삭제해 주세요.':'사진을 저장하지 못했습니다. 기기의 저장 공간을 확인하세요.'));};
});}
async function erase(id?:string){const db=await openDB();return new Promise<void>((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);if(id)s.delete(id);else s.clear();
 tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('yeohaengit:photos'));resolve();};
 tx.onabort=tx.onerror=()=>{db.close();reject(Error('사진을 삭제하지 못했습니다.'));};
});}
export const deletePhoto=(id:string)=>erase(id);
export const clearPhotos=()=>erase();
export async function preparePhoto(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP 사진을 선택해 주세요. HEIC 사진은 JPG로 변환해 주세요.');
 if(file.size>10*1024*1024)throw Error('사진 한 장은 10MB 이하로 선택해 주세요.');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.'));image.src=url;});
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>50000000)throw Error('사진 해상도가 너무 큽니다. 5천만 화소 이하 사진을 선택해 주세요.');
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('이 브라우저에서는 사진을 처리할 수 없습니다.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('사진을 저장용으로 변환하지 못했습니다.')),'image/jpeg',0.85));
 }finally{URL.revokeObjectURL(url);}
}
