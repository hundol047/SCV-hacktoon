from pathlib import Path
from pptx import Presentation
from pptx.util import Inches,Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
out=Path(__file__).resolve().parents[1]/'artifacts/ir'
p=Presentation(out/'보폭_IR_16장_표지정리.pptx');s=p.slides[14]
for a in list(s.shapes):s.shapes._spTree.remove(a._element)
def text(x,y,w,h,t,size=16,color='1B4354',bold=False):
 a=s.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h));f=a.text_frame;f.word_wrap=True;f.margin_left=f.margin_right=Pt(2);f.margin_top=f.margin_bottom=Pt(2)
 for i,line in enumerate(t.split('\n')):
  q=f.paragraphs[0] if i==0 else f.add_paragraph();q.text=line;q.font.name='Noto Sans CJK KR';q.font.size=Pt(size);q.font.bold=bold;q.font.color.rgb=RGBColor.from_string(color);q.space_after=Pt(7)
 return a
def rect(x,y,w,h,color):
 a=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h));a.fill.solid();a.fill.fore_color.rgb=RGBColor.from_string(color);a.line.fill.background();return a
text(.55,.28,12,.3,'보폭  /  TEAM',11,'216D99',True)
text(.55,.9,12,1,'AI 개발과 창업 경험을 갖춘 실행 팀',30,bold=True)
team=[('백승훈','사업총괄','의료AI코딩대회 수상\n강원 AI&반도체 포럼\n아이디어 경진대회 수상\n강원특별자치도·송호대학교\n창업경진대회 수상'),('장현희','서비스 기획 · UX','사용자 흐름 설계\n사용자 조사\n화면 기획'),('이종원','재무 · 영업 · R&D','의료AI코딩대회 수상\n전국 모의 투자대회 입상\nLG AIMERS 12기 수료\n대한의공학회 학술지 투고'),('조재민','연구개발','2024 연세의료AI\n개발경진대회 대상\n2025 연세FPGA\n개발경진대회 대상\nEMBC 국제학술대회 투고')]
for i,(name,role,body) in enumerate(team):
 x=.6+i*3.08;rect(x,2.0,2.86,4.8,'FFFFFF');rect(x+.2,2.2,2.46,1.15,'EAF2F5');text(x+.7,2.58,1.5,.4,'사진 넣기',14,'71858F')
 text(x+.2,3.55,2.46,.45,name,23,bold=True);text(x+.2,4.12,2.46,.4,role,15,'216D99',True);text(x+.2,4.73,2.46,1.98,body,14)
text(.65,7.1,11.2,.27,'출처: WAVE-LAB 참여신청서·사업계획서 p.3, 12  |  장현희: 기존 보폭 역할 분담안',8,'526B7A');text(12,7.1,.6,.3,'15',9,'216D99')
assert len(p.slides)==16
p.save(out/'보폭_IR_16장_팀역량반영.pptx')
