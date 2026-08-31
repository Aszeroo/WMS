-- Add session versioning so logout and password changes revoke issued tokens.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Enforce one active issuance and one active repair per equipment under concurrency.
CREATE UNIQUE INDEX "EquipmentIssuance_active_equipment_unique"
ON "EquipmentIssuance" ("equipmentId")
WHERE "returnDate" IS NULL;

CREATE UNIQUE INDEX "EquipmentRepair_active_equipment_unique"
ON "EquipmentRepair" ("equipmentId")
WHERE "status" IN ('reported', 'in_progress');
