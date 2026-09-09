import { Alert, Card, Col, Empty, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { DashboardStats, EquipmentInstance } from '../types';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<EquipmentInstance[]>([]);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  // Status labels from translation
  const statusLabel: Record<string, string> = {
    available: t('dashboard.available'),
    issued: t('dashboard.issued'),
    under_repair: t('dashboard.under_repair'),
  };

  // Status colors (static)
  const statusColor: Record<string, string> = {
    available: 'green',
    issued: 'blue',
    under_repair: 'orange',
  };

  // Date formatter based on current language
  function formatDate(date?: string | null) {
    if (!date) return '—';
    const locale = i18n.language === 'th' ? 'th-TH' : 'en-US';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date));
  }

  useEffect(() => {
    Promise.all([apiService.getStats(), apiService.getInstances({ page: 1, pageSize: 5 })])
      .then(([nextStats, instances]) => {
        setStats(nextStats);
        setRecent(instances.data);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason, t('dashboard.load_error'))));
  }, []);

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <Typography.Text className="eyebrow">{t('dashboard.monitoring')}</Typography.Text>
          <Typography.Title level={2}>{t('dashboard.title')}</Typography.Title>
          <Typography.Paragraph>{t('dashboard.description')}</Typography.Paragraph>
        </div>
        <div className="intro-date">{t('dashboard.update_date')}</div>
      </section>

      {error && <Alert type="error" showIcon message={error} />}

      <Row gutter={[16, 16]}>
        {[
          { label: t('dashboard.total'), key: 'total' as const, className: 'stat-primary' },
          { label: t('dashboard.available'), key: 'available' as const, className: 'stat-success' },
          { label: t('dashboard.issued'), key: 'issued' as const, className: 'stat-info' },
          { label: t('dashboard.under_repair'), key: 'underRepair' as const, className: 'stat-warning' },
        ].map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <Card className={`stat-card ${item.className}`}>
              {stats ? <Statistic title={item.label} value={stats[item.key]} /> : <Skeleton active paragraph={false} />}
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="content-card" title={t('dashboard.latest_equipment')}>
        {recent.length === 0 ? (
          <Empty description={t('dashboard.no_equipment')} />
        ) : (
          <div className="recent-list">
            {recent.map((item) => (
              <div className="recent-item" key={item.id}>
                <div>
                  <Typography.Text strong>{item.serialNumber}</Typography.Text>
                  <Typography.Text type="secondary" className="recent-meta">
                    {(item.type?.name ?? t('dashboard.unspecified_type'))} ·
                    {(item.brand ?? t('dashboard.unspecified_brand'))} {item.model || ''}
                  </Typography.Text>
                </div>
                <div className="recent-right">
                  <Tag color={statusColor[item.status] ?? 'default'}>
                    {statusLabel[item.status] ?? item.status}
                  </Tag>
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