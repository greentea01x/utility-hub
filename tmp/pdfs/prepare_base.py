import logging
from pathlib import Path
from pypdf import PdfReader,PdfWriter
logging.getLogger('pypdf').setLevel(logging.ERROR)
r=PdfReader('/Users/initia-army/Documents/Le parc next/Version0.1.pdf');w=PdfWriter()
for i,p in enumerate(r.pages):
 c=p.get_contents();depth=0;starts=[]
 for j,(a,o) in enumerate(c.operations):
  if o==b'q':
   if depth==0:starts.append(j)
   depth+=1
  elif o==b'Q':depth-=1
 if len(starts)==3:
  if i+1 in [14,19,24]:
   a=starts[2]; end=a+1
   while c.operations[end][1]!=b'Do':end+=1
   assert c.operations[end+1][1]==b'Q'
   c.operations=c.operations[:end+2]+[([],b'Q')]
  else:c.operations=c.operations[:starts[2]]
  p.replace_contents(c)
 w.add_page(p)
with open('tmp/pdfs/clean_base.pdf','wb') as f:w.write(f)
print('clean base',len(w.pages))
