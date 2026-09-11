CREATE TABLE "onboarding_assessments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "date_of_birth" TEXT DEFAULT '',
    "gender" TEXT DEFAULT '',
    "education_level" TEXT DEFAULT '',
    "computing_experience" TEXT DEFAULT '',
    "strengths" TEXT DEFAULT '',
    "greatest_strength" TEXT DEFAULT '',
    "weaknesses" TEXT DEFAULT '',
    "weakness_response" TEXT DEFAULT '',
    "improvement_plan" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "score" DOUBLE PRECISION,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "feedback" TEXT DEFAULT '',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_assessments_student_id_created_at_idx" ON "onboarding_assessments"("student_id", "created_at");
CREATE INDEX "onboarding_assessments_enrollment_id_idx" ON "onboarding_assessments"("enrollment_id");
CREATE INDEX "onboarding_assessments_status_created_at_idx" ON "onboarding_assessments"("status", "created_at");

ALTER TABLE "onboarding_assessments" ADD CONSTRAINT "onboarding_assessments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_assessments" ADD CONSTRAINT "onboarding_assessments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "onboarding_assessments" ADD CONSTRAINT "onboarding_assessments_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
