const TYPES=['solo','couple','family','parents','pet'];
export function companions(input={}) {
  const values=typeof input==='string'?[input]:Array.isArray(input.companions)&&input.companions.length?input.companions:[input.who];
  const list=[...new Set(values.filter(v=>TYPES.includes(v)))];
  return list.length>1?list.filter(v=>v!=='solo'):list.length?list:['couple'];
}
export const hasCompanion=(input,kind)=>companions(input).includes(kind);
export function primaryCompanion(input){const list=companions(input);return ['parents','family','pet','couple','solo'].find(v=>list.includes(v));}
export function parseCompanions(text){
 const s=String(text).toLowerCase(),found=[];
 for(const [type,re] of [['solo',/혼자|alone|solo|一人|独自/],['couple',/친구|연인|커플|friend|couple|友達|恋人|朋友|情侣/],['family',/아이|애들|아들|딸|유아|어린이|kids?|child|baby|子ども|子供|孩子/],['parents',/부모|엄마|아빠|어머니|아버지|어르신|노인|할머니|할아버지|parents?|mother|father|elder|両親|高齢|父母|老人/],['pet',/강아지|반려|애견|댕댕|dog|pets?|犬|ペット|宠物|寵物/]])if(re.test(s))found.push(type);
 return found.length?companions({companions:found}):[];
}
