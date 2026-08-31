-- แปลง role เดิมที่ไม่อยู่ในชุดสิทธิ์ใหม่ให้เป็นผู้ชม เพื่อรักษาบัญชีเดิม
UPDATE "User" SET "role" = 'viewer' WHERE "role" NOT IN ('admin', 'staff', 'viewer');
