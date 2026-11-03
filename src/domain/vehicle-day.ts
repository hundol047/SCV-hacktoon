import {dayDate} from './schema';
import {confirmedFacilities,closedOn} from './venue-details';
import {dayWeather} from './day-weather';
import type {Basics} from './schema';
import type {Catalog} from '../data/catalog';
import {isTravelOnlyDay} from './world';
import {weatherAllowed,weatherGuidance} from './weather';

export function vehicleDayError(basics:Basics,catalog:Catalog,day:number,ids:string[]):string|null{
  if(!Number.isInteger(day)||day<1||day>basics.days)return '여행 기간 안의 여행일을 선택해 주세요.';
  if(basics.travelDays?.includes(day)||isTravelOnlyDay(basics,day))return '이동 전용 날짜에는 관광 코스를 배정할 수 없습니다. 다른 여행일을 선택하세요.';
  const region=basics.destinations?.find(d=>d.startDay<=day&&d.endDay>=day)?.region??basics.region;
  const places=ids.map(id=>catalog.places.find(p=>p.id===id));
  if(places.some(p=>!p||(p.region??catalog.region)!==region))return '선택한 여행일의 지역에 있는 장소만 골라 주세요.';
  if(places.some(p=>!confirmedFacilities(p!,basics.requiredFacilities)))return '선택한 장소의 필수 시설이 최근 확인되지 않았습니다.';
  if(places.some(p=>closedOn(p!,dayDate(basics,day))))return '선택한 여행일에 휴무로 기록된 장소가 있습니다.';
  let weather;try{weather=dayWeather(basics,day);}catch(e){return (e as Error).message;}
  if(weather==='storm')return weatherGuidance.storm;
  if(places.some(p=>!weatherAllowed(p!,weather)))return '선택한 날씨에 맞지 않는 야외 장소가 있습니다. 장소 또는 날씨 가정을 확인하세요.';
  return null;
}
