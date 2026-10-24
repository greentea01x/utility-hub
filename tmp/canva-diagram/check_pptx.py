from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import json

base=Path('/Users/initia-army/Documents/juristic-platform/docs/diagrams')
source=ET.parse(base/'block-diagram-semester-scope.svg').getroot()
expected=[''.join(n.itertext()) for n in source.findall('{http://www.w3.org/2000/svg}text')]
path=base/'block-diagram-semester-scope.pptx'
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with ZipFile(path) as z:
 slides=sorted(n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml'))
 roots=[ET.fromstring(z.read(n)) for n in slides]
 texts=[''.join(n.itertext()) for root in roots for n in root.findall('.//a:t',ns)]
 paragraphs=[''.join(n.itertext()) for root in roots for n in root.findall('.//a:p',ns)]
 all_text='\n'.join(texts)
 missing=[t for t in expected if t not in all_text and t not in paragraphs]
 summary={
  'slides':len(slides),'source_text_labels':len(expected),'missing_labels':missing,
  'native_shapes':sum(len(root.findall('.//p:sp',ns)) for root in roots),
  'native_connectors':sum(len(root.findall('.//p:cxnSp',ns)) for root in roots),
  'picture_shapes':sum(len(root.findall('.//p:pic',ns)) for root in roots),
  'pptx_bytes':path.stat().st_size,
 }
 print(json.dumps(summary,ensure_ascii=False,indent=2))
 if len(slides)!=1 or missing: raise SystemExit(1)
