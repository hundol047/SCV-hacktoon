import {mkdir,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import './build-mobile.mjs';
const sdk=process.env.ANDROID_SDK_ROOT;
if(!sdk)throw Error('Set ANDROID_SDK_ROOT; install platforms;android-35 and build-tools;35.0.0 first.');
const run=(command,args,options={})=>{const r=spawnSync(command,args,{stdio:'inherit',...options});if(r.status!==0)throw Error(command+' failed');};
const root=resolve('android'),out=root+'/build',tools=sdk+'/build-tools/35.0.0',jar=sdk+'/platforms/android-35/android.jar';
await mkdir(out+'/classes',{recursive:true});await mkdir(out+'/dex',{recursive:true});
run(tools+'/aapt2',['compile','--dir',root+'/res','-o',out+'/resources.zip']);
run(tools+'/aapt2',['link','-o',out+'/unsigned.apk','-I',jar,'--manifest',root+'/AndroidManifest.xml','-A',out+'/assets',out+'/resources.zip']);
const compileArgs=['-encoding','UTF-8','-source','8','-target','8','-bootclasspath',jar+':'+tools+'/core-lambda-stubs.jar','-d',out+'/classes',root+'/src/kr/bopok/offline/MainActivity.java',root+'/src/kr/bopok/offline/PersonalAI.java'];
if(process.env.ANDROID_ECJ_JAR)run('java',['-jar',process.env.ANDROID_ECJ_JAR,...compileArgs]);else run('javac',compileArgs);
const classes=(await readdir(out+'/classes/kr/bopok/offline')).filter(f=>f.endsWith('.class')).map(f=>out+'/classes/kr/bopok/offline/'+f);
run(tools+'/d8',['--lib',jar,'--min-api','26','--output',out+'/dex',...classes]);
run('zip',['-j',out+'/unsigned.apk',out+'/dex/classes.dex']);
run(tools+'/zipalign',['-f','4',out+'/unsigned.apk',out+'/aligned.apk']);
// Local preview signing identity, never committed. Preserve it for upgrade compatibility.
const key=resolve('.android-signing/preview.jks');await mkdir(resolve('.android-signing'),{recursive:true});
try{await stat(key);}catch{run('keytool',['-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','bopok-preview','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=Bopok Offline Preview']);}
run(tools+'/apksigner',['sign','--ks',key,'--ks-key-alias','bopok-preview','--ks-pass','pass:android','--key-pass','pass:android','--out',out+'/bopok-android.apk',out+'/aligned.apk']);
run(tools+'/apksigner',['verify','--verbose',out+'/bopok-android.apk']);
console.log('APK: '+out+'/bopok-android.apk');
