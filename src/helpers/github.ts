export type GitHubShorthand = {
  owner: string;
  repo: string;
};

export function parseGitHubShorthand(input: string): GitHubShorthand | null {
  const githubShorthandPattern = /^([a-zA-Z0-9][\w.-]*?)\/([a-zA-Z0-9][\w.-]*?)$/;
  const match = input.match(githubShorthandPattern);

  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

export async function getGitProtocolPreference(): Promise<'https' | 'ssh'> {
  try {
    const result = Bun.spawnSync(['git', 'config', '--global', '--get', 'url.ssh://git@github.com/.insteadOf']);

    if (result.success && result.stdout) {
      const output = result.stdout.toString().trim();
      if (output === 'https://github.com/') {
        return 'ssh';
      }
    }

    const sshResult = Bun.spawnSync(['git', 'config', '--global', '--get', 'url.https://github.com/.insteadOf']);

    if (sshResult.success && sshResult.stdout) {
      const output = sshResult.stdout.toString().trim();
      if (output.includes('ssh://git@github.com/') || output.includes('git@github.com:')) {
        return 'https';
      }
    }

    return 'https';
  } catch {
    return 'https';
  }
}

export async function expandGitHubShorthand(
  shorthand: GitHubShorthand,
  preferredProtocol?: 'https' | 'ssh',
): Promise<string> {
  const protocol = preferredProtocol || (await getGitProtocolPreference());

  if (protocol === 'ssh') {
    return `git@github.com:${shorthand.owner}/${shorthand.repo}.git`;
  }

  return `https://github.com/${shorthand.owner}/${shorthand.repo}.git`;
}

export function isGitHubShorthand(input: string): boolean {
  if (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('git@') ||
    input.startsWith('/') ||
    input.startsWith('./') ||
    input.startsWith('../')
  ) {
    return false;
  }

  return parseGitHubShorthand(input) !== null;
}
