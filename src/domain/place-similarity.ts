import type {Place} from '../data/demo';
export function placeSimilarity(source:Place,candidate:Place){
  const shared=[...new Set(source.experiences)].filter(e=>candidate.experiences.includes(e));
  const reasons=shared.map(e=>'공통 테마: '+e);
  let score=shared.length*4;
  const setting=source.setting?.value;
  if(setting&&setting!=='unknown'&&setting===candidate.setting?.value){score+=2;reasons.push(setting==='indoor'?'둘 다 실내 기록':'둘 다 야외 기록');}
  if(source.walkMin.value!==null&&candidate.walkMin.value!==null&&Math.abs(source.walkMin.value-candidate.walkMin.value)<=10){score++;reasons.push('등록 보행 시간 차이 10분 이내');}
  return {score,reasons:reasons.length?reasons:['공통 특성 자료 부족 · 조건에 맞는 대안']};
}
