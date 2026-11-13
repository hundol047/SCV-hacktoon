import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs','public/vendor/maplibre-worker.mjs');
await copyFile('node_modules/maplibre-gl/LICENSE.txt','public/vendor/maplibre-LICENSE.txt');
