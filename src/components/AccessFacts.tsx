import type {Place} from '../data/demo';
import {accessLabels} from '../domain/accessibility';
export default function AccessFacts({place}:{place:Place}){
 const labels=accessLabels(place);if(!labels.length)return null;
 return <div className="access-facts" aria-label="확인된 접근성·편의 시설">{labels.map(f=><span key={f.key} title="최근 등록 자료 기준 · 현장 상태는 방문 전 확인">{f.label}<small> · {place.facilities?.[f.key]?.collectedAt?.slice(0,10)}</small> <a href={f.source} target="_blank" rel="noreferrer">근거</a></span>)}</div>;
}
