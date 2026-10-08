import { Basics,Conditions,Item } from './schema';
import { Catalog,catalogFor,indexCatalog } from '../data/catalog';
import { Place } from '../data/demo';
import { validateSchedule } from './validate';

type Task={place:Place;kind:'visit'|'meal'}|{fixed:Item};
export type SearchResult={items:Item[];reasons:string[];preserved:string[];blocked:boolean;searched:number;searchLimited:boolean};
const MAX_SEARCH=12000;
function buildDay(tasks:Task[],day:number,c:Conditions,b:Basics,catalog:Catalog,restMin:number):Item[]|null{
  const {placeById,getRoute}=indexCatalog(catalog);
  const rows:Item[]=[];let cursor=570,serial=0,last:string|null=null;
  const add=(kind:Item['kind'],p:string|null,start:number,end:number,extra:Partial<Item>={})=>{
    if(start<0||end>1440||end<=start)return false;
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
    const selected=[...safe.filter(p=>p.kind==='visit')].sort((a,b)=>requested.filter(x=>b.experiences.includes(x)).length-requested.filter(x=>a.experiences.includes(x)).length).slice(0,2);
    const meal=safe.find(p=>p.kind==='meal');if(meal)selected.push(meal);
    const items:Item[]=[];
    for(let day=1;day<=b.days;day++){let cursor=570,last:string|null=null;for(const p of selected){if(last){items.push({id:`draft:${day}:${items.length}`,day,start:cursor,end:cursor+20,kind:'move',placeId:null,fromId:last,toId:p.id,transport:b.transport,locked:false,mode:'real'});cursor+=20;}if(p.kind==='meal')cursor=Math.max(660,cursor);items.push({id:`draft:${day}:${items.length}`,day,start:cursor,end:cursor+40,kind:p.kind,placeId:p.id,fromId:null,toId:null,transport:null,locked:false,mode:'real'});cursor+=40;last=p.id;}}
    const report=validateSchedule(items,c,b,catalog);
    return {items,blocked:report.issues.some(x=>x.status==='violation'||x.status==='conflict'),searched:0,searchLimited:false,preserved:requested.filter(x=>selected.some(p=>p.experiences.includes(x))),reasons:['실제 장소를 배치한 확인 전 초안입니다. 방문 40분·이동 20분은 편집용 배정 시간이며 실제 소요 시간이나 적합성 확인값이 아닙니다.','시설·메뉴·내부 보행·경로의 미확인 항목은 충족으로 판단하지 않았습니다. 경로 조회와 출발 전 확인을 거쳐 수정해 주세요.']};
  }

  if(locked.some(i=>validateSchedule([{...i,day:1}],{...c,requiredExperiences:[]},{...b,days:1},catalog).issues.some(x=>x.status==='violation'&&['time','stairs','route-stairs','food','internal-time','travel-time','place-kind','walk-time','walk-distance'].includes(x.code))))return {items:structuredClone(original),blocked:true,searched:0,searchLimited:false,preserved:[],reasons:['고정 구간 자체가 필수 조건과 맞지 않습니다. 고정 구간을 보존했고 조건을 낮추지 않았어요. 직접 고정을 해제하거나 해당 조건을 명시적으로 조정해 주세요.']};
  type State={items:Item[];score:number;covered:Set<string>;cost:number};
  let beam:State[]=[{items:[],score:0,covered:new Set(),cost:0}],searched=0,limited=false;
  const restMin=(c.restMin??20)+(feedback.includes('쉬는 시간을 늘려 주세요')?10:0);
  for(let day=1;day<=b.days;day++){
    const anchors=original.filter(i=>i.day===day&&i.locked).sort((a,b)=>a.start-b.start).map(fixed=>({fixed}));
    const fixedVisits=anchors.filter(a=>a.fixed.kind==='visit').length,hasMeal=anchors.some(a=>a.fixed.kind==='meal');
    const next:State[]=[];
    for(const state of beam){
      let considered=0;const allowance=Math.floor(MAX_SEARCH/beam.length);
      const sorted=[...visits].sort((a,b)=>requested.filter(e=>!state.covered.has(e)&&b.experiences.includes(e)).length-requested.filter(e=>!state.covered.has(e)&&a.experiences.includes(e)).length||(a.walkMin.value??0)-(b.walkMin.value??0));
      const counts=[Math.max(0,2-fixedVisits),Math.max(0,1-fixedVisits),Math.max(0,3-fixedVisits)].filter((n,i,a)=>a.indexOf(n)===i);
      if(feedback.includes('걷는 구간을 줄여 주세요'))counts.sort((a,b)=>a-b);
      const variants:Place[][]=[];
      function combinations(prefix:Place[],count:number){if(!count){variants.push(prefix);return;}for(const p of sorted)if(!prefix.some(q=>q.id===p.id))combinations([...prefix,p],count-1);}
      for(const count of counts)combinations([],count);
      outer:for(const variant of variants)for(const meal of hasMeal?[null]:meals){
        const mealPositions=meal?Array.from({length:variant.length+1},(_,i)=>i):[-1];
        // Prefer lunch after the first visit while still exploring every placement.
        mealPositions.sort((a,b)=>Math.abs(a-1)-Math.abs(b-1));
        for(const at of mealPositions){const flexible:Task[]=variant.map(place=>({place,kind:'visit'}));if(meal)flexible.splice(at,0,{place:meal,kind:'meal'});
          for(const tasks of interleave(flexible,anchors)){
            if(++considered>allowance){limited=true;break outer;}searched++;
            const rows=buildDay(tasks,day,c,b,catalog,restMin);if(!rows)continue;
            const dayRows=rows.map(i=>({...i,day:1}));
            const report=validateSchedule(dayRows,{...c,requiredExperiences:[]},{...b,days:1},catalog);
            if(report.issues.some(i=>i.status==='violation'||i.status==='conflict'))continue;
            if(state.cost+report.cost>b.budget)continue;
            const items=[...state.items,...rows];
            const covered=new Set([...state.covered,...rows.filter(i=>i.kind==='visit'||i.kind==='meal').flatMap(i=>placeById.get(i.placeId??'')?.experiences??[])]);
            const coverage=requested.filter(e=>covered.has(e)).length;
            const required=c.requiredExperiences.filter(e=>covered.has(e)).length;
            const walking=rows.filter(i=>i.kind==='visit').reduce((sum,i)=>sum+(placeById.get(i.placeId??'')?.walkMin.value??0),0);
            const count=rows.filter(i=>i.kind==='visit').length;
            const score=required*100000+coverage*10000+(feedback.includes('걷는 구간을 줄여 주세요')?-walking*100:Math.min(count,2)*500-walking)-report.cost/100;
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
