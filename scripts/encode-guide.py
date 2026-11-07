"""Encode the optional RECORD_GUIDE Playwright recording (requires ffmpeg)."""
from pathlib import Path
import json,subprocess
r=Path(__file__).resolve().parent.parent;d=Path('/tmp/yeohaengit-guide');v=r/'public/videos'
o=json.loads((d/'offset.json').read_text())['offset']
subprocess.run(['ffmpeg','-y','-v','error','-ss',str(o),'-i',str(d/'guide.webm'),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-an',str(v/'travel-guide.mp4')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-ss','3','-i',str(v/'travel-guide.mp4'),'-frames:v','1','-q:v','2',str(v/'travel-guide-poster.jpg')],check=True)
chapters=json.loads((d/'chapters.json').read_text());labels=['지역 탐색','접근성·조건','일정·비용','숙소','여행 중 모드','직접 편집','동행·교통','공유']
(r/'src/data/guide-chapters.json').write_text(json.dumps([{'at':round(c['at'],2),'label':labels[i]} for i,c in enumerate(chapters[:8])],ensure_ascii=False,indent=2)+'\n')
def ts(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
s='WEBVTT\n\n'
for i,c in enumerate(chapters):
 end=chapters[i+1]['at'] if i+1<len(chapters) else c['at']+3.5
 s+=f'{ts(c["at"])} --> {ts(end)}\n{c["text"]}\n\n'
(v/'travel-guide.ko.vtt').write_text(s.rstrip()+'\n');(v/'travel-guide.chapters.vtt').write_text(s.rstrip()+'\n')
print('Encoded latest product walkthrough')
