import type {Trip} from './schema';
import {dayDate} from './schema';
import {travelBenefits,type Benefit} from '../data/travel-benefits';
export const benefitRegionAliases:Record<string,string[]>={서울:['서울'],부산:['부산'],대구:['대구'],인천:['인천'],광주:['광주광역시'],대전:['대전'],울산:['울산'],세종:['세종'],경기:['경기도','경기'],강원:['강원'],충북:['충청북도','충북'],충남:['충청남도','충남'],전북:['전북','전라북도'],전남:['전라남도','전남'],경북:['경상북도','경북'],경남:['경상남도','경남'],제주:['제주']};
const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
export function benefitRegions(text:string){return Object.entries(benefitRegionAliases).filter(([,names])=>names.some(n=>text.includes(n))).map(([r])=>r);}
export function koreaToday(now=Date.now()){return new Date(now+9*3600000).toISOString().slice(0,10);}
export function selectBenefits(trip:Trip,day:number,regionOverride='',today=koreaToday(),catalog:Benefit[]=travelBenefits){
 const destination=trip.basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day);
 const places=trip.items.filter(i=>i.day===day&&i.placeId).map(i=>trip.catalog?.places.find(p=>p.id===i.placeId)).filter(p=>!!p);
 const domestic=destination?destination.timezone==='Asia/Seoul':trip.basics.timezone==='Asia/Seoul';
 if(!domestic&&!regionOverride)return [];
 // Departure names are deliberately excluded: a Seoul departure is not a Seoul holiday.
 const context=destination?destination.region:trip.basics.title+' '+trip.basics.region;
 const contextRegions=benefitRegions(context);
 const regions=regionOverride?[regionOverride]:contextRegions.length?contextRegions:[...new Set(benefitRegions(places.map(p=>p.region??'').join(' ')))];
 const localText=context+' '+places.map(p=>[p.name,p.visitorInfo?.address].filter(Boolean).join(' ')).join(' ');
 const date=dayDate(trip.basics,day),venueNames=places.map(p=>norm(p.name));
 return catalog.filter(b=>b.regions.some(r=>regions.includes(r)))
 .filter(b=>!b.reviewBy||today<=b.reviewBy)
 .filter(b=>!(b.until&&(b.until<today||date>b.until))&&!(b.from&&date<b.from))
 .filter(b=>regionOverride||!b.cities||b.venues?.some(n=>venueNames.some(p=>p.includes(norm(n))))||b.cities.some(city=>localText.includes(city))||b.kind==='resident'&&trip.basics.title.replace(/\s*여행$/,'').trim()===b.regions[0])
 .map(b=>({...b,inItinerary:!regionOverride&&!!b.venues?.some(n=>venueNames.some(p=>p.includes(norm(n))))}))
 .sort((a,b)=>Number(b.inItinerary)-Number(a.inItinerary)||(a.kind==='discount'?0:a.kind==='resident'?1:a.kind==='pass'?2:3)-(b.kind==='discount'?0:b.kind==='resident'?1:b.kind==='pass'?2:3));
}

// Match the actual facility, not just its city or a similarly named business.
export function benefitsForPlace(benefits:Benefit[],name:string){return benefits.filter(b=>b.venues?.some(v=>norm(v)===norm(name)));}
