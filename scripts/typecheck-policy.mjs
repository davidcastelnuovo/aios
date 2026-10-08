const config = 'tsconfig.app.json';

// A multiset catches duplicate additions and equal-total replacements. Locations
// are only used for reporting, so inserting lines does not invalidate the debt.
export function diagnosticKey(diagnostic) {
  return JSON.stringify([diagnostic.file, diagnostic.code, diagnostic.message, diagnostic.source]);
}

export function snapshot(diagnostics) {
  const entries = new Map();
  for (const { file, code, message, source } of diagnostics) {
    const entry = { file, code, message, source };
    const key = diagnosticKey(entry);
    const previous = entries.get(key);
    entries.set(key, { ...entry, count: (previous?.count ?? 0) + 1 });
  }
  return [...entries.values()].sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b), 'en'));
}

export function validateBaseline(baseline) {
  if (baseline?.schemaVersion !== 1 || baseline.config !== config ||
      typeof baseline.typescriptVersion !== 'string' || !Array.isArray(baseline.diagnostics)) {
    throw new Error('Invalid TypeScript baseline metadata.');
  }
  const keys = new Set();
  for (const entry of baseline.diagnostics) {
    if (typeof entry.file !== 'string' || !entry.file.startsWith('src/') ||
        !Number.isInteger(entry.code) || typeof entry.message !== 'string' ||
        typeof entry.source !== 'string' || !Number.isSafeInteger(entry.count) || entry.count < 1 ||
        keys.has(diagnosticKey(entry))) {
      throw new Error('Invalid or duplicate TypeScript baseline diagnostic.');
    }
    keys.add(diagnosticKey(entry));
  }
  return baseline;
}

export function compareDiagnostics(current, baseline) {
  const allowed = new Map(baseline.map(entry => [diagnosticKey(entry), entry.count]));
  const added = [];
  for (const diagnostic of current) {
    const key = diagnosticKey(diagnostic);
    const remaining = allowed.get(key) ?? 0;
    if (remaining > 0) allowed.set(key, remaining - 1);
    else added.push(diagnostic);
  }
  const resolved = baseline.flatMap(entry => {
    const count = allowed.get(diagnosticKey(entry)) ?? 0;
    return count ? [{ ...entry, count }] : [];
  });
  return { added, resolved };
}

export function baselineAdditions(current, previous) {
  validateBaseline(current);
  if (!previous) return true;
  validateBaseline(previous);
  if (current.typescriptVersion !== previous.typescriptVersion) return true;
  const counts = new Map(previous.diagnostics.map(entry => [diagnosticKey(entry), entry.count]));
  return current.diagnostics.some(entry => entry.count > (counts.get(diagnosticKey(entry)) ?? 0));
}

export async function approvingMaintainer(reviews, headSha, permissionFor) {
  const latest = new Map();
  for (const review of reviews) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
      latest.set(review.user.login, review);
    }
  }
  for (const review of latest.values()) {
    if (review.state !== 'APPROVED' || review.commit_id !== headSha) continue;
    let permission;
    try { permission = await permissionFor(review.user.login); }
    catch (error) {
      if (error.status !== 404) throw error;
      continue;
    }
    if (['admin', 'maintain', 'write'].includes(permission)) return review.user.login;
  }
  return null;
}

