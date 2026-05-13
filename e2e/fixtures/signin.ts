import { Page, expect } from '@playwright/test';

export const LEAD_EMAIL = 'lead@example.test';
export const AUDITOR_EMAIL = 'auditor2@example.test';
export const CLIENT_OWNER_EMAIL = 'owner@client.test';
export const CLIENT_REVIEWER_EMAIL = 'reviewer@client.test';

export async function signInAs(page: Page, email: string, name = email.split('@')[0]) {
  await page.goto('/signin');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /display name/i }).fill(name);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15_000 });
}

export async function signOut(page: Page) {
  // The app uses next-auth's /api/auth/signout endpoint.
  await page.goto('/api/auth/signout');
  await page.getByRole('button', { name: /sign out/i }).click().catch(() => undefined);
  // After signout, requests should redirect to /signin
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin/, { timeout: 10_000 });
}
