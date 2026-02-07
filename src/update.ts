export interface UpdateInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
}

/**
 * Check the npm registry for a newer version of a package.
 * Returns null if the check fails (no internet, timeout, etc).
 */
export async function checkForUpdate(
  packageName: string,
  currentVersion: string,
  timeoutMs = 3000,
): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as { version?: string };
    const latest = data.version;
    if (!latest) return null;

    return {
      current: currentVersion,
      latest,
      updateAvailable: isNewer(latest, currentVersion),
    };
  } catch {
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}
