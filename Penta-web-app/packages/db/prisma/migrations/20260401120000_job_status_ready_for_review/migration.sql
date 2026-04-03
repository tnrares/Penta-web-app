-- Intermediate pipeline step: worker marks work complete for manager review
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'JobStatus' AND e.enumlabel = 'READY_FOR_REVIEW'
  ) THEN
    ALTER TYPE "JobStatus" ADD VALUE 'READY_FOR_REVIEW' BEFORE 'FINALIZED';
  END IF;
END
$migration$;
