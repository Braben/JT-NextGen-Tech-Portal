-- Match the assignment allocation columns used by the API and SQLite migration.
ALTER TABLE "assignments" ADD COLUMN "program_id" TEXT;
ALTER TABLE "assignments" ADD COLUMN "class_id" TEXT;
CREATE INDEX "idx_assignments_program_due" ON "assignments"("program_id", "due_date");
CREATE INDEX "idx_assignments_class_due" ON "assignments"("class_id", "due_date");
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_program_id_fkey"
  FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "program_classes"("id") ON DELETE RESTRICT;
