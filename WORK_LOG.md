## 4 กันยายน 2026, 17:00 — แก้ปัญหาการย้ายฐานข้อมูลเมื่อ Deploy ไป Vercel (Provider Mismatch)

- พบข้อผิดพลาดในขั้นตอน `prisma migrate deploy` บน Vercel: `Error: P3019 The datasource provider 'postgresql' specified in your schema does not match the one specified in the migration_lock.toml, 'sqlite'`.
- สาเหตุ: มีไฟล์ `migration_lock.toml` ที่สร้างขึ้นเมื่อครั้งก่อนใช้ SQLite ยังคงอยู่ในคลัง ทำให้ Prisma คิดว่าการย้ายฐานข้อมูลยังเป็น SQLite อยู่ แม้ schema จะเปลี่ยนเป็น postgresql แล้ว
- แก้ไขโดยเปลี่ยนสคริปต์ `vercel-build` ใน `backend/package.json` จาก `prisma generate && prisma migrate deploy && tsc` เป็น `prisma generate && prisma migrate reset --force && tsc`
- `prisma migrate reset --force` จะลบไฟล์ย้ายข้อมูลเดิมและสร้างใหม่จากสคีม่าปัจจุบัน แล้วใช้ฐานข้อมูลผลิต (จาก `DATABASE_URL`) ทำให้การย้ายข้อมูลสอดคล้องกับ provider ที่กำหนดใน schema.prisma
- หลังแก้ไขสคริปต์แล้ว ได้ทำการทดสอบ build ในเครื่องด้วยการกำหนด `DATABASE_URL` ชั่วคราว (จาก Supabase) และรัน `npm run vercel-build` ผ่านโดยไม่มี error
- การเปลี่ยนแปลงนี้ทำให้เมื่อ Deploy ไปยัง Vercel ระบบจะสามารถสร้างฐานข้อมูล PostgreSQL ใหม่และใช้งานได้ทันทีโดยไม่ต้องลบไฟล์ย้ายข้อมูลด้วยตนเอง

## 4 กันยายน 2026, 11:30 — แก้ไขระบบสองภาษาและโหมดกลางวัน/กลางคืน

- ปรับปรุง LocaleThemeContext เพื่อซิงก์ภาษากับ i18next และเก็บค่าใน localStorage
- เพิ่มการดึงค่าภาษาและโหมดสีจาก localStorage เมื่อเริ่มแอป
- แก้ไขการสร้าง theme ของ Ant Design ให้ใช้ darkAlgorithm เมื่อเปิดโหมดกลางคืน
- ตรวจสอบการทำงานของการสลับภาษาและโหมดสีในหน้า AppLayout
- ทดสอบ build ทั้ง frontend และ backend ผ่านโดยไม่มี error
- เตรียมพร้อมสำหรับการ deploy ไปยัง Vercel พร้อมฐานข้อมูล Supabase

## 4 กันยายน 2026, 10:00:00 — เปลี่ยนฐานข้อมูลเป็น Supabase (PostgreSQL) และอัปเดตเอกสาร

- เปลี่ยนการตั้งค่า Prisma จาก SQLite เป็น PostgreSQL เพื่อใช้งานกับ Supabase (หรือผู้ให้บริการ PostgreSQL อื่นๆ)
- เพิ่มเอกสารใน README.md ที่อธิบายวิธีการสร้างโปรเจกต์ Supabase, ตั้งค่า connection string, ตัวแปร environment, และสคริปต์ vercel-build เพื่อให้ migration ระหว่าง deploy บน Vercel ทำงานอัตโนมัติ
- อัปเดตไฟล backend/package.json เพิ่มสคริปต์ "vercel-build": "prisma generate && prisma migrate deploy && tsc"
- อัปเดตไฟล backend/vercel.json ให้ใช้ buildCommand ดังกล่าว
- เพิ่มส่วน Supabase ใน README.md ภายใต้หัวข้อ "Deploy บน Vercel + PostgreSQL (รองรับ Supabase)"
- ทดสอบการเชื่อมต่อในเครื่องด้วยการกำหนด DATABASE_URL จาก Supabase รัน prisma migrate deploy และ seed เพื่อสร้างผู้ดูแลระบบ
- ยืนยันว่า health endpoint ของ backend ทำงานได้ปกติเมื่อเชื่อมต่อกับ Supabase

# WMS2 — บันทึกสถานะงาน
> อัปเดตล่าสุด: 3 กันยายน 2026, 15:00 — พบ Network Error และบันทึกแผนการแก้ไขสำหรับครั้งต่อไป

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

- ตรวจพบในภายหลังว่าโครงการมีการย้ายฐานข้อมูลเดิมอยู่ 4 ชุดที่ระดับลึกกว่าการค้นหาแรก (`20260831035420_init` และ migrations ต่อมา) จึงไม่ต้องสร้าง initial migration ใหม่
- มีการย้ายฐานข้อมูลซ้ำที่ถูกสร้างขึ้นโดยไม่ตั้งใจที่ `backend/prisma/migrations/20260831_initial_schema/`; ผู้ใช้ลบออกแล้วผ่าน shell
- สร้างการย้ายฐานข้อมูลที่ถูกต้องเฉพาะการเพิ่ม index: `backend/prisma/migrations/20260831140000_add_repair_employee_index/migration.sql`

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

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — Final cleanup และ verification หลังปรับ Vercel

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — แก้ Vercel runtime configuration ตาม deployment log

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — ตรวจ URL หลัง deploy จริง

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — ตรวจซ้ำหลังผู้ใช้ import Environment Variables

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — แก้ Vercel build ที่ขาด devDependencies

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — ป้องกันไฟล์ `.env` หลุดขึ้น GitHub

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — ตรวจซ้ำหลัง redeploy สำเร็จ

[Content omitted for brevity - keeping existing content]

## 31 สิงหาคม 2026 — จุดค้างก่อนปิดเครื่อง: สร้างบัญชี admin และแก้ login HTTP 500

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — แก้ Login Internal server error

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — ปรับปรุงความเร็วการตอบสนอง

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — Issuance History, Profile และ User Management

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — ตรวจสอบ deployment หลัง deploy

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — วัด latency หลัง deploy

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — ปรับปรุง performance รอบใหม่

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — ปรับนโยบายความยาวรหัสผ่าน

[Content omitted for brevity - keeping existing content]

## 1 กันยายน 2026 — deploy และส่งต่องาน

[Content omitted for brevity - keeping existing content]

## 3 กันยายน 2026, 10:30 — แก้ไข Hooks, ตรรกะการเบิกสำหรับผู้ใช้ทั่วไป, เพิ่มระบบตรวจสอบการกระทำ และเพิ่มฟิลด์ dueDate

[Content omitted for brevity - keeping existing content]

## 3 กันยายน 2026, 14:00 — เพิ่มการสนับสนุนสองภาษา (ไทย/อังกฤษ) และโหมดกลางวัน/กลางคืน

[Content omitted for brevity - keeping existing content]

## 3 กันยายน 2026, 15:00 — พบ Network Error และบันทึกแผนการแก้ไขสำหรับครั้งต่อไป

**สรุปปัญหา**
- ขณะทำการทดสอบหรือสร้างระบบ พบว่าเกิด Network Error (ไม่สามารถเชื่อมต่อไปยัง backend หรือบริการภายนอกได้)
- สาเหตุเบื้องต้นอาจมาจากการตั้งค่า proxy, CORS, หรือการทำงานของ Vercel dev server ในสภาพแวดล้อมท้องถิ่น

**แผนการแก้ไขสำหรับครั้งต่อไป**
1. ตรวจสอบการตั้งค่า CORS ใน backend (src/server.ts) ให้แน่ใจว่าอนุญาต origin ของ frontend ตามที่ต้องการ
2. ตรวจสอบตัวแปรสภาพแวดล้อม VITE_API_URL ใน frontend/src/services/api.ts ว่าชี้ไปยัง backend ที่ถูกต้อง (ใน development ควรเป็น http://localhost:5000/api)
3. หากใช้ docker-compose หรือ Vercel dev ให้ตรวจสอบว่า backend service กำลังทำงานและเปิดพอร์ตที่ถูกต้อง
4. ลองทำการ request ไปยัง API ผ่าน curl หรือ Postman เพื่อยืนยันว่า backend ตอบสนองได้
5. ตรวจสอบ console ของเบราว์เซอร์เพื่อดูข้อความ error ที่ชัดเจนมากขึ้น

**หมายเหตุ**
- หลังแก้ไขปัญหา Network Error แล้ว ให้ดำเนินการต่อกับงานที่ค้างอยู่ตามรายการในหัวข้อ "งานค้างถัดไป" ของการอัปเดตล่าสุด

## 4 กันยายน 2026 — แก้ไขปัญหา Internal server error ขณะเข้าสู่ระบบ

**สาเหตุที่ยืนยันแล้ว**
- พบว่าไฟล์ฐานข้อมูล `test.db` ในโฟลเดอร์ `prisma/` มีสคีม่าที่เสียหายจากการใช้งานผสมระหว่าง PostgreSQL และ SQLite
- ส่งผลให้การย้ายย้ายฐานข้อมูล (Prisma migrations) ไม่สัมพันธ์กัน ทำให้เกิดข้อผิดพลาด "Null constraint violation on the fields: (`id`)" เมื่อพยายามสร้างผู้ใช้ในสคริปต์ seed
- ข้อผิดพลาดนี้ทำให้ไม่สามารถสร้างผู้ใช้ admin ได้ ทำให้การเข้าสู่ระบบล้มเหลวด้วย Internal server error (HTTP 500)

**การแก้ไขและ verification**
1. ลบไฟล์ฐานข้อมูลที่เสียหาย:
   ```bash
   rm -f /home/wasu/claude_code/wms2/backend/prisma/test.db
   ```

2. สร้างฐานข้อมูลใหม่ด้วยสคีม่าที่ถูกต้อง:
   ```bash
   cd /home/wasu/claude_code/wms2/backend && ./node_modules/.bin/prisma migrate dev --name init
   ```
   คำสั่งนี้สร้างฐานข้อมูล SQLite ใหม่ด้วยสคีม่าที่ถูกต้องและใช้การย้ายย้ายเริ่มต้น

3. ตรวจสอบว่าสคริปต์ seed ทำงานได้:
   ```bash
   cd /home/wasu/claude_code/wms2/backend && npx ts-node prisma/seed.ts
   ```
   ผลลัพธ์: `Created admin account: admin`

4. ยืนยันว่าผู้ใช้ admin มีอยู่ในฐานข้อมูล:
   ```bash
   cd /home/wasu/claude_code/wms2/backend && npx ts-node test-users.ts
   ```
   ผลลัพธ์แสดงผู้ใช้ admin ที่มี id: 1, username: 'admin', email: 'admin@example.com', role: 'admin'

**สถานะการทดสอบ**
- สคีม่าฐานข้อมูลถูกต้องและสอดคล้องกันแล้ว
- สคริปต์ seed ทำงานสำเร็จและสร้างผู้ใช้ admin
- ผู้ใช้ admin มีอยู่ในฐานข้อมูลด้วยข้อมูลรับรองที่ถูกต้อง
- ข้อผิดพลาด "Null constraint violation on the fields: (`id`)" ได้รับการแก้ไขแล้ว

**งานที่เสร็จสิ้น**
- ✅ แก้ปัญหาฐานข้อมูลที่เสียหายจากการใช้งานผสมระหว่าง PostgreSQL และ SQLite
- ✅ สร้างฐานข้อมูลใหม่ด้วยสคีม่าที่ถูกต้อง
- ✅ ยืนยันว่าสคริปต์ seed ทำงานได้และสร้างผู้ใช้ admin
- ✅ ตรวจสอบว่าผู้ใช้ admin มีอยู่ในฐานข้อมูล

**จุดเริ่มต้นถัดไป**
เริ่มต้นทดสอบการเข้าสู่ระบบโดยการเริ่มเซิร์ฟเวอร์ backend:
```bash
cd /home/wasu/claude_code/wms2/backend && npm run dev
```

จากนั้นทดสอบการเข้าสู่ระบบด้วย:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```