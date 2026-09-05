-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EquipmentInstance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serialNumber" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'available',
    "typeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentInstance_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EquipmentIssuance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "equipmentId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnDate" DATETIME,
    "dueDate" DATETIME,
    "building" TEXT,
    "floor" TEXT,
    "jobNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentIssuance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentIssuance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentRepair" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "equipmentId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "repairDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "repairedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EquipmentRepair_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EquipmentRepair_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "userId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_name_key" ON "EquipmentType"("name");

-- CreateIndex
CREATE INDEX "EquipmentType_name_idx" ON "EquipmentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentInstance_serialNumber_key" ON "EquipmentInstance"("serialNumber");

-- CreateIndex
CREATE INDEX "EquipmentInstance_status_idx" ON "EquipmentInstance"("status");

-- CreateIndex
CREATE INDEX "EquipmentInstance_typeId_idx" ON "EquipmentInstance"("typeId");

-- CreateIndex
CREATE INDEX "EquipmentInstance_serialNumber_idx" ON "EquipmentInstance"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_name_idx" ON "Employee"("name");

-- CreateIndex
CREATE INDEX "EquipmentIssuance_equipmentId_returnDate_idx" ON "EquipmentIssuance"("equipmentId", "returnDate");

-- CreateIndex
CREATE INDEX "EquipmentIssuance_issueDate_idx" ON "EquipmentIssuance"("issueDate");

-- CreateIndex
CREATE INDEX "EquipmentIssuance_jobNumber_idx" ON "EquipmentIssuance"("jobNumber");

-- CreateIndex
CREATE INDEX "EquipmentIssuance_dueDate_idx" ON "EquipmentIssuance"("dueDate");

-- CreateIndex
CREATE INDEX "EquipmentRepair_equipmentId_status_idx" ON "EquipmentRepair"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "EquipmentRepair_employeeId_idx" ON "EquipmentRepair"("employeeId");

-- CreateIndex
CREATE INDEX "EquipmentRepair_repairDate_idx" ON "EquipmentRepair"("repairDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
