import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = '/Users/initia-army/Documents/juristic-platform';
const skill = '/Users/initia-army/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const result = await finalizePresentation({
  workspaceDir: root,
  candidatePath: path.join(root, 'tmp/block-diagram-phases-20261017/candidate.pptx'),
  finalPath: path.join(root, 'output/presentations/block-diagram-phases-20261017/block-diagram-phase-1-and-2.pptx'),
  pythonExecutable: '/Users/initia-army/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '18288000,10287000', '--validate-bullet-geometry', '--validate-heading-fit'],
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: 'design', families: ['Thonburi'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(root, 'tmp/block-diagram-phases-20261017/validation.json'),
});
console.log(JSON.stringify(result, null, 2));
