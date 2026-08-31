import { Alert, Card, Col, Empty, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { DashboardStats, EquipmentInstance } from '../types';

const statusLabel: Record<string, string> = {
  available: 'พร้อมใช้งาน',
  issued: 'ถูกเบิกใช้งาน',
  under_repair: 'อยู่ระหว่างซ่อม',
};

const statusColor: Record<string, string> = {
  available: 'green',
  issued: 'blue',
  under_repair: 'orange',
};

function formatDate(date?: string | null) {
  return date ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(date)) : '—';
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<EquipmentInstance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiService.getStats(), apiService.getInstances({ page: 1, pageSize: 5 })])
      .then(([nextStats, instances]) => {
        setStats(nextStats);
        setRecent(instances.data);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason, 'ไม่สามารถโหลดข้อมูลภาพรวมได้')));
  }, []);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <Typography.Text className="eyebrow">MONITORING</Typography.Text>
          <Typography.Title level={2}>ภาพรวมระบบ</Typography.Title>
          <Typography.Paragraph>ติดตามจำนวนอุปกรณ์และสถานะล่าสุดจากศูนย์กลางเดียว</Typography.Paragraph>
        </div>
        <div className="intro-date">อัปเดตแบบเรียลไทม์เมื่อเปิดหน้านี้</div>
      </section>

      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]}>
        {[
          { label: 'อุปกรณ์ทั้งหมด', key: 'total' as const, className: 'stat-primary' },
          { label: 'พร้อมใช้งาน', key: 'available' as const, className: 'stat-success' },
          { label: 'ถูกเบิกใช้งาน', key: 'issued' as const, className: 'stat-info' },
          { label: 'อยู่ระหว่างซ่อม', key: 'underRepair' as const, className: 'stat-warning' },
        ].map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <Card className={`stat-card ${item.className}`} bordered={false}>
              {stats ? <Statistic title={item.label} value={stats[item.key]} /> : <Skeleton active paragraph={false} />}
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} className="content-card" title="อุปกรณ์ที่เพิ่มล่าสุด">
        {recent.length === 0 ? (
          <Empty description="ยังไม่มีข้อมูลอุปกรณ์" />
        ) : (
          <div className="recent-list">
            {recent.map((item) => (
              <div className="recent-item" key={item.id}>
                <div>
                  <Typography.Text strong>{item.serialNumber}</Typography.Text>
                  <Typography.Text type="secondary" className="recent-meta">
                    {item.type?.name ?? 'ไม่ระบุประเภท'} · {item.brand || 'ไม่ระบุยี่ห้อ'} {item.model || ''}
                  </Typography.Text>
                </div>
                <div className="recent-right">
                  <Tag color={statusColor[item.status] ?? 'default'}>{statusLabel[item.status] ?? item.status}</Tag>
                  <Typography.Text type="secondary">{formatDate(item.purchaseDate)}</Typography.Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
