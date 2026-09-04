# Report on System Improvements

## Date: 2026-09-03

## Summary of Changes

### 1. Fixed Claude Code Hooks
- **Issue**: The PostToolUse hooks in `.claude/settings.json` contained syntactically invalid shell commands, causing Edit/Write operations on TypeScript/JavaScript files to be blocked.
- **Fix**: Converted conditional statements to proper `case ... esac` syntax in all PostToolUse hooks (TypeScript check, wildcard import check, test runner, and prettier formatter).
- **Files Modified**:
  - `/home/wasu/.claude/settings.json`
  - `/home/wasu/claude_code/.claude/settings.json`

### 2. Viewer Issuance Creation and Return Restriction
- **Requirement**: Regular users (viewers) should be able to create equipment requests (issuances) but must not be able to process returns themselves.
- **Implementation**:
  - The issuance creation endpoint (`POST /api/issuance-history`) already used `requireAuth(prisma)`, allowing authenticated viewers to create issuances.
  - Viewer-specific logic:
    - Automatically assigns the `employeeId` based on the viewer's username (creates an employee record if none exists).
    - Prevents viewers from specifying a `returnDate` when creating an issuance.
  - The issuance update endpoint (`PUT /api/issuance-history/:id`) is protected by `writeAccess` (restricted to admin and staff roles), preventing viewers from updating issuances (including setting a returnDate).
- **Files Modified**:
  - `/home/wasu/claude_code/wms2/backend/src/server.ts` (viewer logic was already present; no changes needed beyond ensuring it works after hook fixes)

### 3. Added Audit Logging
- **Purpose**: To track mutating actions (who did what, when, and what changed) for security and compliance.
- **Implementation**:
  - Added audit logging for equipment type creation (fixed existing call that incorrectly used spread operator).
  - Added audit logging for issuance creation.
  - Updated the `extractRequestInfo` function in `audit.ts` to safely extract IP address using optional chaining.
  - Regenerated Prisma client after adding the `AuditLog` model and relations.
- **Files Modified**:
  - `/home/wasu/claude_code/wms2/backend/src/audit.ts`
  - `/home/wasu/claude_code/wms2/backend/prisma/schema.prisma`
  - `/home/wasu/claude_code/wms2/backend/src/server.ts` (equipment types creation and issuance creation endpoints)

### 4. Prisma Schema Updates
- **Changes**:
  - Added `auditLogs` relation to the `User` model (one-to-many).
  - Updated the `user` relation in the `AuditLog` model to explicitly specify the relation name.
  - Added `ipAddress` and `userAgent` optional fields to the `AuditLog` model (already present).
- **Files Modified**:
  - `/home/wasu/claude_code/wms2/backend/prisma/schema.prisma`

### 5. Added Due Date Field
- **Purpose**: Allow specifying an expected return date for equipment issuances to track overdue items.
- **Implementation**:
  - Added `dueDate` DateTime? field to the `EquipmentIssuance` model in Prisma schema.
  - Added index on `dueDate` for query performance.
  - Updated issuance creation and update endpoints to accept and validate `dueDate` (must not be before `issueDate`).
  - Modified frontend IssuanceHistoryPage to include dueDate input in the creation modal and display it in the table.
  - Updated TypeScript interfaces (`Issuance` and `IssuanceFormValues`) to include `dueDate`.
- **Files Modified**:
  - `/home/wasu/claude_code/wms2/backend/prisma/schema.prisma`
  - `/home/wasu/claude_code/wms2/backend/src/server.ts`
  - `/home/wasu/claude_code/wms2/frontend/src/pages/IssuanceHistoryPage.tsx`
  - `/home/wasu/claude_code/wms2/frontend/src/types/index.ts`

### 6. Migration to Supabase/PostgreSQL and Vercel Build Preparation
- **Issue**: The system previously used SQLite for development, which is not suitable for Vercel serverless deployments due to its file‑based nature and lack of persistence.
- **Fix**: 
  - Changed Prisma provider from `sqlite` to `postgresql` in `backend/prisma/schema.prisma`.
  - Added a Vercel‑specific build script `vercel-build` that runs `prisma generate && prisma migrate deploy && tsc` so that migrations are applied automatically during Vercel deployment.
  - Updated `backend/vercel.json` to use the new build script.
  - Provided example environment variables in `backend/.env.example` and `frontend/.env.example` for Supabase/PostgreSQL.
  - Updated documentation in `README.md` (section “Deploy บน Vercel + PostgreSQL (รองรับ Supabase)”) with step‑by‑step instructions for creating a Supabase project, setting `DATABASE_URL`, and configuring Vercel environment variables.
  - Cleaned up temporary test files and logs to keep the repository tidy.
- **Files Modified**:
  - `/home/wasu/claude_code/wms2/backend/prisma/schema.prisma`
  - `/home/wasu/claude_code/wms2/backend/package.json` (added `vercel-build` script)
  - `/home/wasu/claude_code/wms2/backend/vercel.json` (changed `buildCommand`)
  - `/home/wasu/claude_code/wms2/backend/.env.example`
  - `/home/wasu/claude_code/wms2/frontend/.env.example`
  - `/home/wasu/claude_code/wms2/README.md`
  - `/home/wasu/claude_code/wms2/WORK_LOG.md` (added entry for 2026-09-04)
  - Removed temporary files: `backend/test_api.js`, `backend/test_api2.js`, `backend/test.js`, `backend/server.log`, `backend/server.pid`, `backend/backend.log`, `backend/backend.pid`, `frontend/frontend.log`, `frontend/frontend.pid`

## Verification
- TypeScript compilation passes with no errors.
- The system now allows viewers to create issuances without being able to set a returnDate.
- Viewers cannot update issuances (including setting returnDate) due to `writeAccess` restriction.
- Audit logs are created for equipment type and issuance creation.
- Due date field is correctly stored, validated, and displayed in the issuance history.
- Backend builds successfully with the new `vercel-build` script, applying migrations against a PostgreSQL (Supabase) database.
- Health endpoint returns `{"status":"ok","database":"connected", ...}` when connected to Supabase.

## Future Improvements (Recommended)
Based on the initial report, the following improvements are still pending:
1. Implement data export (CSV/Excel) for all major tables.
2. Convert department management to a dropdown (create Department table, update Employee model, add UI).
3. Add soft-delete (deletedAt column) to key tables and adjust queries.
4. Strengthen password policy and optionally implement TOTP-based 2FA for admin/staff roles.
5. Refine rate limiting (stricter limits on mutating and export endpoints).
6. Performance optimizations (database indexing, caching, connection pooling).
7. Increase test coverage (unit and integration tests for new features).
8. Update code quality settings (enable `no-console` rule, ensure Prettier runs on commit).
9. Generate API documentation (Swagger/OpenAPI).
10. Set up CI/CD pipeline (lint, tests, security audit, build before deployment).