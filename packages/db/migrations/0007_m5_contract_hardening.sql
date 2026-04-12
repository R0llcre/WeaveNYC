DO $$
BEGIN
  ALTER TABLE community_rulesets
    ADD CONSTRAINT chk_community_rulesets_review_categories_valid
    CHECK (review_categories <@ ARRAY['food', 'goods', 'childcare', 'companionship', 'translation', 'transportation', 'other']::text[]);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE community_rulesets
    ADD CONSTRAINT chk_community_rulesets_language_preferences_valid
    CHECK (language_preferences <@ ARRAY['en', 'es', 'zh']::text[]);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE community_rulesets
    ADD CONSTRAINT chk_community_rulesets_auto_hide_report_threshold
    CHECK (auto_hide_report_threshold BETWEEN 1 AND 20);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
