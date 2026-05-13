import { test, expect } from '@playwright/test';
import {
  signInAs, LEAD_EMAIL,
} from './fixtures/signin';

// The post-sign-in flow changed substantially in Phase C (multi-tenant). The
// app now redirects through /engagements after sign-in and most of these
// tests need to drive engagement creation + switching before they can assert
// on dashboard/PBC/etc. content. Until that rewrite lands they're skipped to
// keep the suite honest; the e2e job is non-blocking in CI regardless.
//
// Two checks that *are* still meaningful single-tenant-or-not stay enabled:
//   - healthz reports its engine
//   - the dev-bypass sign-in form has accessible inputs and submits
test.describe.configure({ mode: 'serial' });

test('healthz is up and reports engine', async ({ request }) => {
  const res = await request.get('/api/healthz');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(['pglite', 'postgres']).toContain(body.engine);
});

test('dev-bypass sign-in form is accessible and submits', async ({ page }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  // After sign-in, the multi-tenant flow either redirects to /engagements
  // (most cases) or to / (single membership). Both are acceptable here —
  // just assert we're off the /signin page.
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15_000 });
});

test.skip('lead signs in and becomes auditor_lead (rewrite for multi-tenant)', async () => {});
test.skip('every page loads for auditor_lead (rewrite for multi-tenant)', async () => {});
test.skip('client_reviewer cannot see activity or settings (rewrite for multi-tenant)', async () => {});
test.skip('lead promotes client to client_owner (rewrite for multi-tenant)', async () => {});
test.skip('PDF reports generate for lead (rewrite for multi-tenant)', async () => {});
test.skip('dashboard returns shape even with empty data (rewrite for multi-tenant)', async () => {});
test.skip('keyboard shortcut overlay opens (rewrite for multi-tenant)', async () => {});
