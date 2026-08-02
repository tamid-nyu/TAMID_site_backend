CREATE TABLE IF NOT EXISTS "public"."site_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."site_config" OWNER TO "postgres";

ALTER TABLE ONLY "public"."site_config"
    ADD CONSTRAINT "site_config_pkey" PRIMARY KEY ("key");

CREATE POLICY "Public read access" ON "public"."site_config" FOR SELECT USING (true);

ALTER TABLE "public"."site_config" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."site_config" TO "anon";
GRANT ALL ON TABLE "public"."site_config" TO "authenticated";
GRANT ALL ON TABLE "public"."site_config" TO "service_role";
