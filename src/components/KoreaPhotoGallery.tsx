'use client';
import photos from '../../public/images/korea/online.json';
export default function KoreaPhotoGallery(){return <section className="korea-gallery" aria-label="한국 관광지 사진"><div className="section-heading"><span className="eyebrow">EXPLORE KOREA</span><h2>이번엔 어디로 떠날까요?</h2></div><div className="korea-photo-grid">{photos.map(p=><figure key={p.id}><img src={p.image} alt={`${p.region} ${p.place}`} loading="lazy" referrerPolicy="no-referrer" width="640" height="420"/><figcaption><h3>{p.place}</h3><p>{p.region}</p></figcaption></figure>)}</div></section>;}
