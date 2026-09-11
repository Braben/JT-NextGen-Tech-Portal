ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" TEXT DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "education_level" TEXT DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "computing_experience" TEXT DEFAULT '';

ALTER TABLE "onboarding_assessments" ALTER COLUMN "status" SET DEFAULT 'recommended';
