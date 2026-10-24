import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const base='/Users/initia-army/Documents/juristic-platform';
const skill='/Users/initia-army/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({
 workspaceDir:base,
 candidatePath:path.join(base,'tmp/pptx-diagram/candidate.pptx'),
 finalPath:path.join(base,'docs/diagrams/block-diagram-semester-scope.pptx'),
 pythonExecutable:'/Users/initia-army/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-bullet-geometry','--validate-heading-fit'],
 explicitTotalSlideCount:1,
 requiredNativeTableOwnerSlides:[],
 requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'design',families:['Arial','Thonburi']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(base,'tmp/pptx-diagram/validation.json'),
});
console.log(JSON.stringify(result,null,2));
