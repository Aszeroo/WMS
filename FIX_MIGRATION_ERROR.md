# การแก้ไขข้อผิดพลาด Prisma Migration Provider Mismatch

## ปัญหา
เมื่อทำการ deploy ไปยัง Vercel พบข้อผิดพลาดดังต่อไปนี้:

```
Error: P3019
The datasource provider `postgresql` specified in your schema does not match the one specified in the migration_lock.toml, `sqlite`. Please remove your current migration directory and start a new migration history with prisma migrate dev.
```

ข้อผิดพลาดนี้เกิดขึ้นเมื่อ:
1. ไฟล์สคีมาฐานข้อมูล (`prisma/schema.prisma`) กำหนดให้ใช้ผู้ให้บริการ `postgresql`
2. แต่ไฟล์ `migration_lock.toml` ในไดเรกทอรีการย้ายข้อมูลยังคงระบุว่าผู้ให้บริการเดิมคือ `sqlite`
3. นี่มักเกิดขึ้นเมื่อเปลี่ยนจากการใช้ SQLite ในการพัฒนาในเครื่องไปเป็น PostgreSQL สำหรับ production โดยไม่ได้ล้างประวัติการย้ายข้อมูลเดิม

## สาเหตุ
ในระหว่างการพัฒนาในเครื่อง หากคุณใช้ SQLite และสร้างการย้ายข้อมูล (migrations) ไว้ จากนั้นเปลี่ยนมาใช้ PostgreSQL ในไฟล์ `schema.prisma` โดยไม่ได้จัดการกับไดเรกทอรีการย้ายข้อมูลเดิม ระบบจะพบความขัดแย้งระหว่างผู้ให้บริการที่ระบุในสคีมากับที่บันทึกไว้ใน `migration_lock.toml`

## วิธีแก้ไข

### วิธีที่ 1: สำหรับฐานข้อมูลใหม่หรือการทดสอบ (แนะนำสำหรับขั้นตอนนี้)
หากฐานข้อมูลของคุณยังไม่มีข้อมูลสำคัญ หรือคุณสามารถยอมให้ข้อมูลถูกลบออกได้ (เหมาะกับการทดสอบหรือการตั้งค่าใหม่):

#### ขั้นตอนที่ 1: ลบไดเรกทอรีการย้ายข้อมูลเดิม
```bash
# ลบไดเรกทอรี migrations ทั้งหมด (จะถูกสร้างขึ้นใหม่)
rm -rf backend/prisma/migrations
```

#### ขั้นตอนที่ 2: สร้างการย้ายข้อมูลใหม่จากสคีมาปัจจุบัน
```bash
cd backend
# ตรวจสอบว่าใช้สคีมาหลัก (PostgreSQL)
npx prisma migrate dev --name init
```

#### ขั้นตอนที่ 3: สร้างไคลเอนต์ Prisma ใหม่
```bash
npx prisma generate
```

#### ขั้นตอนที่ 4: ทำการ commit และ push การเปลี่ยนแปลง
```bash
git add backend/prisma/migrations
git add backend/prisma/schema.prisma
git commit -m "Reset migration history for PostgreSQL provider"
git push
```

### วิธีที่ 2: สำหรับฐานข้อมูลที่มีข้อมูลอยู่แล้ว (ต้องระมัดระวัง)
หากฐานข้อมูลของคุณมีข้อมูลสำคัญอยู่แล้วและคุณไม่สามารถลบข้อมูลได้:

#### ขั้นตอนที่ 1: ตรวจสอบให้แน่ใจว่าสคีมาปัจจุบันตรงกับฐานข้อมูล
ตรวจสอบว่า `backend/prisma/schema.prisma` ตรงกับโครงสร้างฐานข้อมูลปัจจุบันของคุณ

#### ขั้นตอนที่ 2: สร้างการย้ายข้อมูลใหม่โดยไม่กระทบข้อมูลที่มีอยู่
```bash
cd backend
# สร้างการย้ายข้อมูลใหม่จากความแตกต่างระหว่างสคีมากับฐานข้อมูล
npx prisma migrate dev --name update-to-postgresql
```

#### ขั้นตอนที่ 3: ใช้การย้ายข้อมูลนี้ในฐานข้อมูล production
เมื่อ deploy ไปยัง Vercel ให้แน่ใจว่าสคริปต์ `vercel-build` ใช้ `prisma migrate deploy` (ไม่ใช่ `prisma migrate reset`)

#### ขั้นตอนที่ 4: ตรวจสอบและปรับไฟล์ vercel-build
ตรวจสอบว่า `backend/package.json` มีสคริปต์ดังนี้:
```json
"vercel-build": "prisma generate && prisma migrate deploy && tsc"
```
ไม่ใช่ `prisma migrate reset --force` ซึ่งจะลบข้อมูลทั้งหมด

### วิธีที่ 3: แก้ไขไฟล์ migration_lock.toml โดยตรง (ไม่แนะนำสำหรับการผลิต)
> **คำเตือน**: วิธีนี้เสี่ยงและไม่แนะนำสำหรับฐานข้อมูลที่มีข้อมูลอยู่แล้ว ใช้เฉพาะในกรณีฉุกเฉินหรือการทดสอบเท่านั้น

```bash
# แก้ไขไฟล์ migration_lock.toml ไดเรกทอรีล่าสุดใน migrations
# เปลี่ยน provider จาก "sqlite" เป็น "postgresql"
# ตรวจสอบให้แน่ใจว่าการย้ายข้อมูลทั้งหมดในไดเรกทอรีนี้เข้ากันได้กับ PostgreSQL
```

## การป้องกันไม่ให้เกิดปัญหานี้ในอนาคต

### สำหรับการพัฒนาในเครื่อง
1. **ใช้ไฟล์สคีมาที่แยกต่างหากสำหรับการทดสอบและ production** ตามที่ระบุใน `SUPERBASE_READY.md`:
   - `prisma/schema.prisma` - สำหรับ production (PostgreSQL)
   - `prisma/sqlite-test/schema.prisma` - สำหรับการทดสอบในเครื่อง (SQLite)

2. **เมื่อทำการทดสอบในเครื่อง** ให้ใช้คำสั่งที่ระบุสคีมาทดสอบอย่างชัดเจน:
   ```bash
   npx prisma migrate dev --schema prisma/sqlite-test/schema.prisma
   npx prisma generate --schema prisma/sqlite-test/schema.prisma
   ```

### สำหรับการ deploy ไปยัง Vercel
1. ตรวจสอบว่า `backend/package.json` มีสคริปต์ `vercel-build` ที่ถูกต้อง:
   ```json
   "vercel-build": "prisma generate && prisma migrate deploy && tsc"
   ```

2. ตรวจสอบว่า `backend/vercel.json` ใช้สคริปต์นี้:
   ```json
   {
     "version": 2,
     "buildCommand": "npm run vercel-build",
     "installCommand": "npm ci --include=dev",
     "functions": {
       "api/index.ts": {
         "maxDuration": 30
       }
     },
     "rewrites": [
       { "source": "/(.*)", "destination": "/api/index.ts" }
     ]
   }
   ```

3. อย่าใช้ `prisma migrate reset` ใน production เว้นแต่คุณต้องการลบฐานข้อมูลทั้งหมดอย่างตั้งใจ

## การตรวจสอบหลังการแก้ไข
หลังจากทำการแก้ไขแล้ว ให้ทำการ deploy ใหม่ไปยัง Vercel และตรวจสอบว่า:

1. การ build สำเร็จโดยไม่มีข้อผิดพลาด P3019
2. สามารถเชื่อมต่อกับฐานข้อมูล PostgreSQL ได้
3. รันคำสั่ง seed เพื่อสร้างผู้ใช้เริ่มต้น (หากจำเป็น):
   ```bash
   DATABASE_URL="[connection-string-of-your-supabase]" \
   ADMIN_USERNAME="admin@gmail.com" \
   ADMIN_EMAIL="admin@gmail.com" \
   ADMIN_PASSWORD="P@ssw0rd" \
   npm run seed --prefix backend
   ```

4. ตรวจสอบสุขภาพของ API:
   ```bash
   curl https://backend-ten-psi-94.vercel.app/api/health
   ```
   ควรตอบกลับ: `{"status":"ok","database":"connected", ...}`

## สรุป
ข้อผิดพลาด P3019 เกิดจากความไม่สอดคล้องกันระหว่างผู้ให้บริการฐานข้อมูลที่ระบุในสคีมาปัจจุบันกับที่บันทึกไว้ในประวัติการย้ายข้อมูล วิธีแก้ไขที่ปลอดภัยที่สุดคือการลบประวัติการย้ายข้อมูลเดิมและสร้างใหม่จากสคีมาปัจจุบัน โดยเฉพาะอย่างยิ่งเมื่ออยู่ในขั้นตอนการทดสอบหรือการตั้งค่าใหม่

หลังจากแก้ไขแล้ว ให้ทำการ commit การเปลี่ยนแปลงและ deploy ใหม่ไปยัง Vercel ระบบควรจะทำงานได้ตามปกติ