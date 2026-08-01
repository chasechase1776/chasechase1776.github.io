UPDATE "Student"
SET "name" = 'Bennett C. Claypool'
WHERE "name" = 'Bennett'
  AND NOT EXISTS (
    SELECT 1 FROM "Student" WHERE "name" = 'Bennett C. Claypool'
  );
