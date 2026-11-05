import csv
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'engineering_visualization_report.docx'; CHARTS=ROOT/'report_charts'; CHARTS.mkdir(exist_ok=True)
with (ROOT/'placement_dataset.csv').open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
deps=[r['Department'] for r in rows]; eligible=[int(r['Students Eligible']) for r in rows]; placed=[int(r['Students Placed']) for r in rows]; packages=[float(r['Average Package (LPA)']) for r in rows]
NAVY='#222222'; BLUE='#1f77b4'; TEAL='#ff7f0e'; GOLD='#2ca02c'; RED='#d62728'; GREY='#555555'; GRID='#d9d9d9'; WHITE='#FFFFFF'
try: FONT='/Windows/Fonts/arial.ttf'; BOLD='/Windows/Fonts/arialbd.ttf'; REG=ImageFont.truetype(FONT,17); SMALL=ImageFont.truetype(FONT,14); TITLE=ImageFont.truetype(FONT,20); MED=ImageFont.truetype(BOLD,17)
except OSError: REG=SMALL=TITLE=MED=ImageFont.load_default()
def canvas(title):
 im=Image.new('RGB',(1200,440),WHITE); d=ImageDraw.Draw(im); d.text((600,18),title,font=TITLE,fill=NAVY,anchor='mt'); return im,d
def text(d,pos,s,font=REG,fill=NAVY,anchor='mm'): d.text(pos,str(s),font=font,fill=fill,anchor=anchor)
def save(im,name): im.save(CHARTS/name)
def bars(name,title,cats,series,colors,maxv,ylab):
 im,d=canvas(title); L,R,T,B=100,1140,85,350; d.line((L,T,L,B),fill=GREY,width=2); d.line((L,B,R,B),fill=GREY,width=2)
 for tick in range(0,maxv+1,max(1,maxv//5)):
  y=B-(B-T)*tick/maxv; d.line((L,y,R,y),fill=GRID,width=1); text(d,(L-38,y),tick,SMALL,GREY)
 text(d,(L,64),ylab,SMALL,GREY,'lm')
 n=len(cats); group=(R-L)/n; bw=min(54,group/(len(series)+1))
 for i,c in enumerate(cats):
  cx=L+(i+.5)*group
  for j,(label,vals) in enumerate(series):
   x=cx+(j-(len(series)-1)/2)*(bw+8); y=B-(B-T)*vals[i]/maxv; d.rectangle((x-bw/2,y,x+bw/2,B),fill=colors[j]); text(d,(x,y-14),f'{vals[i]:g}',SMALL,NAVY)
  text(d,(cx,B+24),c,SMALL,NAVY)
 lx=790
 for j,(label,_) in enumerate(series): d.rectangle((lx+j*155,T-35,lx+18+j*155,T-17),fill=colors[j]); text(d,(lx+72+j*155,T-26),label,SMALL,NAVY)
 save(im,name)
bars('01_grouped_bars.png','Eligible and placed students by department',deps,[('Eligible',eligible),('Placed',placed)],[BLUE,TEAL],200,'Students')
# Pie chart
im,d=canvas('Share of all placed students (487 total)'); vals=placed; cols=[BLUE,TEAL,GOLD,RED,'#8A78B5']; box=(135,75,535,425); start=-90; total=sum(vals)
for v,c in zip(vals,cols):
 end=start+360*v/total; d.pieslice(box,start,end,fill=c,outline=WHITE,width=3); start=end
legendx=660
for i,(dep,v,c) in enumerate(zip(deps,vals,cols)):
 y=115+i*55; d.rectangle((legendx,y,legendx+25,y+25),fill=c); text(d,(legendx+225,y+12),f'{dep}: {v} ({v/total:.1%})',REG,NAVY,'lm')
save(im,'02_placed_share.png')
bars('03_package.png','Average package by department',deps,[('Package (LPA)',packages)],[TEAL],10,'LPA')
# line trend
im,d=canvas('Placements increased steadily, 2021–2026'); L,R,T,B=110,1140,85,350; years=[2021,2022,2023,2024,2025,2026]; vals=[310,345,382,410,438,487]; d.line((L,T,L,B),fill=GREY,width=2); d.line((L,B,R,B),fill=GREY,width=2)
for tick in range(300,501,50):
 y=B-(tick-280)/(510-280)*(B-T); d.line((L,y,R,y),fill=GRID); text(d,(68,y),tick,SMALL,GREY)
pts=[]
for i,(yr,v) in enumerate(zip(years,vals)):
 x=L+i*(R-L)/(len(years)-1); y=B-(v-280)/(510-280)*(B-T); pts.append((x,y)); text(d,(x,y-23),v,SMALL,NAVY); text(d,(x,B+22),yr,SMALL,NAVY)
d.line(pts,fill=BLUE,width=5)
for x,y in pts: d.ellipse((x-7,y-7,x+7,y+7),fill=TEAL,outline=WHITE,width=2)
text(d,(L,64),'Students placed',SMALL,GREY,'lm'); save(im,'04_year_trend.png')
# scatter
im,d=canvas('Project effort and marks'); hours=[22,28,35,40,46,52,30,58]; marks=[62,68,72,78,82,86,65,91]; L,R,T,B=100,1140,85,350
d.line((L,T,L,B),fill=GREY,width=2); d.line((L,B,R,B),fill=GREY,width=2)
for tick in range(20,61,10):
 x=L+(tick-18)/(62-18)*(R-L); d.line((x,T,x,B),fill=GRID); text(d,(x,B+23),tick,SMALL,GREY)
for tick in range(60,96,5):
 y=B-(tick-58)/(95-58)*(B-T); d.line((L,y,R,y),fill=GRID); text(d,(65,y),tick,SMALL,GREY)
for i,(h,m) in enumerate(zip(hours,marks)):
 x=L+(h-18)/(62-18)*(R-L); y=B-(m-58)/(95-58)*(B-T); d.ellipse((x-8,y-8,x+8,y+8),fill=TEAL,outline=WHITE,width=2); text(d,(x+15,y-13),chr(65+i),SMALL,NAVY)
text(d,(L,64),'Marks',SMALL,GREY,'lm')
# trend line from endpoints of simple linear regression
mh=sum(hours)/len(hours); mm=sum(marks)/len(marks); slope=sum((h-mh)*(v-mm) for h,v in zip(hours,marks))/sum((h-mh)**2 for h in hours); intercept=mm-slope*mh
p1=(L+(20-18)/44*(R-L),B-((slope*20+intercept)-58)/37*(B-T)); p2=(L+(60-18)/44*(R-L),B-((slope*60+intercept)-58)/37*(B-T)); d.line((p1,p2),fill=BLUE,width=3)
text(d,(600,410),'Project hours',REG,NAVY); save(im,'05_effort_marks.png')
# boxplot
scores=[45,52,55,58,61,63,65,67,70,72,74,78,82,90,96]; im,d=canvas('Distribution of programming test scores'); L,R=130,1130; y=240; lo,hi=35,102
x=lambda v:L+(v-lo)/(hi-lo)*(R-L)
for tick in range(40,101,10): d.line((x(tick),105,x(tick),345),fill=GRID); text(d,(x(tick),365),tick,SMALL,GREY)
# median-of-halves quartiles Q1=58, median=67, Q3=78
for a,b in [(x(45),x(58)),(x(78),x(96))]: d.line((a,y,b,y),fill=GREY,width=4)
for v in [45,96]: d.line((x(v),y-22,x(v),y+22),fill=GREY,width=3)
d.rectangle((x(58),y-48,x(78),y+48),fill='#B8D8E8',outline=BLUE,width=3); d.line((x(67),y-48,x(67),y+48),fill=NAVY,width=5); d.polygon([(x(68),y-8),(x(68)+8,y),(x(68),y+8),(x(68)-8,y)],fill=GOLD)
text(d,(600,415),'Score',REG,NAVY); save(im,'06_score_boxplot.png')
# heat map
cpu=[[42,51,38],[60,68,55],[78,82,74],[71,76,69],[55,62,58]]; im,d=canvas('CPU usage by hour and server (%)'); x0,y0=300,100; cw,ch=210,53; labels=['Server A','Server B','Server C']; times=['9 AM','11 AM','1 PM','3 PM','5 PM']
for j,l in enumerate(labels): text(d,(x0+j*cw+cw/2,78),l,REG,NAVY)
def heat(v):
 t=(v-35)/55; a=(255,247,188); b=(8,81,156); return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
for i,row in enumerate(cpu):
 text(d,(225,y0+i*ch+ch/2),times[i],REG,NAVY,'rm')
 for j,v in enumerate(row):
  x1=x0+j*cw; y1=y0+i*ch; d.rectangle((x1,y1,x1+cw-2,y1+ch-2),fill=heat(v)); text(d,(x1+cw/2,y1+ch/2),f'{v}%',MED,WHITE if v>69 else NAVY)
# calibrated color legend
for k,v in enumerate(range(35,91,5)): d.rectangle((x0+k*14,390,x0+k*14+14,408),fill=heat(v))
for v in [35,55,75,90]: text(d,(x0+(v-35)/55*14*11,430),v,SMALL,GREY)
text(d,(x0+405,420),'CPU usage (%)',SMALL,GREY); save(im,'07_cpu_heatmap.png')

# document
doc=Document(); sec=doc.sections[0]; sec.top_margin=Inches(.52); sec.bottom_margin=Inches(.52); sec.left_margin=Inches(.68); sec.right_margin=Inches(.68)
styles=doc.styles
normal=styles['Normal']; normal.font.name='Times New Roman'; normal.font.size=Pt(10); normal.font.color.rgb=RGBColor(0,0,0); normal.paragraph_format.space_after=Pt(4); normal.paragraph_format.line_spacing=1.08
for nm,size in [('Title',19),('Heading 1',14),('Heading 2',11)]:
 s=styles[nm]; s.font.name='Times New Roman'; s.font.size=Pt(size); s.font.bold=True; s.font.color.rgb=RGBColor(0,0,0); s.paragraph_format.space_before=Pt(5); s.paragraph_format.space_after=Pt(4)
def shade(cell,fill):
 tcPr=cell._tc.get_or_add_tcPr(); shd=OxmlElement('w:shd'); shd.set(qn('w:fill'),fill); tcPr.append(shd)
def p(text='',style=None,boldlead=None):
 para=doc.add_paragraph(style=style)
 if boldlead and text.startswith(boldlead): para.add_run(boldlead).bold=True; para.add_run(text[len(boldlead):])
 else: para.add_run(text)
 return para
def fig(name,alt,width=6.7):
 para=doc.add_paragraph(); para.alignment=WD_ALIGN_PARAGRAPH.CENTER; para.paragraph_format.space_after=Pt(1); para.add_run().add_picture(str(CHARTS/name),width=Inches(width)); para._p.get_or_add_pPr().append(OxmlElement('w:keepNext'))
def interp(text):
 para=doc.add_paragraph(); para.paragraph_format.space_after=Pt(5); r=para.add_run('Interpretation. '); r.bold=True; r.font.color.rgb=RGBColor(23,50,77); para.add_run(text)
def page(): doc.add_page_break()
# Page 1
para=doc.add_paragraph(style='Title'); para.alignment=WD_ALIGN_PARAGRAPH.CENTER; para.add_run('Engineering Data Visualization')
para=doc.add_paragraph(); para.alignment=WD_ALIGN_PARAGRAPH.CENTER; para.add_run('Placement Statistics and Examples of Engineering Data').italic=True
para=doc.add_paragraph(); para.alignment=WD_ALIGN_PARAGRAPH.CENTER; para.add_run('Name: ____________________    Roll number: ____________________    Course/section: ____________________')
p('This assignment uses the figures given in the question to make and interpret common charts. The examples cover college placements, student scores, and server CPU use.')
p('Part A  |  Concepts', 'Heading 1')
p('1. Data visualization. Data visualization presents information in a visual form so that comparisons and patterns are easier to see. For example, a college can compare eligible and placed students in each department to see where additional placement support may be useful.')
p('2. Data types', 'Heading 2')
t=doc.add_table(rows=1,cols=3); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
for c,wid in zip(t.columns,[1.45,1.65,3.75]): c.width=Inches(wid)
for c,txt in zip(t.rows[0].cells,['Type','Meaning','Engineering example']): c.text=txt; shade(c,'17324D')
for c in t.rows[0].cells:
 for r in c.paragraphs[0].runs: r.font.bold=True; r.font.color.rgb=RGBColor(255,255,255); r.font.size=Pt(8)
t.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
for vals in [('Nominal','Named categories without rank','Material type: steel, aluminium, polymer'),('Ordinal','Categories with an order','Surface finish rating: poor, fair, good'),('Discrete numerical','Countable whole-number values','Number of defects on a machined part'),('Continuous numerical','Measured values on a scale','Shaft diameter in millimetres'),('Time-series','Values recorded in time order','Hourly vibration readings from a motor')]:
 cells=t.add_row().cells
 for i,(c,txt) in enumerate(zip(cells,vals)): c.text=txt; c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER; c.width=Inches([1.45,1.65,3.75][i]);
 for c in cells:
  for pp in c.paragraphs:
   pp.paragraph_format.space_after=Pt(1)
   for r in pp.runs: r.font.size=Pt(8)
p('3. Three principles of effective visualization','Heading 2')
p('A chart should answer a clear question and have a title that says what is being compared. Axes need readable labels, units, and an honest scale; bar charts should normally start at zero. Colours should be easy to distinguish and used consistently. Extra effects and decorations can distract from the data.')
p('4. Two visual elements','Heading 2')
p('Position makes it easy to compare values against the same scale, as in a bar chart. Length also communicates size: a longer bar means a larger value, which is why the bars should share a zero baseline. Colour can help distinguish groups, but labels should still make the chart understandable.')
# Page 2
page(); p('Part B  |  Placement comparisons','Heading 1')
p('The bars compare the number of eligible students with the number who were placed in each department.')
fig('01_grouped_bars.png','Grouped bars'); interp('CSE has the highest counts, with 180 eligible students and 156 placed. Civil has the lowest, with 100 eligible and 52 placed. EEE has the biggest difference between eligible and placed students (42). These totals do not show why the remaining students were not placed.')
fig('02_placed_share.png','Pie chart'); interp('CSE accounts for about 32% of all placements, while Civil accounts for about 11%. One drawback of the pie chart is that slices of similar size are hard to compare accurately.')
# Page3
page(); p('Part B  |  Packages and annual trend','Heading 1')
p('3. Average package by department','Heading 2'); fig('03_package.png','Average packages'); interp('CSE has the highest average package at 8.6 LPA. Civil has the lowest at 4.6 LPA.')
p('4. Placements over six years','Heading 2'); fig('04_year_trend.png','Annual line chart'); interp('The number of placements goes up each year, from 310 in 2021 to 487 in 2026. That is 177 more placements over the six years. The largest year-to-year increase is from 2025 to 2026.')
# Page4
page(); p('Part B  |  Student performance','Heading 1')
p('5. Project hours and marks','Heading 2'); fig('05_effort_marks.png','Scatter plot'); interp('In these eight examples, students who spent more hours on their projects generally earned higher marks. This pattern shows an association; it does not prove that extra hours alone caused the higher marks.')
p('Part C  |  Distribution','Heading 1'); p('1. Programming test scores','Heading 2'); fig('06_score_boxplot.png','Box plot'); interp('The median is 67, and the middle half of the scores runs from 58 to 78. No score falls beyond the whiskers, so this box plot shows no outliers.')
# Page5
page(); p('Part C  |  Monitoring and hierarchy','Heading 1')
p('2. Server CPU heat map','Heading 2'); fig('07_cpu_heatmap.png','CPU heatmap'); interp('Server B reaches the highest value at 1 PM, with 82% CPU usage. All three servers are busiest at 1 PM, then their usage falls later in the day.')
p('3. Budget hierarchy','Heading 2'); p('A tree map uses nested rectangles to show each domain and its sub-projects. The area of each rectangle can represent the budget, so viewers can see both the parts within a domain and how the domains compare. Labels and a budget scale should be included.')
p('Part D  |  Choosing a chart','Heading 1')
for title,body in [('1. Attendance percentage for five departments — Bar chart.','Bars support direct comparison among a small set of categories; use a 0–100% scale.'),('2. Monthly campus electricity over two years — Line chart.','A month-by-month line shows change over time and makes seasonal patterns and year-to-year movement visible.'),('3. Distribution and possible outliers in CGPA — Box plot.','The median, middle 50%, spread, and potential outliers appear together; a dot plot or histogram can add detail if needed.'),('4. Daily screen time and sleep duration — Scatter plot.','One point per student shows direction, strength, clusters, and unusual pairs across two numerical measures.')]:
 para=doc.add_paragraph(); para.paragraph_format.space_after=Pt(3); rr=para.add_run(title+' '); rr.bold=True; para.add_run(body)
p('Software and materials','Heading 2'); p('The figures were drawn in Python with Pillow in a style similar to the plots commonly made in Google Colab. The report was prepared with python-docx. The two CSV files include the values used for the charts, and the Python source file can regenerate the report and figures.')
# footer page number
for s in doc.sections:
 f=s.footer.paragraphs[0]; f.alignment=WD_ALIGN_PARAGRAPH.CENTER
 fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); f._p.append(fld)
doc.core_properties.title='Engineering Data Visualization Report'; doc.core_properties.subject='Placement statistics and engineering visualization assignment'
doc.save(OUT)
print(f'Created {OUT}')
