import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { EquipmentInstance, EquipmentType } from '../types';

const statusOptions = [
  { value: 'available', label: 'พร้อมใช้งาน' },
  { value: 'issued', label: 'ถูกเบิกใช้งาน' },
  { value: 'under_repair', label: 'อยู่ระหว่างซ่อม' },
];
const statusLabel = Object.fromEntries(statusOptions.map((item) => [item.value, item.label]));
const statusColor: Record<string, string> = { available: 'green', issued: 'blue', under_repair: 'orange' };

type TypeFormValues = { name: string; unit: string; description?: string };
type InstanceFormValues = {
  typeId: number;
  serialNumbers: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  status?: string;
};

function dateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : undefined;
}

export function EquipmentManagementPage() {
  const { canWrite, isAdmin } = useAuth();
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [instances, setInstances] = useState<EquipmentInstance[]>([]);
  const [instanceTotal, setInstanceTotal] = useState(0);
  const [instancePage, setInstancePage] = useState(1);
  const [instancePageSize, setInstancePageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [instanceModalOpen, setInstanceModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<EquipmentType | null>(null);
  const [editingInstance, setEditingInstance] = useState<EquipmentInstance | null>(null);
  const [typeForm] = Form.useForm<TypeFormValues>();
  const [instanceForm] = Form.useForm<InstanceFormValues>();

  const loadTypes = useCallback(async () => {
    try {
      setTypes(await apiService.getTypes());
    } catch (error) {
      message.error(getErrorMessage(error, 'ไม่สามารถโหลดประเภทอุปกรณ์ได้'));
    }
  }, []);

  const loadInstances = useCallback(async (page = instancePage, pageSize = instancePageSize) => {
    setLoading(true);
    try {
      const nextInstances = await apiService.getInstances({ page, pageSize });
      const lastPage = Math.max(1, Math.ceil(nextInstances.total / pageSize));
      if (page > lastPage) {
        setInstancePage(lastPage);
        return;
      }
      setInstances(nextInstances.data);
      setInstanceTotal(nextInstances.total);
    } catch (error) {
      message.error(getErrorMessage(error, 'ไม่สามารถโหลดรายการอุปกรณ์ได้'));
    } finally {
      setLoading(false);
    }
  }, [instancePage, instancePageSize]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  const openTypeModal = (type?: EquipmentType) => {
    setEditingType(type ?? null);
    typeForm.setFieldsValue(type ? { name: type.name, unit: type.unit, description: type.description ?? undefined } : {});
    setTypeModalOpen(true);
  };

  const submitType = async (values: TypeFormValues) => {
    try {
      if (editingType) await apiService.updateType(editingType.id, values);
      else await apiService.createType(values);
      message.success(editingType ? 'แก้ไขประเภทอุปกรณ์แล้ว' : 'เพิ่มประเภทอุปกรณ์แล้ว');
      setTypeModalOpen(false);
      await loadTypes();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const deleteType = (type: EquipmentType) => {
    Modal.confirm({
      title: 'ลบประเภทอุปกรณ์นี้หรือไม่',
      content: type._count?.instances ? 'ไม่สามารถลบประเภทที่มีรายการอุปกรณ์อยู่ได้' : `ประเภท “${type.name}” จะถูกลบถาวร`,
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteType(type.id);
          message.success('ลบประเภทอุปกรณ์แล้ว');
          await loadTypes();
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const openInstanceModal = (instance?: EquipmentInstance) => {
    setEditingInstance(instance ?? null);
    instanceForm.setFieldsValue(
      instance
        ? {
            typeId: instance.typeId,
            serialNumbers: instance.serialNumber,
            brand: instance.brand ?? undefined,
            model: instance.model ?? undefined,
            purchaseDate: dateInputValue(instance.purchaseDate),
            status: instance.status,
          }
        : { serialNumbers: '', status: 'available' },
    );
    setInstanceModalOpen(true);
  };

  const submitInstance = async (values: InstanceFormValues) => {
    const serialNumbers = values.serialNumbers.split(/\r?\n/).map((serial) => serial.trim()).filter(Boolean);
    if (serialNumbers.length === 0) {
      message.error('กรุณาระบุหมายเลขซีเรียลอย่างน้อย 1 รายการ');
      return;
    }
    try {
      if (editingInstance) {
        await apiService.updateInstance(editingInstance.id, {
          typeId: values.typeId,
          serialNumber: serialNumbers[0],
          brand: values.brand,
          model: values.model,
          purchaseDate: values.purchaseDate,
          ...(values.status && values.status !== editingInstance.status ? { status: values.status } : {}),
        });
        message.success('แก้ไขข้อมูลอุปกรณ์แล้ว');
      } else {
        await apiService.createInstances({
          typeId: values.typeId,
          serialNumbers,
          brand: values.brand,
          model: values.model,
          purchaseDate: values.purchaseDate,
        });
        message.success(`เพิ่มอุปกรณ์ ${serialNumbers.length} รายการแล้ว`);
      }
      setInstanceModalOpen(false);
      await Promise.all([loadInstances(), loadTypes()]);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const deleteInstance = (instance: EquipmentInstance) => {
    Modal.confirm({
      title: 'ลบอุปกรณ์นี้หรือไม่',
      content: `หมายเลขซีเรียล ${instance.serialNumber} จะถูกลบถาวร`,
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteInstance(instance.id);
          message.success('ลบอุปกรณ์แล้ว');
          await Promise.all([loadInstances(), loadTypes()]);
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const typeColumns: TableProps<EquipmentType>['columns'] = [
    { title: 'ชื่อประเภท', dataIndex: 'name', key: 'name', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'หน่วยนับ', dataIndex: 'unit', key: 'unit' },
    { title: 'จำนวนอุปกรณ์', key: 'count', render: (_, type) => type._count?.instances ?? 0 },
    { title: 'รายละเอียด', dataIndex: 'description', key: 'description', render: (value: string | null) => value || '—' },
    {
      title: 'จัดการ', key: 'actions', width: 150,
      render: (_, type) => canWrite && <Space><Button type="link" onClick={() => openTypeModal(type)}>แก้ไข</Button>{isAdmin && <Button type="link" danger onClick={() => deleteType(type)}>ลบ</Button>}</Space>,
    },
  ];

  const instanceColumns: TableProps<EquipmentInstance>['columns'] = [
    { title: 'หมายเลขซีเรียล', dataIndex: 'serialNumber', key: 'serialNumber', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
    { title: 'ประเภท', key: 'type', render: (_, item) => item.type?.name ?? '—' },
    { title: 'ยี่ห้อ / รุ่น', key: 'device', render: (_, item) => [item.brand, item.model].filter(Boolean).join(' / ') || '—' },
    { title: 'วันที่ซื้อ', dataIndex: 'purchaseDate', key: 'purchaseDate', render: (value: string | null) => dateInputValue(value) || '—' },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={statusColor[value] ?? 'default'}>{statusLabel[value] ?? value}</Tag> },
    {
      title: 'จัดการ', key: 'actions', width: 150,
      render: (_, item) => canWrite && <Space><Button type="link" onClick={() => openInstanceModal(item)}>แก้ไข</Button>{isAdmin && <Button type="link" danger onClick={() => deleteInstance(item)}>ลบ</Button>}</Space>,
    },
  ];

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><Typography.Text className="eyebrow">INVENTORY</Typography.Text><Typography.Title level={2}>จัดการอุปกรณ์</Typography.Title><Typography.Paragraph>จัดระเบียบประเภทอุปกรณ์และรายการครุภัณฑ์ที่ใช้งานอยู่</Typography.Paragraph></div>
        {canWrite && <Button type="primary" onClick={() => openInstanceModal()}>+ เพิ่มอุปกรณ์</Button>}
      </section>
      <Card bordered={false} className="content-card">
        <Spin spinning={loading}>
          <Tabs
            items={[
              { key: 'types', label: `ประเภทอุปกรณ์ (${types.length})`, children: <><div className="table-toolbar">{canWrite && <Button onClick={() => openTypeModal()}>+ เพิ่มประเภท</Button>}</div><Table rowKey="id" columns={typeColumns} dataSource={types} locale={{ emptyText: <Empty description="ยังไม่มีประเภทอุปกรณ์" /> }} pagination={false} /></> },
              { key: 'instances', label: `รายการอุปกรณ์ (${instanceTotal})`, children: <Table rowKey="id" columns={instanceColumns} dataSource={instances} locale={{ emptyText: <Empty description="ยังไม่มีอุปกรณ์" /> }} scroll={{ x: 850 }} pagination={{ current: instancePage, pageSize: instancePageSize, total: instanceTotal, showSizeChanger: true, onChange: (page, pageSize) => { setInstancePage(page); setInstancePageSize(pageSize); } }} /> },
            ]}
          />
        </Spin>
      </Card>

      <Modal title={editingType ? 'แก้ไขประเภทอุปกรณ์' : 'เพิ่มประเภทอุปกรณ์'} open={typeModalOpen} onCancel={() => setTypeModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={typeForm} layout="vertical" onFinish={submitType} requiredMark="optional">
          <Form.Item name="name" label="ชื่อประเภท" rules={[{ required: true, message: 'กรุณาระบุชื่อประเภท' }]}><Input placeholder="เช่น Notebook, จอภาพ" /></Form.Item>
          <Form.Item name="unit" label="หน่วยนับ" rules={[{ required: true, message: 'กรุณาระบุหน่วยนับ' }]}><Input placeholder="เช่น เครื่อง, ชุด" /></Form.Item>
          <Form.Item name="description" label="รายละเอียด"><Input.TextArea rows={3} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></Form.Item>
          <div className="modal-actions"><Button onClick={() => setTypeModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>

      <Modal title={editingInstance ? 'แก้ไขรายการอุปกรณ์' : 'เพิ่มรายการอุปกรณ์'} open={instanceModalOpen} onCancel={() => setInstanceModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={instanceForm} layout="vertical" onFinish={submitInstance} requiredMark="optional">
          <Form.Item name="typeId" label="ประเภทอุปกรณ์" rules={[{ required: true, message: 'กรุณาเลือกประเภทอุปกรณ์' }]}><Select placeholder="เลือกประเภทอุปกรณ์" options={types.map((type) => ({ value: type.id, label: type.name }))} /></Form.Item>
          <Form.Item name="serialNumbers" label="หมายเลขซีเรียล" rules={[{ required: true, message: 'กรุณาระบุหมายเลขซีเรียล' }]} extra={!editingInstance ? 'ใส่หลายหมายเลขโดยแยกคนละบรรทัดได้' : undefined}><Input.TextArea rows={editingInstance ? 1 : 4} placeholder={editingInstance ? 'SN-0001' : 'SN-0001\nSN-0002\nSN-0003'} /></Form.Item>
          <div className="form-grid"><Form.Item name="brand" label="ยี่ห้อ"><Input placeholder="เช่น Dell" /></Form.Item><Form.Item name="model" label="รุ่น"><Input placeholder="เช่น Latitude 5440" /></Form.Item></div>
          <div className="form-grid"><Form.Item name="purchaseDate" label="วันที่ซื้อ"><Input type="date" /></Form.Item>{editingInstance ? <Form.Item name="status" label="สถานะ"><Select options={statusOptions} /></Form.Item> : <Form.Item label="สถานะ"><Input value="พร้อมใช้งาน" disabled /></Form.Item>}</div>
          <div className="modal-actions"><Button onClick={() => setInstanceModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>
    </div>
  );
}
