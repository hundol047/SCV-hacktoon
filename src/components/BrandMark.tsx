export default function BrandMark({size=28}:{size?:number}){
  return <svg width={size} height={size} viewBox="0 0 108 108" fill="none" aria-hidden="true" focusable="false">
    <rect width="108" height="108" rx="26" fill="#174F41"/>
    <path d="M54 23C39 23 28 34 28 48C28 66 54 86 54 86C54 86 80 66 80 48C80 34 69 23 54 23Z" fill="#FFF7E5"/>
    <path d="M42 56L54 41L66 56" stroke="#174F41" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="42" cy="56" r="5" fill="#174F41"/><circle cx="66" cy="56" r="5" fill="#174F41"/><circle cx="54" cy="41" r="7" fill="#D58C35"/>
  </svg>;
}
