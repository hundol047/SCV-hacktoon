// Expand common school abbreviations, without a hard-coded list of individual schools.
export function locationQuery(value:string){
 const query=value.normalize('NFKC').trim().replace(/,/g,' ').replace(/\s+/g,' ');
 return query.replace(/([가-힣]{2,}?)(여고|여중|공고|상고|초|중|고)(?=\s|$)/g,(word:string,name:string,kind:string)=>/(?:창고|문고|금고|차고)$/.test(word)?word:name+({여고:'여자고등학교',여중:'여자중학교',공고:'공업고등학교',상고:'상업고등학교',초:'초등학교',중:'중학교',고:'고등학교'}[kind]??kind))
  .replace(/([가-힣]+(?:대로|로|길))(?=\d)/g,'$1 ').replace(/(번길)(?=\d)/g,'$1 ');
}
