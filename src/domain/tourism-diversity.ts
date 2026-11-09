import type {Place} from '../data/demo';
export function tourismVisitAllowed(p:Place){
 if(p.kind!=='visit')return true;
 const name=p.name.replace(/\s/g,'');
 if(/체육관|체육센터|수영장|운동장|경기장|스포츠센터|복지관|교회|수련원/.test(name)&&!/박물관|전시|체험|아쿠아|올림픽기념|투어/.test(name))return false;
 return true;
}
export function visitTheme(p:Place){
 const n=p.name.replace(/\s/g,'');
 const groups:[RegExp,string][]=[[/체육관|체육센터|수영장/,'sports'],[/기념비|기념탑|전적비|당간지주|순국|항일|전승비/,'monument'],[/수목원|식물원/,'botanical'],[/해변|해수욕장/,'beach'],[/아쿠아리움|수족관/,'aquarium'],[/미술관|아트뮤지엄|아르떼/,'art'],[/과학관|과학체험/,'science'],[/박물관|전시관|기념관/,'exhibition'],[/케이블카|전망대/,'viewpoint'],[/자연휴양림|숲길/,'forest']];
 return groups.find(([re])=>re.test(n))?.[1]??p.id;
}
export function distinctVisits(places:Place[]){const themes=new Set<string>(),names=new Set<string>();return places.filter(p=>{const name=p.name.normalize('NFKC').replace(/[\s\p{P}]/gu,'');const theme=visitTheme(p);if(!tourismVisitAllowed(p)||themes.has(theme)||names.has(name))return false;themes.add(theme);names.add(name);return true;});}
