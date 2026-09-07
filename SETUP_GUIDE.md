# คู่มือการตั้งค่าและติดตั้งระบบจัดการอุปกรณ์ (WMS2)

คู่มือนี้จะแนะนำขั้นตอนการตั้งค่าและติดตั้งระบบจัดการอุปกรณ์ WMS2 ตั้งแต่การโหลดโค้ดไปจนถึงการทำงานบน production ได้ 100%

## ข้อกำหนดเบื้องต้น (Prerequisites)

ก่อนเริ่มต้น ตรวจสอบว่าคุณมีสิ่งต่อไปนี้ติดตั้งไว้แล้ว:

1. **Node.js** เวอร์ชัน 18.0.0 หรือสูงกว่า
2. **npm** (มาพร้อมกับ Node.js) หรือ **yarn**
3. **Git** สำหรับการ clone repository
4. สำหรับ production: บัญชี **Supabase** (หรือผู้ให้บริการ PostgreSQL อื่นๆ) และ **Vercel**

## ขั้นตอนที่ 1: โหลดโค้ดโครงการ

```bash
# Clone repository
git clone <repository-url>
cd wms2

# หรือหากคุณมีไฟล์โครงการอยู่แล้ว ให้เข้าไปที่โฟลเดอร์โครงการ
cd /path/to/wms2
```

## ขั้นตอนที่ 2: ติดตั้ง dependencies

```bash
# ติดตั้ง dependencies ทั้ง backend และ frontend
npm run install:all

# หรือติดตั้งแยกกัน
npm install --prefix backend
npm install --prefix frontend
```

## ขั้นตอนที่ 3: การพัฒนาในเครื่อง (Local Development) - ใช้ SQLite สำหรับการทดสอบ

สำหรับการพัฒนาและทดสอบในเครื่องโดยไม่ต้องติดตั้ง PostgreSQL ให้ทำตามขั้นตอนต่อไปนี้:

### 3.1 ตั้งค่า environment variables สำหรับ backend

```bash
cd backend
cp .env.example .env
```

แก้ไขไฟล์ `.env` ในโฟลเดอร์ `backend` หากจำเป็น (โดยปกติค่าเริ่มต้นใช้ SQLite อยู่แล้ว):

```
# Local development environment using existing test.db
DATABASE_URL="file:./test.db"
PORT=5000

# Comma-separated exact frontend origins. Use the frontend Vercel URL in production.
CORS_ORIGIN="http://localhost:5173"

# Generate a unique value with at least 32 characters in production.
SESSION_SECRET="dhm9SjLT+36+7JzIid86DTY4gAFfYhn6TU7rztbJS28="
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
TRUST_PROXY=false

# Used only by the separate post-deploy seed command.
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

### 3.2 เริ่มต้นฐานข้อมูลทดสอบและรัน migration

```bash
# อยู่ในโฟลเดอร์ backend
npx prisma migrate deploy --schema prisma/sqlite-test/schema.prisma
npx prisma generate --schema prisma/sqlite-test/schema.prisma
```

### 3.3 รันการสร้างข้อมูลเริ่มต้น (seed) เพื่อสร้างผู้ใช้ admin

```bash
npm run seed --prefix backend
```

คุณควรเห็นข้อความ: `Created admin account: admin`

### 3.4 เริ่มเซิร์ฟเวอร์พัฒนา

เปิดสอง terminal หน้าต่าง:

**Terminal ที่ 1 - เริ่ม backend:**
```bash
cd backend
npm run dev  # จะทำงานที่ http://localhost:5000
```

**Terminal ที่ 2 - เริ่ม frontend:**
```bash
cd frontend
npm run dev  # จะทำงานที่ http://localhost:5173
```

### 3.5 ทดสอบการทำงาน

1. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`
2. เข้าสู่ระบบด้วย:
   - ชื่อผู้ใช้: `admin`
   - รหัสผ่าน: `admin123`
3. ทดสอบการใช้งานระบบต่างๆ เช่น:
   - ดู dashboard
   - จัดการประเภทอุปกรณ์
   - จัดการ instances ของอุปกรณ์
   - จัดการพนักงาน
   - ดูประวัติการเบิกคืน
   - ดูประวัติการซ่อม

### 3.6 รันการทดสอบอัตโนมัติ

```bash
# รันการทดสอบทั้ง backend และ frontend
npm test

# หรือรันแยกกัน
npm run test:backend
npm run test:frontend
```

## ขั้นตอนที่ 4: การเตรียมพร้อมสำหรับ production (ใช้ Supabase/PostgreSQL และ Vercel)

สำหรับการ deploy ไปยัง production โดยใช้ Supabase หรือผู้ให้บริการ PostgreSQL อื่นๆ ให้ทำตามขั้นตอนต่อไปนี้:

### 4.1 สร้างฐานข้อมูล PostgreSQL บน Supabase

1. ไปที่ [Supabase](https://supabase.com) และสร้างบัญชีหากยังไม่มี
2. สร้างโปรเจกต์ใหม่
3. ไปที่ **Settings → Database** เพื่อดู connection string
4. คัดลอก connection string ที่มีรูปแบบ:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres
   ```

### 4.2 ตั้งค่า environment variables สำหรับ backend (production)

```bash
cd backend
cp .env.example .env
```

แก้ไขไฟล์ `.env` ในโฟลเดอร์ `backend` ดังนี้:

```
# Production environment using Supabase/PostgreSQL
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres"
NODE_ENV=production
SESSION_SECRET=[สุ่มค่าอย่างน้อย 32 ตัวอักษร]  # สร้างสุ่มอย่างน้อย 32 ตัวอักษร
CORS_ORIGIN=https://[ชื่อ-frontend-project].vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
TRUST_PROXY=true

# สำหรับการสร้างผู้ใช้ admin แยกต่างหาก (ไม่ควรเก็บใน repo)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=[รหัสผ่านอย่างน้อย 8 ตัวอักษร]
```

### 4.3 ตั้งค่า environment variables สำหรับ frontend (production)

```bash
cd frontend
cp .env.example .env
```

แก้ไขไฟล์ `.env` ในโฟลเดอร์ `frontend` ดังนี้:

```
VITE_API_URL=https://[ชื่อ-backend-project].vercel.app/api
```

### 4.4 เตรียมสคีมาฐานข้อมูล

ตรวจสอบว่า `backend/prisma/schema.prisma` ตั้งค่า `provider = "postgresql"` (ซึ่งเป็นค่าเริ่มต้นแล้ว):

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

สร้างไคลเอนต์ Prisma:

```bash
cd backend
npx prisma generate
```

### 4.5 สร้างโครงการใน Vercel

คุณจะต้องสร้างสองโครงการใน Vercel จาก repository เดียวกัน:

#### สำหรับ backend โครงการ:
1. ไปที่ [Vercel](https://vercel.com) และสร้างบัญชีหากยังไม่มี
2. คลิก "New Project" และเชื่อมต่อกับ repository ของคุณ
3. ตั้งค่า:
   - **Framework Preset:** Other
   - **Root Directory:** `backend`
   - **Build Command:** `npm run vercel-build`
   - **Install Command:** `npm ci --include=dev`
   - **Output Directory:** เว้นว่าง (เป็น Node.js Function)

#### สำหรับ frontend โครงการ:
1. ทำขั้นตอนเดียวกันกับข้างต้น แต่ตั้งค่า:
   - **Framework Preset:** Vite หรือ Other
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Install Command:** `npm ci --include=dev`
   - **Output Directory:** `dist`

### 4.6 ตั้งค่า environment variables ใน Vercel

สำหรับทั้งสองโครงการ (backend และ frontend) ในหน้า Settings ของแต่ละโครงการใน Vercel:

#### สำหรับ backend:
```
DATABASE_URL=[connection-string-of-your-supabase]
NODE_ENV=production
SESSION_SECRET=[สุ่มค่าอย่างน้อย 32 ตัวอักษร]
CORS_ORIGIN=https://[ชื่อ-frontend-project].vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
TRUST_PROXY=true
```

> **หมายเหตุ:** ไม่ต้องตั้ง `ADMIN_USERNAME`, `ADMIN_EMAIL`, และ `ADMIN_PASSWORD` ใน Vercel เนื่องจากจะใช้เฉพาะขั้นตอน seed ที่ปลอดภัยด้านล่าง

#### สำหรับ frontend:
```
VITE_API_URL=https://[ชื่อ-backend-project].vercel.app/api
```

### 4.7 การ deploy ไปยัง Vercel

หลังจากตั้งค่า environment variables แล้ว ให้ทำการ deploy โดยการ push ไปยัง repository (Vercel จะทำการ build และ deploy อัตโนมัติเมื่อมีการ push ไปยัง branch ที่เชื่อมต่อ)

### 4.8 รันการย้ายข้อมูลและสร้างข้อมูลเริ่มต้นหลังจาก deploy backend

หลังจากที่ backend ถูก deploy ไปยัง Vercel สำเร็จแล้ว ให้รันคำสั่ง seed แยกต่างหากด้วยตัวแปรสภาพแวดล้อมจริงของคุณ:

```bash
# แทนที่ [connection-string-of-your-supabase] ด้วย connection string จริงของคุณ
DATABASE_URL="[connection-string-of-your-supabase]" \
ADMIN_USERNAME="admin" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="[รหัสผ่านอย่างน้อย 8 ตัวอักษร]" \
npm run seed --prefix backend
```

> **สำคัญ:** คำสั่งนี้ต้องรันบนเครื่องของคุณ (ไม่ใช่ใน Vercel) เนื่องจากต้องใช้ connection string จริงและข้อมูลรับรองของ admin

### 4.9 ตรวจสอบการทำงานหลังจาก deploy

1. ตรวจสอบ backend สุขภาพดี:
   ```bash
   curl https://[ชื่อ-backend-project].vercel.app/api/health
   ```
   ควรตอบกลับ: `{"status":"ok","database":"connected", ...}`

2. เปิดเบราว์เซอร์ไปที่ `https://[ชื่อ-frontend-project].vercel.app`
3. เข้าสู่ระบบด้วย:
   - ชื่อผู้ใช้: `admin` (หรือชื่อที่คุณตั้งใน ADMIN_USERNAME)
   - รหัสผ่าน: [รหัสผ่านที่คุณตั้งใน ADMIN_PASSWORD]
4. ทดสอบการใช้งานระบบต่างๆ เพื่อให้แน่ใจว่าทุกอย่างทำงานได้ปกติ

## ขั้นตอนที่ 5: ตรวจสอบคุณภาพและการบำรุงรักษา

เพื่อให้แน่ใจว่าระบบทำงานได้ดีและไม่มีปัญหา ให้ทำการตรวจสอบเป็นประจำดังนี้:

```bash
# ตรวจสอบ TypeScript
npm run typecheck

# รันการทดสอบ
npm test

# ตรวจสอบการ build สำหรับ production
npm run build

# ตรวจสอบช่องโหว่ด้านความปลอดภัย
npm audit --prefix backend --audit-level=high
npm audit --prefix frontend --audit-level=high
```

## ขั้นตอนที่ 6: การแก้ไขปัญหาทั่วไป (Troubleshooting)

### ปัญหาที่พบบ่อยและวิธีแก้ไข

1. **ปัญหาการเชื่อมต่อฐานข้อมูล**
   - ตรวจสอบว่า `DATABASE_URL` ถูกต้องและสามารถเข้าถึงได้
   - ตรวจสอบว่าไฟร์วอลล์อนุญาตการเชื่อมต่อจาก IP ของคุณไปยังฐานข้อมูล
   - สำหรับ Supabase: ตรวจสอบว่าได้เปิดใช้งานการเชื่อมต่อจากทุกที่ (หรือจาก IP ที่เฉพาะเจาะจง)

2. **ปัญหาการย้ายข้อมูล (Migration)**
   - หากพบข้อผิดพลาดเกี่ยวกับ migration lock ให้ลองใช้ `prisma migrate reset` เฉพาะในฐานข้อมูลทดสอบเท่านั้น
   - อย่าใช้ `prisma migrate reset` ในฐานข้อมูล production เนื่องจากจะลบข้อมูลทั้งหมด

3. **ปัญหาการเข้าสู่ระบบหลังจาก deploy**
   - ตรวจสอบว่าได้รันคำสั่ง seed แล้วเพื่อสร้างผู้ใช้ admin
   - ตรวจสอบว่า `ADMIN_PASSWORD` ถูกต้องและตรงกับที่ใช้ในคำสั่ง seed

4. **ปัญหา CORS (Cross-Origin Resource Sharing)**
   - ตรวจสอบว่า `CORS_ORIGIN` ใน backend ตรงกับ URL ของ frontend อย่างแน่นอน (ไม่มี `/` ท้าย)
   - ใน production ต้องตั้ง `COOKIE_SECURE=true` และ `COOKIE_SAME_SITE=none`

5. **ปัญหาการเชื่อมต่อระหว่าง frontend และ backend**
   - ตรวจสอบว่า `VITE_API_URL` ใน frontend ชี้ไปยัง URL ของ backend ที่ถูกต้อง
   - ตรวจสอบว่า backend เปิดให้รับ request จาก origin ของ frontend (ตั้งค่า CORS อย่างถูกต้อง)

## สรุปขั้นตอนการทำงานทั้งหมด

### สำหรับการพัฒนาในเครื่อง:
1. Clone repository
2. ติดตั้ง dependencies (`npm run install:all`)
3. ตั้งค่า backend/.env (ใช้ค่าเริ่มต้นสำหรับ SQLite)
4. เริ่มต้นฐานข้อมูลทดสอบ (`npx prisma migrate deploy --schema prisma/sqlite-test/schema.prisma`)
5. สร้างข้อมูลเริ่มต้น (`npm run seed --prefix backend`)
6. เริ่ม backend (`npm run dev --prefix backend`)
7. เริ่ม frontend (`npm run dev --prefix frontend`)
8. ทดสอบการทำงานที่ http://localhost:5173

### สำหรับการ deploy ไปยัง production (Supabase + Vercel):
1. สร้างฐานข้อมูล PostgreSQL บน Supabase และรับ connection string
2. ตั้งค่า backend/.env สำหรับ production (ใช้ connection string จาก Supabase)
3. ตั้งค่า frontend/.env สำหรับ production (ตั้งค่า VITE_API_URL)
4. ตรวจสอบว่า backend/prisma/schema.prisma ตั้งค่า provider = "postgresql"
5. สร้างสองโครงการใน Vercel:
   - backend โครงการ: Root Directory = `backend`, Build Command = `npm run vercel-build`
   - frontend โครงการ: Root Directory = `frontend`, Build Command = `npm run build`
6. ตั้งค่า environment variables ใน Vercel สำหรับทั้งสองโครงการ
7. ทำการ deploy ไปยัง Vercel (โดยการ push ไปยัง repository)
8. หลังจาก backend deploy สำเร็จ ให้รันคำสั่ง seed แยกต่างหากด้วยข้อมูลจริง
9. ตรวจสอบการทำงานโดยการเข้าไปที่ URL ของ frontend และทดสอบการใช้งาน

ด้วยการทำตามขั้นตอนเหล่านี้ คุณจะสามารถตั้งค่าและติดตั้งระบบจัดการอุปกรณ์ WMS2 ได้สำเร็จและพร้อมใช้งานใน production ได้ 100%