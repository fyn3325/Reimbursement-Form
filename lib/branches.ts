export const DEFAULT_BRANCHES = ['HQ', 'PBJ', 'MVJB', 'IOI'];

const CUSTOM_BRANCHES_KEY = 'auditlink_custom_branches';

function safeParseBranches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((branch) => String(branch ?? '').trim())
      .filter((branch) => branch.length > 0);
  } catch {
    return [];
  }
}

function dedupeBranches(branches: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const branch of branches) {
    const key = branch.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(branch);
  }

  return result;
}

export function loadBranches(extraBranch = ''): string[] {
  const savedBranches =
    typeof localStorage === 'undefined'
      ? []
      : safeParseBranches(localStorage.getItem(CUSTOM_BRANCHES_KEY));

  return dedupeBranches([...DEFAULT_BRANCHES, ...savedBranches, extraBranch.trim()]);
}

export function addCustomBranch(branch: string): string {
  const trimmed = branch.trim();
  if (!trimmed || typeof localStorage === 'undefined') return trimmed;

  const customBranches = safeParseBranches(localStorage.getItem(CUSTOM_BRANCHES_KEY));
  const nextBranches = dedupeBranches([...customBranches, trimmed]);
  localStorage.setItem(CUSTOM_BRANCHES_KEY, JSON.stringify(nextBranches));
  window.dispatchEvent(new Event('auditlink:branches-updated'));

  return trimmed;
}
