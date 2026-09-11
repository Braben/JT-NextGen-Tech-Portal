-- Optional class scope for attendance sessions.

ALTER TABLE "attendance_sessions" ADD COLUMN "class_id" TEXT;

CREATE INDEX "idx_attendance_sessions_class_date" ON "attendance_sessions"("class_id", "date");

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "program_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
