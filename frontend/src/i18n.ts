import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Resources for English and Thai
const resources = {
  en: {
    translation: {
      // App layout
      "brand": "Equipment Desk",
      "dashboard": "Dashboard",
      "equipment_management": "Equipment Management",
      "employees": "Employees",
      "issuance_history": "Issuance History",
      "repair_history": "Repair History",
      "profile": "Profile",
      "user_management": "User Management",
      // Header
      "operations_console": "OPERATIONS CONSOLE",
      "equipment_management_system": "Equipment Management System",
      "logout": "Logout",
      // Buttons
      "cancel": "Cancel",
      "save": "Save",
      "submit": "Submit",
      "delete": "Delete",
      "edit": "Edit",
      "add": "Add",
      "search": "Search",
      "reset": "Reset",
      // Form labels (examples)
      "equipment_id": "Equipment ID",
      "employee_id": "Employee ID",
      "issue_date": "Issue Date",
      "due_date": "Due Date",
      "building": "Building",
      "floor": "Floor",
      "job_number": "Job Number",
      "notes": "Notes",
      // Status tags
      "available": "Available",
      "issued": "Issued",
      "under_repair": "Under Repair",
      "reported": "Reported",
      "in_progress": "In Progress",
      "completed": "Completed",
      "rejected": "Rejected",
      // Messages
      "login_success": "Login successful",
      "logout_success": "Logout successful",
      // Theme
      "light_mode": "Light Mode",
      "dark_mode": "Dark Mode",
      // Add more as needed
    }
  },
  th: {
    translation: {
      // App layout
      "brand": "อุปกรณ์เดสก์",
      "dashboard": "ภาพรวมระบบ",
      "equipment_management": "จัดการอุปกรณ์",
      "employees": "จัดการพนักงาน",
      "issuance_history": "ประวัติการเบิก",
      "repair_history": "ประวัติการซ่อม",
      "profile": "โปรไฟล์ของฉัน",
      "user_management": "จัดการผู้ใช้งาน",
      // Header
      "operations_console": "OPERATIONS CONSOLE",
      "equipment_management_system": "ระบบจัดการอุปกรณ์",
      "logout": "ออกจากระบบ",
      // Buttons
      "cancel": "ยกเลิก",
      "save": "บันทึก",
      "submit": "ส่ง",
      "delete": "ลบ",
      "edit": "แก้ไข",
      "add": "เพิ่ม",
      "search": "ค้นหา",
      "reset": "รีเซ็ต",
      // Form labels (examples)
      "equipment_id": "รหัสอุปกรณ์",
      "employee_id": "รหัสพนักงาน",
      "issue_date": "วันที่ออก",
      "due_date": "วันที่ต้องคืน",
      "building": "อาคาร",
      "floor": "ชั้น",
      "job_number": "หมายเลข JOB",
      "notes": "หมายเหตุ",
      // Status tags
      "available": "พร้อมใช้งาน",
      "issued": "เบิกออกแล้ว",
      "under_repair": "อยู่ระหว่างซ่อม",
      "reported": "แจ้งซ่อม",
      "in_progress": "ดำเนินการ",
      "completed": "เสร็จสิ้น",
      "rejected": "ไม่อนุมัติ",
      // Messages
      "login_success": "เข้าสู่ระบบสำเร็จ",
      "logout_success": "ออกจากระบบสำเร็จ",
      // Theme
      "light_mode": "โหมดกลางวัน",
      "dark_mode": "โหมดกลางคืน",
      // Add more as needed
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'th', // default language
    fallbackLng: 'th',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
