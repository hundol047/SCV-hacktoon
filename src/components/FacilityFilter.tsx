import type {Basics} from '../domain/schema';
import {facilityKeys,facilityNames} from '../domain/venue-details';
export default function FacilityFilter({basics,onChange}:{basics:Basics;onChange:(b:Basics)=>void}){
 return <details className="facility-filter"><summary>동행 편의 조건{basics.requiredFacilities?.length?` · ${basics.requiredFacilities.length}개 선택`:''}</summary><p>최근 7일 이내 출처와 함께 ‘있음’으로 기록된 시설만 추천 조건에 맞는 것으로 봅니다. 사용자 확인 기록이며 현장 상태를 보장하지 않습니다.</p>{facilityKeys.map(key=><label className="check-row" key={key}><input type="checkbox" checked={basics.requiredFacilities?.includes(key)??false} onChange={e=>onChange({...basics,requiredFacilities:e.target.checked?[...(basics.requiredFacilities??[]),key]:(basics.requiredFacilities??[]).filter(k=>k!==key)})}/>{facilityNames[key]} 확인된 곳만</label>)}</details>;
}
