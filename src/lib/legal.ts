// Terms of Use and Privacy Notice shown at /terms and /privacy and linked from
// the footer. Source draft: Claude Docs "Audit Portal Terms of Use and Privacy
// Notice". Bracketed values in LEGAL are placeholders that must be filled
// before this ships to prod; bump LEGAL.version whenever the text changes.

export const LEGAL = {
  version: '1.0',
  effectiveDate: '[EFFECTIVE DATE]',
  companyName: 'Carpa Tech FZE',
  address: '[ADDRESS]',
  licenceNo: '[LICENCE NO.]',
  contactEmail: '[CONTACT EMAIL]',
  liabilityCap: '[LIABILITY CAP]',
  retentionPeriod: '[RETENTION PERIOD]',
  hostingRegion: 'the Australia East region (New South Wales, Australia)',
  backupRegion: 'Australia Southeast (Victoria, Australia)',
  governingLaw: 'the United Arab Emirates as applied in the Emirate of Dubai',
  courts: 'Dubai',
} as const;

export type LegalBlock =
  | string
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  sections: LegalSection[];
}

const L = LEGAL;

export const TERMS: LegalDocument = {
  title: 'Terms of Use',
  sections: [
    {
      heading: '1. Acceptance',
      blocks: [
        `These Terms govern your use of the audit portal (the "Portal") operated by ${L.companyName}, ${L.address}, licence ${L.licenceNo} ("CarpaTech", "we"). By signing in to or using the Portal you agree to these Terms and to the Privacy Notice in full. If you do not agree, do not use the Portal. If you use the Portal for an organisation, you confirm you are authorised to accept these Terms for it.`,
      ],
    },
    {
      heading: '2. Purpose and access',
      blocks: [
        `The Portal exists to run audit and assurance engagements: requesting, uploading, reviewing and tracking evidence. Access is by invitation only and is limited to the engagements you are a member of. You must keep your sign-in credentials secure, must not share your account, and must tell us at ${L.contactEmail} if you suspect unauthorised access. We may suspend or remove access at any time, including when an engagement ends.`,
      ],
    },
    {
      heading: '3. Acceptable use',
      blocks: [
        "You must not: upload malware or unlawful material; try to access engagements, data or systems you are not authorised for; probe, scan or test the Portal's security without our written permission; disrupt or overload the Portal; or copy, resell or reverse engineer it.",
      ],
    },
    {
      heading: '4. Your content',
      blocks: [
        'You or your organisation keep ownership of the documents and information you upload ("Client Content"). You grant CarpaTech the right to store, process and review Client Content to deliver the engagement. You confirm you have the right to share it with us, including any personal data in it, and that sharing it does not breach any law or obligation you owe to others. You are responsible for the accuracy and completeness of Client Content.',
      ],
    },
    {
      heading: '5. Confidentiality',
      blocks: [
        'We treat Client Content as confidential and use it only for the engagement, subject to any signed engagement letter. You must treat audit requests, findings and reports you see in the Portal as confidential and use them only for the engagement.',
      ],
    },
    {
      heading: '6. Hosting location',
      blocks: [
        `The Portal and its data are currently hosted on Microsoft Azure in ${L.hostingRegion}, with database backups also copied to ${L.backupRegion}. CarpaTech may move hosting, in whole or in part, to another region or provider at any time, including where the current location becomes unavailable, unlawful, unsuitable or no longer viable. This applies notwithstanding any earlier statement, proposal or correspondence about hosting location.`,
        'Where a signed engagement letter or data processing agreement expressly fixes a hosting location, we will follow it or agree a change with you in writing. We will give reasonable advance notice of any move of personal data to another country, except where a move is urgent for legal or security reasons, in which case we will notify you as soon as practicable. Any transfer will use the safeguards required by applicable data protection law.',
      ],
    },
    {
      heading: '7. Availability',
      blocks: [
        'The Portal is provided "as is" and "as available". We do not guarantee it will be uninterrupted, error free or available at any particular time. Keep your own copies of anything you upload.',
      ],
    },
    {
      heading: '8. Limitation of liability',
      blocks: [
        'To the fullest extent permitted by law:',
        {
          list: [
            'CarpaTech is not liable for any indirect, incidental, special or consequential loss, or for loss of profit, revenue, business, goodwill or data, however caused.',
            'CarpaTech is not liable for loss arising from Client Content, from your breach of these Terms, from unauthorised use of your account, or from outages or failures of third-party services, including Microsoft Azure and Microsoft Entra ID.',
            `CarpaTech's total liability arising from or in connection with the Portal, in contract, tort or otherwise, is limited to ${L.liabilityCap}.`,
          ],
        },
        'Nothing in these Terms limits liability that cannot be limited by law, including for fraud or gross negligence.',
      ],
    },
    {
      heading: '9. Indemnity',
      blocks: [
        'You will compensate CarpaTech for losses and claims arising from Client Content you upload without the right to do so, or from your breach of section 3.',
      ],
    },
    {
      heading: '10. Signed agreements',
      blocks: [
        'If these Terms conflict with a signed engagement letter between CarpaTech and your organisation, the engagement letter prevails for that conflict only.',
      ],
    },
    {
      heading: '11. Changes',
      blocks: [
        'We may update these Terms. We will show the new version in the Portal, and continuing to use the Portal after that means you accept it. Material changes will be notified at sign-in.',
      ],
    },
    {
      heading: '12. Governing law',
      blocks: [
        `These Terms are governed by the laws of ${L.governingLaw}, and the courts of ${L.courts} have exclusive jurisdiction.`,
      ],
    },
    {
      heading: '13. Contact',
      blocks: [L.contactEmail],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy Notice',
  sections: [
    {
      heading: '1. Who we are',
      blocks: [
        `${L.companyName} ("CarpaTech") operates the audit portal. For your account and usage data, CarpaTech decides how the data is used. For personal data inside documents your organisation uploads, your organisation decides, and CarpaTech processes it on its behalf under the engagement letter.`,
      ],
    },
    {
      heading: '2. What we collect',
      blocks: [
        {
          table: {
            head: ['Data', 'Source', 'Why'],
            rows: [
              ['Name, work email, Microsoft account ID', "Your organisation's Microsoft sign-in", 'Sign you in and show who did what'],
              ['Engagement memberships and roles', 'Set by the audit team', 'Control what you can see'],
              ['Activity records (uploads, status changes, comments)', 'Your use of the Portal', 'Audit trail and security'],
              ['Uploaded documents and any personal data in them', 'You or your colleagues', 'Deliver the engagement'],
              ['Session cookies', 'Your browser', 'Keep you signed in and remember your engagement'],
            ],
          },
        },
        'We do not use advertising or analytics cookies, and we do not sell personal data.',
      ],
    },
    {
      heading: '3. Legal basis',
      blocks: [
        'We process this data to perform the engagement contract, for our legitimate interest in running a secure and auditable service, and to meet legal and professional obligations.',
      ],
    },
    {
      heading: '4. Where it is stored',
      blocks: [
        `Data is hosted on Microsoft Azure in ${L.hostingRegion}. Database backups are also copied to ${L.backupRegion}. The hosting location may change as set out in section 6 of the Terms of Use. If personal data moves to another country, we will use the safeguards that applicable law requires, such as an adequacy decision or standard contractual clauses, and give notice as described there.`,
      ],
    },
    {
      heading: '5. Who we share it with',
      blocks: [
        "Microsoft, as our hosting and sign-in provider (Azure and Entra ID). Members of the same engagement, limited by their role. Authorities or advisers where the law requires it. Nobody else without your organisation's consent.",
      ],
    },
    {
      heading: '6. How long we keep it',
      blocks: [
        `Engagement data and uploaded documents are kept for ${L.retentionPeriod} after the engagement closes, or longer if law or professional standards require, then deleted. Activity records are kept for the same period.`,
      ],
    },
    {
      heading: '7. Security',
      blocks: [
        'Each client deployment runs in its own isolated Azure environment. Data is encrypted in transit and at rest, and access is restricted to engagement members by role.',
      ],
    },
    {
      heading: '8. Your rights',
      blocks: [
        'Depending on where you are, you may ask to access, correct, delete or restrict your personal data, object to its use, or receive a copy. For data inside uploaded documents, we will pass your request to your organisation. You may also complain to your data protection authority.',
      ],
    },
    {
      heading: '9. Changes',
      blocks: ['We will post updates here and notify material changes at sign-in.'],
    },
    {
      heading: '10. Contact',
      blocks: [L.contactEmail],
    },
  ],
};
