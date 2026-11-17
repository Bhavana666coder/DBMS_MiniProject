// Simulated cloud scanners. Each provider returns findings in ITS OWN native JSON shape -
// exactly why raw scan reports are stored in MongoDB (schema-flexible) and then normalised into SQL.
const POOL = [
  { title: 'Storage bucket is publicly accessible', d: 'Anonymous read access is enabled', s: 'CRITICAL', kinds: ['STORAGE'] },
  { title: 'Storage volume not encrypted',          d: 'Encryption at rest is disabled',    s: 'HIGH',     kinds: ['STORAGE', 'DATABASE', 'VM'] },
  { title: 'SSH port open to the world',            d: 'Inbound SSH allowed from 0.0.0.0/0', s: 'HIGH',     kinds: ['VM', 'NETWORK'] },
  { title: 'Audit logging disabled',                d: 'Audit logging is not enabled',      s: 'MEDIUM',   kinds: ['DATABASE', 'CONTAINER', 'STORAGE'] },
  { title: 'Outdated OS package detected',          d: 'Packages with known CVEs installed', s: 'MEDIUM',  kinds: ['VM', 'CONTAINER'] },
  { title: 'Overly permissive IAM policy',          d: 'Wildcard permissions granted',      s: 'HIGH',     kinds: ['IAM', 'FUNCTION'] },
  { title: 'Default credentials in use',            d: 'Vendor default password unchanged', s: 'CRITICAL', kinds: ['VM', 'DATABASE'] },
  { title: 'MFA not enabled for privileged user',   d: 'Privileged login without MFA',      s: 'HIGH',     kinds: ['IAM'] },
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const cap = (s) => s[0] + s.slice(1).toLowerCase();

export function simulateScan(account, resources, count = 5) {
  const findings = [];
  const used = new Set();
  for (let i = 0; i < count * 3 && findings.length < count; i++) {
    const res = pick(resources);
    const fit = POOL.filter((p) => p.kinds.includes(res.type));
    if (!fit.length) continue;
    const p = pick(fit);
    if (used.has(res.name + p.title)) continue;
    used.add(res.name + p.title);
    const id = `${account.provider.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
    if (account.provider === 'AWS')        // AWS Security Hub (ASFF-style)
      findings.push({ Id: id, ProductArn: 'arn:aws:securityhub:::product/aws/inspector', Title: p.title,
        Description: p.d, Severity: { Label: p.s }, Compliance: { Status: 'FAILED' },
        Resources: [{ Type: 'AwsResource', Id: res.name, Region: account.region }] });
    else if (account.provider === 'AZURE') // Microsoft Defender for Cloud
      findings.push({ id, name: id, properties: { displayName: p.title, description: p.d, severity: cap(p.s),
        status: { code: 'Unhealthy' }, resourceDetails: { source: 'Azure', id: `/subscriptions/x/resources/${res.name}` } } });
    else                                   // Google Security Command Center
      findings.push({ name: `organizations/1/sources/2/findings/${id}`, category: p.title, description: p.d,
        severity: p.s, state: 'ACTIVE', resourceName: `//compute.googleapis.com/${res.name}` });
  }
  return findings;
}

// Provider-specific -> common model { resource_name, title, description, severity }
export function normalize(provider, f) {
  if (provider === 'AWS')
    return { resource_name: f.Resources?.[0]?.Id, title: f.Title, description: f.Description, severity: String(f.Severity?.Label).toUpperCase() };
  if (provider === 'AZURE') {
    const p = f.properties || {};
    return { resource_name: String(p.resourceDetails?.id || '').split('/').pop(), title: p.displayName, description: p.description, severity: String(p.severity).toUpperCase() };
  }
  return { resource_name: String(f.resourceName || '').split('/').pop(), title: f.category, description: f.description, severity: String(f.severity).toUpperCase() };
}
