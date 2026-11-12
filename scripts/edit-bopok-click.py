from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parents[1];out=root/'artifacts/video/click-demo'
data=json.loads((out/'cues.json').read_text());cues=data['cues'];cut=max(0,cues[0]['start']-.2);duration=data['duration']-cut;intro=6;end=7;total=intro+duration+end
assert 120<=total<=180,total
def ass_time(t):
 v=round(t*100);return f'{v//360000}:{v//6000%60:02}:{v//100%60:02}.{v%100:02}'
def srt_time(t):
 v=round(t*1000);return f'{v//3600000:02}:{v//60000%60:02}:{v//1000%60:02},{v%1000:03}'
ass='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Noto Sans CJK KR,40,&H00FFFFFF,&H00FFFFFF,&H004D3D23,&H204D3D23,0,0,0,0,100,100,0,0,3,12,0,2,70,70,24,1
Style: Chapter,Noto Sans CJK KR,26,&H00996B14,&H00996B14,&H00FFFFFF,&H10FFFFFF,-1,0,0,0,100,100,0,0,3,8,0,8,60,60,22,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
srt=[]
for i,c in enumerate(cues,1):
 a=intro+max(0,c['start']-cut);b=intro+c['end']-cut
 ass+=f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Caption,,0,0,0,,{c['caption']}\n"
 ass+=f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Chapter,,0,0,0,,{c['chapter']}\n"
 srt.append(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{c['caption']}\n")
(out/'captions.ass').write_text(ass);(out/'보폭_한국어자막.srt').write_text('\n'.join(srt),encoding='utf-8-sig')
filters=f'[0:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v0];[1:v]trim=duration={duration},fps=30,scale=1920:1080,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v1];[2:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0,ass={out}/captions.ass[v]'
cmd=['ffmpeg','-y','-hide_banner','-loglevel','warning','-loop','1','-t',str(intro),'-i',str(out/'intro.png'),'-ss',str(cut),'-i',str(out/'bopok-live.webm'),'-loop','1','-t',str(end),'-i',str(out/'outro.png'),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-filter_complex_threads','2','-filter_complex',filters,'-map','[v]','-map','3:a','-r','30','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','22','-threads','2','-c:a','aac','-b:a','128k','-t',str(total),'-movflags','+faststart',str(out/'보폭_클릭시연_관광지_호텔.mp4')]
print('Encoding',round(total,2),'seconds',flush=True);subprocess.run(cmd,check=True)
(out/'영상설명.txt').write_text('제목: 부모님도 아이도 함께 떠나요 | 보폭 실제 사용 시연\n\n보폭은 동행자의 이동 조건을 반영하는 강원 여행 도우미입니다.\n어르신 동행 조건 선택부터 3박 4일 코스 비교, 숙소 검색, 장소 정보 확인, 일정 저장까지 실제 사용 흐름을 보여드립니다.\n\n동행자 맞춤 · 보행과 휴식 · 여행 코스와 숙소 비교\n#보폭 #가족여행 #부모님여행 #강원여행 #여행계획\n\n영상 형식: 한국어 자막형 / 배경음악·내레이션 없음\n',encoding='utf-8-sig')
(out/'README.md').write_text(f'# 보폭 실행 시연\n\n- 영상: 보폭_클릭시연_관광지_호텔.mp4 ({total:.1f}초, 1920×1080, 30fps, H.264/AAC 무음).\n- 최신 로컬 프로덕션 앱을 실제 조작하여 녹화했습니다. 외부 AI 응답이나 실시간 도로·예약 공급자 연결을 시연한 것은 아닙니다.\n- 소개·마무리에는 사용자가 제공한 실제 화면을 사용했습니다. 라카이 샌드파인·컨피네스 오션 스위트 호텔 사진은 사용자 제공 실제 화면에서 동일 호텔의 사진 부분을 녹화용 로컬 캐시로 표시했습니다. 남항진해변과 가시연습지 사진도 사용자 제공 동일 장소 화면에서 캐시로 표시했습니다. 다른 외부 사진·지도는 대체 표시가 있을 수 있습니다.\n- 한국어 자막은 영상에 포함되며 별도 SRT도 제공합니다. 유튜브 게시 자체는 수행하지 않았습니다.\n- 재현: record-bopok-click.cjs → edit-bopok-click.py.\n')
