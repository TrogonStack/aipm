#!/usr/bin/env bun

import { $ } from 'bun';
import pkg from '../package.json';

type BuildTarget = {
  os: 'windows' | 'linux' | 'darwin';
  arch: 'x64' | 'arm64';
  bunTarget: 'bun-windows-x64' | 'bun-linux-arm64' | 'bun-linux-x64' | 'bun-darwin-x64' | 'bun-darwin-arm64';
};

const allTargets: BuildTarget[] = [
  { os: 'windows', arch: 'x64', bunTarget: 'bun-windows-x64' },
  { os: 'linux', arch: 'arm64', bunTarget: 'bun-linux-arm64' },
  { os: 'linux', arch: 'x64', bunTarget: 'bun-linux-x64' },
  { os: 'darwin', arch: 'x64', bunTarget: 'bun-darwin-x64' },
  { os: 'darwin', arch: 'arm64', bunTarget: 'bun-darwin-arm64' },
];

const singleFlag = process.argv.includes('--single');
const platformArg = process.argv.find((arg) => arg.startsWith('--platform='));
const platform = platformArg?.split('=')[1] as 'linux' | 'darwin' | 'windows' | undefined;

const targets = singleFlag
  ? allTargets.filter((t) => t.os === process.platform && t.arch === process.arch)
  : platform
    ? allTargets.filter((t) => t.os === platform)
    : allTargets;

console.log(`Building aipm v${pkg.version} for ${targets.length} platform(s)`);

await $`rm -rf dist`;

for (const target of targets) {
  console.log(`Building ${target.os}-${target.arch}`);
  const name = `aipm-${target.os}-${target.arch}`;
  await $`mkdir -p dist/${name}/bin`;

  const binary = target.os === 'windows' ? 'aipm.exe' : 'aipm';

  const result = await Bun.build({
    entrypoints: ['./src/cli.ts'],
    target: 'bun',
    compile: {
      target: target.bunTarget,
      outfile: `dist/${name}/bin/${binary}`,
    },
  });

  if (!result.success) {
    console.error(`Failed to build ${target.os}-${target.arch}`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log(`✓ Built ${name}/bin/${binary}`);
}
