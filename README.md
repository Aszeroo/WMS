# Equipment Management System

ระบบจัดการอุปกรณ์สำหรับบันทึกครุภัณฑ์ การเบิกคืน และประวัติการซ่อม พร้อมระบบยืนยันตัวตนและการกำหนดสิทธิ์ (`admin`, `staff`, `viewer`)

## โครงสร้างโครงการ

- `backend/` — Express 5 + TypeScript + Prisma 6 API สำหรับ Vercel Functions
- `frontend/` — React 19 + Vite 8 + Ant Design 6 สำหรับ Vercel Static Build
- `backend/prisma/schema.prisma` — schema production สำหรับ PostgreSQL
- `backend/prisma/sqlite-test/schema.prisma` — schema test-only สำหรับ Vitest ในเครื่อง/CI
- `docker-compose.yml` — ทางเลือกสำหรับรัน stack แบบ container โดยใช้ PostgreSQL ภายนอก
- `WORK_LOG.md` — บันทึกการทำงานหลักเพียงไฟล์เดียว

## Deploy บน Vercel + PostgreSQL

ระบบนี้ออกแบบให้สร้าง **สอง Vercel Projects จาก repository เดียวกัน** เพื่อให้แต่ละส่วนใช้ dependency และ build context ของตนเอง

### 1. สร้าง PostgreSQL

สร้าง database จาก Neon, Vercel Postgres หรือผู้ให้บริการ PostgreSQL ที่รองรับ connection จาก serverless และเตรียม connection string ที่มี `sslmode=require` ตามข้อกำหนดของผู้ให้บริการ ห้ามใช้ `file:...` หรือ SQLite เป็นฐานข้อมูล production บน Vercel

### 2. Deploy backend project

สร้าง Vercel Project โดยตั้งค่า:

- **Root Directory:** `backend`
- **Framework Preset:** Other
- **Build Command:** `npm run build`
- **Install Command:** `npm ci --include=dev`
- **Output Directory:** เว้นว่าง (เป็น Node.js Function)

ตั้ง Environment Variables ของ backend (Production และ Preview ตามที่ต้องการ):

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
NODE_ENV=production
SESSION_SECRET=<สุ่มค่าอย่างน้อย 32 ตัวอักษร>
CORS_ORIGIN=https://<ชื่อ-frontend-project>.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
TRUST_PROXY=true
```

`ADMIN_USERNAME`, `ADMIN_EMAIL` และ `ADMIN_PASSWORD` ไม่จำเป็นต่อ build และไม่ควรเก็บใน repository ให้ใช้เฉพาะขั้นตอน seed ที่ปลอดภัยด้านล่าง

หลังติดตั้ง dependencies ให้ apply migration กับ database **ครั้งเดียวก่อนเปิดใช้งาน**:

```bash
cd backend
npm ci
npm run generate
DATABASE_URL="<PostgreSQL connection string>" npm run migrate:deploy
```

รัน seed admin แยกจาก Vercel build และใช้ secret จริงผ่าน environment ของเครื่อง/ระบบ CI ที่ปลอดภัย:

```bash
DATABASE_URL="<PostgreSQL connection string>" \
ADMIN_USERNAME="admin" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="<รหัสผ่านอย่างน้อย 12 ตัวอักษร>" \
npm run seed
```

ตรวจ backend หลัง deploy:

```bash
curl https://<ชื่อ-backend-project>.vercel.app/api/health
```

ต้องได้สถานะ `ok` และ `database: connected` โดย function `backend/api/index.ts` จะ export Express app และไม่เปิด TCP listener ต่อ request

### 3. Deploy frontend project

สร้าง Vercel Project จาก repository เดิม โดยตั้งค่า:

- **Root Directory:** `frontend`
- **Framework Preset:** Other หรือ Vite
- **Build Command:** `npm run build`
- **Install Command:** `npm ci --include=dev`
- **Output Directory:** `dist`

ตั้ง Environment Variable ของ frontend:

```text
VITE_API_URL=https://<ชื่อ-backend-project>.vercel.app/api
```

ห้ามใช้ค่า `localhost` ใน Production เพราะ Vite จะฝังค่านี้ลงใน static bundle แล้ว deploy ใหม่เมื่อเปลี่ยนค่า `VITE_API_URL` การ rewrite ใน `frontend/vercel.json` ทำให้การ refresh เส้นทางของ React Router กลับไปที่ `index.html`

หลัง deploy ให้อัปเดต backend `CORS_ORIGIN` ให้ตรงกับ URL จริงของ frontend แบบ exact origin (ไม่มี `/` ท้าย URL) แล้ว redeploy backend หากจำเป็น การใช้คนละ Vercel origin ต้องใช้ `COOKIE_SAME_SITE=none` และ `COOKIE_SECURE=true`; browser บางรุ่นอาจจำกัด third-party cookies แนะนำให้ใช้ custom domain ที่ออกแบบให้ frontend/API อยู่ภายใต้ site เดียวกันเมื่อเปิดใช้งานจริง

### ลำดับ deploy ที่ถูกต้อง

1. สร้าง PostgreSQL และเก็บ connection string เป็น secret
2. Deploy backend function
3. รัน `prisma migrate deploy` กับ PostgreSQL
4. รัน seed admin แยกจาก build
5. Deploy frontend พร้อม `VITE_API_URL`
6. ตั้งค่า `CORS_ORIGIN` เป็น frontend URL แล้วตรวจ health, login, logout และ flow ธุรกิจ

Vercel build จะไม่รัน migration หรือ seed อัตโนมัติ เพื่อป้องกัน build preview แก้ไขฐานข้อมูล production โดยไม่ตั้งใจ

## เริ่มต้นพัฒนาในเครื่อง

ต้องใช้ PostgreSQL ที่เข้าถึงได้จากเครื่อง และคัดลอกตัวอย่าง environment ก่อน:

```bash
npm run install:all
cp backend/.env.example backend/.env
# แก้ DATABASE_URL, SESSION_SECRET และค่าที่จำเป็นใน backend/.env
npm run generate --prefix backend
npm run migrate:deploy --prefix backend
npm run seed --prefix backend
npm run typecheck
npm test
npm run build
```

เปิด development server แยกกัน:

```bash
npm run dev:backend   # http://localhost:5000
npm run dev:frontend  # http://localhost:5173
```

`frontend/.env` ตัวอย่างใช้ `VITE_API_URL=http://localhost:5000/api` ส่วน frontend ที่ไม่มีตัวแปรนี้จะใช้ `/api` เป็นค่า default สำหรับการ reverse proxy/same-origin

## Docker Compose (ทางเลือก)

Docker Compose ยังเก็บไว้เป็น deployment ทางเลือก แต่ใช้ PostgreSQL ภายนอกเช่นเดียวกับ Vercel ไม่ได้สร้าง database volume แบบ SQLite:

```bash
cp .env.example .env
# ตั้ง DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD และ CORS_ORIGIN ใน .env
# local HTTP ใช้ COOKIE_SECURE=false; production HTTPS ใช้ COOKIE_SECURE=true
docker compose up -d --build
docker compose ps
curl http://localhost:5173/health
```

`backend-migrate` และ `backend-bootstrap` เป็น one-shot services ที่ต้องสำเร็จก่อน backend รับคำขอ หยุด stack โดยไม่ลบข้อมูลที่ database provider:

```bash
docker compose down
```

## Auth และสิทธิ์

- `POST /api/auth/login` รับ `identifier` หรือ `username`/`email` และ `password` คืน user ที่ไม่มี `passwordHash` พร้อม bearer token fallback
- `POST /api/auth/logout` ล้าง `httpOnly` cookie และเพิ่ม `sessionVersion` เพื่อ revoke token เดิม
- `GET /api/auth/me` ตรวจสอบ session ปัจจุบัน
- session ใช้ cookie ชื่อ `wms_session`; API client อื่นใช้ `Authorization: Bearer <token>` ได้
- `admin` จัดการข้อมูลและผู้ใช้รวมถึงลบข้อมูล, `staff` สร้าง/แก้ไขได้แต่ลบไม่ได้, `viewer` อ่านได้เท่านั้น
- ข้อมูลธุรกิจทุก endpoint ต้อง login ส่วน `/`, `/health`, `/api/health` และ login/logout เป็น public

## API หลัก

- `GET /api/health` — ตรวจสอบ API และ database
- `GET|POST|PUT|DELETE /api/equipment-types`
- `GET|POST|PUT|DELETE /api/equipment-instances`
- `GET|POST|PUT|DELETE /api/employees`
- `GET|POST|PUT|DELETE /api/issuance-history`
- `GET|POST|PUT|DELETE /api/repair-history`
- `GET|POST|PUT|DELETE /api/users` — เฉพาะ admin
- `GET /api/dashboard/stats`

การสร้าง equipment instances รองรับ `serialNumbers` เป็น array ระบบป้องกันการเบิกอุปกรณ์ที่ไม่พร้อมใช้งาน ป้องกันการแจ้งซ่อมขณะยังถูกเบิก และปรับสถานะอุปกรณ์อัตโนมัติเมื่อเบิก คืน หรือเปลี่ยนสถานะงานซ่อม

## ตรวจสอบคุณภาพ

```bash
npm run typecheck
npm test
npm run build
npm audit --prefix backend --audit-level=high
npm audit --prefix frontend --audit-level=high
```

Backend tests ใช้ `backend/prisma/sqlite-test/schema.prisma` และฐานข้อมูล `backend/test.db` ชั่วคราว เพื่อให้ CI รันได้โดยไม่ต้องมี PostgreSQL ภายนอก การ deploy production ใช้ `backend/prisma/schema.prisma` และ PostgreSQL migration เท่านั้น

## Environment files

- `.env.example` — ตัวอย่างสำหรับ Docker Compose
- `backend/.env.example` — backend local/Vercel และคำสั่ง seed
- `frontend/.env.example` — frontend local และ URL backend production

ไฟล์ `.env` จริง, connection string, password และ session secret ต้องไม่ commit หรือเผยแพร่
