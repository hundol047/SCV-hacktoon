export type TourismPhoto={id:string;place:string;region:string;author:string;source:string;original:string;image:string;license:string;licenseURL:string;sha256:string;evidence:string;description:string;thumbnail:boolean};
const DAY=86400000,SEOUL_OFFSET=9*3600000;
export function koreaDay(now:number){return Math.floor((now+SEOUL_OFFSET)/DAY);}
export function dailyPhoto<T>(photos:readonly T[],now:number):T|undefined{return photos.length?photos[((koreaDay(now)%photos.length)+photos.length)%photos.length]:undefined;}
export function untilKoreaMidnight(now:number){return (koreaDay(now)+1)*DAY-SEOUL_OFFSET-now;}
