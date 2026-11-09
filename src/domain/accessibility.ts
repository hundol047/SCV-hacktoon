import type {Place,Fact} from '../data/demo';
import {type Facility,recentFact,facilityKeys,facilityNames} from './venue-details';
export function osmAccessibility(tags:Record<string,string>,id:string,source:string,collectedAt?:string):Place['facilities']{
 const out:NonNullable<Place['facilities']>={};
 const put=(key:Facility,value:boolean|null)=>{if(value!==null)out[key]={value,evidenceId:id+':'+key,source,collectedAt,nature:'real',checked:'source'};};
 const yesno=(v:string|undefined)=>v==='yes'?true:v==='no'?false:null;
 put('wheelchair',yesno(tags.wheelchair));
 put('ramp',yesno(tags['ramp:wheelchair']??tags.ramp));
 put('accessibleToilet',yesno(tags['toilets:wheelchair']));
 // Neither a wheelchair tag nor a ramp proves that every path has no steps.
 put('stepFree',tags.highway==='steps'?false:tags.step_count==='0'?true:null);
 // An unsigned or directional incline is not a measured gentle gradient.
 if(/^[+-]?\d+(\.\d+)?%$/.test(tags.incline??''))put('gentleSlope',Math.abs(parseFloat(tags.incline))<=5);
 return out;
}
const clean=(v:unknown)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim().slice(0,2000):'';
export function barrierFreeFacts(row:Record<string,unknown>,id:string,at:string):Place['facilities']{
 const source='https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2';
 const out:NonNullable<Place['facilities']>={};
 const put=(key:Facility,value:boolean|null)=>{if(value!==null)out[key]={value,evidenceId:id+':'+key,source,collectedAt:at,nature:'real',checked:'source'} as Fact<boolean>;};
 const entry=clean(row.exit),route=clean(row.route),toilet=clean(row.restroom),lift=clean(row.elevator);
 // Only explicit statements qualify. Rental availability (wheelchair field) is not access.
 const classify=(text:string,positive:RegExp,negative:RegExp)=>negative.test(text)?false:positive.test(text)?true:null;
 const paths=entry+' '+route;
 const uncertain=/(일부|부분|도움|보조|동반|확인\s*필요|공사|폐쇄|제한|유료|가능하[나지]|가능하지만|어려|어렵)/;
 if(!uncertain.test(paths)){
  put('ramp',classify(paths,/경사로(?:가|는)?\s*(있음|있습니다|설치|이용\s*가능)/,/경사로(?:가|는)?\s*(없|미설치|이용\s*불가)/));
  put('stepFree',classify(paths,/(계단|단차|문턱|턱)(?:이|가|은|는)?\s*(없음|없습니다|없어)|무단차/,/(계단|단차|문턱|턱)(?:이|가|은|는)?\s*(있음|있습니다|있어)/));
  put('wheelchair',classify(paths,/휠체어\s*(접근|출입|진입|통행|이동)\s*가능/,/휠체어\s*(접근|출입|진입|통행|이동)\s*(불가|불가능)/));
  put('gentleSlope',classify(paths,/(경사|진입로)\s*(가\s*)?완만|평탄한\s*(진입로|접근로)/,/급경사|가파른/));
 }
 if(!uncertain.test(toilet))put('accessibleToilet',classify(toilet,/장애인\s*(?:전용\s*)?화장실(?:이|은|는)?\s*(있음|있습니다|설치|이용\s*가능)/,/장애인\s*(?:전용\s*)?화장실(?:이|은|는)?\s*(없|미설치|이용\s*불가)/));
 if(!uncertain.test(lift))put('elevator',classify(lift,/^(있음|있습니다|설치됨)$|(엘리베이터|승강기)(?:가|는)?\s*(있음|있습니다|설치|이용\s*가능)/,/^(없음|없습니다|미설치)$|(엘리베이터|승강기)(?:가|는)?\s*(없|미설치|이용\s*불가)/));
 return out;
}
export function accessLabels(place:Place){return facilityKeys.filter(k=>place.facilities?.[k]?.value===true&&recentFact(place.facilities[k])).map(key=>({key,label:facilityNames[key],source:place.facilities![key]!.source}));}
