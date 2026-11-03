// Licensed photographic source collection. No guessed licenses, placeholder
// entries, repeated crops, or generated images count towards the 365 minimum.
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ProxyAgent,fetch} from 'undici';
const out='public/images/korea';
await mkdir(out+'/evidence',{recursive:true});
const dispatcher=process.env.HTTPS_PROXY?new ProxyAgent({uri:process.env.HTTPS_PROXY,requestTls:{ca:await readFile(process.env.SSL_CERT_FILE||'/etc/ssl/certs/ca-certificates.crt')}}):undefined;
const sites=[
 ['경복궁','서울','Gyeongbokgung'],['창덕궁','서울','Changdeokgung'],['덕수궁','서울','Deoksugung'],
 ['북촌 한옥마을','서울','Bukchon Hanok Village'],['남산서울타워','서울','N Seoul Tower'],
 ['불국사','경북 경주','Bulguksa'],['첨성대','경북 경주','Cheomseongdae'],['석굴암','경북 경주','Seokguram'],
 ['해운대해수욕장','부산','Haeundae Beach'],['광안대교','부산','Gwangan Bridge'],
 ['성산일출봉','제주','Seongsan Ilchulbong'],['한라산','제주','Hallasan'],
 ['설악산','강원','Seoraksan'],['수원화성','경기 수원','Hwaseong Fortress'],
 ['전주한옥마을','전북 전주','Jeonju Hanok Village'],['순천만','전남 순천','Suncheon Bay']
];
const licenses=new Map([['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'],['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'],['CC BY 3.0','https://creativecommons.org/licenses/by/3.0/'],['CC BY-SA 3.0','https://creativecommons.org/licenses/by-sa/3.0/'],['CC0','https://creativecommons.org/publicdomain/zero/1.0/']]);
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
async function get(url){const r=await fetch(url,{dispatcher,headers:{'User-Agent':'YeohaengitPhotoCollector/1.0 (https://github.com/hundol047/SCV-hacktoon)'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Source HTTP ${r.status}: ${url}`);return r;}
async function api(params){const url='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',...params});return {url,data:await (await get(url)).json()};}
let entries=JSON.parse(await readFile(out+'/manifest.json','utf8'));const ids=new Set(entries.map(p=>p.source)),hashes=new Set(entries.map(p=>p.sha256));
for(const [place,region,category] of sites){
 const queue=[{title:'Category:'+category,depth:0}],visited=new Set();let added=0;
 while(queue.length&&added<40&&entries.length<400){
  const {title,depth}=queue.shift();if(visited.has(title))continue;visited.add(title);let continuation;
  do{
   const {data}=await api({list:'categorymembers',cmtitle:title,cmtype:'file|subcat',cmlimit:'500',...(continuation?{cmcontinue:continuation}:{})});
   if(data.error)throw Error(JSON.stringify(data.error));
   const members=data.query?.categorymembers??[];
   for(const member of members){
    if(member.ns===14){if(depth<2&&!/maps|drawings|paintings|diagrams|plans|historical|postcards|people/i.test(member.title))queue.push({title:member.title,depth:depth+1});continue;}
    if(!/\.(jpg|jpeg)$/i.test(member.title)||added>=40||entries.length>=400)continue;
    const {url:metadataURL,data:metadata}=await api({prop:'imageinfo',titles:member.title,iiprop:'url|extmetadata|mime|sha1',iiurlwidth:'1200'});
    const page=Object.values(metadata.query?.pages??{})[0],info=page?.imageinfo?.[0],meta=info?.extmetadata;
    if(!meta||info.mime!=='image/jpeg'||ids.has(info.descriptionurl))continue;
    const license=plain(meta.LicenseShortName?.value),licenseURL=licenses.get(license),author=plain(meta.Artist?.value);
    if(!licenseURL||!author||author.length>1000||meta.Restrictions?.value||plain(meta.Copyrighted?.value)==='True'&&!/^CC/.test(license))continue;
    const description=plain(meta.ImageDescription?.value);
    if(/drawing|painting|diagram|map of|postcard|portrait|reconstruction illustration/i.test(description))continue;
    const imageURL=info.thumburl||info.url;const bytes=Buffer.from(await (await get(imageURL)).arrayBuffer());
    if(bytes[0]!==255||bytes[1]!==216||bytes.length<10000)continue;
    const sha256=createHash('sha256').update(bytes).digest('hex');if(hashes.has(sha256))continue;
    const id=String(page.pageid),file=`${id}.jpg`,evidence=`evidence/${id}.json`;
    // Exclusive creates preserve any pre-existing source file.
    try{const f=await open(`${out}/${file}`,'wx');await f.writeFile(bytes);await f.close();}catch(e){if(e.code!=='EEXIST')throw e;const existing=await readFile(`${out}/${file}`);if(createHash('sha256').update(existing).digest('hex')!==sha256)throw Error('Existing photo differs; refusing overwrite');}
    await writeFile(`${out}/${evidence}`,JSON.stringify({metadataURL,retrievedAt:new Date().toISOString(),category:title,metadata},null,2),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    entries.push({id,place,region,author,source:info.descriptionurl,original:info.url,image:`/images/korea/${file}`,license,licenseURL,sha256,evidence:`/images/korea/${evidence}`,description,thumbnail:!!info.thumburl});
    ids.add(info.descriptionurl);hashes.add(sha256);added++;
    await writeFile(out+'/manifest.json',JSON.stringify(entries,null,2)+'\n');console.log(entries.length,place,member.title);
   }
   continuation=data.continue?.cmcontinue;
  }while(continuation&&added<40&&entries.length<400);
 }
}
if(entries.length<365)throw Error(`Only ${entries.length} verified photos; minimum 365 required. Do not mark photo release complete.`);
