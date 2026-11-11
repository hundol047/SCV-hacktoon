from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
import sys
root=Path(__file__).resolve().parents[1];out=root/'artifacts/ir'
p=Presentation(sys.argv[1])
INK='193D50';BLUE='146B99';MUTED='526B7A'
def text(s,x,y,w,h,t,size=18,color=INK,bold=False,center=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True
 f.margin_left=f.margin_right=Pt(3);f.margin_top=f.margin_bottom=Pt(2)
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.line_spacing=1.12;q.space_after=Pt(5)
  if center:q.alignment=PP_ALIGN.CENTER
 return a
def box(s,x,y,w,h,c):
 a=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h));a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(c);a.line.fill.background();a.adjustments[0]=.06;return a
def roundpic(a):
 geom=a._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom');geom.set('prst','roundRect')
 av=geom.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst')
 for child in list(av):av.remove(child)
 gd=OxmlElement('a:gd');gd.set('name','adj');gd.set('fmla','val 4000');av.append(gd)
def place(a,x,y,w,h,crop=(0,0,0,0)):
 l,t,r,b=crop;iw,ih=a.image.size;ratio=iw*(1-l-r)/(ih*(1-t-b));ww=min(w,h*ratio);hh=ww/ratio
 a.left=Inches(x+(w-ww)/2);a.top=Inches(y+(h-hh)/2);a.width=Inches(ww);a.height=Inches(hh)
 a.crop_left=l;a.crop_top=t;a.crop_right=r;a.crop_bottom=b;roundpic(a)

from pptx.enum.text import MSO_ANCHOR

def clear_body(s):
 for a in list(s.shapes):
  if a.top>=Inches(1.75) and a.top<Inches(7):s.shapes._spTree.remove(a._element)
def heading(s,title):
 for a in s.shapes:
  if a.has_text_frame and Inches(.7)<a.top<Inches(1.6):
   a.text_frame.paragraphs[0].runs[0].text=title

s=p.slides[3];clear_body(s);heading(s,'부모님도, 아이도 함께 떠날 수 있는 여행')
text(s,.65,1.85,12,.45,'핵심 고객은 어르신·이동이 불편한 분, 가족과 보호자가 함께 계획합니다.',17,MUTED)
for x,file,title,body in [(.65,'senior.jpg','부모님과 쉬엄쉬엄 떠나는 여행','짧게 걷기 · 관광 뒤 휴식 · 필요한 편의시설'),(6.85,'family.jpg','아이와 함께 즐기는 가족 여행','아이 동반 장소 · 여유로운 속도 · 유모차 진입 조건')]:
 box(s,x,2.5,5.83,3.8,'FFFFFF')
 a=s.shapes.add_picture(str(out/'target-photos'/file),Inches(x),Inches(2.5),width=Inches(5.83))
 # Native crop preserves the original photograph and centers the subjects.
 iw,ih=a.image.size;target=5.83/2.5;ratio=iw/ih
 if ratio<target:
  v=(1-ratio/target)/2;place(a,x,2.5,5.83,2.5,(0,v,0,v))
 else:
  v=(1-target/ratio)/2;place(a,x,2.5,5.83,2.5,(v,0,v,0))
 text(s,x+.18,5.18,5.47,.45,title,22,BLUE,True)
 text(s,x+.18,5.78,5.47,.35,body,14,MUTED)
text(s,.65,6.55,12,.36,'보폭의 약속  |  동행자의 이동 조건을 출발점으로 삼아, 함께할 수 있는 일정을 만듭니다.',17,BLUE,True)

s=p.slides[8];clear_body(s);heading(s,'보폭의 차별성: 이동 조건을 일정 전체에 반영')
text(s,.65,1.86,12,.4,'여행지를 찾는 기능에서, 동행자의 보행·휴식 조건을 지키는 일정으로',17,MUTED)
rows=[['서비스','장소·코스\n탐색','필수 이동 조건\n장소 선별','관광 뒤 휴식\n자동 배치','일정 변경 후\n필수 조건 유지','어르신·아이\n시작 유형'],['보폭','○','○','○','○','○'],['네이버 지도','○','—','—','—','—'],['트리플','○','—','—','—','—'],['열린관광\n모두의 여행','○','편의정보 필터','—','—','관광약자 정보']]
a=s.shapes.add_table(5,6,Inches(.65),Inches(2.6),Inches(12.03),Inches(3.25));table=a.table
widths=[1.83,1.65,2.2,2.1,2.2,2.05]
for i,w in enumerate(widths):table.columns[i].width=Inches(w)
for ri,row in enumerate(rows):
 table.rows[ri].height=Inches(.65)
 for ci,value in enumerate(row):
  c=table.cell(ri,ci);c.text=value;c.vertical_anchor=MSO_ANCHOR.MIDDLE;c.margin_left=c.margin_right=Inches(.07);c.margin_top=c.margin_bottom=Inches(.04)
  c.fill.solid();c.fill.fore_color.rgb=RGBColor.from_string('146B99' if ri==0 else 'E1F3EC' if ri==1 else 'FFFFFF' if ri%2==0 else 'F0F5F9')
  for q in c.text_frame.paragraphs:
   q.alignment=PP_ALIGN.CENTER;q.font.name='Noto Sans CJK KR';q.font.size=Pt(15 if ri==0 else 17 if ri==1 else 14);q.font.bold=ri<2;q.font.color.rgb=RGBColor.from_string('FFFFFF' if ri==0 else INK)
text(s,.65,6.02,12,.32,'○ 제공·구현 확인   — 검토한 공식 안내에서 확인되지 않음(기능 부재를 뜻하지 않음)',12,MUTED)
text(s,.65,6.42,12,.43,'보폭은 장소를 바꿔도 필수 이동 조건을 유지하고, 관광 뒤 여유 시간을 다시 배치합니다.',18,BLUE,True)

s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string('F7FBFE')
text(s,.6,.3,12,.3,'보폭  /  COMPARISON & PHOTO SOURCES',11,BLUE,True)
text(s,.6,.9,12,.65,'비교 기준과 이미지 출처',28,INK,True)
refs=[('서비스 비교','네이버 지도 · 공식 서비스 소개','https://www.navercorp.com/ko/service/map'),('','트리플 · 공식 앱 소개 및 일정 작성 안내','https://triple.guide/intro'),('','열린관광 모두의 여행 · 편의정보 및 추천 코스','https://access.visitkorea.or.kr/main/main.do'),('어르신 여행 사진','Traveling to Europe for Seniors 공개 프로젝트의 배너 사진','https://github.com/LSIS5425-Fall2023/group-2/blob/main/_data/Traveleuropebanner.jpeg'),('아이 동반 사진','Kindred 데모 사진 · 저장소에서 Pexels 사진으로 안내','https://github.com/mkteagle/kindred/tree/main/apps/web/public/demo/photos')]
for i,(tag,desc,url) in enumerate(refs):
 y=1.95+i*.77;text(s,.65,y,11.9,.3,(tag+'  |  ' if tag else '')+desc,15,INK,True)
 a=text(s,.65,y+.34,11.9,.25,url,10,MUTED);a.text_frame.paragraphs[0].runs[0].hyperlink.address=url
text(s,.65,6,12,.75,'비교는 2026.11.11 공개 안내와 보폭 구현을 기준으로 작성했습니다. 전 기능을 실사용한 비교는 아닙니다.\n보폭의 휴식 배치는 일정상 여유 시간이며 현장 좌석·시설 확보를 뜻하지 않습니다. 사진은 타깃 설명용입니다.',12,MUTED)
text(s,12,7.12,.6,.3,'18',10,BLUE)
for s in p.slides:
 for a in s.shapes:
  sp=getattr(a._element,'spPr',None)
  if sp is not None:sp.append(OxmlElement('a:effectLst'))
  for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
p.part._element.set('autoCompressPictures','0')
p.save(out/'보폭_IR_고객사진_차별성비교.pptx')
print('Saved',len(p.slides),'slides')
