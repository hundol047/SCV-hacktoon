import { Basics,Conditions,Item } from './schema';
import { Catalog,catalogFor,indexCatalog } from '../data/catalog';
import { Place } from '../data/demo';
import {destinationFor,isTravelOnlyDay} from './world';
import { validateSchedule } from './validate';

type Task={place:Place;kind:'visit'|'meal'}|{fixed:Item};
export type SearchResult={items:Item[];reasons:string[];preserved:string[];blocked:boolean;searched:number;searchLimited:boolean};
const MAX_SEARCH=12000;
function buildDay(tasks:Task[],day:number,c:Conditions,b:Basics,catalog:Catalog,restMin:number):Item[]|null{
  const {placeById,getRoute}=indexCatalog(catalog);
  const rows:Item[]=[];let cursor=570,serial=0,last:string|null=null;
  const reserved=new Set(tasks.flatMap(t=>'fixed'in t?[t.fixed.id]:[]));
  const add=(kind:Item['kind'],p:string|null,start:number,end:number,extra:Partial<Item>={})=>{
    if(start<0||end>1440||end<=start)return false;
    while(reserved.has(`plan:${day}:${serial}`))serial++;
    rows.push({id:`plan:${day}:${serial++}`,day,start,end,kind,placeId:p,fromId:null,toId:null,transport:null,locked:false,mode:b.mode,...extra});cursor=end;return true;
  };
  const rest=(p:Place,length=restMin)=>p.seat.value===true&&add('rest',p.id,cursor,cursor+length);
  for(let n=0;n<tasks.length;n++){
    const task=tasks[n],fixed='fixed'in task?task.fixed:null;
    const p=fixed?placeById.get(fixed.kind==='move'?fixed.fromId??'':fixed.placeId??''):(task as {place:Place}).place;
    if(!p)return null;
    const target=fixed?.start??Infinity;
    if(fixed&&cursor>target&&rows.length)return null;
    if(!rows.length&&fixed)cursor=Math.min(cursor,target);
    if(last&&last!==p.id){
      const route=getRoute(last,p.id,b.transport);
      if(!route||route.duration.value===null)return null;
      if(cursor+route.duration.value>target)return null;
      if(!add('move',null,cursor,cursor+route.duration.value,{fromId:last,toId:p.id,transport:b.transport}))return null;
      // The rest is a seat with known duration, not a label or a route-distance estimate.
      if(!fixed&&!rest(p))return null;
    }
    if(fixed){
      if(cursor>fixed.start)return null;
      if(fixed.start-cursor>=restMin&&p.seat.value===true)rest(p,fixed.start-cursor);
      rows.push({...fixed});cursor=fixed.end;last=fixed.kind==='move'?fixed.toId:fixed.placeId;
      if(fixed.kind!=='rest'){
        const next=tasks[n+1];const nextFixed=next&&'fixed'in next?next.fixed:null;
        const seat=placeById.get(last??'');
        if(seat&&(!nextFixed||cursor+restMin<=nextFixed.start))rest(seat);
      }
    }else{
      const kind=(task as {kind:'visit'|'meal'}).kind;
      if(kind==='meal'&&cursor<660){if(p.seat.value===true)rest(p,660-cursor);else cursor=660;}
      const length=Math.max(p.walkMin.value??0,Math.min(kind==='meal'?40:30,c.restInterval??40));
      if(!add(kind,p.id,cursor,cursor+length))return null;
      last=p.id;if(!rest(p))return null;
    }
  }
  return rows;
}
function* interleave(flexible:Task[],anchors:Task[],prefix:Task[]=[]):Generator<Task[]>{
  if(!flexible.length&&!anchors.length){yield prefix;return;}
  if(flexible.length)yield* interleave(flexible.slice(1),anchors,[...prefix,flexible[0]]);
  if(anchors.length)yield* interleave(flexible,anchors.slice(1),[...prefix,anchors[0]]);
}
export function optimize(c:Conditions,b:Basics,original:Item[]=[],feedback:string[]=[],supplied?:Catalog):SearchResult{
  const catalog=catalogFor(b.mode,supplied),{placeById}=indexCatalog(catalog);
  const requested=[...new Set([...c.requiredExperiences,...c.experiences])];
  const eligible=(p:Place)=>p.walkMin.value!==null&&p.walkM.value!==null&&p.seat.value===true&&
    (c.maxWalkMin===null||p.walkMin.value<=c.maxWalkMin)&&(c.maxWalkM===null||p.walkM.value<=c.maxWalkM)&&
    (!c.avoidStairs||p.stairs.value===false)&&!c.avoidSituations.some(s=>p.situations.value?.includes(s));
  const visits=catalog.places.filter(p=>p.kind==='visit'&&eligible(p));
  const supported=['매운 음식','순한 음식','지역 음식','죽'];
  const meals=catalog.places.filter(p=>p.kind==='meal'&&eligible(p)&&p.foods.value!==null&&!c.foodAvoids.some(f=>!supported.includes(f)||p.foods.value!.includes(f))&&! (feedback.includes('식사를 바꾸고 싶어요')&&original.some(i=>i.kind==='meal'&&i.placeId===p.id)));
  const locked=original.filter(i=>i.locked);
  if(catalog.mode==='real'&&(!visits.length||!meals.length)&&!locked.length){
    const safe=catalog.places.filter(p=>(!c.avoidStairs||p.stairs.value!==true)&&!c.avoidSituations.some(x=>p.situations.value?.includes(x))&&!c.foodAvoids.some(x=>p.foods.value?.includes(x)));
    const availableVisits=safe.filter(p=>p.kind==='visit'),availableMeals=safe.filter(p=>p.kind==='meal');
    const items:Item[]=[],used=new Set<string>(),covered=new Set<string>(),notes=new Set<string>();
    const fewer=feedback.includes('걷는 구간을 줄여 주세요'),restMin=(c.restMin??20)+(feedback.includes('쉬는 시간을 늘려 주세요')?10:0);
    for(let day=1;day<=b.days;day++){
      if(isTravelOnlyDay(b,day))continue;
      const dayRegion=destinationFor(b,day)?.region,cityVisits=availableVisits.filter(p=>!dayRegion||(p.region??catalog.region)===dayRegion);let candidates=cityVisits.filter(p=>!used.has(p.id));
      if(!candidates.length&&cityVisits.length){candidates=cityVisits;notes.add('추가 관광 후보가 없어 일부 장소를 반복했습니다. 다른 후보를 조회하거나 직접 선택해 주세요.');}
      candidates.sort((a,b)=>c.requiredExperiences.filter(x=>!covered.has(x)&&b.experiences.includes(x)).length-c.requiredExperiences.filter(x=>!covered.has(x)&&a.experiences.includes(x)).length||requested.filter(x=>!covered.has(x)&&b.experiences.includes(x)).length-requested.filter(x=>!covered.has(x)&&a.experiences.includes(x)).length);
      const count=fewer?1:Math.min(2,Math.max(1,Math.ceil(candidates.length/(b.days-day+1))));
      const selected=candidates.slice(0,count);
      // Keep required experiences even when the request asks for fewer visits.
      if(day===b.days)for(const experience of c.requiredExperiences)if(!covered.has(experience)&&!selected.some(p=>p.experiences.includes(experience))){const p=candidates.find(p=>p.experiences.includes(experience));if(p&&!selected.includes(p))selected.push(p);}
      let mealCandidates=availableMeals.filter(p=>!dayRegion||(p.region??catalog.region)===dayRegion);
      if(feedback.includes('식사를 바꾸고 싶어요')){const alternatives=mealCandidates.filter(p=>!original.some(i=>i.kind==='meal'&&i.placeId===p.id));if(alternatives.length)mealCandidates=alternatives;else notes.add('다른 식당 후보가 없어 식사를 바꾸지 못했습니다. 메뉴·회피 음식 정보도 확인해 주세요.');}
      const meal=[...mealCandidates].sort((a,b)=>Number(used.has(a.id))-Number(used.has(b.id))+c.foodLikes.filter(x=>b.foods.value?.includes(x)).length-c.foodLikes.filter(x=>a.foods.value?.includes(x)).length)[0];
      if(meal){if(used.has(meal.id))notes.add('식당 후보가 부족해 식당을 반복했습니다. 다른 식당 후보를 추가해 주세요.');selected.splice(Math.min(1,selected.length),0,meal);}
      let cursor=570,last:string|null=null;
      const add=(kind:Item['kind'],p:Place,start:number,end:number)=>items.push({id:`draft:${day}:${items.length}`,day,start,end,kind,placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real'});
      for(const p of selected){
        if(last){const route=indexCatalog(catalog).getRoute(last,p.id,b.transport),length=route?.duration.value??20;items.push({id:`draft:${day}:${items.length}`,day,start:cursor,end:cursor+length,kind:'move',placeId:null,fromId:last,toId:p.id,transport:b.transport,locked:false,mode:'real'});cursor+=length;}
        if(p.kind==='meal'&&cursor<660){add('rest',p,cursor,660);cursor=660;}
        const length=Math.max(p.walkMin.value??0,p.kind==='meal'?40:Math.min(40,c.restInterval??40));
        add(p.kind,p,cursor,cursor+length);cursor+=length;
        const seat=p.seat.value===true?p:undefined;
        // Reserve a rest slot without inventing a seat or resetting unknown walking facts.
        if(p.seat.value!==false){add('rest',seat??p,cursor,cursor+restMin);cursor+=restMin;if(!seat)notes.add('휴식 시간을 배정했지만 앉을 자리는 미확인입니다. 현장에 확인하기 전 휴식 조건 충족으로 계산하지 않습니다.');}
        else notes.add('앉을 자리가 없는 것으로 기록된 장소에서는 휴식을 배치하지 못했습니다. 다른 휴식 장소를 선택해 주세요.');
        last=p.id;used.add(p.id);for(const x of p.experiences)covered.add(x);
      }
    }
    const report=validateSchedule(items,c,b,catalog);
    return {items,blocked:report.issues.some(x=>x.status==='violation'||x.status==='conflict'),searched:0,searchLimited:false,preserved:requested.filter(x=>covered.has(x)),reasons:[
      '실제 장소를 배치한 확인 전 초안입니다. 방문 최대 40분·미확인 이동 20분은 편집용 배정 시간이며 실제 소요 시간이나 적합성 확인값이 아닙니다.',
      ...(fewer?['필수 경험을 유지하면서 방문 수와 이동 구간을 줄였습니다. 실제 보행 감소량은 자료 부족으로 확인하지 못했습니다.']:[]),
      ...(feedback.includes('쉬는 시간을 늘려 주세요')?[`의견에 따라 최소 휴식 배정을 ${restMin}분으로 늘렸습니다. 좌석 확인이 필요합니다.`]:[]),
      ...(feedback.includes('식사를 바꾸고 싶어요')&&!notes.has('다른 식당 후보가 없어 식사를 바꾸지 못했습니다. 메뉴·회피 음식 정보도 확인해 주세요.')?['기존 일정에 없는 식당 후보로 바꿨습니다. 메뉴 적합성은 별도로 확인해 주세요.']:[]),
      ...notes,'시설·메뉴·내부 보행·경로의 미확인 항목은 충족으로 판단하지 않았습니다. 경로 조회와 출발 전 확인을 거쳐 수정해 주세요.'
    ]};
  }

  if(locked.some(i=>validateSchedule([{...i,day:1}],{...c,requiredExperiences:[]},{...b,days:1},catalog).issues.some(x=>x.status==='violation'&&['time','stairs','route-stairs','food','internal-time','travel-time','place-kind','walk-time','walk-distance'].includes(x.code))))return {items:structuredClone(original),blocked:true,searched:0,searchLimited:false,preserved:[],reasons:['고정 구간 자체가 필수 조건과 맞지 않습니다. 고정 구간을 보존했고 조건을 낮추지 않았어요. 직접 고정을 해제하거나 해당 조건을 명시적으로 조정해 주세요.']};
  type State={items:Item[];score:number;covered:Set<string>;cost:number};
  let beam:State[]=[{items:[],score:0,covered:new Set(),cost:0}],searched=0,limited=false;
  const restMin=(c.restMin??20)+(feedback.includes('쉬는 시간을 늘려 주세요')?10:0);
  for(let day=1;day<=b.days;day++){
    if(isTravelOnlyDay(b,day)&&!locked.some(i=>i.day===day))continue;
    const anchors=original.filter(i=>i.day===day&&i.locked).sort((a,b)=>a.start-b.start).map(fixed=>({fixed}));
    const fixedVisits=anchors.filter(a=>a.fixed.kind==='visit').length,hasMeal=anchors.some(a=>a.fixed.kind==='meal');
    const next:State[]=[];
    for(const state of beam){
      let considered=0;const allowance=Math.max(1,Math.floor(MAX_SEARCH/b.days/beam.length));
      const dayRegion=destinationFor(b,day)?.region;const sorted=[...visits].filter(p=>!dayRegion||(p.region??catalog.region)===dayRegion).sort((a,b)=>requested.filter(e=>!state.covered.has(e)&&b.experiences.includes(e)).length-requested.filter(e=>!state.covered.has(e)&&a.experiences.includes(e)).length||(a.walkMin.value??0)-(b.walkMin.value??0)).slice(0,12);
      const counts=[Math.max(0,2-fixedVisits),Math.max(0,1-fixedVisits),Math.max(0,3-fixedVisits)].filter((n,i,a)=>a.indexOf(n)===i);
      if(feedback.includes('걷는 구간을 줄여 주세요'))counts.sort((a,b)=>a-b);
      const variants:Place[][]=[];
      function combinations(prefix:Place[],count:number){if(!count){variants.push(prefix);return;}for(const p of sorted)if(!prefix.some(q=>q.id===p.id))combinations([...prefix,p],count-1);}
      for(const count of counts)combinations([],count);
      outer:for(const variant of variants)for(const meal of hasMeal?[null]:meals.filter(p=>!dayRegion||(p.region??catalog.region)===dayRegion).slice(0,12)){
        const mealPositions=meal?Array.from({length:variant.length+1},(_,i)=>i):[-1];
        // Prefer lunch after the first visit while still exploring every placement.
        mealPositions.sort((a,b)=>Math.abs(a-1)-Math.abs(b-1));
        for(const at of mealPositions){const flexible:Task[]=variant.map(place=>({place,kind:'visit'}));if(meal)flexible.splice(at,0,{place:meal,kind:'meal'});
          for(const tasks of interleave(flexible,anchors)){
            if(++considered>allowance){limited=true;break outer;}searched++;
            const rows=buildDay(tasks,day,c,b,catalog,restMin);if(!rows)continue;
            const dayRows=rows.map(i=>({...i,day:1}));
            const report=validateSchedule(dayRows,{...c,requiredExperiences:[]},{...b,days:1,destinations:undefined,expenses:undefined,transfers:undefined},catalog);
            if(report.issues.some(i=>i.status==='violation'||i.status==='conflict'))continue;
            if(state.cost+report.cost>b.budget)continue;
            const items=[...state.items,...rows];
            const covered=new Set([...state.covered,...rows.filter(i=>i.kind==='visit'||i.kind==='meal').flatMap(i=>placeById.get(i.placeId??'')?.experiences??[])]);
            const coverage=requested.filter(e=>covered.has(e)).length;
            const required=c.requiredExperiences.filter(e=>covered.has(e)).length;
            const walking=rows.filter(i=>i.kind==='visit').reduce((sum,i)=>sum+(placeById.get(i.placeId??'')?.walkMin.value??0),0);
            const count=rows.filter(i=>i.kind==='visit').length;
            const foodPreference=meal?c.foodLikes.filter(f=>meal.foods.value?.includes(f)).length:0;
            const score=required*100000+coverage*10000+foodPreference*1000+(feedback.includes('걷는 구간을 줄여 주세요')?-walking*100:Math.min(count,2)*500-walking)-report.cost/100;
            next.push({items,covered,score:state.score+score,cost:state.cost+report.cost});
          }
        }
      }
    }
    // Retain best state per experience set, so day two can complete experiences from day one.
    const masks=new Map<string,State[]>();
    for(const state of next.sort((a,b)=>b.score-a.score)){const mask=requested.filter(e=>state.covered.has(e)).sort().join('|');const options=masks.get(mask)??[];if(!options.some(s=>s.score>=state.score&&s.cost<=state.cost))masks.set(mask,[...options,state]);}
    beam=[...masks.values()].flat().sort((a,b)=>b.score-a.score).slice(0,16);
    if(!beam.length)break;
  }
  const ordered=beam.sort((a,b)=>b.score-a.score);
  const found=ordered.find(s=>{const report=validateSchedule(s.items,c,b,catalog);return !report.issues.some(i=>i.status==='violation'||i.status==='conflict');});
  const items=found?.items??(original.some(i=>i.locked)?structuredClone(original):[]);
  return {items,blocked:!found,searched,searchLimited:limited,preserved:requested.filter(e=>items.some(i=>placeById.get(i.placeId??'')?.experiences.includes(e))),reasons:[
    found?'후보 장소·방문 순서·점심 위치를 비교하고 같은 조건으로 다시 점검했어요.':limited?'탐색 한도 안에서 모든 필수 조건을 맞추는 수정안을 찾지 못했어요. 조건을 낮추지 않았습니다.':'현재 자료에서 필수 조건을 충족하는 수정안을 찾지 못했어요. 미확인 자료와 고정 시간을 확인해 주세요.',
    ...(original.some(i=>i.locked)?['고정 구간의 ID·장소·시작·종료는 그대로 보존하고, 주변 구간을 다시 배치했어요.']:[]),
    `이동 수단은 ${b.transport==='taxi'?'택시':'도보'}를 유지하고, 좌석 정보가 있는 장소에서 최소 ${restMin}분 쉬도록 배치했어요.`,
    ...(feedback.includes('쉬는 시간을 늘려 주세요')?['부모님 의견에 따라 최소 휴식 시간을 10분 늘린 제안입니다. 입력 조건 자체는 바꾸지 않았어요.']:[]),
    ...(feedback.includes('걷는 구간을 줄여 주세요')?['원하는 경험을 유지하면서 방문 수와 내부 보행을 줄이는 후보를 우선했어요.']:[]),
    '확인되지 않은 정보는 충족으로 계산하지 않았어요.',
  ]};
}
