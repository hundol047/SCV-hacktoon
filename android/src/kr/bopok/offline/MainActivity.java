package kr.bopok.offline;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintManager;
import android.webkit.*;
import android.widget.Toast;
import android.widget.FrameLayout;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

public class MainActivity extends Activity {
  private static final String ORIGIN="https://appassets.androidplatform.net";
  private WebView web;
  private ValueCallback<Uri[]> chooser;
  private byte[] pendingJson;
  private boolean pendingDataset=false;
  private boolean saving=false;
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    FrameLayout root=new FrameLayout(this);
    root.setOnApplyWindowInsetsListener((v,insets)->{
      v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets.consumeSystemWindowInsets();
    });
    web=new WebView(this);root.addView(web);setContentView(root);
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
    WebView.setWebContentsDebuggingEnabled(false);
    web.addJavascriptInterface(new Bridge(),"BopokAndroid");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if("https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())){
          String path=uri.getPath();if(path==null||path.equals("/"))path="/index.html";
          if(!path.contains(".."))try{
            String type=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".gz")?"application/gzip":path.endsWith(".html")?"text/html":"text/plain";
            HashMap<String,String> headers=new HashMap<>();headers.put("X-Content-Type-Options","nosniff");
            return new WebResourceResponse(type,type.equals("application/gzip")?null:"UTF-8",200,"OK",headers,getAssets().open(path.substring(1)));
          }catch(IOException ignored){}
        }
        return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,new ByteArrayInputStream(new byte[0]));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if(ORIGIN.equals(uri.getScheme()+"://"+uri.getHost())&&(uri.getPath().equals("/")||uri.getPath().equals("/index.html")))return false;
        if("https".equals(uri.getScheme())&&!"appassets.androidplatform.net".equals(uri.getHost()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){notice("링크를 열 브라우저가 없습니다.");}
        else notice("오프라인 버전에서 지원하지 않는 링크입니다.");
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);
        try{startActivityForResult(intent,1);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;notice("파일 선택기를 열지 못했습니다.");}
        return true;
      }
    });
    web.loadUrl(ORIGIN+"/");
  }
  private void notice(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
  private void save(String name,String type,byte[] bytes,boolean dataset){
    runOnUiThread(()->{
      if(saving){notice("진행 중인 파일 저장을 먼저 완료해 주세요.");return;}
      saving=true;pendingJson=bytes;pendingDataset=dataset;
      Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE,name);
      try{startActivityForResult(intent,2);}catch(Exception e){saving=false;pendingJson=null;pendingDataset=false;notice("파일 저장기를 열지 못했습니다.");}
    });
  }
  public class Bridge {
    @JavascriptInterface public void saveJson(String name,String data){
      if(data==null||data.length()>8*1024*1024){notice("파일이 너무 큽니다.");return;}
      byte[] bytes=data.getBytes(StandardCharsets.UTF_8);if(bytes.length>8*1024*1024){notice("8 MiB 이하 파일만 저장할 수 있습니다.");return;}
      save("bopok-trip.json","application/json",bytes,false);
    }
    @JavascriptInterface public void saveTourism(){save("bopok-korea-tourism.json.gz","application/gzip",null,true);}
    @JavascriptInterface public void printPage(){runOnUiThread(()->{
      try{((PrintManager)getSystemService(PRINT_SERVICE)).print("보폭 여행 일정",web.createPrintDocumentAdapter("보폭 여행 일정"),null);}catch(Exception e){notice("인쇄 서비스를 사용할 수 없습니다.");}
    });}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==1&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}
    if(request==2){
      final byte[] bytes=pendingJson;final boolean dataset=pendingDataset;pendingJson=null;pendingDataset=false;saving=false;
      if(result!=RESULT_OK||data==null||data.getData()==null)return;
      final Uri destination=data.getData();
      new Thread(()->{try(InputStream input=dataset?getAssets().open("snapshot.json.gz"):new ByteArrayInputStream(bytes==null?new byte[0]:bytes);OutputStream output=getContentResolver().openOutputStream(destination)){
        if(output==null)throw new IOException();byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);notice("파일을 저장했습니다.");
      }catch(Exception e){notice("파일 저장에 실패했습니다. 다시 시도해 주세요.");}}).start();
    }
  }
  @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){if(chooser!=null)chooser.onReceiveValue(null);web.removeJavascriptInterface("BopokAndroid");web.destroy();super.onDestroy();}
}
