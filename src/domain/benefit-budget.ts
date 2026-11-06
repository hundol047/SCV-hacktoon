import {dayDate} from './schema';
import type {Trip} from './schema';
import {benefitsForPlace,selectBenefits} from './travel-benefits';
export function benefitSavings(trip:Trip,admission:number,eligible:Record<string,number>,today:string){
 const people=trip.basics.travelers??1;
 const seen=new Set<string>();const rows:{id:string;name:string;conditions:string;url:string;people:number;amount:number}[]=[];
 for(const item of trip.items){if(item.kind!=='visit')continue;const place=trip.catalog?.places.find(p=>p.id===item.placeId);if(!place)continue;const key=item.day+':'+place.id;if(seen.has(key))continue;seen.add(key);
  const candidates=benefitsForPlace(selectBenefits(trip,item.day,'',today),place.name).filter(b=>b.discountRate);
  // Do not stack discounts. The best confirmed eligible saving is used once per visit.
  const amounts=candidates.map(b=>{const count=Math.max(0,Math.min(people,Math.floor(eligible[b.id]??0)));return {id:b.id,name:place.name+' · '+b.summary,conditions:b.conditions,url:b.url,people:count,amount:Math.floor((place.cost.value??admission)*b.discountRate!*count)};});
  const admissionCost=(place.cost.value??admission)*people;
  for(const coupon of trip.basics.coupons??[]){if(coupon.day===item.day&&coupon.placeId===place.id&&coupon.until>=dayDate(trip.basics,item.day)&&coupon.until>=today)amounts.push({id:coupon.id,name:place.name+' · '+coupon.title+' (직접 확인)',conditions:coupon.conditions,url:coupon.url,people,amount:Math.min(admissionCost,coupon.amount)});}
  const selected=amounts.sort((a,b)=>b.amount-a.amount)[0];if(selected)rows.push(selected);
 }
 return {rows,saving:rows.reduce((sum,r)=>sum+r.amount,0)};
}
