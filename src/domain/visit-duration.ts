import type {Place} from '../data/demo';
// Planning estimates by venue type, not claims about the venue's official recommended duration.
export function visitDuration(p:Place){
 if(p.kind==='meal')return 60;if(p.kind==='rest')return 30;
 const text=p.name+' '+p.experiences.join(' ')+' '+p.description;
 if(/테마파크|놀이공원|등산|트레킹|수목원|동물원/.test(text))return 120;
 if(/박물관|미술관|전시|과학관|문화/.test(text))return 90;
 if(/산책|공원|해변|해수욕장|사찰|유적/.test(text))return 60;
 if(/전망대|포토|사진|케이블카/.test(text))return 45;
 return 60;
}
