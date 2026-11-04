export type MapPlace={name:string;latitude?:number;longitude?:number;visitorInfo?:{address?:string}};
export function placeMapLink(p:MapPlace){
 if(Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude!)<=90&&Math.abs(p.longitude!)<=180)return 'https://map.kakao.com/link/map/'+encodeURIComponent(p.name)+','+p.latitude+','+p.longitude;
 return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:p.visitorInfo?.address?.trim()||p.name});
}
