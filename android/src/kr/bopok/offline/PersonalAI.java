package kr.bopok.offline;

import android.app.Activity;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.WebView;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import java.security.KeyStore;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

final class PersonalAI {
  private final Activity activity;
  private final WebView web;
  private final SharedPreferences prefs;
  private boolean busy=false;
  private static final String ALIAS="bopok-personal-ai-key";
  PersonalAI(Activity activity,WebView web){this.activity=activity;this.web=web;this.prefs=activity.getSharedPreferences("personal-ai",0);}
  private SecretKey wrappingKey()throws Exception{
    KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
    if(!store.containsAlias(ALIAS)){
      KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
      generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generator.generateKey();
    }
    return (SecretKey)store.getKey(ALIAS,null);
  }
  synchronized void configure(String key,String model)throws Exception{
    if(busy)throw new IllegalStateException("Request in progress");
    if(key.isEmpty()){prefs.edit().remove("ciphertext").remove("iv").apply();return;}
    if(!key.matches("sk-[A-Za-z0-9_-]{10,500}")||!model.matches("[A-Za-z0-9._:-]{1,100}"))throw new IllegalArgumentException("Invalid credentials");
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,wrappingKey());
    String encoded=Base64.encodeToString(cipher.doFinal(key.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
    if(!prefs.edit().putString("ciphertext",encoded).putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("model",model).commit())throw new IOException("Credential save failed");
  }
  String status(){try{return new JSONObject().put("configured",prefs.contains("ciphertext")).put("model",prefs.getString("model","gpt-4.1-mini")).toString();}catch(Exception e){return "{}";}}
  private String secret()throws Exception{
    if(!prefs.contains("ciphertext"))throw new IOException("Missing credential");
    Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,wrappingKey(),new GCMParameterSpec(128,Base64.decode(prefs.getString("iv",""),Base64.NO_WRAP)));
    return new String(cipher.doFinal(Base64.decode(prefs.getString("ciphertext",""),Base64.NO_WRAP)),StandardCharsets.UTF_8);
  }
  private void reply(String id,JSONObject output,String error){
    try{
      JSONObject data=new JSONObject().put("id",id);if(error!=null)data.put("error",error);else data.put("output",output);
      String script="window.dispatchEvent(new CustomEvent('bopok:ai',{detail:JSON.parse("+JSONObject.quote(data.toString())+")}));";
      activity.runOnUiThread(()->{if(!activity.isDestroyed())web.evaluateJavascript(script,null);});
    }catch(Exception ignored){}
  }
  synchronized void request(String id,String payload){
    if(id==null||!id.matches("[A-Za-z0-9-]{1,80}"))return;
    if(busy){reply(id,null,"이미 AI 요청이 진행 중입니다.");return;}
    if(payload==null||payload.length()>16000){reply(id,null,"추천 입력이 너무 큽니다.");return;}
    if(!prefs.contains("ciphertext")){reply(id,null,"API 키를 먼저 등록해 주세요.");return;}
    String today=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date());
    int count=today.equals(prefs.getString("day",""))?prefs.getInt("requests",0):0;
    if(count>=20){reply(id,null,"이 기기의 하루 AI 요청 한도 20회에 도달했습니다.");return;}
    if(!prefs.edit().putString("day",today).putInt("requests",count+1).commit()){reply(id,null,"사용량을 기록하지 못해 요청하지 않았습니다.");return;}
    busy=true;
    new Thread(()->{
      HttpsURLConnection connection=null;
      try{
        JSONObject input=new JSONObject(payload);JSONArray ids=input.getJSONArray("candidateIds");
        if(ids.length()<1||ids.length()>20)throw new IOException("Invalid candidate count");
        JSONObject schema=new JSONObject().put("type","object").put("properties",new JSONObject().put("candidateIds",new JSONObject().put("type","array").put("maxItems",3).put("items",new JSONObject().put("type","string").put("enum",ids)))).put("required",new JSONArray().put("candidateIds")).put("additionalProperties",false);
        JSONObject body=new JSONObject().put("model",prefs.getString("model","gpt-4.1-mini")).put("store",false).put("max_output_tokens",800).put("input",input.getString("input")).put("instructions",input.getString("instructions")).put("text",new JSONObject().put("format",new JSONObject().put("type","json_schema").put("name","replacement").put("strict",true).put("schema",schema)));
        connection=(HttpsURLConnection)new URL("https://api.openai.com/v1/responses").openConnection();
        connection.setConnectTimeout(12000);connection.setReadTimeout(25000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setDoOutput(true);
        connection.setRequestProperty("Authorization","Bearer "+secret());connection.setRequestProperty("Content-Type","application/json");
        try(OutputStream out=connection.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
        int status=connection.getResponseCode();
        if(status!=200){reply(id,null,status==401||status==403?"API 키 또는 모델 접근 권한을 확인해 주세요.":status==429?"OpenAI 사용 한도·잔액·요청 빈도를 확인해 주세요.":"OpenAI 요청 실패 (HTTP "+status+"). 키·모델 설정을 확인해 주세요.");return;}
        ByteArrayOutputStream data=new ByteArrayOutputStream();
        try(InputStream stream=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=stream.read(buffer))!=-1){if(data.size()+n>1024*1024)throw new IOException("Response too large");data.write(buffer,0,n);}}
        JSONObject response=new JSONObject(new String(data.toByteArray(),StandardCharsets.UTF_8));JSONArray output=response.getJSONArray("output");
        for(int i=0;i<output.length();i++){JSONArray content=output.getJSONObject(i).optJSONArray("content");if(content==null)continue;for(int j=0;j<content.length();j++){JSONObject part=content.getJSONObject(j);if("output_text".equals(part.optString("type"))){reply(id,new JSONObject(part.getString("text")),null);return;}}}
        reply(id,null,"AI가 추천 목록을 반환하지 않았습니다. 다시 요청해 주세요.");
      }catch(Exception e){reply(id,null,"AI 연결에 실패했습니다. 인터넷·API 키·모델 설정을 확인해 주세요.");}
      finally{if(connection!=null)connection.disconnect();synchronized(PersonalAI.this){busy=false;}}
    },"bopok-ai").start();
  }
}
