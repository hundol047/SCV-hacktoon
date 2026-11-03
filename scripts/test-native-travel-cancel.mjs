// Runs the actual Java transport with Android/JSON boundary stubs and a fake HTTPS connection.
// This verifies cancellation ownership and retry races, not a physical Android network.
import {mkdtemp,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
const root=await mkdtemp(join(tmpdir(),'travel-cancel-'));
const files={
 'android/app/Activity.java':`package android.app; public class Activity {public void runOnUiThread(Runnable r){r.run();}public boolean isFinishing(){return false;}}`,
 'android/webkit/WebView.java':`package android.webkit; public class WebView {public static final java.util.concurrent.CountDownLatch done=new java.util.concurrent.CountDownLatch(1);public static volatile String payload="";public static volatile int count=0; public void evaluateJavascript(String s,Object callback){payload=s;count++;done.countDown();}}`,
 'org/json/JSONObject.java':`package org.json; public class JSONObject {private String id="";public JSONObject(){}public JSONObject(String s){}public JSONObject put(String k,Object v){if(k.equals("id"))id=String.valueOf(v);return this;}public String toString(){return "{id:"+id+"}";}}`,
 'kr/bopok/offline/CancelTest.java':`package kr.bopok.offline;
import java.net.*;import java.io.*;import java.util.concurrent.*;import javax.net.ssl.*;
public class CancelTest {
 static final CountDownLatch started=new CountDownLatch(1),disconnected=new CountDownLatch(1);
 static class Connection extends HttpsURLConnection {
  volatile boolean stopped=false;Connection(URL u){super(u);}public void connect(){}public boolean usingProxy(){return false;}
  public void disconnect(){stopped=true;if(url.getQuery().equals("first"))disconnected.countDown();}
  public int getResponseCode(){return 200;}
  public InputStream getInputStream(){if(!url.getQuery().equals("first"))return new ByteArrayInputStream("{}".getBytes());
   return new InputStream(){public int read()throws IOException{started.countDown();long end=System.currentTimeMillis()+5000;while(!stopped&&System.currentTimeMillis()<end)try{Thread.sleep(10);}catch(InterruptedException e){}throw new IOException("cancelled");}};
  }
  public String getCipherSuite(){return "test";}public java.security.cert.Certificate[] getLocalCertificates(){return null;}public java.security.cert.Certificate[] getServerCertificates(){return null;}
 }
 public static void main(String[] args)throws Exception{
  URL.setURLStreamHandlerFactory(protocol->protocol.equals("https")?new URLStreamHandler(){protected URLConnection openConnection(URL u){return new Connection(u);}}:null);
  PublicTravel transport=new PublicTravel(new android.app.Activity(),new android.webkit.WebView());
  transport.request("first-id","https://api.open-meteo.com/v1/forecast?first");
  if(!started.await(2,TimeUnit.SECONDS))throw new AssertionError("request not started");
  transport.cancel("different-id");if(disconnected.getCount()!=1)throw new AssertionError("wrong owner cancelled");
  transport.cancel("first-id");transport.request("second-id","https://api.open-meteo.com/v1/forecast?second");
  if(!disconnected.await(2,TimeUnit.SECONDS)||!android.webkit.WebView.done.await(2,TimeUnit.SECONDS))throw new AssertionError("cancel/retry did not complete");
  Thread.sleep(100);
  if(android.webkit.WebView.count!=1||!android.webkit.WebView.payload.contains("second-id"))throw new AssertionError("old request leaked or blocked new request");
  System.out.println("PASS: native cancellation disconnects the owned request, permits immediate retry, and suppresses late callbacks");
 }
}`
};
try{
 for(const [name,code] of Object.entries(files)){const path=join(root,name);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,code);}
 await cp('android/src/kr/bopok/offline/PublicTravel.java',join(root,'kr/bopok/offline/PublicTravel.java'));
 const args=['-source','8','-target','8','-d',join(root,'classes'),...Object.keys(files).map(p=>join(root,p)),join(root,'kr/bopok/offline/PublicTravel.java')];
 const compiler=process.env.ANDROID_ECJ_JAR;
 const compiled=spawnSync(compiler?'java':'javac',compiler?['-jar',resolve(compiler),...args]:args,{stdio:'inherit'});if(compiled.status!==0)throw Error('Java test compilation failed');
 const run=spawnSync('java',['-cp',join(root,'classes'),'kr.bopok.offline.CancelTest'],{stdio:'inherit',timeout:10000});if(run.status!==0)throw Error('Native cancel regression failed');
}finally{await rm(root,{recursive:true,force:true});}
