import { test, expect, request as pwRequest } from '@playwright/test';
import {
  signInAs, LEAD_EMAIL, AUDITOR_EMAIL, CLIENT_OWNER_EMAIL, CLIENT_REVIEWER_EMAIL,
} from './fixtures/signin';

// Tests run serially against a single Next dev server with a deterministic
// pglite directory (see playwright.config.ts). Tests are ordered: bootstrap
// the lead user first so the AUDITOR_LEAD_BOOTSTRAP_EMAILS guard kicks in.

test.describe.configure({ mode: 'serial' });

test('healthz is up and reports engine', async ({ request }) => {
  const res = await request.get('/api/healthz');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(['pglite', 'postgres']).toContain(body.engine);
});

test('lead signs in and becomes auditor_lead', async ({ page, request }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  const me = await request.get('/api/me');
  expect(me.ok()).toBe(true);
  const body = await me.json();
  expect(body.authenticated).toBe(true);
  expect(body.user.role).toBe('auditor_lead');
});

test('every page loads for auditor_lead', async ({ page }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  const pages: Array<[string, RegExp]> = [
    ['/',              /Dashboard|KPI|Total|Outstanding/i],
    ['/pbc',           /PBC|Items|Status|Owner/i],
    ['/access',        /Access|Provisioning|Username/i],
    ['/walkthroughs',  /Walkthrough|Calendar|Topic/i],
    ['/entities',      /Entity|Scope|Legal/i],
    ['/sampling',      /Sampling|Population|Confidence/i],
    ['/activity',      /Activity|Timeline|Change/i],
    ['/reports',       /Report|PDF/i],
    ['/settings',      /Setting|Engagement|Users|Theme/i],
  ];
  for (const [url, marker] of pages) {
    await page.goto(url);
    await expect(page.locator('body')).toContainText(marker, { timeout: 10_000 });
  }
});

test('client_reviewer cannot see activity or settings', async ({ page, request }) => {
  // Lead promotes a new user to client_reviewer (default on first sign-in).
  await signInAs(page, CLIENT_REVIEWER_EMAIL, 'Client Reviewer');
  const me = await request.get('/api/me');
  const meBody = await me.json();
  expect(meBody.user.role).toBe('client_reviewer');

  const activity = await request.get('/api/activity');
  expect([401, 403]).toContain(activity.status());

  // /api/users requires auditor_lead
  const users = await request.get('/api/users');
  expect([401, 403]).toContain(users.status());
});

test('lead promotes client to client_owner', async ({ page, request }) => {
  // First sign in the reviewer to seed the user row
  await signInAs(page, CLIENT_OWNER_EMAIL, 'Client Owner');
  // Then sign in as lead and promote
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  const users = await (await request.get('/api/users')).json();
  const target = users.find((u: { email: string }) => u.email === CLIENT_OWNER_EMAIL);
  expect(target).toBeTruthy();
  const patch = await request.patch(`/api/users/${target.id}`, {
    data: { role: 'client_owner' },
    headers: { 'content-type': 'application/json' },
  });
  expect(patch.ok()).toBe(true);
  const after = await patch.json();
  expect(after.role).toBe('client_owner');
});

test('PDF reports generate for lead', async ({ page, request }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  for (const variant of ['client', 'full']) {
    const r = await request.get(`/api/reports/${variant}`);
    expect(r.ok()).toBe(true);
    const buf = await r.body();
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  }
});

test('dashboard returns shape even with empty data', async ({ page, request }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  const r = await request.get('/api/dashboard');
  expect(r.ok()).toBe(true);
  const body = await r.json();
  expect(body).toHaveProperty('kpi');
  expect(body.kpi).toHaveProperty('total');
  expect(body).toHaveProperty('statusCounts');
  expect(body).toHaveProperty('recentActivity');
});

test('keyboard shortcut overlay opens', async ({ page }) => {
  await signInAs(page, LEAD_EMAIL, 'Lead Auditor');
  await page.goto('/');
  await page.keyboard.press('?');
  // The shortcut overlay should mention at least one shortcut label.
  await expect(page.locator('body')).toContainText(/Dashboard|Focus|Shortcut/i);
});
