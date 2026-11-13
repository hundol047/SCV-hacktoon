from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_16장_팀역량반영.pptx');s=p.slides[14]
for a in list(s.shapes):s.shapes._spTree.remove(a._element)
s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor.from_string('071D33')
def text(x,y,w,h,t,size=16,bold=False,center=False,color='FFFFFF'):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True;f.margin_left=f.margin_right=Pt(0);f.margin_top=f.margin_bottom=Pt(1)
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.space_after=Pt(5)
  if center:q.alignment=PP_ALIGN.CENTER
 return a
team=[('백승훈','CEO','제품 기획 및 사업화','연세대학교 AI반도체학부\n인공지능시스템연구실(AISL) 책임연구원','학부생 의료AI코딩대회 수상\n강원 AI&반도체 포럼 아이디어 경진대회 수상\n강원특별자치도·송호대학교 창업경진대회 수상\n모두의 창업 1·2기'),('이종원','CTO','AI·웹 개발 및 엣지 배포','연세대학교 AI반도체학부\n인공지능시스템연구실(AISL) 수석연구원','과학기술정보통신부 의료AI코딩대회 대상\n대한의공학회·대한전자공학회 AI 관련 논문 투고·발표\nMIMIC-III 기반 중환자 예측 AI 모델 개발\nLG Aimers 12기 수료 · NVIDIA DLI Certificate')]
for i,(name,title,role,aff,achieve) in enumerate(team):
 x=.7+i*6.35;w=5.6
 text(x,.55,w,.5,role,24,True,True)
 a=s.shapes.add_shape(MSO_SHAPE.RECTANGLE,Inches(x+(w-1.8)/2),Inches(1.35),Inches(1.8),Inches(2.32));a.name=name+' 사진';a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string('EDF2F7');a.line.fill.background()
 ph=OxmlElement('p:ph');ph.set('type','pic');ph.set('idx',str(40+i));a._element.nvSpPr.nvPr.append(ph)
 a.text_frame.text='사진 넣기';q=a.text_frame.paragraphs[0];q.font.name='Noto Sans CJK KR';q.font.size=Pt(13);q.font.color.rgb=RGBColor.from_string('526B7A');q.alignment=PP_ALIGN.CENTER
 text(x,3.94,w,.5,name+'   '+title,23,True,True)
 text(x,4.7,w,.7,aff,16,True)
 text(x,5.62,w,1.3,achieve,15)
text(.7,7.16,11.4,.22,'출처: 사용자 제공 팀 소개 이미지 · WAVE-LAB 사업계획서 p.12',8,color='A8BBCB')
text(12.1,7.1,.5,.3,'15',9,color='A8BBCB')
s.notes_slide.notes_text_frame.text='사진 넣기: 각 사진 자리의 그림 삽입 아이콘을 클릭해 해당 인물 사진을 선택하세요. 세로 비율 1.8:2.32(약 0.776), 크기 4.57 × 5.89cm. 얼굴이 잘리면 그림 서식 > 자르기 > 맞춤을 선택하세요. 백승훈(왼쪽), 이종원(오른쪽). 경력·직책은 사용자 제공 소개 이미지와 사업계획서 기준입니다.'
p.save(out/'보폭_IR_16장_팀소개수정.pptx')
check=Presentation(out/'보폭_IR_16장_팀소개수정.pptx');assert len(check.slides)==16
assert len([a for a in check.slides[14].placeholders if a.placeholder_format.type==18])==2
print('16 slides, 2 editable picture placeholders verified')
