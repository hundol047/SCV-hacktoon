import {expect,it} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
async function run(mode:string){
 const dir=await mkdtemp(join(tmpdir(),'bopok-official-')),hook=join(dir,'fetch.mjs'),key='synthetic-public-test-key-never-real';
 await writeFile(join(dir,'tourapi-basic.json.gz'),'previous-good-file');
 await writeFile(hook,`globalThis.fetch=async input=>{
 const u=new URL(input);const page=Number(u.searchParams.get('pageNo'));
 if(u.origin!=='https://apis.data.go.kr'||u.searchParams.get('serviceKey')!==${JSON.stringify(key)})throw Error('unexpected request');
 if(${JSON.stringify(mode)}==='auth')return Response.json({response:{header:{resultCode:'030',resultMsg:${JSON.stringify(key)}}}});
 const total=page===2&&${JSON.stringify(mode)}==='changed'?102:101;
 const start=(page-1)*100,rows=Array.from({length:Math.min(100,total-start)},(_,i)=>({contentid:String(start+i+1),contenttypeid:'12',title:'공식 테스트 '+(start+i+1),mapx:'127',mapy:'37',firstimage:'https://example.invalid/copyright-photo.jpg'}));
 return Response.json({response:{header:{resultCode:'0000'},body:{totalCount:total,pageNo:page,items:{item:rows}}}});
};`);
 const result=spawnSync(process.execPath,['--import',hook,resolve('scripts/collect-tourapi.mjs')],{encoding:'utf8',timeout:15000,env:{NODE_ENV:'test',PATH:process.env.PATH,BOPok_TOURAPI_KEY:mode==='missing'?'':key,BOPok_TOURAPI_OUTPUT_DIR:dir}});
 const file=await readFile(join(dir,'tourapi-basic.json.gz'));return {result,file,key,cleanup:()=>rm(dir,{recursive:true,force:true})};
}
it('official collection visits the final page, checks counts and omits copyrighted images and keys',async()=>{
 const r=await run('good');try{expect(r.result.status).toBe(0);const s=JSON.parse(gunzipSync(r.file).toString('utf8'));expect(s.total).toBe(101);expect(s.records).toHaveLength(101);expect(s.records.at(-1).contentid).toBe('101');expect(JSON.stringify(s)).not.toContain('firstimage');expect(JSON.stringify(s)).not.toContain(r.key);expect(r.result.stdout+r.result.stderr).not.toContain(r.key);}finally{await r.cleanup();}
});
it('changed page totals refuse to replace an existing official collection',async()=>{
 const r=await run('changed');try{expect(r.result.status).not.toBe(0);expect(r.file.toString()).toBe('previous-good-file');expect(r.result.stderr).toContain('전체 건수가 바뀌었습니다');expect(r.result.stdout+r.result.stderr).not.toContain(r.key);}finally{await r.cleanup();}
});
it('missing keys and auth failure preserve the old file and never echo provider messages containing a key',async()=>{
 for(const mode of ['missing','auth']){const r=await run(mode);try{expect(r.result.status).not.toBe(0);expect(r.file.toString()).toBe('previous-good-file');expect(r.result.stdout+r.result.stderr).not.toContain(r.key);}finally{await r.cleanup();}}
});
