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
  private ServerAPI api;
  private PublicTravel travel;
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
    settings.setUserAgentString(settings.getUserAgentString()+" Yeohaengit/0.16.1 (+https://github.com/hundol047/SCV-hacktoon)");
    settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
    WebView.setWebContentsDebuggingEnabled(false);
    api=new ServerAPI(this,web);
    travel=new PublicTravel(this,web);
    web.addJavascriptInterface(new Bridge(),"BopokAndroid");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
        Uri uri=request.getUrl();
        if("GET".equals(request.getMethod())&&"https".equals(uri.getScheme())&&"tile.openstreetmap.org".equals(uri.getHost())&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().matches("/[0-9]{1,2}/[0-9]{1,7}/[0-9]{1,7}\\.png")&&uri.getQuery()==null)return null;
        if("GET".equals(request.getMethod())&&"https".equals(uri.getScheme())&&("upload.wikimedia.org".equals(uri.getHost())||"thumb.wikimedia.org".equals(uri.getHost()))&&uri.getPort()==-1&&uri.getPath()!=null&&uri.getPath().startsWith("/wikipedia/commons/")&&uri.getPath().endsWith(".jpg")&&uri.getQuery()==null)return null;
        if("https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())){
          String path=uri.getPath();if(path==null||path.equals("/"))path="/index.html";
          if(!path.contains(".."))try{
            String type=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".gz")?"application/gzip":path.endsWith(".png")?"image/png":path.endsWith(".jpg")?"image/jpeg":path.endsWith(".mp4")?"video/mp4":path.endsWith(".vtt")?"text/vtt":path.endsWith(".html")?"text/html":"text/plain";
            HashMap<String,String> headers=new HashMap<>();headers.put("X-Content-Type-Options","nosniff");
            InputStream asset=getAssets().open(path.substring(1));
            if(type.equals("video/mp4")){
              long total=asset.available();headers.put("Accept-Ranges","bytes");
              String range=request.getRequestHeaders().get("Range");if(range==null)range=request.getRequestHeaders().get("range");
              if(range!=null&&range.matches("bytes=[0-9]+-[0-9]*")){
                try{
                  String[] bounds=range.substring(6).split("-",-1);long start=Long.parseLong(bounds[0]),end=bounds[1].isEmpty()?total-1:Math.min(Long.parseLong(bounds[1]),total-1);
                  if(start>end||start>=total){asset.close();headers.put("Content-Range","bytes */"+total);return new WebResourceResponse(type,null,416,"Range Not Satisfiable",headers,new ByteArrayInputStream(new byte[0]));}
                  long skipped=0;while(skipped<start){long n=asset.skip(start-skipped);if(n<=0){if(asset.read()==-1)throw new IOException("Short video");n=1;}skipped+=n;}
                  final long length=end-start+1;headers.put("Content-Range","bytes "+start+"-"+end+"/"+total);headers.put("Content-Length",Long.toString(length));
                  InputStream limited=new FilterInputStream(asset){long remaining=length;@Override public int read()throws IOException{if(remaining<=0)return -1;int value=super.read();if(value>=0)remaining--;return value;}@Override public int read(byte[] b,int off,int len)throws IOException{if(remaining<=0)return -1;int n=in.read(b,off,(int)Math.min(len,remaining));if(n>0)remaining-=n;return n;}};
                  return new WebResourceResponse(type,null,206,"Partial Content",headers,limited);
                }catch(NumberFormatException ignored){}
              }
              headers.put("Content-Length",Long.toString(total));
            }
            return new WebResourceResponse(type,(type.equals("application/gzip")||type.startsWith("image/")||type.startsWith("video/"))?null:"UTF-8",200,"OK",headers,asset);
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
        boolean images=false;for(String type:params.getAcceptTypes())if(type.startsWith("image/"))images=true;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType(images?"image/*":"application/json").addCategory(Intent.CATEGORY_OPENABLE);
        if(images)intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
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
    @JavascriptInterface public void cancelTravel(String id){travel.cancel(id);}
    @JavascriptInterface public void requestTravel(String id,String url){travel.request(id,url);}
    @JavascriptInterface public void requestServer(String id,String path,String body){api.request(id,path,body);}
    @JavascriptInterface public void shareText(String title,String url){
      if(url==null||url.length()>20000||!url.startsWith("http://52.65.9.104:8000/shared#"))return;
      runOnUiThread(()->{try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_SUBJECT,"여행잇 일정").putExtra(Intent.EXTRA_TEXT,url),"일정 공유"));}catch(Exception e){notice("공유할 앱을 열지 못했습니다.");}});
    }
    @JavascriptInterface public void saveCalendar(String content){
      if(content==null||content.length()>1024*1024||!content.startsWith("BEGIN:VCALENDAR"))return;
      save("yeohaengit-itinerary.ics","text/calendar",content.getBytes(StandardCharsets.UTF_8),false);
    }
    @JavascriptInterface public void saveJson(String name,String data){
      if(data==null||data.length()>8*1024*1024){notice("파일이 너무 큽니다.");return;}
      byte[] bytes=data.getBytes(StandardCharsets.UTF_8);if(bytes.length>8*1024*1024){notice("8 MiB 이하 파일만 저장할 수 있습니다.");return;}
      save("bopok-trip.json","application/json",bytes,false);
    }
    @JavascriptInterface public void saveTourism(){save("bopok-korea-tourism.json.gz","application/gzip",null,true);}
    @JavascriptInterface public void printPage(){runOnUiThread(()->{
      try{((PrintManager)getSystemService(PRINT_SERVICE)).print("여행잇 여행 일정",web.createPrintDocumentAdapter("여행잇 여행 일정"),null);}catch(Exception e){notice("인쇄 서비스를 사용할 수 없습니다.");}
    });}
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==1&&chooser!=null){
      Uri[] selected=null;
      if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();selected=new Uri[n];for(int i=0;i<n;i++)selected[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)selected=new Uri[]{data.getData()};}
      chooser.onReceiveValue(selected);chooser=null;
    }
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
