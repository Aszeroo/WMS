# WMS2 — บันทึกสถานะงาน

> อัปเดตล่าสุด: 1 กันยายน 2026 — ปรับปรุง performance รอบใหม่ผ่าน quality gates

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

## 31 สิงหาคม 2026 — ตรวจซ้ำหลัง redeploy สำเร็จ

- GitHub branch `main` มี commit ล่าสุด `3dd2cea` ชื่อ `Ignore environment files`
- ตรวจ `https://backend-ten-psi-94.vercel.app/api/health` แล้วได้ `status: ok` และ `database: connected`; Backend และ PostgreSQL เชื่อมต่อสำเร็จ
- ตรวจ `https://frontend-rose-one-72.vercel.app/` แล้วโหลดสำเร็จและพบ title `Equipment Desk`
- สถานะ deployment หลักพร้อมสำหรับการทดสอบ login และ business flows; ยังควรทดสอบจาก browser จริงเพื่อยืนยัน CORS, cookie และการเรียก API จาก frontend

## 31 สิงหาคม 2026 — จุดค้างก่อนปิดเครื่อง: สร้างบัญชี admin และแก้ login HTTP 500

- ผู้ใช้ยังไม่มีบัญชี `admin`; การรัน `npm ci` และ `npm run generate` สำเร็จแล้ว โดย Prisma Client `6.19.0` ถูก generate จาก `.env` เรียบร้อย
- Warning ที่พบระหว่าง generate เรื่อง `package.json#prisma` deprecated ใน Prisma 7 ยังไม่ใช่ failure และยังไม่ต้องแก้เพื่อทำงานต่อ
- ผู้ใช้ต้องเพิ่มค่าเหล่านี้ใน `backend/.env` (ไฟล์นี้ห้าม commit): `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` โดย password ต้องยาวอย่างน้อย 8 ตัวอักษร
- หลังเปิดเครื่อง ให้เข้าโฟลเดอร์ `backend` แล้วตรวจ migration ก่อน:
  ```bash
  cd /home/wasu/claude_code/wms2/backend
  npx prisma migrate status
  ```
- จากนั้น apply PostgreSQL migrations และสร้างบัญชี admin:
  ```bash
  npm run migrate:deploy
  npm run seed
  ```
- ผลสำเร็จที่คาดหวัง: migration แสดงว่าไม่มีรายการค้าง และ seed แสดง `Created admin account: <username>` หรือ `Admin account already exists; bootstrap skipped: <username>`
- การ login จาก frontend แสดง `Internal server error` ไม่ใช่เพียง invalid password; ตรวจสอบ live endpoint ด้วยข้อมูลปลอมแล้วพบว่า `POST /api/auth/login` ตอบ HTTP 500 แม้ username ไม่มีอยู่จริง สาเหตุที่ต้องตรวจลำดับแรกคือ production schema/migration หรือ Vercel `DATABASE_URL` ไม่ใช่รหัสผ่าน
- เหตุผลที่ health ผ่านแต่ login 500 ได้: `/api/health` ตรวจเพียง `SELECT 1` จึงยืนยันแค่การเชื่อมต่อฐานข้อมูล ไม่ได้ยืนยันว่าตาราง `User` และคอลัมน์ตรงกับ Prisma schema
- ถ้า `migrate:deploy` แจ้งปัญหา Neon pooler ให้ใช้ direct PostgreSQL connection string สำหรับ migration/seed; ห้ามส่ง `DATABASE_URL` หรือ password ในแชต
- หลัง seed สำเร็จ ให้ลอง login ที่ `https://frontend-rose-one-72.vercel.app/`; ไม่ต้อง commit หรือ redeploy เพราะ seed เขียนลง PostgreSQL โดยตรง
- หากยังได้ 500 หลัง migration และ seed สำเร็จ ให้เปิด Vercel Runtime Logs ของ Backend deployment ล่าสุด แล้วส่งเฉพาะ error ที่ลบ secret แล้ว หรือส่งผลลัพธ์ `npx prisma migrate status` และ `npm run seed` โดยไม่ส่งเนื้อหา `.env`
- งานถัดไปหลัง login ผ่าน: ตรวจ logout/session revocation, CRUD, issuance/return, repair, role enforcement, CORS/cookie flags และ SPA refresh แล้วบันทึกผลต่อในไฟล์นี้

## 1 กันยายน 2026 — แก้ Login Internal server error

**สาเหตุที่ยืนยันแล้ว**

- `prisma migrate status` พบว่า PostgreSQL production ยังไม่ได้ apply migration `20260831150000_postgresql_baseline`
- สาเหตุที่ health ผ่านแต่ login ได้ HTTP 500 คือ `/api/health` ตรวจเพียง `SELECT 1` ขณะที่ login เรียกตาราง `User` ซึ่งยังไม่มี schema ที่จำเป็น

**การแก้ไขและ verification**

- รัน `npm run migrate:deploy` ใน `backend/` สำเร็จ และสร้าง schema จาก PostgreSQL baseline
- รัน `npm run seed` สำเร็จ สร้างบัญชี admin ตาม environment ที่ตั้งไว้ โดยไม่บันทึกค่าลับลง log
- ตรวจ `prisma migrate status` ซ้ำแล้วพบว่า database schema เป็นปัจจุบัน
- ทดสอบ deployed login สำเร็จ HTTP 200 และได้ user ที่ปลอดภัยโดยไม่มี `passwordHash`
- ทดสอบ `/api/auth/me` สำเร็จ, logout ได้ HTTP 204 และ session เดิมถูก revoke ได้ HTTP 401
- ทดสอบข้อมูล login ผิดได้ HTTP 401 `INVALID_CREDENTIALS` แทน HTTP 500
- รัน `npm run typecheck` จาก root ผ่าน
- รัน `npm test` ผ่าน: backend 7/7 tests และ frontend 3/3 tests
- รัน `npm run build` ผ่านทั้ง backend และ frontend; ยังคงมีคำเตือน Vite เรื่อง chunk ใหญ่และ Prisma package configuration deprecated ซึ่งไม่ทำให้ gate ล้มเหลว

**สถานะ**

- ปัญหา Login Internal server error ได้รับการแก้ไขที่ฐานข้อมูลแล้ว ไม่ต้อง redeploy โค้ด
- ควรทดสอบ CRUD และ business flows จาก browser จริงต่อ และ rotate credential ที่เคยอยู่ในไฟล์ local/ประวัติการสนทนา

## 1 กันยายน 2026 — ปรับปรุงความเร็วการตอบสนอง

**แก้ไขแล้ว**

- ปรับ `GET /api/dashboard/stats` ให้ใช้ Prisma `groupBy` เพียง query เดียว แทนการนับ 4 query แยกกัน โดยคง response shape เดิมและรองรับ status ที่ไม่มีข้อมูลด้วยค่า `0`
- เพิ่ม in-memory TTL cache 30 วินาทีและ request deduplication สำหรับ lookup ที่เปลี่ยนไม่บ่อย (`equipment-types` และ `employees`)
- invalidate lookup cache หลัง create/update/delete ของ equipment type และ employee เพื่อไม่ให้ข้อมูลใหม่ค้างอยู่หลัง mutation
- เพิ่ม route-level chunk preload เมื่อผู้ใช้เลื่อน pointer เข้าเมนู โดยยังคง `React.lazy` และไม่โหลดทุกหน้าตั้งแต่ initial bundle
- แยก `AppLayout` เป็น lazy chunk และตัดการ import `antd` จาก `App`/`ProtectedRoute` fallback เพื่อไม่ preload Ant Design shell ในเส้นทาง login
- เพิ่ม regression tests สำหรับ dashboard aggregation และ cache TTL, deduplication และ invalidation

**หลักการที่คงไว้**

- ไม่ลด bcrypt work factor, ไม่ cache authentication และไม่ปิดการตรวจ `sessionVersion`
- ไม่ cache history หรือ equipment instances ที่เปลี่ยนบ่อย
- ยังไม่ตั้งค่า Vercel region หรือปรับ `manualChunks` โดยเดาสุ่ม เพราะต้องยืนยัน region ของ Neon และ critical-path bundle จาก production metrics ก่อน

**ผลการตรวจสอบ**

- backend typecheck ผ่าน
- frontend typecheck ผ่าน
- backend tests ผ่าน 8/8 และ frontend tests ผ่าน 6/6
- production build ผ่านทั้ง backend และ frontend
- จาก local production build, initial modulepreload chunk ลดจาก 729.60 kB (gzip 235.13 kB) เหลือ 439.77 kB (gzip 136.22 kB) หลังแยก shell และ fallback ออกจาก `antd`; ตัวเลขนี้ยังไม่ใช่ latency จาก production deployment จริง
- หลังแยก shell แล้ว build ไม่แสดงคำเตือน Vite เรื่อง chunk ใหญ่กว่า 500 kB; เหลือคำเตือน Ant Design เรื่อง `Card bordered` ใน test ซึ่งไม่ทำให้ gate ล้มเหลว
- วัด deployment ปัจจุบันแบบไม่ส่ง credential 3 ครั้ง: `/api/health` ได้ `200` ที่ประมาณ `3482, 516, 534 ms` และหน้า frontend ได้ `200` ที่ประมาณ `478, 49, 52 ms`; ค่านี้เป็น baseline ของ health/static เท่านั้น และยังไม่ใช่ผลของ source changes จนกว่าจะ deploy ใหม่

**งานค้างถัดไป**

- วัด `TTFB`, server processing และ download ของ login, `/auth/me`, dashboard และ endpoint หลักจาก browser Network ทั้ง cold/warm request
- ตรวจ region ของ Vercel กับ Neon และพิจารณา `manualChunks` เฉพาะเมื่อ metrics ยืนยันว่าเป็นคอขวด
- ทำ browser smoke test หลัง deploy และบันทึกค่า p50/p95 โดยไม่บันทึก token, password, connection string หรือ secret

## 1 กันยายน 2026 — Issuance History, Profile และ User Management

**แก้ไขแล้ว**

- แก้ `dateFilter` ใน `backend/src/server.ts` ให้ `startDate`/`endDate` ที่เป็นค่าว่างหมายถึงไม่มีตัวกรอง ขณะที่ยัง reject วันที่ไม่ถูกต้องและช่วงวันที่กลับด้าน
- ปรับ `IssuanceHistoryPage` ไม่ส่ง optional query ที่เป็น empty string เพื่อป้องกัน `Invalid start date` ตั้งแต่ฝั่ง client และคง backward compatibility ฝั่ง API
- เพิ่ม `PUT /api/auth/profile` สำหรับแก้ username/email ของผู้ใช้ที่ authenticated โดยใช้ user id จาก session และคืนเฉพาะ `PublicUser`
- เพิ่ม `POST /api/auth/change-password` ตรวจรหัสผ่านเดิม, ใช้ bcrypt work factor 12, เพิ่ม `sessionVersion`, ล้าง session cookie และไม่คืนข้อมูลลับ
- เสริม admin user CRUD ให้ invalidate session เมื่อเปลี่ยน password/role และป้องกันการลบหรือ downgrade admin คนสุดท้ายด้วย transaction ระดับ `Serializable`; คงการห้ามลบบัญชีตนเอง
- เพิ่ม frontend API/types/auth state สำหรับ profile, password และ user CRUD
- เพิ่มหน้า Profile สำหรับทุก role และหน้า User Management พร้อม admin route guard, lazy routes และเมนูตาม role
- เพิ่ม frontend regression test สำหรับ Profile และปรับ test setup/mocks ให้จัดการ async state ได้ถูกต้อง

**ผลการตรวจสอบ**

- `npm run typecheck` จาก root — ผ่าน
- `npm test` จาก root — ผ่าน: backend 10/10 tests และ frontend 11/11 tests (6 test files)
- `npm run build` จาก root — ผ่านทั้ง backend และ frontend
- พบเพียงคำเตือนเดิมของ Ant Design (`Card bordered`/`Space direction` deprecated) และไม่มี test unhandled error; ยังไม่แก้ warning ที่อยู่นอก scope
- ยังไม่มีการ commit หรือ deploy source changes โดยอัตโนมัติ

**งานค้างถัดไป**

- เพิ่ม regression test เฉพาะ `UserManagementPage`, `AdminRoute` และ visibility ของเมนู หากต้องการ coverage เชิง UI เพิ่มเติม
- หลังผู้ใช้ commit/push/deploy ให้ทำ browser smoke test ของ issuance, profile, password และ admin user management
- วัด performance หลัง deploy ตาม Task #8 โดยไม่บันทึก token, password, connection string หรือ secret

## 1 กันยายน 2026 — ตรวจสอบ deployment หลัง deploy

**ผลตรวจสอบจาก production URL**

- `https://backend-ten-psi-94.vercel.app/api/health` ตอบสถานะระบบปกติ และฐานข้อมูลเชื่อมต่อแล้ว
- `https://backend-ten-psi-94.vercel.app/api/auth/me` ตอบ `401 Unauthorized` เมื่อไม่มี session ตามที่คาดหวัง
- `https://backend-ten-psi-94.vercel.app/api/users` ตอบ `401 Unauthorized` เมื่อไม่มี session ตามที่คาดหวัง
- `https://backend-ten-psi-94.vercel.app/api/issuance-history?startDate=&endDate=` ไม่เปิดเผยข้อมูลเมื่อไม่มี session และถูกปฏิเสธที่ authentication boundary; ยังไม่สามารถยืนยันผลรายการจริงโดยไม่มี authenticated session
- Frontend production ส่งหน้า HTML `Equipment Desk` สำหรับ `/`, `/issuance-history`, `/profile` และ `/user-management` โดยไม่พบข้อมูลบัญชีใน response

**ข้อจำกัด**

- ยังไม่ได้ทำ authenticated browser smoke test เพราะ session/cookie ของผู้ใช้ไม่สามารถเข้าถึงจากการตรวจสอบแบบไม่ส่ง credential ได้
- ยังไม่ได้ยืนยัน HTTP response หลัง login, การแสดงรายการ issuance, การแก้ Profile และ admin CRUD จาก session จริง
- ไม่ได้อ่านหรือส่ง password, token, cookie, connection string หรือค่า secret ใด ๆ

## 1 กันยายน 2026 — วัด latency หลัง deploy

**วิธีวัด**

- ใช้ `curl` แบบไม่เก็บ response body และไม่ส่ง credential
- วัด 10 requests ต่อ endpoint จาก runtime เดียวกัน
- ค่า `p50` เป็น median ของ 10 ตัวอย่าง และ `p95-observed` คือค่าสูงสุดของ sample ชุดเล็กนี้ ไม่ใช่ percentile จาก production monitoring ระยะยาว

**ผลลัพธ์**

| Endpoint | Status | Average | p50 | p95-observed |
| --- | ---: | ---: | ---: | ---: |
| Backend `/api/health` | 200 | 632 ms | 605 ms | 829 ms |
| Frontend `/` | 200 | 130 ms | 127 ms | 163 ms |
| Frontend `/issuance-history` | 200 | 133 ms | 131 ms | 172 ms |
| Backend `/api/auth/me` ไม่มี session | 401 | 377 ms | 370 ms | 452 ms |
| Backend `/api/issuance-history?startDate=&endDate=` ไม่มี session | 401 | 364 ms | 365 ms | 381 ms |

**สรุปและข้อจำกัด**

- Frontend static/SPA shell ตอบสนองเร็วและทุกเส้นทางที่ตรวจได้ตอบ `200`
- Backend warm health request อยู่ราว 0.6 วินาที แต่ cold/warm แยกอย่างเป็นระบบยังต้องใช้ APM หรือ browser Network
- ค่า `/auth/me` และ history ที่วัดเป็น unauthenticated `401` จึงไม่ใช่เวลาของ authenticated workload จริง
- ยังไม่ได้วัด successful login, authenticated dashboard, issuance history และ repair history เพราะไม่มี authenticated browser session ในเครื่องมือ และไม่ได้อ่านหรือส่ง credential
- การวัดรอบนี้เป็น snapshot จากจุดตรวจเดียว ไม่ควรใช้แทน p95/p99 ของผู้ใช้จริงในระยะยาว

## 1 กันยายน 2026 — ปรับปรุง performance รอบใหม่

**แก้ไขแล้ว**

- เปลี่ยน read-only `findMany + count` ของ `GET /api/equipment-instances`, `GET /api/issuance-history` และ `GET /api/repair-history` จาก Prisma `$transaction` เป็น `Promise.all` เพื่อลด transaction overhead โดยคง pagination, filters, relations และ response shape เดิม
- เพิ่ม `Server-Timing: app;dur=...` จาก middleware ที่วัดเฉพาะ application elapsed time ก่อนส่ง response โดยไม่อ่านหรือเปิดเผย body, query values, authorization, cookie หรือข้อมูล credential
- เพิ่ม `preloadAuthenticatedShell()` ให้โหลด `AppLayout` และ `DashboardPage` พร้อมกันหลัง login สำเร็จ โดยยังคง route-level lazy loading และไม่เพิ่ม initial bundle ของหน้า login
- เพิ่ม regression test สำหรับ timing header ของ response ปกติ/unauthenticated error และ login transition preload ใน `frontend/src/pages/LoginPage.test.tsx`

**ผลการตรวจสอบ**

- backend `npm run typecheck` — ผ่าน
- backend `npm test` — ผ่าน 10/10 tests
- frontend `npm run typecheck` — ผ่าน
- frontend `npm test -- --run` — ผ่าน 12/12 tests ใน 7 test files; ไม่พบ unhandled error
- backend และ frontend `npm run build` — ผ่าน
- `git diff --check` — ผ่าน
- ยังคงพบเฉพาะคำเตือน Ant Design เดิมเรื่อง `Card bordered` และ `Space direction` และ Prisma package configuration deprecated ซึ่งไม่ทำให้ quality gate ล้มเหลว

**ข้อจำกัดและงานถัดไป**

- ยังไม่ได้ deploy source changes และยังไม่ได้อ้างว่า latency production ลดลงจนกว่าจะวัดหลัง deploy ใหม่ด้วย sample เดิม
- ต้องตรวจ Vercel cold/warm function duration, region และ Neon/database latency จาก dashboard โดยไม่เปิดเผย connection string; หาก region ไม่สอดคล้องให้เสนอ operational change แยกก่อนปรับ production
- หลังผู้ใช้เปิด browser session เอง จึงค่อยวัด successful login และ authenticated `/auth/me`, dashboard, issuance และ repair โดยส่งต่อเฉพาะ status/timing ที่ไม่ใช่ credential หรือ token

## 1 กันยายน 2026 — ปรับนโยบายความยาวรหัสผ่าน

- ปรับความยาวรหัสผ่านขั้นต่ำจาก 12 เป็น 8 ตัวอักษรสำหรับการสร้างผู้ใช้, การแก้ไขรหัสผ่านโดย admin, การเปลี่ยนรหัสผ่านของตนเอง และ `ADMIN_PASSWORD` ใน seed
- เพิ่ม `MIN_PASSWORD_LENGTH` ใน `backend/src/auth.ts` เพื่อให้ backend schema และ seed ใช้ค่ากลางเดียวกัน
- อัปเดต validation message ของ Profile/User Management รวมถึง `README.md` และ `backend/.env.example`
- คง bcrypt work factor 12, การตรวจรหัสผ่านเดิม และ `sessionVersion` session revocation ไว้เหมือนเดิม
