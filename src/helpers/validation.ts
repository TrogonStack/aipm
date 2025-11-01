import { ZodError } from 'zod';

export function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
    return `${path}: ${issue.message}`;
  });

  return issues.join('\n');
}
