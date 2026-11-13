import type {Issue} from './validate';
export function reviewGroups(issues:Issue[]){
 const groups=[{title:'먼저 확인 · 운영시간·예약·이동',match:/hours|opening|closure|time|route|transfer|weather/},{title:'동행자 필수 확인 · 보행·휴식·시설',match:/walk|rest|stairs|seat|facility|place/},{title:'예산 확인 · 요금·미포함 비용',match:/cost|expense|exchange|budget/},{title:'기타 · 자료 최신성·선호 조건',match:/.*/}];
 const rows=groups.map(g=>({...g,items:[] as Issue[]}));
 for(const issue of issues){const group=rows.find(g=>g.match.test(issue.code))!;const existing=group.items.find(i=>i.code===issue.code&&i.message===issue.message);if(existing)existing.itemIds=[...new Set([...existing.itemIds,...issue.itemIds])];else group.items.push({...issue,itemIds:[...issue.itemIds]});}
 return rows.filter(g=>g.items.length);
}
