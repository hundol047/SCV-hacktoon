import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('public/images/korea/manifest.json','utf8'));
if(manifest.length<365)throw Error(`Verified Korean tourism photos: ${manifest.length}; at least 365 required`);
const ids=new Set(),hashes=new Set();
for(const p of manifest){
 for(const field of ['id','place','region','author','source','license','licenseURL','sha256','evidence'])if(!p[field])throw Error(`Missing ${field}`);
 if(ids.has(p.id)||hashes.has(p.sha256))throw Error('Duplicate photo');ids.add(p.id);hashes.add(p.sha256);
 if(new URL(p.source).hostname!=='commons.wikimedia.org'||new URL(p.licenseURL).hostname!=='creativecommons.org')throw Error('Unverified source/license');
 const bytes=await readFile('public'+p.image);if(createHash('sha256').update(bytes).digest('hex')!==p.sha256)throw Error('Photo digest mismatch');
 const evidence=JSON.parse(await readFile('public'+p.evidence,'utf8'));if(!evidence.metadata?.query||!evidence.retrievedAt)throw Error('Missing license evidence');
 const info=Object.values(evidence.metadata.query.pages??{})[0]?.imageinfo?.[0];
 if(info?.descriptionurl!==p.source||info?.url!==p.original||info?.extmetadata?.LicenseShortName?.value!==p.license)throw Error('Attribution differs from retained source evidence');
}
console.log(`Verified ${manifest.length} unique photographic assets and attribution records`);
