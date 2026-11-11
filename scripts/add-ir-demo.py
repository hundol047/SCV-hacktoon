from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
root=Path(__file__).resolve().parents[1];out=root/'artifacts/ir'
p=Presentation(out/'보폭_IR_고객사진_차별성비교.pptx')
def text(s,x,y,w,h,value,size=20,color='193D50',bold=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True;f.margin_left=f.margin_right=Pt(3);f.margin_top=f.margin_bottom=Pt(2)
 for i,line in enumerate(value.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.line_spacing=1.12
 return a
s=p.slides.add_slide(p.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string('F7FBFE')
text(s,.6,.3,12,.3,'보폭  /  LIVE DEMO',11,'146B99',True)
text(s,.6,.9,12,.7,'말 한마디가, 함께 떠날 수 있는 일정으로',28,bold=True)
text(s,.65,1.85,12,.5,'“어머니와 강릉으로, 많이 걷지 않고 쉬면서 다니고 싶어요. 3박 4일로.”',19,'146B99',True)
a=s.shapes.add_picture(str(out/'user-screens/result.png'),Inches(.7),Inches(2.65),width=Inches(6.7),height=Inches(3.8))
# Crop page gutters; keep original aspect ratio of the itinerary content.
a.crop_left=.25;a.crop_right=.25;a.crop_top=.065
ratio=(1879*.5)/(938*.935);a.width=Inches(3.8*ratio);a.left=Inches(.8+(6.3-3.8*ratio)/2)
g=a._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom');g.set('prst','roundRect');av=g.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst');gd=OxmlElement('a:gd');gd.set('name','adj');gd.set('fmla','val 4000');av.append(gd)
for y,title,desc in [(2.65,'01  여행 조건 입력','동행자·기간·이동 조건을 말하거나 선택'),(3.75,'02  코스·숙소 비교','추천·여유롭게·색다른 코스에서 선택'),(4.85,'03  장소 정보 확인','소개·보행·편의시설을 보고 길찾기')]:
 text(s,7.5,y,5.1,.4,title,22,'146B99',True);text(s,7.5,y+.5,5.1,.4,desc,16,'526B7A')
button=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,Inches(7.55),Inches(6.05),Inches(4.7),Inches(.6));button.fill.solid();button.fill.fore_color.rgb=RGBColor.from_string('146B99');button.line.fill.background();button.adjustments[0]=.1;button.text='보폭 웹사이트 실행';q=button.text_frame.paragraphs[0];q.alignment=PP_ALIGN.CENTER;q.font.name='Noto Sans CJK KR';q.font.size=Pt(18);q.font.bold=True;q.font.color.rgb=RGBColor(255,255,255);button.click_action.hyperlink.address='http://52.65.9.104:8000/lab/'
text(s,.65,7.12,11,.28,'MENTOR IR  ·  2026.11  ·  어르신과 아이, 서로의 보폭에 맞추는 여행',9,'526B7A')
text(s,12,7.12,.6,.3,'10',10,'146B99')
# Insert directly after the ninth slide without rebuilding any existing slides.
ids=p.slides._sldIdLst;last=ids[-1];ids.remove(last);ids.insert(9,last)
for i,page in enumerate(p.slides,1):
 for a in page.shapes:
  if a.has_text_frame and a.left>=Inches(11.9) and a.top>=Inches(7) and a.text.strip().isdigit():
   for q in a.text_frame.paragraphs:
    if q.runs:q.runs[0].text=f'{i:02}'
 for a in page.shapes:
  sp=getattr(a._element,'spPr',None)
  if sp is not None:sp.append(OxmlElement('a:effectLst'))
  for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
p.part._element.set('autoCompressPictures','0')
p.save(out/'보폭_IR_고객사진_비교표_시연.pptx');print('Saved',len(p.slides),'slides')
