package kr.bopok.offline;

import android.app.Activity;
import android.webkit.WebView;
import org.json.JSONObject;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Only two fixed read-only public APIs. No cookies, credentials or redirects. */
final class PublicTravel {
  private final Activity activity;private final WebView web;private boolean busy=false;
  PublicTravel(Activity activity,WebView web){this.activity=activity;this.web=web;}
  synchronized void request(final String id,final String address){
    if(id==null||!id.matches("[A-Za-z0-9-]{1,80}"))return;
    if(busy){send(id,null,"다른 외부 조회가 진행 중입니다. 잠시 후 다시 시도하세요.");return;}
    busy=true;
    new Thread(()->{HttpsURLConnection connection=null;
      try{
        if(address==null||address.length()>2000)throw new IOException();
        URL url=new URL(address);
        boolean weather=url.getHost().equals("api.open-meteo.com")&&url.getPath().equals("/v1/forecast");
        boolean road=url.getHost().equals("router.project-osrm.org")&&url.getPath().matches("/route/v1/driving/[-0-9.,]+;[-0-9.,]+");
        if(!url.getProtocol().equals("https")||url.getUserInfo()!=null||url.getPort()!=-1||url.getRef()!=null||!(weather||road))throw new IOException();
        connection=(HttpsURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent","Yeohaengit/0.11.0 (Android; github.com/hundol047/SCV-hacktoon)");connection.setRequestProperty("Accept","application/json");
        int status=connection.getResponseCode();if(status!=200)throw new IOException(status==429?"요청 한도 초과":"서버 응답 오류");
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];long started=System.nanoTime();
        try(InputStream input=connection.getInputStream()){
          int count;while((count=input.read(buffer))!=-1){if(bytes.size()+count>4000000||System.nanoTime()-started>20000000000L)throw new IOException();bytes.write(buffer,0,count);}
        }
        send(id,new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)),null);
      }catch(Exception e){send(id,null,"날씨·경로 서버 조회에 실패했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도하세요.");}
      finally{if(connection!=null)connection.disconnect();synchronized(PublicTravel.this){busy=false;}}
    },"public-travel").start();
  }
  private void send(String id,JSONObject output,String error){
    try{String payload=new JSONObject().put("id",id).put("output",output).put("error",error).toString();
      activity.runOnUiThread(()->{if(!activity.isFinishing())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('bopok:travel',{detail:"+payload+"}));",null);});
    }catch(Exception ignored){}
  }
}
