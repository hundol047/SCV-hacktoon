from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.oxml.xmlchemy import OxmlElement
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_QA이미지_최종.pptx');s=p.slides[-1]
# Preserve the introduction and small Q&A on the left; replace right-hand stock photos.
for a in list(s.shapes):
 if a.shape_type==13 or (a.has_text_frame and (a.left>=Inches(7) and a.top<Inches(7) or a.top>=Inches(7) and a.left<Inches(11.9))):
  s.shapes._spTree.remove(a._element)
a=s.shapes.add_picture(str(out/'user-screens/home.png'),Inches(7.1),Inches(1.0),width=Inches(5.6),height=Inches(5.5))
a.crop_left=.265;a.crop_right=.265;a.crop_top=.07;a.crop_bottom=.02
# Keep the cropped screenshot's aspect ratio instead of stretching the UI.
ratio=(1883*.47)/(902*.91);a.width=Inches(5.5*ratio);a.left=Inches(7+(5.7-5.5*ratio)/2)
g=a._element.spPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}prstGeom');g.set('prst','roundRect');av=g.find('{http://schemas.openxmlformats.org/drawingml/2006/main}avLst');gd=OxmlElement('a:gd');gd.set('name','adj');gd.set('fmla','val 4000');av.append(gd)
for x,y,w,h,t,size in [(7.1,6.65,5.6,.3,'보폭 실제 프로그램 화면',13),(.7,7.12,11,.25,'화면: 사용자 제공 보폭 실제 실행 화면',8)]:
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.margin_left=f.margin_right=Pt(2);f.margin_top=f.margin_bottom=Pt(1);q=f.paragraphs[0];q.text=t;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.color.rgb=RGBColor.from_string('526B7A')
for a in s.shapes:
 sp=getattr(a._element,'spPr',None)
 if sp is not None:sp.append(OxmlElement('a:effectLst'))
 for e in a._element.xpath('.//a:effectRef'):e.set('idx','0')
p.save(out/'보폭_IR_프로그램화면_QA.pptx')
