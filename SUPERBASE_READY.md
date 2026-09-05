# ระบบพร้อมสำหรับการย้ายไปยัง Supabase (PostgreSQL)

## สถานะปัจจุบัน
ระบบ Equipment Management System (WMS2) ได้รับการแก้ไขและพร้อมสำหรับการทำงานทั้งในสภาพแวดล้อมการพัฒนาในเครื่องและการDeployไปยัง Supabase/PostgreSQL

### การตั้งค่าฐานข้อมูล
- **สคีมาหลัก** (`wms2/backend/prisma/schema.prisma`): ตั้งค่าให้ใช้ `provider = "postgresql"` (พร้อมสำหรับ Supabase)
- **สคีมาทดสอบ** (`wms2/backend/prisma/sqlite-test/schema.prisma`): ตั้งค่าให้ใช้ `provider = "sqlite"` (สำหรับการทดสอบในเครื่อง)

## 🛠️ การพัฒนาในเครื่อง (ใช้ SQLite)

สำหรับการพัฒนาและทดสอบในเครื่องโดยไม่ต้องติดตั้ง PostgreSQL:

1. **ตรวจสอบว่าใช้สคีมาทดสอบ**:
   - ไฟล์ `wms2/backend/prisma/schema.prisma` ควรชี้ไปที่ `wms2/backend/prisma/sqlite-test/schema.prisma` สำหรับการทดสอบ
   - หรือคุณสามารถเปลี่ยนผู้ให้บริการในสคีมาหลักเป็น `sqlite` ชั่วคราวได้

2. **เริ่มต้นฐานข้อมูลทดสอบ**:
   ```bash
   cd wms2/backend
   # ฐานข้อมูลทดสอบถูกตั้งค่าแล้วใน .env (DATABASE_URL="file:./test.db")
   npx prisma migrate deploy --schema prisma/sqlite-test/schema.prisma
   npx prisma generate --schema prisma/sqlite-test/schema.prisma
   ```

3. **รันการทดสอบ**:
   ```bash
   cd wms2
   npm test --prefix backend
   ```

4. **เริ่มเซิร์ฟเวอร์พัฒนา**:
   ```bash
   # ใน terminal หนึ่ง
   cd wms2/backend
   npm run dev  # เริ่มที่ http://localhost:5000
   
   # ใน terminal อีกหนึ่ง
   cd wms2/frontend
   npm run dev  # เริ่มที่ http://localhost:5173/
   ```

## ☁️ การDeployไปยัง Supabase/Postgreย

สำหรับการDeployไปยังการผลิตโดยใช้ Supabase หรือผู้ให้บริการ PostgreSQL อื่นๆ:

1. **ตั้งค่าฐานข้อมูล PostgreSQL**:
   - สร้างโครงการใน Supabase (หรือผู้ให้บริการ PostgreSQL อื่นๆ)
   - รับ connection string ที่มีรูปแบบ:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres
     ```

2. **ตั้งค่าตัวแปรสภาพแวดล้อม**:
   - คัดลอก `wms2/backend/.env.example` เป็น `wms2/backend/.env`
   - แก้ไขตัวแปรต่อไปนี้ใน `.env`:
     ```
     DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres"
     NODE_ENV=production
     SESSION_SECRET=[สุ่มค่าอย่างน้อย 32 ตัวอักษร]
     CORS_ORIGIN=https://[ชื่อ-frontend-project].vercel.app
     COOKIE_SECURE=true
     COOKIE_SAME_SITE=none
     TRUST_PROXY=true
     ```

3. **เตรียมสคีมาฐานข้อมูล**:
   - ตรวจสอบว่า `wms2/backend/prisma/schema.prisma` ตั้งค่า `provider = "postgresql"` (ซึ่งเป็นค่าเริ่มต้นแล้ว)
   - สร้างไคลเอนต์ Prisma:
     ```bash
     cd wms2/backend
     npx prisma generate
     ```

4. **Deployไปยัง Vercel**:
   - สร้างสองโครงการใน Vercel จาก repository เดียวกัน:
     - **Backendโครงการ**: ตั้งค่า Root Directory เป็น `backend`, Build Command เป็น `npm run vercel-build`
     - **Frontendโครงการ**: ตั้งค่า Root Directory เป็น `frontend`, Build Command เป็น `npm run build`
   - ตั้งค่าตัวแปรสภาพแวดล้อมเหมือนกับขั้นตอนที่ 2 สำหรับทั้งสองโครงการ

5. **รันการย้ายข้อมูลและสร้างข้อมูลเริ่มต้น**:
   - การDeploybackendผ่าน Vercel จะรัน `vercel-build` โดยอัตโนมัติ ซึ่งรวมถึง:
     - `prisma generate` - สร้าง Prisma Client
     - `prisma migrate deploy --force` - ใช้การย้ายข้อมูลกับฐานข้อมูล production
     - `tsc` - คอมไพล์ TypeScript
   - หลังจากDeploybackendแล้ว ให้รันคำสั่ง seed แยกต่างหากด้วยตัวแปรสภาพแวดล้อมจริงของคุณ:
     ```bash
     DATABASE_URL="[connection-string-of-your-supabase]" \
     ADMIN_USERNAME="admin" \
     ADMIN_EMAIL="admin@example.com" \
     ADMIN_PASSWORD="[รหัสผ่านอย่างน้อย 8 ตัวอักษร]" \
     npm run seed --prefix backend
     ```

## 📝 สิ่งสำคัญที่ต้องทราบ

1. **ความแตกต่างระหว่างสภาพแวดล้อม**:
   - การพัฒนาในเครื่อง: ใช้ SQLite ผ่านไฟล์ `test.db` ใน `wms2/backend/prisma/sqlite-test/`
   - การผลิต: ใช้ PostgreSQL ผ่าน connection string ใน `DATABASE_URL`

2. **สคริปต์การสร้าง**:
   - `npm run build`: สำหรับการพัฒนาในเครื่อง (สร้างโดยไม่ย้ายข้อมูล)
   - `npm run vercel-build`: สำหรับการDeployไปยัง Vercel (รวมการย้ายข้อมูลด้วย `prisma migrate deploy --force`)

3. **การจัดการฐานข้อมูล**:
   - อย่าใช้ `prisma migrate reset` ในฐานข้อมูลproductionเนื่องจากจะลบข้อมูลทั้งหมด
   - ใช้ `prisma migrate deploy` เพื่อใช้การย้ายข้อมูลใหม่ๆอย่างปลอดภัย

## 🔍 ตรวจสอบการทำงาน

หลังจากDeployไปยัง Supabaseแล้ว ให้ตรวจสอบว่า:
1. Backendสุขภาพดี: `curl https://[ชื่อ-backend-project].vercel.app/api/health`
   - ควรตอบกลับ: `{"status":"ok","database":"connected", ...}`
2. frontendสามารถเชื่อมต่อกับ backendได้อย่างถูกต้อง
3. ทดสอบการสร้างเข้าสู่ระบบ สร้างอุปกรณ์ และสร้างประวัติการออกใช้งาน

## 🛠️ การแก้ไขปัญหา

หากพบปัญหาเกี่ยวกับฐานข้อมูล:
1. ตรวจสอบว่า `DATABASE_URL` ถูกตั้งค่าอย่างถูกต้องในตัวแปรสภาพแวดล้อม
2. ตรวจสอบว่าผู้ให้บริการใน `schema.prisma` เป็น `postgresql` สำหรับการผลิต
3. สำหรับข้อผิดพลาดการย้ายข้อมูล ให้ตรวจสอบไฟล์ migration lock และพิจารณาใช้ `prisma migrate reset` เฉพาะในฐานข้อมูลทดสอบเท่านั้น
4. ตรวจสอบว่า Prisma Client ถูกสร้างขึ้นใหม่หลังจากการเปลี่ยนแปลงสกีมา

---
ระบบพร้อมสำหรับการพัฒนาในเครื่องด้วย SQLite และการDeployไปยัง Supabase/PostgreSQLแล้ว!
