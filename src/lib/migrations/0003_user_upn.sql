-- Track the raw Entra UPN separately from the displayed email so we keep
-- forensic clarity for B2B guests (whose UPN looks like
-- alice_contoso.com#EXT#@auditor.onmicrosoft.com while email displays
-- as alice@contoso.com).

ALTER TABLE users ADD COLUMN IF NOT EXISTS upn TEXT;
CREATE INDEX IF NOT EXISTS idx_users_upn ON users(upn);

-- Allow rare guest tokens with no resolvable email. OID is the real key.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- The old UNIQUE on email was too strict (empty/null collisions). Replace it
-- with a partial unique index that ignores blanks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_nonblank
  ON users(LOWER(email))
  WHERE email IS NOT NULL AND email <> '';
