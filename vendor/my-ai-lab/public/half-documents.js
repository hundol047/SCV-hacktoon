// Local-only editable preparation notes, never a claim of approval or expenditure.
export function halfDocumentDraft(benefit, input, trip, people, proofs = {}) {
  const dates=trip.days.map(d=>d.date);
  const lines=[`${benefit.title || '반값여행'} 신청 준비 초안`, '',
    '이 문서는 작성 보조용입니다. 공식 신청서와 해당 회차의 자격·기간·예산을 확인한 뒤 제출하세요.',
    `여행 기간: ${dates[0] || input.date} ~ ${dates.at(-1) || input.date}`,
    `동행 인원: 성인 ${people.adults || 0}명 / 어린이 ${people.kids || 0}명`,
    '', '예정 일정 (방문 완료 증빙이 아님)',
    ...trip.days.map((d,i)=>`${i+1}일차 (${d.date}): ${d.items.map(it=>it.place.name).join(', ')}`),
    '', '증빙 준비 현황 (파일 보관 여부이며 적격 판정이 아님)',
    ...(benefit.proofs || []).map(p=>`${p}: ${(proofs[benefit.id+':'+p] || []).length}장 보관`),
    '', '실제 지출 내역: 여행 후 영수증의 상호·날짜·금액을 직접 확인하여 작성',
    '신청 금액: 공식 인정 항목과 한도를 확인한 뒤 작성',
    '신청자·연락처: 공식 신청 페이지에 직접 입력',
    `공식 안내: ${benefit.link || '해당 시군 공고 확인'}`];
  return lines.join('\n');
}
