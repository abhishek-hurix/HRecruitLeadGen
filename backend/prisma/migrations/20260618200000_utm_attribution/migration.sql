-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE');

-- CreateTable visitors
CREATE TABLE "visitors" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "first_touch_source" TEXT NOT NULL DEFAULT 'ORGANIC',
    "first_touch_medium" TEXT,
    "first_touch_campaign" TEXT,
    "first_touch_term" TEXT,
    "first_touch_content" TEXT,
    "last_touch_source" TEXT NOT NULL DEFAULT 'ORGANIC',
    "last_touch_medium" TEXT,
    "last_touch_campaign" TEXT,
    "last_touch_term" TEXT,
    "last_touch_content" TEXT,
    "landing_page" TEXT NOT NULL,
    "referrer" TEXT,
    "device_type" "DeviceType" NOT NULL DEFAULT 'DESKTOP',
    "first_visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_visited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "candidate_id" TEXT,
    "registered_at" TIMESTAMP(3),

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visitors_visitor_id_key" ON "visitors"("visitor_id");
CREATE UNIQUE INDEX "visitors_candidate_id_key" ON "visitors"("candidate_id");
CREATE INDEX "visitors_first_touch_source_idx" ON "visitors"("first_touch_source");
CREATE INDEX "visitors_last_touch_source_idx" ON "visitors"("last_touch_source");
CREATE INDEX "visitors_last_touch_campaign_idx" ON "visitors"("last_touch_campaign");
CREATE INDEX "visitors_device_type_idx" ON "visitors"("device_type");
CREATE INDEX "visitors_first_visited_at_idx" ON "visitors"("first_visited_at");

-- AlterTable candidate_profiles
ALTER TABLE "candidate_profiles" ADD COLUMN "visitor_id" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "utm_source" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "utm_medium" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "utm_campaign" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "utm_term" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "utm_content" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "first_touch_source" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "last_touch_source" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "attribution_landing_page" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "attribution_referrer" TEXT;
ALTER TABLE "candidate_profiles" ADD COLUMN "attribution_device" "DeviceType";

CREATE UNIQUE INDEX "candidate_profiles_visitor_id_key" ON "candidate_profiles"("visitor_id");

ALTER TABLE "visitors" ADD CONSTRAINT "visitors_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
