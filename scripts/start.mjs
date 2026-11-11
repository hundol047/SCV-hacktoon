import {cp,mkdir} from 'node:fs/promises';
await mkdir('.next/standalone/.next',{recursive:true});
await cp('.next/static','.next/standalone/.next/static',{recursive:true});
await cp('public','.next/standalone/public',{recursive:true});
await cp('vendor/my-ai-lab','.next/standalone/vendor/my-ai-lab',{recursive:true});
process.env.HOSTNAME='0.0.0.0';
await import('../.next/standalone/server.js');
