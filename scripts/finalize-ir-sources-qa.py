from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.xmlchemy import OxmlElement
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_고객사진_비교표_시연.pptx')
# Move references from both source-only slides to the relevant slide footer.
for index in (18,17):
 sid=p.slides._sldIdLst[index];p.part.drop_rel(sid.rId);p.slides._sldIdLst.remove(sid)
def text(s,x,y,w,h,t,size=18,color='193D50',bold=False,center=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.margin_left=f.margin_right=Pt(2);f.margin_top=f.margin_bottom=Pt(1);f.word_wrap=True
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.line_spacing=1.12
  if center:q.alignment=PP_ALIGN.CENTER
 return a
mcst='https://www.mcst.go.kr/site/s_notice/press/pressView.jsp?pSeq=22557'
gangwon='https://v.daum.net/v/20260705165659435'
code='https://github.com/hundol047/SCV-hacktoon/tree/64fd652'
senior='https://github.com/LSIS5425-Fall2023/group-2/blob/main/_data/Traveleuropebanner.jpeg'
family='https://github.com/mkteagle/kindred/tree/main/apps/web/public/demo/photos'
refs={
1:[('화면: 보폭 실제 실행 화면 · 사용자 제공 PPT',None)],
4:[('사진: 어르신 여행 — Traveling to Europe for Seniors',senior),('아이 동반 — Kindred 데모(Pexels 안내)',family)],
5:[('화면: 보폭 실제 실행 화면 · 사용자 제공 PPT',None)],
6:[('화면·기능: 보폭 최신 코드 직접 실행',code)],
7:[('화면: 사용자 제공 보폭 코스·숙소 화면',None)],
8:[('화면: 사용자 제공 보폭 장소 상세 화면',None)],
9:[('비교 출처: 네이버 지도', 'https://www.navercorp.com/ko/service/map'),('트리플','https://triple.guide/intro'),('열린관광 모두의 여행','https://access.visitkorea.or.kr/main/main.do'),('보폭 구현 · 2026.11.11 공개 안내 기준',code)],
10:[('화면: 사용자 제공 보폭 실행 화면',None)],
11:[('[1] 문체부, 2025 국민여행조사(2026.6.30)',mcst),('[2] 경북일보, 강원 지출 인용(2026.7.5)',gangwon),('SAM·SOM: 팀 가정·목표',None)],
12:[('기준 통계: 2025 국민여행조사',mcst),('강원 지출 5.858조 원 인용',gangwon),('5%·10%·15%: 팀 가정',None)],
13:[('산출: 보폭 팀 사업 가정 · 소비액 10억 × 제휴 전환 30% × 수수료 5%',None)],
14:[('계획: 보폭 팀의 고객 검증·시장 진입 계획',None)],
15:[('구현 근거: 보폭 코드 · AWS Bedrock 연동 및 일정 엔진',code)],
16:[('목표: 보폭 팀의 단계별 실사용 검증·사업 지표',None)],
17:[('팀 구성·역할: 팀 제공 정보 및 역할 분담안',None)]}
for i,s in enumerate(p.slides,1):
 if i not in refs:continue
 for a in list(s.shapes):
  if a.has_text_frame and a.top>=Inches(7) and a.left<Inches(11.9):s.shapes._spTree.remove(a._element)
 a=text(s,.65,7.11,11.15,.3,'',8.2,'526B7A');q=a.text_frame.paragraphs[0]
 for j,(label,url) in enumerate(refs[i]):
  run=q.add_run();run.text=('  ·  ' if j else '')+label;run.font.name='Noto Sans CJK KR';run.font.size=Pt(8.2);run.font.color.rgb=RGBColor.from_string('526B7A')
  if url:run.hyperlink.address=url
# Dedicated closing slide.
s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string('F7FBFE')
text(s,.65,.4,12,.4,'보폭  /  함께 떠날 수 있는 여행',13,'146B99',True)
text(s,1,1.25,11.33,.9,'서로의 보폭에 맞춰, 함께 떠나요',32,'193D50',True,True)
text(s,1.25,2.35,10.83,1.15,'보폭은 어르신·이동이 불편한 분과 아이 동반 가족을 위해\n보행·휴식·편의시설 조건을 반영해 여행 일정과 숙소를 연결하는 서비스입니다.',21,'526B7A',False,True)
for x,label,c in [(1.3,'동행자 맞춤','E1F3EC'),(5,'보행·휴식 반영','E7F2FC'),(8.7,'일정·숙소 비교','FFF0D5')]:
 a=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,Inches(x),Inches(3.85),Inches(3.33),Inches(.65));a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(c);a.line.fill.background();a.adjustments[0]=.1
 a.text=label;a.text_frame.vertical_anchor=MSO_ANCHOR.MIDDLE;q=a.text_frame.paragraphs[0];q.alignment=PP_ALIGN.CENTER;q.font.name='Noto Sans CJK KR';q.font.size=Pt(18);q.font.bold=True;q.font.color.rgb=RGBColor.from_string('146B99')
text(s,1,4.85,11.33,1.1,'Q&A',60,'146B99',True,True)
text(s,1,6.2,11.33,.5,'궁금한 점을 말씀해 주세요.',20,'526B7A',False,True)
text(s,12,7.12,.6,.3,'18',10,'146B99')
for page in p.slides:
 for a in page.shapes:
  sp=getattr(a._element,'spPr',None)
  if sp is not None:sp.append(OxmlElement('a:effectLst'))
  for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
p.part._element.set('autoCompressPictures','0')
p.save(out/'보폭_IR_출처정리_QA.pptx');print('Saved',len(p.slides),'slides')
