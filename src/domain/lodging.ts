import {z} from 'zod';
import {placeSchema} from '../data/catalog';
export const lodgingSchema=z.object({facilities:placeSchema.shape.facilities,id:z.string(),name:z.string(),address:z.string(),latitude:z.number(),longitude:z.number(),distanceKm:z.number().nonnegative(),imageUrl:z.string().url().refine(v=>v.startsWith("https://")).optional()});
export function lodgingLinks(name:string,checkIn:string,checkOut:string,adults:number,rooms:number){return {booking:'https://www.booking.com/searchresults.ko.html?'+new URLSearchParams({ss:name,checkin:checkIn,checkout:checkOut,group_adults:String(adults),no_rooms:String(rooms),group_children:'0'}),compare:'https://www.google.com/travel/search?'+new URLSearchParams({q:`${name} ${checkIn} ${checkOut} 성인 ${adults}명 객실 ${rooms}개 숙소 가격 비교`})};}

export function lodgingImage(value:unknown):string|undefined {
 if(typeof value!=='string'||!value.trim())return;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return;url.protocol='https:';return url.href;}catch{return;}
}
