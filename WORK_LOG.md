# WMS2 — บันทึกสถานะงาน

> อัปเดตล่าสุด: 31 สิงหาคม 2026 — กำลังดำเนินการ

## กติกาการอัปเดต

อัปเดตไฟล์นี้หลังจบทุกชุดงานสำคัญ โดยระบุสิ่งที่เปลี่ยน ผลการตรวจสอบ งานค้าง และจุดเริ่มต้นสำหรับกลับมาทำต่อ เพื่อให้หยุดพักหรือเริ่มเซสชันใหม่ได้โดยไม่สูญเสียบริบท

## ชุดงานปัจจุบัน: แก้จุดค้างที่ตรวจพบ

### เป้าหมาย

ทำให้ระบบ deploy ฐานข้อมูลใหม่ได้ และแก้ข้อจำกัด/ความไม่สอดคล้องของ Repair History กับ Equipment Management โดยยังไม่เพิ่ม workflow ใหม่ที่ไม่ได้พิสูจน์ว่าจำเป็น

### สถานะก่อนเริ่มแก้

- พบว่า `backend/prisma/migrations/` มีเพียง `migration_lock.toml` แต่ scripts และ Docker Compose เรียก `prisma migrate deploy` จึง deploy บนฐานข้อมูลว่างไม่ได้
- หน้าซ่อมส่ง `equipmentId` ตอนแก้ไข แม้ backend ไม่รองรับการย้าย repair ไปอุปกรณ์อื่น ทำให้ UI ชวนให้เข้าใจผิด
- Repair History ยังไม่มี filter ตามอุปกรณ์/พนักงาน และ preload equipment ได้เพียง 100 รายการ
- Equipment Management โหลดรายการ instances เพียงหน้าแรก 100 รายการ แล้วปิด pagination

### งานที่กำลังทำ

1. สร้าง initial Prisma migration, เพิ่ม employee filter และ integration tests
2. ปรับ Repair History: edit payload, filters, equipment search และ error/retry state
3. เพิ่ม instance pagination, frontend regression tests และรัน quality gates

### จุดเริ่มต้นหากกลับมาทำต่อ

เริ่มจาก Task #1: `backend/prisma/schema.prisma`, `backend/src/server.ts`, และ `backend/tests/integration.test.ts` จากนั้นอัปเดตหัวข้อ “ผลลัพธ์ล่าสุด” ด้านล่างก่อนเปลี่ยนไป Task ถัดไป

## ผลลัพธ์ล่าสุด

### 31 สิงหาคม 2026 — Backend repair filters (กำลังรอ verification)

**แก้ไขแล้ว**

- เพิ่ม `@@index([employeeId])` ให้ model `EquipmentRepair` ใน `backend/prisma/schema.prisma`
- เพิ่ม `employeeId` query filter ให้ `GET /api/repair-history` ใน `backend/src/server.ts`
- เพิ่ม integration tests สำหรับ filter ตาม equipment/employee และ validation ของ `employeeId`

**ประเด็นที่พบระหว่าง verification**

- ตรวจพบในภายหลังว่าโครงการมี migration เดิมอยู่ 4 ชุดที่ระดับลึกกว่าการค้นหาแรก (`20260831035420_init` และ migrations ต่อมา) จึงไม่ต้องสร้าง initial migration ใหม่
- มี migration ซ้ำที่ถูกสร้างขึ้นโดยไม่ตั้งใจที่ `backend/prisma/migrations/20260831_initial_schema/`; ผู้ใช้ลบออกแล้วผ่าน shell
- สร้าง migration ที่ถูกต้องเฉพาะการเพิ่ม index: `backend/prisma/migrations/20260831140000_add_repair_employee_index/migration.sql`

**สถานะการทดสอบ**

- `npm run typecheck --prefix backend` ผ่าน
- รัน `prisma migrate deploy` บน SQLite database ใหม่สำเร็จครบ 5 migrations
- รัน backend integration tests บน database ใหม่: ผ่าน 6/6 tests

**จุดเริ่มต้นถัดไป**

ทำ Task #2 ต่อที่ `frontend/src/pages/EquipmentManagementPage.tsx`: เปลี่ยนรายการ instances เป็น server-side pagination และตรวจ frontend tests ทั้งหมด

### 31 สิงหาคม 2026 — Repair History UI

**แก้ไขแล้ว**

- แยก `RepairHistoryQuery`, `RepairCreateInput` และ `RepairUpdateInput` ใน `frontend/src/types/index.ts` และใช้ใน `frontend/src/services/api.ts`
- แยก `draftFilters`/`appliedFilters`; เพิ่มตัวกรองวันที่ สถานะ อุปกรณ์ และผู้รับผิดชอบ พร้อมปุ่มล้างตัวกรอง
- เปลี่ยน equipment lookup ใน Repair History เป็น server-backed search จำกัดครั้งละ 20 รายการ พร้อม debounce และป้องกันผลลัพธ์จาก request เก่า
- โหมดแก้ไขแสดงอุปกรณ์เดิมแบบ disabled และ update payload ไม่ส่ง `equipmentId` ซึ่งตรงกับ backend ที่ไม่รองรับการย้าย repair
- แยก `historyError`/`lookupError` พร้อมปุ่ม retry
- เพิ่ม `frontend/src/pages/RepairHistoryPage.test.tsx` ตรวจการล็อกอุปกรณ์และ payload
- เพิ่ม polyfill สำหรับ Ant Design/jsdom ใน `frontend/src/test/setup.ts`

**สถานะการทดสอบ**

- frontend typecheck ผ่าน
- Repair History regression test ผ่าน 1/1 โดยไม่มี unhandled error หลังเพิ่ม cleanup/mock ที่จำเป็น
- frontend test เดิมยังต้องรันรวมอีกครั้งหลังงาน pagination

**งานค้าง**

- ตรวจสอบ quality gates รวมจากรากโครงการ
- พิจารณาคำเตือน build เรื่อง chunk ใหญ่ (ไม่ทำให้ build ล้มเหลว)

### 31 สิงหาคม 2026 — Equipment Instances pagination

**แก้ไขแล้ว**

- `frontend/src/pages/EquipmentManagementPage.tsx` แยก `loadTypes` และ `loadInstances`
- เปลี่ยนการโหลด instances จากหน้าแรก 100 รายการเป็น server-side pagination ด้วย `instancePage`, `instancePageSize`, `total` และ Ant Design Table pagination
- เมื่อรายการถูกลบจนหน้าปัจจุบันเกินหน้าสุดท้าย ระบบจะถอยไปหน้าที่ถูกต้องแล้วโหลดซ้ำ
- หลังเพิ่ม/แก้ไข/ลบ instance จะ refresh ทั้งรายการ instances และจำนวนในประเภทอุปกรณ์; การแก้ไขประเภท refresh เฉพาะ types

**สถานะการทดสอบ**

- frontend typecheck ผ่าน
- frontend production build ผ่าน
- frontend tests ผ่าน 3/3 (2 test files)
- มีเพียงคำเตือนเดิมของ Ant Design (`Card bordered` deprecated) และ Vite เรื่อง chunk ใหญ่ ไม่ใช่ test/build failure

**จุดเริ่มต้นถัดไป**

ตรวจ diff ของไฟล์ที่แก้และตัดสินใจว่าจะปรับปรุงคำเตือน `Card bordered`/chunk size หรือไม่ โดยไม่ขยาย scope ฟีเจอร์ จากนั้นจึงเตรียมสรุปชุดงานนี้

### 31 สิงหาคม 2026 — Quality gates และสถานะล่าสุด

**ผลตรวจสอบจากรากโครงการ**

- `cd /home/wasu/claude_code/wms2 && npm run typecheck` — ผ่าน
- `npm test` — ผ่าน: backend 7/7 tests และ frontend 3/3 tests
- `npm run build` — ผ่านทั้ง backend และ frontend
- `npm audit --prefix backend --audit-level=high` — พบ 0 vulnerabilities
- `npm audit --prefix frontend --audit-level=high` — พบ 0 vulnerabilities
- fresh SQLite migration deploy — ผ่านครบ 5 migrations

**ข้อสังเกตที่ไม่ใช่ failure**

- `prisma migrate status` เมื่อใช้ `backend/.env` ชี้ไปที่ `prisma/dev.db` พบว่ายังไม่ได้ apply migrations `20260831120000_session_version` และ `20260831140000_add_repair_employee_index`; ไม่ได้ apply อัตโนมัติเพราะอาจเป็นฐานข้อมูล local ที่มีข้อมูลอยู่ ควรสำรองก่อนแล้วจึงรัน `npm run migrate:deploy --prefix backend` หากต้องการอัปเดตฐานข้อมูลพัฒนา
- frontend build มีคำเตือน Vite เรื่อง chunk ใหญ่กว่า 500 kB และ test มีคำเตือน Ant Design ว่า `Card bordered` deprecated แต่ทั้งคู่ไม่ทำให้ gate ล้มเหลว
- ตรวจทาน boundary ของ pagination เพิ่มเติมและแก้กรณีลบจนเหลือ 0 รายการ: หากหน้าปัจจุบันเกินหน้าสุดท้าย ระบบจะกลับไปหน้า 1 แล้วโหลดใหม่

**สถานะงาน**

- ฟีเจอร์และ defect ที่อยู่ใน scope ชุดนี้เสร็จแล้ว
- `WORK_LOG.md` ถูกอัปเดตให้เป็นจุดอ้างอิงสำหรับเซสชันถัดไป
- ยังไม่มีการ commit เนื่องจากโฟลเดอร์นี้ไม่ใช่ git repository

## คู่มือทดสอบสำหรับผู้ใช้

### ทดสอบแบบ local development

1. เปิด terminal ที่ `/home/wasu/claude_code/wms2`
2. ตรวจ `backend/.env` ให้มี `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` และ `CORS_ORIGIN` ที่ตรงกับ port ของ frontend
3. สำรอง `backend/prisma/dev.db` ก่อนอัปเดตฐานข้อมูลเดิม แล้วรัน `npm run migrate:deploy --prefix backend` และ `npm run seed --prefix backend`
4. เปิด backend ด้วย `npm run dev --prefix backend`
5. เปิด terminal อีกอันแล้วเปิด frontend ด้วย `npm run dev --prefix frontend`
6. เข้า `http://localhost:5173` หรือ port ที่ Vite แจ้ง และ login ด้วย `ADMIN_USERNAME`/`ADMIN_PASSWORD` จาก `.env`

### ลำดับ smoke test ที่แนะนำ

- ตรวจ `GET http://localhost:5000/api/health`
- สร้าง equipment type และเพิ่ม instances แบบหลาย serial โดยแยกบรรทัด
- สร้างเกิน 100 instances แล้วตรวจ pagination และรายการท้ายสุด
- เพิ่มพนักงาน
- เบิกอุปกรณ์ที่ available แล้วตรวจสถานะเป็น `issued`
- คืนอุปกรณ์แล้วตรวจสถานะกลับเป็น `available`
- แจ้งซ่อมหลังคืนแล้วตรวจสถานะเป็น `under_repair`
- แก้ repair และตรวจว่าอุปกรณ์เดิมเปลี่ยนไม่ได้; เปลี่ยนสถานะเป็น completed แล้วตรวจกลับเป็น `available`
- ทดสอบ filter Repair History ตามอุปกรณ์/พนักงาน/สถานะ/วันที่ และปุ่มล้างตัวกรอง
- logout แล้วตรวจว่าเข้าหน้า protected ไม่ได้

### ทดสอบด้วย Docker

ใช้ `.env.example` ที่รากโครงการเป็นต้นแบบ ตั้งค่า secret จริง แล้วรัน `docker compose up -d --build`, ตรวจ `docker compose ps`, `curl http://localhost:5173/health` และดู `docker compose logs backend-migrate backend-bootstrap` หากเริ่มระบบไม่สำเร็จ

## งานปรับปรุงที่แนะนำถัดไป

1. **ควรทำก่อนใช้งานจริง:** สำรองและ apply migrations ที่ยังค้างใน `backend/prisma/dev.db` และทำ browser smoke test ตามคู่มือด้านบน
2. **ควรทำลำดับถัดไป:** เพิ่ม frontend tests สำหรับ filters, retry state และ Equipment Management pagination ให้ครอบคลุมมากกว่า regression test ปัจจุบัน
3. **ปรับปรุงคุณภาพ:** เปลี่ยน `Card bordered` เป็น API ใหม่ของ Ant Design และพิจารณาแยก Vite chunk ที่ใหญ่กว่า 500 kB
4. **ก่อน production:** เพิ่ม runbook backup/restore จริง, ทดสอบ Docker ด้วย volume ใหม่ และตรวจ CORS/cookie ผ่าน HTTPS

## 31 สิงหาคม 2026 — Phase Vercel/PostgreSQL (backend และ frontend)

**การตัดสินใจด้าน deployment**

- เลือก deploy เป็น 2 Vercel projects จาก repository เดียวกัน: backend ใช้ root `backend/`, frontend ใช้ root `frontend/` เพื่อให้ Vercel ติดตั้ง dependencies และ build context ได้ตรง package
- ใช้ managed PostgreSQL ภายนอก (เช่น Neon, Vercel Postgres หรือ provider ที่รองรับ serverless) แทน SQLite แบบไฟล์ ซึ่งไม่ควรใช้เป็น persistent database บน Vercel
- Vercel build ไม่รัน migration หรือ seed อัตโนมัติ; migration และ admin bootstrap เป็น post-deploy operations ที่ต้องสั่งอย่างตั้งใจ

**Backend ที่เปลี่ยน**

- เปลี่ยน `backend/prisma/schema.prisma` เป็น `provider = "postgresql"`
- สร้าง PostgreSQL baseline ที่ `backend/prisma/migrations/20260831150000_postgresql_baseline/migration.sql` ครบทุก model, relation, index, `sessionVersion` และ active issuance/repair partial unique indexes
- เปลี่ยน `backend/prisma/migrations/migration_lock.toml` เป็น PostgreSQL; migration chain เดิมของ SQLite ถูกเก็บเป็นข้อมูลอ้างอิงระหว่างตรวจสอบ แล้วลบออกจาก final repository หลังสร้าง test-only migration fixture แยก เพื่อไม่ให้ SQL ที่มี `PRAGMA`/`AUTOINCREMENT` ถูก deploy ไป PostgreSQL
- เพิ่ม `backend/prisma/sqlite-test/schema.prisma` เป็น schema test-only สำหรับ Vitest/CI; production ใช้ `schema.prisma` เท่านั้น
- ปรับ `backend/package.json` ให้ `build` เรียก `prisma generate` ก่อน TypeScript และให้ test ใช้ `prisma migrate deploy` กับ test-only SQLite schema โดยไม่เปลี่ยน production migration
- ปรับ `backend/src/server.ts` ให้ reuse `PrismaClient` ผ่าน `globalThis` ใน warm serverless runtime และ validate `DATABASE_URL` รวมถึง production auth/cookie settings เมื่อโหลดใน production
- เพิ่ม `backend/api/index.ts` สำหรับ export Express app โดยไม่เปิด listener และเพิ่ม `backend/vercel.json` สำหรับ Node.js 22 function/routing

**Frontend และ container ที่เปลี่ยน**

- เปลี่ยน default `VITE_API_URL` ใน `frontend/src/services/api.ts` เป็น same-origin `/api`; local example ยัง override เป็น `http://localhost:5000/api` และ production ต้องตั้ง backend Vercel URL
- เพิ่ม `frontend/vercel.json` สำหรับ `dist` output และ SPA fallback ของ React Router
- ปรับ `.env.example`, `backend/.env.example`, `frontend/.env.example` ให้ใช้ PostgreSQL placeholder และไม่บรรจุ secret จริง
- ปรับ `docker-compose.yml` ให้เป็นทางเลือกที่ใช้ PostgreSQL ภายนอกแทน SQLite volume เพื่อไม่ให้ local file database ถูกเข้าใจว่าเหมาะกับ production
- ขยาย `.gitignore` ให้ครอบคลุม database artifacts, `tsbuildinfo`, `.vercel` และ Windows `:Zone.Identifier`
- ปรับ `README.md` ให้มีคู่มือ Vercel สอง projects, migration/seed order, CORS/cookie, environment variables และคำอธิบาย test-only SQLite schema

**สถานะ verification ของ phase นี้**

- ตรวจ SQL ที่สร้างจาก `prisma migrate diff --from-empty --to-schema-datamodel` แล้วปรับให้คง partial unique indexes สำหรับ concurrency เดิม
- `npm run typecheck` ผ่านทั้ง backend และ frontend
- `npm test` ผ่าน: backend 7/7 tests และ frontend 3/3 tests; backend test ใช้ isolated SQLite migration fixture ที่ `backend/prisma/sqlite-test/`
- `npm run build` ผ่านทั้ง backend และ frontend; Vite ยังคงเตือน chunk ใหญ่กว่า 500 kB และ Ant Design เตือน `Card bordered` deprecated ซึ่งไม่ทำให้ gate ล้มเหลว
- `npm audit --prefix backend --audit-level=high` และ frontend ผ่าน โดยพบ 0 vulnerabilities ทั้งคู่
- `prisma migrate diff` สร้าง PostgreSQL baseline สำเร็จ และ `prisma generate` สำหรับ production schema สำเร็จ
- ยังไม่มี PostgreSQL connection string สำหรับรัน deploy จริงใน environment นี้ จึงยังไม่ได้รัน `prisma migrate deploy` กับ managed PostgreSQL หรือ `vercel dev`; ต้องทำในขั้นตอน deploy โดยผู้ใช้
- รวมรายละเอียดจาก `PLAN.md` และ historical work logs ทั้งหมดลงหัวข้อ consolidation แล้ว; เหลือ cleanup ไฟล์ซ้ำและตรวจ structural diff

**จุดเริ่มต้นถัดไป**

รวมบันทึกเก่าตามรายการในหัวข้อ “Historical work-log consolidation” ตรวจรายการไฟล์ที่จะลบ จากนั้นทำ cleanup และรัน quality gates ใหม่ทั้งชุด

## Historical work-log consolidation

ข้อมูลจากไฟล์บันทึกเก่าที่อ่านแล้วจะเก็บไว้ในไฟล์นี้เป็นประวัติอ้างอิง โดยสถานะ “blocked” ในบันทึกวันที่ 28 สิงหาคมเป็นสถานะก่อนแก้ไข ไม่ใช่สถานะปัจจุบัน

### `work_log_001_project_setup_attempt.txt`

เริ่มวางโครงสร้าง backend Node.js/TypeScript/Express/Prisma และ frontend React/Vite/Ant Design แต่ความพยายามแรกสะดุดจากการเขียน `package.json` ผิด directory และ API ภายนอก 503 (`NVIDIA_NIM_API_KEY` ไม่ได้ตั้งค่า) จึงเริ่มทำใหม่ด้วยเครื่องมือใน directory ที่ถูกต้อง

### `work_log_002_directory_structure.txt`

สร้างโครงสร้างเริ่มต้น `equipment-management-system/backend`, `frontend` และ `docs` เพื่อเตรียมตั้งค่า package และ dependencies

### `work_log_003_backend_dependencies_install.txt`

เริ่ม `npm init` และติดตั้ง Express, TypeScript, type definitions, `ts-node-dev`, Prisma และ `@prisma/client`; บันทึกเดิมระบุว่ากระบวนการติดตั้งกำลังทำงานอยู่ ก่อนดำเนินการสร้าง TypeScript config และ Prisma

### `work_log_004_backend_setup_complete.txt`

ตั้งค่า backend package และติดตั้ง dependencies สำเร็จ พร้อมสร้าง frontend Vite/React/TypeScript, ติดตั้ง Ant Design, Axios และ React Router และจัดโครงสร้าง `src/components`, `pages`, `services`, `hooks`, `utils`, `types`, `assets` จากนั้นเตรียมสร้าง API entrypoint

### `work_log_005_tsconfig_created.txt`

สร้าง backend `tsconfig.json` ด้วย root/output และ CommonJS settings สำหรับ Node.js TypeScript ก่อนเริ่ม Prisma initialization

### `work_log_006_prisma_init.txt`

รัน `npx prisma init`, ตรวจว่ามี `prisma/schema.prisma` และ `.env` พร้อม `DATABASE_URL` และเตรียมกำหนด model สำหรับ equipment types, instances, employees, issuance, repairs และ users

### `work_log_007_backend_prisma_success.txt`

บันทึกระยะเริ่มต้นที่ Prisma generate สำเร็จหลังลองใช้ config file และ PostgreSQL adapter แต่ยังเป็นสถานะก่อนปรับกลับมาใช้ Prisma 6/SQLite ในงานภายหลัง

### `work_log_008_frontend_setup_complete.txt`

สร้าง frontend Vite/React และติดตั้ง dependencies, สร้างโครงสร้าง source, เตรียม Dashboard, equipment management, reports และ repair history

### `work_log_009_backend_api_routes_complete.txt`

เพิ่ม Express API สำหรับ equipment types และ instances พร้อม CRUD, search, pagination, relations และ health check; บันทึกเดิมระบุการใช้ PostgreSQL adapter ในช่วงทดลอง ซึ่งภายหลังถูกแทนด้วย Prisma client ปัจจุบัน

### `work_log_010_dashboard_created.txt`

สร้าง `DashboardPage` และ API service สำหรับสถิติ total, issued, available และ under repair พร้อม routing, loading state และ local frontend development server

### `work_log_011_equipment_management_page.txt`

สร้าง `EquipmentManagementPage` สองแท็บสำหรับ types/instances, CRUD modal/forms, status tags, type relation และการใส่ serial numbers หลายบรรทัด; ภายหลังเพิ่ม server-side pagination ในงาน defect fixes

### `work_log_012_backend_issuance_repair_api.txt`

เพิ่ม issuance และ repair history API พร้อม filtering, pagination, CRUD, transaction และ state transition: เบิกได้เฉพาะ equipment ที่พร้อมใช้งาน, คืนแล้วกลับ available, repair ขณะ issued ถูกปฏิเสธ และสถานะ repair ปรับสถานะ equipment อัตโนมัติ

### `work_log_final_summary.txt`, `equipment-management-system/COMBINED_WORK_LOG.txt`, `equipment-management-system/FULL_WORK_LOG_COMBINED.txt`, `equipment-management-system/WORK_LOG_LATEST.txt` และ `equipment-management-system/work_log.txt`

ไฟล์กลุ่มนี้มีรายการซ้ำของความสำเร็จข้างต้นและรายละเอียด historical Prisma initialization failure (“PrismaClient requires a driver adapter...”) รวมถึงขั้นตอน troubleshooting: ตรวจ config, generate, database, constructor options และ environment โดยสรุปนั้นเก็บไว้แล้วในหัวข้อนี้และหัวข้อผลลัพธ์ก่อนหน้า ไม่ใช่ blocker ปัจจุบัน

### `PLAN.md` เดิม

แผนเดิมครอบคลุม auth, password hashing/session cookie, role middleware, helmet/rate limit/CORS/validation, Prisma schema/seed/transactions, React pages, search/filter/pagination, automated tests, Docker/healthcheck, `.env.example`, CI, backup notes และ quality gates เนื้อหาที่ทำเสร็จแล้วสะท้อนอยู่ในผลลัพธ์วันที่ 31 สิงหาคม 2026 และแผน Vercel ปัจจุบัน; ไฟล์นี้จึงไม่ต้องคงไว้เป็นเอกสารซ้ำ

## 31 สิงหาคม 2026 — Final cleanup และ verification หลังปรับ Vercel

- แก้ reference ใน `README.md` และ `WORK_LOG.md` ให้ใช้ `backend/prisma/sqlite-test/schema.prisma` ซึ่งเป็น path ของ test-only schema จริง แทน path เก่าที่ถูกลบแล้ว
- ติดตั้ง dependencies ใหม่ด้วย `npm ci` แยกใน `backend/` และ `frontend/` เพื่อยืนยัน lockfile และ clean install
- `npm run typecheck` ผ่านทั้ง backend และ frontend
- `npm test` ผ่าน: backend 7/7 tests และ frontend 3/3 tests; test สร้าง SQLite database ชั่วคราวจาก migration fixture 5 migrations แล้วถูกลบหลัง verification
- `npm run build` ผ่านทั้ง backend และ frontend; build เรียก production `prisma generate` ก่อน compile และ frontend สร้าง `dist` สำเร็จ
- `npm audit --prefix backend --audit-level=high` และ `npm audit --prefix frontend --audit-level=high` ผ่าน โดยพบ 0 vulnerabilities ทั้งคู่
- `DATABASE_URL` แบบ placeholder ใช้ตรวจ `prisma validate` และ schema PostgreSQL valid; `prisma migrate diff` สร้าง SQL baseline ได้ 150 บรรทัด
- ทดสอบการโหลด compiled backend ด้วย production environment placeholders ที่ไม่เปิดเผย secret แล้วผ่านเมื่อใช้ `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` และ `CORS_ORIGIN` ตามข้อกำหนด
- ตรวจ `docker compose --env-file .env.example config` แล้วผ่าน
- บังคับ production runtime ให้ใช้ `COOKIE_SAME_SITE=none` คู่กับ `COOKIE_SECURE=true` เพื่อให้ cookie ใช้งานได้เมื่อ frontend และ backend อยู่คนละ Vercel origin
- แก้ค่าเริ่มต้นของ Docker Compose และ `.env.example` เป็น `NODE_ENV=development` ให้สอดคล้องกับการรัน local HTTP ที่ใช้ `COOKIE_SECURE=false`/`SameSite=lax`; production ต้องตั้งค่า environment อย่างชัดเจนเอง
- ลบ `node_modules`, `dist`, SQLite test database และ `tsconfig.tsbuildinfo` ที่เกิดจาก verification ออกจาก workspace; artifacts เหล่านี้ถูก ignore และไม่ใช่ source ที่ต้อง deploy จาก repository
- ตรวจ structural inventory แล้วไม่พบ `.env` จริง, database artifact, `PLAN.md`, historical `work_log_*.txt`, `:Zone.Identifier`, duplicate project หรือ reference ไปยัง schema/migration path ที่ลบแล้ว

**ข้อจำกัดที่ยังต้องทำในขั้นตอน deploy จริง**

- ยังไม่ได้รัน `prisma migrate deploy`, `prisma migrate status` และ `seed` กับ managed PostgreSQL เพราะ environment นี้ไม่มี connection string จริง; ให้รันตามลำดับใน README โดยไม่ส่ง secret ในแชต
- ยังไม่ได้รัน `vercel dev` หรือ deploy จริง จึงควร smoke test function routing, CORS, cookie flags, SPA refresh และ business flows หลังสร้าง Vercel projects
- คำเตือน Vite เรื่อง chunk ใหญ่กว่า 500 kB และ Ant Design `Card bordered` deprecated ยังไม่กระทบ verification gate แต่ควรปรับปรุงภายหลัง

## 31 สิงหาคม 2026 — แก้ Vercel runtime configuration ตาม deployment log

- Deployment จาก GitHub commit `fcb8603` ล้มเหลวก่อนเริ่ม build ด้วยข้อความ `Error: Function Runtimes must have a valid version, for example now-php@1.0.0.`
- สาเหตุคือ `backend/vercel.json` กำหนด `runtime: nodejs22.x` ซึ่งเป็น Node version ไม่ใช่ชื่อ npm runtime package/version ตามรูปแบบที่ Vercel CLI รุ่นนี้ตรวจสอบ
- ลบการกำหนด `runtime` ออกจาก `backend/vercel.json`; Node.js เป็น official Vercel runtime จึงให้ Vercel ตรวจจับจาก `api/index.ts` และตั้ง Node.js version จาก Project Settings แทน โดยคง `maxDuration` และ rewrite เดิมไว้
- ตรวจ JSON config หลังแก้แล้วผ่าน; ต้อง commit/push ไฟล์ `backend/vercel.json` ที่แก้ไปยัง GitHub ก่อนกด redeploy เพราะ commit `fcb8603` ยังเป็น revision เดิมที่มีปัญหา

## 31 สิงหาคม 2026 — ตรวจ URL หลัง deploy จริง

- ตรวจ `https://backend-ten-psi-94.vercel.app/` และ `/api/health` แล้วได้ HTTP 500; backend deployment มีอยู่แต่ application ยังล้มเหลวตอน runtime
- ตรวจ `https://frontend-rose-one-72.vercel.app/` แล้ว frontend โหลดได้และแสดงหน้า `Equipment Desk`; static deployment เบื้องต้นทำงาน
- สาเหตุที่ต้องตรวจเป็นลำดับแรกคือ production environment variables ของ Backend โดย `server.ts` จะหยุดตั้งแต่ import หากไม่มี `DATABASE_URL`, `SESSION_SECRET`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` หรือ `CORS_ORIGIN`
- หากตั้งค่าครบแล้วแต่ยังได้ 500 ให้ดู Vercel Runtime Logs ต่อ โดยแยกตรวจ Prisma connection (`P1001`/SSL) และ migration ที่ยังไม่ได้ apply (`relation does not exist`); ห้ามบันทึก secret ลง log หรือส่งในแชต
- สร้างไฟล์ local ที่ถูก ignore สำหรับเตรียม import: `backend/.env` มีตัวแปร Backend ที่จำเป็น และ `frontend/.env` มี `VITE_API_URL` ชี้ไปยัง Backend URL จริง โดยใส่เฉพาะ placeholders ไม่มี secret จริง
- ต้องแก้ `DATABASE_URL` และ `SESSION_SECRET` ใน `backend/.env` ก่อน import; ห้าม commit ไฟล์ `.env` เหล่านี้กลับไปยัง GitHub

## 31 สิงหาคม 2026 — ตรวจซ้ำหลังผู้ใช้ import Environment Variables

- ตรวจ `https://backend-ten-psi-94.vercel.app/` และ `https://backend-ten-psi-94.vercel.app/api/health` ซ้ำแล้วทั้งคู่ยังตอบ HTTP 500
- ตรวจ `https://frontend-rose-one-72.vercel.app/` แล้ว frontend ยังโหลดได้และแสดง title `Equipment Desk`
- สถานะปัจจุบันจึงเป็น frontend พร้อมใช้งานเบื้องต้น แต่ backend ยังไม่เริ่มทำงานสำเร็จ; ต้อง redeploy หลัง import environment และตรวจ Runtime Logs ของ deployment ล่าสุดเพื่อทราบตัวแปรหรือ Prisma error ที่แท้จริง

## 31 สิงหาคม 2026 — แก้ Vercel build ที่ขาด devDependencies

- Vercel deployment จาก commit `0dadda8` ติดตั้งเพียง 111 packages แล้วล้มที่ `TS2688: Cannot find type definition file for 'node'`; สาเหตุคือ `npm ci` ใน production environment ไม่ติดตั้ง `devDependencies` แต่ backend build ต้องใช้ `typescript`, `@types/node` และ Prisma CLI และ frontend build ต้องใช้ Vite/TypeScript
- เปลี่ยน `installCommand` ใน `backend/vercel.json` และ `frontend/vercel.json` เป็น `npm ci --include=dev` เพื่อให้ build dependencies ถูกติดตั้งแม้ `NODE_ENV=production`
- อัปเดตคำสั่ง Install ใน `README.md` ให้ตรงกับ Vercel configuration; ต้อง commit/push ไฟล์ config และ README ไปยัง GitHub แล้ว redeploy ใหม่

## 31 สิงหาคม 2026 — ป้องกันไฟล์ `.env` หลุดขึ้น GitHub

- ปรับ `.gitignore` ให้ ignore ทั้ง `.env` และไฟล์รูปแบบ `.env.*` ทุกระดับโฟลเดอร์ พร้อมยกเว้นเฉพาะ `.env.example` ซึ่งไม่มีค่าลับ
- ไฟล์ `backend/.env` และ `frontend/.env` ที่ใช้เตรียม import เข้า Vercel จะไม่ถูกแสดงเป็นไฟล์สำหรับ commit เมื่อทำงานผ่าน Git
- หากไฟล์ `.env` เคยถูก commit ไปแล้ว `.gitignore` จะไม่ลบออกจาก Git index อัตโนมัติ ต้องลบออกจาก repository และเปลี่ยน secret ทันที
