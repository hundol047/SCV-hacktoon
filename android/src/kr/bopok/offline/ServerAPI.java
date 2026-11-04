package kr.bopok.offline;

import android.app.Activity;
import android.webkit.WebView;
import org.json.JSONObject;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Fixed application server only; no AWS/API credentials exist on the device. */
final class ServerAPI {
  private static final String BASE="http://52.65.9.104:8000";
  private final Activity activity;private final WebView web;private boolean busy=false;
  ServerAPI(Activity a,WebView w){activity=a;web=w;}
  synchronized void request(String id,String path,String body){
    if(id==null||!id.matches("[A-Za-z0-9-]{1,80}"))return;
    if(busy){send(id,503,null,"다른 AI 요청이 진행 중입니다.");return;}
    if(path==null||!path.matches("/api/(courses|replacements|promotions|conditions|advice|place-details|location)")||body==null||body.getBytes(StandardCharsets.UTF_8).length>8388608){send(id,400,null,"잘못된 요청입니다.");return;}
    busy=true;
    new Thread(()->{HttpURLConnection c=null;try{
      c=(HttpURLConnection)new URL(BASE+path).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(40000);c.setRequestMethod("POST");c.setDoOutput(true);
      c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Origin",BASE);
      String cookie=activity.getSharedPreferences("server-session",0).getString("cookie","");if(!cookie.isEmpty())c.setRequestProperty("Cookie",cookie);
      byte[] payload=body.getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(payload.length);try(OutputStream o=c.getOutputStream()){o.write(payload);}
      int status=c.getResponseCode();String setCookie=c.getHeaderField("Set-Cookie");if(setCookie!=null&&setCookie.startsWith("bopok_session="))activity.getSharedPreferences("server-session",0).edit().putString("cookie",setCookie.split(";",2)[0]).apply();
      InputStream stream=status>=400?c.getErrorStream():c.getInputStream();if(stream==null)throw new IOException();
      ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=stream){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>1048576)throw new IOException();bytes.write(b,0,n);}}
      send(id,status,new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)),null);
    }catch(Exception e){send(id,503,null,"AI 서버에 연결하지 못했습니다. 기존 일정은 유지됩니다.");}finally{if(c!=null)c.disconnect();synchronized(ServerAPI.this){busy=false;}}},"server-api").start();
  }
  private void send(String id,int status,JSONObject data,String error){try{
    String payload=new JSONObject().put("id",id).put("status",status).put("data",data).put("error",error).toString();activity.runOnUiThread(()->{if(!activity.isFinishing())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('bopok:server',{detail:"+payload+"}));",null);});
  }catch(Exception ignored){}}
}
