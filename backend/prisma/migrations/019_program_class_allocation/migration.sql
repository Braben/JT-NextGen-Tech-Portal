-- Programme class allocation, rosters, and class discussion forums.

CREATE TABLE "program_classes" (
  "id" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "instructor_id" TEXT,
  "forum_category_id" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "session" TEXT NOT NULL DEFAULT 'Morning',
  "capacity" INTEGER NOT NULL DEFAULT 25,
  "start_date" TEXT,
  "end_date" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "program_classes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "enrollments" ADD COLUMN "class_id" TEXT;
ALTER TABLE "forum_categories" ADD COLUMN "program_id" TEXT;
ALTER TABLE "forum_categories" ADD COLUMN "class_id" TEXT;

CREATE UNIQUE INDEX "program_classes_code_key" ON "program_classes"("code");
CREATE UNIQUE INDEX "program_classes_forum_category_id_key" ON "program_classes"("forum_category_id");
CREATE INDEX "idx_program_classes_program_status" ON "program_classes"("program_id", "status");
CREATE INDEX "idx_program_classes_instructor" ON "program_classes"("instructor_id");
CREATE INDEX "idx_enrollments_class_status" ON "enrollments"("class_id", "status");
CREATE INDEX "idx_forum_categories_class" ON "forum_categories"("class_id");

ALTER TABLE "program_classes"
  ADD CONSTRAINT "program_classes_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "program_classes"
  ADD CONSTRAINT "program_classes_instructor_id_fkey"
  FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "program_classes"
  ADD CONSTRAINT "program_classes_forum_category_id_fkey"
  FOREIGN KEY ("forum_category_id") REFERENCES "forum_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "program_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forum_categories"
  ADD CONSTRAINT "forum_categories_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forum_categories"
  ADD CONSTRAINT "forum_categories_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "program_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
