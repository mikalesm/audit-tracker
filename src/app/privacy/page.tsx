import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Notice · Audit Tracker' };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
