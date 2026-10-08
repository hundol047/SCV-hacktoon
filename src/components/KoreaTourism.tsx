'use client';
import {useEffect,useRef,useState} from 'react';
import {koreaRegions,koreaCategories,koreaRecordSchema,type KoreaCategory} from '../data/korea-tourism';
import {catalogSchema,type Catalog} from '../data/catalog';
import {z} from 'zod';
const responseSchema=z.object({total:z.number().int().nonnegative(),page:z.number().int(),limit:z.number().int(),records:z.array(koreaRecordSchema),dataset:z.object({total:z.number(),collectedAt:z.string().datetime(),stale:z.boolean(),notice:z.string(),missingNames:z.number(),missingCoordinates:z.number(),missingAddresses:z.number(),coverage:z.array(z.object({name:z.string(),count:z.number(),boundaryStatus:z.string(),currentName:z.string().nullable()}))})});
type Results=z.infer<typeof responseSchema>;
export default function KoreaTourism({onLoaded}:{onLoaded:(catalog:Catalog)=>void}){
 const [open,setOpen]=useState(false),[province,setProvince]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[result,setResult]=useState<Results>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const revision=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;revision.current++;};},[]);
 function changed(){revision.current++;setResult(undefined);setMessage('');setBusy(false);}
 async function search(page=1){
  const sequence=++revision.current;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/tourism?'+new URLSearchParams({province,q:query,category,page:String(page)}),{cache:'no-store'}),data=await r.json();
   if(!mounted.current||sequence!==revision.current)return;
   if(!r.ok)throw Error(data.error);setResult(responseSchema.parse(data));
  }catch(e){if(mounted.current&&sequence===revision.current)setMessage(e instanceof Error?e.message:'전국 자료 검색 실패');}
  finally{if(mounted.current&&sequence===revision.current)setBusy(false);}
 }
 async function candidates(){
  const sequence=++revision.current;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/tourism?'+new URLSearchParams({action:'catalog',province,q:query,limit:'200'}),{cache:'no-store'}),data=await r.json();
   if(!mounted.current||sequence!==revision.current)return;
   if(!r.ok)throw Error(data.error);const catalog=catalogSchema.parse(data);
   if(!catalog.places.length)throw Error('이 조건에는 이름·좌표가 있는 일정 후보가 없습니다. 지역·검색어를 넓혀 주세요.');
   onLoaded(catalog);setMessage(`${catalog.places.length}개 실제 후보를 일정에 사용할 수 있습니다. 숙박·쇼핑·레저는 후보에 포함하지 않습니다.`);
  }catch(e){if(mounted.current&&sequence===revision.current)setMessage(e instanceof Error?e.message:'전국 자료 연결 실패');}
  finally{if(mounted.current&&sequence===revision.current)setBusy(false);}
 }
 return <div className="cloud-panel"><button type="button" className="secondary" aria-expanded={open} onClick={()=>{setOpen(!open);if(!open&&!result)void search();}}>전국 수집 자료 {open?'닫기':'열기'}</button>{open&&<>
  <h3>전국 수집 관광 자료</h3><p>도시 반경 검색과 별도로 보관한 17개 지역 구획 자료입니다. 관광·문화·역사·공원·식당·카페·숙박·쇼핑·레저·쉼터를 검색합니다.</p>
  <label>수집 자료 시·도<select value={province} onChange={e=>{changed();setProvince(e.target.value);}}><option value="">전국 전체</option>{koreaRegions.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
  <label>수집 자료 검색어<input maxLength={120} value={query} onChange={e=>{changed();setQuery(e.target.value);}} placeholder="강릉, 경복궁, 종로구, 한식"/></label>
  <label>수집 자료 분류<select value={category} onChange={e=>{changed();setCategory(e.target.value);}}><option value="">모든 분류</option>{Object.entries(koreaCategories).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
  <button type="button" className="secondary" disabled={busy} onClick={()=>search()}>전국 자료 검색</button>
  {result&&<><p role="status">전국 보관 {result.dataset.total.toLocaleString('ko-KR')}건 · 검색 {result.total.toLocaleString('ko-KR')}건 · 수집 {result.dataset.collectedAt.slice(0,10)}{result.dataset.stale?' · 7일이 지난 자료':''}</p>
   <p>{result.dataset.notice}</p><p>전체 자료 중 이름 미등록 {result.dataset.missingNames.toLocaleString('ko-KR')}건 · 좌표 미등록 {result.dataset.missingCoordinates.toLocaleString('ko-KR')}건 · 상세 주소 미등록 {result.dataset.missingAddresses.toLocaleString('ko-KR')}건</p><ul>{result.records.map(r=><li key={r.id}><a href={'https://www.openstreetmap.org/'+r.id.replace('osm:','').replace(':','/')} target="_blank" rel="noreferrer">{r.name}</a> · {koreaCategories[r.category as KoreaCategory]} · {r.address||r.provinces.map(c=>koreaRegions.find(p=>p.code===c)?.name).join(' / ')}{r.latitude===null||r.longitude===null?' · 좌표 미등록':''}</li>)}</ul>
   <p>{result.page}페이지 · 한 번에 {result.limit}건</p><button type="button" className="secondary" disabled={busy||result.page<=1} onClick={()=>search(result.page-1)}>이전 자료</button><button type="button" className="secondary" disabled={busy||result.page*result.limit>=result.total} onClick={()=>search(result.page+1)}>다음 자료</button>
   <details><summary>시·도별 수집 건수</summary><ul>{result.dataset.coverage.map(r=><li key={r.name}>{r.name}: {r.count.toLocaleString('ko-KR')}건{r.boundaryStatus==='historic'?` · 기존 경계${r.currentName?` (지도 현재 명칭: ${r.currentName})`:''}`:''}</li>)}</ul></details>
  </>}
  <p>일정에는 시·도를 선택하고 시·군·구 검색어로 범위를 좁혀 주세요. 아래 버튼은 분류 선택과 관계없이 이 지역의 관광·식사·쉼터를 최대 200개 사용합니다. 장소 사이 이동 시간과 영업·접근성 정보는 별도 확인이 필요합니다.</p>
  <button type="button" className="secondary" disabled={busy||!province} onClick={candidates}>이 지역 후보를 일정에 사용</button>
  <p><a href="/api/tourism/download" download>전국 수집 자료 받기 (gzip JSON)</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap 기여자 · ODbL</a></p>
  {message&&<p role="status">{message}</p>}
 </>}</div>;
}
