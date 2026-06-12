const DEFAULT_ADMIN_PASSWORD = '8888';

export function getAdminPassword(): string {
  return String(import.meta.env.VITE_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);
}

export function isAdminPassword(input: string): boolean {
  return input === getAdminPassword();
}

export function confirmAdminPassword(actionLabel: string): boolean {
  const input = window.prompt(`Admin password required to ${actionLabel}:`);

  if (input === null) return false;
  if (!isAdminPassword(input)) {
    alert('Incorrect admin password.');
    return false;
  }

  return true;
}
