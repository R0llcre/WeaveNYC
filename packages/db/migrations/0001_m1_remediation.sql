ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_hash_salt varchar(64),
  ADD COLUMN IF NOT EXISTS email_hash_salt varchar(64);

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'resource_providers'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%dataset_version%'
  LOOP
    EXECUTE format(
      'ALTER TABLE resource_providers DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'resource_change_logs'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%dataset_version%'
  LOOP
    EXECUTE format(
      'ALTER TABLE resource_change_logs DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

DROP INDEX IF EXISTS uq_dataset_versions_dataset_version;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_versions_source_version
  ON dataset_versions (source, dataset_version);

ALTER TABLE resource_providers
  ADD CONSTRAINT fk_resource_providers_source_dataset_version
  FOREIGN KEY (source, dataset_version)
  REFERENCES dataset_versions (source, dataset_version);

ALTER TABLE resource_change_logs
  ADD CONSTRAINT fk_resource_change_logs_source_dataset_version
  FOREIGN KEY (source, dataset_version)
  REFERENCES dataset_versions (source, dataset_version);
