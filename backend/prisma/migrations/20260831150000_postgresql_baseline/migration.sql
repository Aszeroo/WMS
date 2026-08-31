-- PostgreSQL baseline generated from the current Prisma schema.
-- This replaces the SQLite migration history for new PostgreSQL deployments.

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInstance" (
    "id" SERIAL NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "typeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentIssuance" (
    "id" SERIAL NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnDate" TIMESTAMP(3),
    "building" TEXT,
    "floor" TEXT,
    "jobNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentRepair" (
    "id" SERIAL NOT NULL,
    "equipmentId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "repairDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "repairedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_name_key" ON "EquipmentType"("name");
CREATE INDEX "EquipmentType_name_idx" ON "EquipmentType"("name");
CREATE UNIQUE INDEX "EquipmentInstance_serialNumber_key" ON "EquipmentInstance"("serialNumber");
CREATE INDEX "EquipmentInstance_status_idx" ON "EquipmentInstance"("status");
CREATE INDEX "EquipmentInstance_typeId_idx" ON "EquipmentInstance"("typeId");
CREATE INDEX "EquipmentInstance_serialNumber_idx" ON "EquipmentInstance"("serialNumber");
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");
CREATE INDEX "Employee_name_idx" ON "Employee"("name");
CREATE INDEX "EquipmentIssuance_equipmentId_returnDate_idx" ON "EquipmentIssuance"("equipmentId", "returnDate");
CREATE INDEX "EquipmentIssuance_issueDate_idx" ON "EquipmentIssuance"("issueDate");
CREATE INDEX "EquipmentIssuance_jobNumber_idx" ON "EquipmentIssuance"("jobNumber");
CREATE INDEX "EquipmentRepair_equipmentId_status_idx" ON "EquipmentRepair"("equipmentId", "status");
CREATE INDEX "EquipmentRepair_employeeId_idx" ON "EquipmentRepair"("employeeId");
CREATE INDEX "EquipmentRepair_repairDate_idx" ON "EquipmentRepair"("repairDate");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Enforce one active issuance and one active repair per equipment under concurrency.
CREATE UNIQUE INDEX "EquipmentIssuance_active_equipment_unique"
ON "EquipmentIssuance" ("equipmentId")
WHERE "returnDate" IS NULL;

CREATE UNIQUE INDEX "EquipmentRepair_active_equipment_unique"
ON "EquipmentRepair" ("equipmentId")
WHERE "status" IN ('reported', 'in_progress');

-- AddForeignKey
ALTER TABLE "EquipmentInstance" ADD CONSTRAINT "EquipmentInstance_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentIssuance" ADD CONSTRAINT "EquipmentIssuance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentIssuance" ADD CONSTRAINT "EquipmentIssuance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentRepair" ADD CONSTRAINT "EquipmentRepair_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentRepair" ADD CONSTRAINT "EquipmentRepair_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
