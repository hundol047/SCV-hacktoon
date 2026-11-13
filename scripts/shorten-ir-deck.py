from pathlib import Path
from pptx import Presentation
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_프로그램화면_QA.pptx')
# Consolidate roadmap metrics into the go-to-market slide; market assumptions
# remain explicitly stated on the nested TAM/SAM/SOM slide.
s=p.slides[13]
replacements={
'보폭  /  GO TO MARKET':'보폭  /  GO TO MARKET & KPI',
'1단계 · 검증':'0~1개월 · 검증',
'2단계 · 유입':'2~3개월 · 유입',
'3단계 · 확장':'4~12개월 · 확장',
'상기 고객 수와 활동은 향후 실행 목표입니다.':'핵심 지표: 조건 준수율 · 실제 방문 완료율 · 재사용률  |  초기 12개월 2,000팀 목표',
'계획: 보폭 팀의 고객 검증·시장 진입 계획':'계획·목표: 보폭 팀의 고객 검증·시장 진입·성과 측정 계획',
}
for a in s.shapes:
 if a.has_text_frame and a.text in replacements:
  value=replacements[a.text]
  para=a.text_frame.paragraphs[0]
  if para.runs:
   para.runs[0].text=value
   for r in para.runs[1:]:r.text=''
  else:para.text=value
for index in [15,11]:
 sid=p.slides._sldIdLst[index];p.part.drop_rel(sid.rId);p.slides._sldIdLst.remove(sid)
for i,s in enumerate(p.slides,1):
 for a in s.shapes:
  if a.has_text_frame and a.text.strip().isdigit() and a.top>p.slide_height*.9:
   a.text_frame.paragraphs[0].runs[0].text=f'{i:02d}'
assert len(p.slides)==16
p.save(out/'보폭_IR_16장_최종.pptx')
