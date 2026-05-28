-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reimbursement_claims (
  id           text PRIMARY KEY,
  claim_number text NOT NULL,
  employee     jsonb NOT NULL DEFAULT '{}',
  items        jsonb NOT NULL DEFAULT '[]',
  updated_at   bigint
);

CREATE TABLE IF NOT EXISTS mileage_claims (
  id           text PRIMARY KEY,
  claim_number text NOT NULL,
  employee     jsonb NOT NULL DEFAULT '{}',
  rows         jsonb NOT NULL DEFAULT '[]',
  currency     text,
  updated_at   bigint
);

CREATE TABLE IF NOT EXISTS benefit_claims (
  id           text PRIMARY KEY,
  claim_number text NOT NULL,
  employee     jsonb NOT NULL DEFAULT '{}',
  items        jsonb NOT NULL DEFAULT '[]',
  updated_at   bigint
);

CREATE TABLE IF NOT EXISTS medical_legacy (
  id             text PRIMARY KEY,
  employee_name  text NOT NULL,
  date           text NOT NULL,
  clinic_name    text,
  total_amount   numeric,
  claimed_amount numeric NOT NULL DEFAULT 0,
  created_at     bigint
);

CREATE TABLE IF NOT EXISTS paid_claims (
  kind       text NOT NULL,
  claim_id   text NOT NULL,
  paid_at    text NOT NULL,
  updated_at bigint,
  PRIMARY KEY (kind, claim_id)
);

-- ── Enable Realtime ───────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE reimbursement_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE mileage_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE benefit_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE medical_legacy;
ALTER PUBLICATION supabase_realtime ADD TABLE paid_claims;

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE reimbursement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE mileage_claims       ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_claims       ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_legacy       ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_claims          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON reimbursement_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON mileage_claims       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON benefit_claims       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON medical_legacy       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON paid_claims          FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Storage Buckets ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('benefit-receipts', 'benefit-receipts', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "auth_all" ON storage.objects
FOR ALL TO authenticated USING (true) WITH CHECK (true);
