export function placePhotoURL(value:unknown):string|undefined{
 if(typeof value!=='string'||value.length>2000)return;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;
 if(!['tong.visitkorea.or.kr','cdn.visitkorea.or.kr','upload.wikimedia.org'].includes(url.hostname))return;
 url.protocol='https:';return url.toString();}catch{return;}
}
