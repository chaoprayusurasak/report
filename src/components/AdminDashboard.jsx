import { useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import './AdminDashboard.css';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CATEGORY_LABELS = {
  road: 'ถนน/ทางเท้าชำรุด',
  electricity: 'ไฟฟ้าสาธารณะ',
  water: 'ท่อน้ำ/ระบบระบายน้ำ',
  garbage: 'ขยะ/ความสะอาด',
  park: 'สวนสาธารณะ',
  traffic: 'สัญญาณไฟจราจร/ป้ายจราจร',
  noise: 'เสียงรบกวน/มลพิษ',
  stray: 'สัตว์จรจัด',
  other: 'อื่นๆ',
};

const CATEGORY_ICONS = {
  road: 'https://cdn-icons-png.flaticon.com/512/4844/4844007.png',
  electricity: 'https://cdn-icons-png.flaticon.com/512/702/702797.png',
  water: 'https://cdn-icons-png.flaticon.com/512/3100/3100223.png',
  garbage: 'https://cdn-icons-png.flaticon.com/512/2892/2892576.png',
  park: 'https://cdn-icons-png.flaticon.com/512/620/620705.png',
  traffic: 'https://cdn-icons-png.flaticon.com/512/2822/2822452.png',
  noise: 'https://cdn-icons-png.flaticon.com/512/1041/1041864.png',
  stray: 'https://cdn-icons-png.flaticon.com/512/91/91544.png',
  other: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png',
};

const STATUS_OPTIONS = ['รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น'];

const OFFICERS = [
  { name: 'นายจิรายุ วงษ์พิทักษ์', position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ' },
  { name: 'นายภาคิไนย ไชยพันธ์', position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ' },
  { name: 'นางสาวอัญญารัตน์ โพธิ์อ่อน', position: 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ' }
];

export default function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [updatingId, setUpdatingId] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [adminDept, setAdminDept] = useState('');
  const [officerName, setOfficerName] = useState(() => {
    return localStorage.getItem('selected_officer') || 'นายจิรายุ วงษ์พิทักษ์';
  });
  const [officerPosition, setOfficerPosition] = useState(() => {
    const savedPosition = localStorage.getItem('selected_officer_position');
    if (savedPosition) return savedPosition;

    const savedName = localStorage.getItem('selected_officer') || 'นายจิรายุ วงษ์พิทักษ์';
    const matched = OFFICERS.find(o => o.name === savedName);
    return matched ? matched.position : 'นักวิชาการคอมพิวเตอร์ปฏิบัติการ';
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempStartNum, setTempStartNum] = useState(() => {
    const saved = localStorage.getItem('starting_receipt_number');
    return saved ? parseInt(saved, 10) : 468;
  });
  const [emailServiceId, setEmailServiceId] = useState(() => localStorage.getItem('emailjs_service_id') || '');
  const [emailTemplateId, setEmailTemplateId] = useState(() => localStorage.getItem('emailjs_template_id') || '');
  const [emailPublicKey, setEmailPublicKey] = useState(() => localStorage.getItem('emailjs_public_key') || '');

  const getThaiTodayDate = () => {
    const date = new Date();
    const thMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return {
      day: date.getDate(),
      month: thMonths[date.getMonth()],
      year: date.getFullYear() + 543
    };
  };

  useEffect(() => {
    if (selectedReport) {
      const defaultDept = (() => {
        const engineeringCats = ['road', 'electricity', 'water',];
        const publicHealthCats = ['garbage', 'park', 'noise', 'stray'];
        // const buildingCats = ['stray',];
        if (engineeringCats.includes(selectedReport.category)) return 'กองช่าง';
        if (publicHealthCats.includes(selectedReport.category)) return 'กองสาธารณสุขและสิ่งแวดล้อม';
        // if (buildingCats.includes(selectedReport.category)) return '';
        return 'สำนักปลัดเทศบาล';
      })();
      setAdminDept(selectedReport.responsible_department || defaultDept);
    } else {
      setAdminDept('');
    }
  }, [selectedReport]);

  const fetchReports = async () => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      alert('กรุณาตั้งค่า Supabase ใน .env');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      alert('ไม่สามารถดึงข้อมูลได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleStatusChange = async (reportId, newStatus) => {
    const supabase = getSupabase();
    if (!supabase) return;

    setUpdatingId(reportId);
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) throw error;

      // Update local state
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport((prev) => ({ ...prev, status: newStatus }));
      }

      // Securely invoke LINE push message function
      const { data: notifyData, error: notifyErr } = await supabase.functions.invoke('line-notify', {
        body: { reportId, status: newStatus }
      });
      if (notifyErr) {
        console.error('Failed to send LINE notification:', notifyErr);
        alert('เปลี่ยนสถานะในระบบเรียบร้อยแล้ว แต่ไม่สามารถส่งแจ้งเตือนทาง LINE ได้: ' + (notifyErr.message || JSON.stringify(notifyErr)));
      } else {
        console.log('LINE notification sent successfully:', notifyData);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('ไม่สามารถอัปเดตสถานะได้: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDepartmentChange = async (newDept) => {
    setAdminDept(newDept);
    if (!selectedReport) return;

    // Check if the value has actually changed to prevent duplicate executions (e.g. Enter + Blur)
    const normalizedNewDept = newDept ? newDept.trim() : '';
    const normalizedOldDept = selectedReport.responsible_department ? selectedReport.responsible_department.trim() : '';
    if (normalizedNewDept === normalizedOldDept) {
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Attempt to save to database
      const { error } = await supabase
        .from('reports')
        .update({ responsible_department: newDept })
        .eq('id', selectedReport.id);

      if (error) {
        console.warn('Database column responsible_department might not exist yet:', error.message);
      } else {
        // Update local list state
        setReports((prev) =>
          prev.map((r) => (r.id === selectedReport.id ? { ...r, responsible_department: newDept } : r))
        );
        setSelectedReport((prev) => ({ ...prev, responsible_department: newDept }));

        // Notify department officers about the newly assigned task
        if (newDept && newDept.trim() !== '') {
          try {
            await supabase.functions.invoke('line-notify', {
              body: { reportId: selectedReport.id, dispatchDept: newDept.trim() }
            });
            console.log(`Dispatched task notification for department: ${newDept}`);
          } catch (notifyErr) {
            console.error('Failed to dispatch department notification:', notifyErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save department in database:', err);
    }
  };

  const handleDescriptionChange = async (newDesc) => {
    if (!selectedReport) return;

    // Update local state immediately for instant feedback
    setSelectedReport((prev) => ({ ...prev, description: newDesc }));
    setReports((prev) =>
      prev.map((r) => (r.id === selectedReport.id ? { ...r, description: newDesc } : r))
    );

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('reports')
        .update({ description: newDesc })
        .eq('id', selectedReport.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to save description in database:', err);
    }
  };

  const handleSendEmail = async (report) => {
    if (!report.reporter_email) {
      alert('ผู้แจ้งไม่ได้ระบุอีเมลไว้');
      return;
    }

    const serviceId = localStorage.getItem('emailjs_service_id') || import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = localStorage.getItem('emailjs_template_id') || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = localStorage.getItem('emailjs_public_key') || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    const currentYear = new Date(report.created_at).getFullYear() + 543;
    const receiptNo = `${getReceiptNumber(report)}/${currentYear}`;
    const categoryLabel = CATEGORY_LABELS[report.category] || report.category;

    // Fallback template builder function if we need to open the mailto client
    const triggerMailtoFallback = () => {
      const subject = encodeURIComponent(`[แจ้งผลการดำเนินการ] เรื่องร้องเรียนเลขรับที่ ${receiptNo}`);
      const body = encodeURIComponent(
        `เรียน คุณ ${report.reporter_name},

ตามที่ท่านได้แจ้งเรื่องร้องเรียน/แจ้งซ่อมผ่านระบบรับเรื่องร้องทุกข์ เทศบาลนครเจ้าพระยาสุรศักดิ์
หมายเลขอ้างอิง: ${report.reference_id || 'ไม่มี'}
เลขรับที่: ${receiptNo}
ประเภทปัญหา: ${categoryLabel}
รายละเอียดปัญหา: ${report.description}

เทศบาลนครเจ้าพระยาสุรศักดิ์ขอเรียนแจ้งให้ทราบว่า เจ้าหน้าที่ได้ดำเนินการแก้ไขปัญหาดังกล่าว "เสร็จสิ้น" เรียบร้อยแล้ว

ขอขอบคุณสำหรับข้อมูลและการแจ้งเบาะแสเพื่อการพัฒนาชุมชนของเรา

ขอแสดงความนับถือ,
เจ้าหน้าที่ระบบแจ้งเรื่องร้องเรียนร้องทุกข์
เทศบาลนครเจ้าพระยาสุรศักดิ์`
      );
      window.location.href = `mailto:${report.reporter_email}?subject=${subject}&body=${body}`;
    };

    // If not configured, use native mailto fallback directly
    if (!serviceId || !templateId || !publicKey) {
      triggerMailtoFallback();
      return;
    }

    setEmailSending(true);
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: report.reporter_email,
            to_name: report.reporter_name,
            receipt_no: receiptNo,
            category: categoryLabel,
            description: report.description,
            reference_id: report.reference_id || 'ไม่มี',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to send email');
      }

      alert('✉️ ส่งอีเมลแจ้งผลการแก้ไขปัญหาไปยังผู้ร้องเรียนสำเร็จแล้ว!');
    } catch (err) {
      console.error('EmailJS Error:', err);
      alert('ไม่สามารถส่งอีเมลอัตโนมัติได้: ' + err.message + '\n\nระบบจะเปิดโปรแกรมเมลของเครื่องให้ส่งแบบปกติแทน');
      triggerMailtoFallback();
    } finally {
      setEmailSending(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesCategory = filterCategory ? report.category === filterCategory : true;
    const matchesStatus = filterStatus ? report.status === filterStatus : true;
    const matchesSearch = searchQuery
      ? report.reporter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.reference_id && report.reference_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesDate = filterDate
      ? (() => {
        const reportDate = new Date(report.created_at).toLocaleDateString('en-CA');
        return reportDate === filterDate;
      })()
      : true;

    return matchesCategory && matchesStatus && matchesSearch && matchesDate;
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatThaiFullDate = (dateString) => {
    if (!dateString) return { day: '', month: '', year: '', time: '' };
    const date = new Date(dateString);
    const thMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return {
      day: date.getDate(),
      month: thMonths[date.getMonth()],
      year: date.getFullYear() + 543,
      time: date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.'
    };
  };

  const getReceiptNumber = (report) => {
    if (!report) return '';
    const savedStart = localStorage.getItem('starting_receipt_number');
    const startNum = savedStart ? parseInt(savedStart, 10) : 468;
    const sortedChronologically = [...reports].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const idx = sortedChronologically.findIndex((r) => r.id === report.id);
    if (idx === -1) return startNum.toString();
    return (startNum + idx).toString();
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h2>
          <img src="https://cdn-icons-png.flaticon.com/512/428/428032.png" className="flaticon-logo-icon" alt="reports" />
          รายการแจ้งเรื่องร้องเรียนทั้งหมด ({sortedReports.length})
        </h2>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="refresh-btn" onClick={fetchReports} disabled={loading}>
            <img src="https://cdn-icons-png.flaticon.com/512/483/483488.png" className="flaticon-btn-icon" alt="refresh" style={{ filter: 'brightness(0) invert(1)' }} />
            รีเฟรชข้อมูล
          </button>
          <button
            className="refresh-btn"
            onClick={() => {
              const saved = localStorage.getItem('starting_receipt_number');
              setTempStartNum(saved ? parseInt(saved, 10) : 468);
              setShowSettingsModal(true);
            }}
            title="ตั้งค่าเลขเริ่มต้น"
          >
            <img src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png" className="flaticon-btn-icon" alt="settings" style={{ filter: 'brightness(0) invert(1)' }} />
            ตั้งค่าระบบ
          </button>
        </div>
      </div>

      {/* === Filters === */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="ค้นหาชื่อผู้แจ้ง / หมายเลขอ้างอิง..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-select"
        >
          <option value="">ทุกประเภทปัญหา</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">ทุกสถานะ</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <div className="filter-date-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', padding: '0.2rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>วันที่:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.9rem', fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', width: '100%' }}
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--error)',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.94rem',
                padding: '0 0.2rem',
                display: 'flex',
                alignItems: 'center'
              }}
              title="ล้างวันที่"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="filter-select"
        >
          <option value="desc">วันที่แจ้ง: ใหม่ล่าสุดก่อน</option>
          <option value="asc">วันที่แจ้ง: เก่าสุดก่อน</option>
        </select>
      </div>

      {/* === List View === */}
      {loading ? (
        <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', color: '#8b6348' }}>
          <lottie-player
            src="https://lottie.host/8c0678d4-539c-469b-90f7-111dbfe7ff6b/Ww3aXF7b3S.json"
            background="transparent"
            speed="1.2"
            style={{ width: '100px', height: '100px' }}
            loop
            autoplay
          ></lottie-player>
          <span style={{ fontSize: '11pt', fontWeight: '500' }}>กำลังดึงข้อมูลเข้าระบบ...</span>
        </div>
      ) : sortedReports.length === 0 ? (
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', color: '#999' }}>
          <lottie-player
            src="https://lottie.host/b089c250-be9c-4b68-80f4-5fdf32fca614/Jlyo9u9zG1.json"
            background="transparent"
            speed="1"
            style={{ width: '120px', height: '120px' }}
            loop
            autoplay
          ></lottie-player>
          <span style={{ fontSize: '11pt', fontWeight: '500' }}>ไม่พบรายการเรื่องร้องเรียนที่ตรงตามเงื่อนไข</span>
        </div>
      ) : (
        <div className="reports-table-container">
          <table className="reports-table">
            <thead>
              <tr>
                <th>วันเวลาที่แจ้ง</th>
                <th>หมายเลขอ้างอิง / เลขรับ</th>
                <th>ผู้แจ้ง / เบอร์โทร</th>
                <th>ประเภท</th>
                <th>รายละเอียด</th>
                <th>สถานะ</th>
                <th>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedReports.map((report) => (
                <tr key={report.id} onClick={() => setSelectedReport(report)} className="report-row">
                  <td>{formatDate(report.created_at)}</td>
                  <td>
                    <span className="ref-badge">{report.reference_id || 'ไม่มี'}</span>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      เลขรับ: {getReceiptNumber(report)}/{new Date(report.created_at).getFullYear() + 543}
                    </div>
                  </td>
                  <td>
                    <strong>{report.reporter_name}</strong>
                    <div className="phone-sub">{report.reporter_phone}</div>
                  </td>
                  <td>
                    <img src={CATEGORY_ICONS[report.category] || CATEGORY_ICONS.other} className="flaticon-icon" alt={report.category} />
                    {CATEGORY_LABELS[report.category] || report.category}
                  </td>
                  <td className="desc-cell">{report.description}</td>
                  <td>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={report.status}
                      onChange={(e) => handleStatusChange(report.id, e.target.value)}
                      disabled={updatingId === report.id}
                      className="status-selector"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === Detail Modal === */}
      {selectedReport && (
        <div className="detail-modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="detail-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>รายละเอียดเรื่องร้องเรียน</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className="print-btn-action"
                  onClick={() => window.print()}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: '#a0785a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="flaticon-btn-icon" alt="print" style={{ filter: 'brightness(0) invert(1)' }} />
                  พิมพ์รายงาน (PDF)
                </button>
                <button className="close-btn" onClick={() => setSelectedReport(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" className="flaticon-icon" alt="user" />
                  ข้อมูลผู้ร้องเรียน
                </h4>
                <p><strong>ชื่อ-นามสกุล:</strong> {selectedReport.reporter_name}</p>
                <p><strong>เบอร์โทรศัพท์:</strong> <a href={`tel:${selectedReport.reporter_phone}`}>{selectedReport.reporter_phone}</a></p>
                <p><strong>อีเมล:</strong> {selectedReport.reporter_email || 'ไม่ได้ระบุ'}</p>
                <p><strong>เฟซบุ๊ก:</strong> {selectedReport.reporter_facebook || 'ไม่ได้ระบุ'}</p>
                <p><strong>ที่อยู่:</strong> {selectedReport.reporter_address || 'ไม่ได้ระบุ'}</p>
              </div>

              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="flaticon-icon" alt="report" />
                  ข้อมูลปัญหา
                </h4>
                <p><strong>หมายเลขอ้างอิง:</strong> <span className="ref-badge">{selectedReport.reference_id || 'ไม่มี'}</span></p>
                <p><strong>เลขรับ:</strong> <strong style={{ color: 'var(--primary-dark)' }}>{getReceiptNumber(selectedReport)}/{new Date(selectedReport.created_at).getFullYear() + 543}</strong></p>
                <p><strong>วันเวลา:</strong> {formatDate(selectedReport.created_at)}</p>
                {selectedReport.rating ? (
                  <p>
                    <strong>คะแนนประเมิน:</strong>{" "}
                    <span style={{ color: "#F4B400", fontWeight: "bold", fontSize: "14pt" }}>
                      {"⭐".repeat(selectedReport.rating)}
                    </span>{" "}
                    ({selectedReport.rating}/5 ดาว)
                  </p>
                ) : (
                  selectedReport.status === "เสร็จสิ้น" && (
                    <p><strong>คะแนนประเมิน:</strong> <span style={{ color: "#8c8c8c", fontStyle: "italic" }}>ยังไม่ได้ประเมิน</span></p>
                  )
                )}
                <p>
                  <strong>ประเภท:</strong>
                  <img src={CATEGORY_ICONS[selectedReport.category] || CATEGORY_ICONS.other} className="flaticon-icon" alt={selectedReport.category} style={{ marginLeft: '0.4rem' }} />
                  {CATEGORY_LABELS[selectedReport.category] || selectedReport.category}
                </p>
                <p style={{ marginBottom: '0.3rem' }}><strong>รายละเอียด (แก้ไขได้):</strong></p>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '11pt',
                    fontFamily: 'inherit',
                    lineHeight: '1.4',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                  value={selectedReport.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="กรอกรายละเอียดปัญหา..."
                />
              </div>

              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" className="flaticon-icon" alt="location" />
                  สถานที่และพิกัด
                </h4>
                <p><strong>จุดสังเกต:</strong> {selectedReport.location_name || 'ไม่ได้ระบุ'}</p>
                {selectedReport.latitude && selectedReport.longitude ? (
                  <div>
                    <p><strong>พิกัด:</strong> {selectedReport.latitude.toFixed(6)}, {selectedReport.longitude.toFixed(6)}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="map-link-btn"
                      style={{ marginBottom: '12px' }}
                    >
                      <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" className="flaticon-btn-icon" alt="maps" style={{ filter: 'brightness(0) invert(1)', marginRight: '6px' }} />
                      เปิดบน Google Maps
                    </a>

                    {/* Embedded Interactive Map */}
                    <div style={{ height: '220px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd', marginTop: '10px' }}>
                      <MapContainer
                        center={[selectedReport.latitude, selectedReport.longitude]}
                        zoom={15}
                        scrollWheelZoom={false}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={[selectedReport.latitude, selectedReport.longitude]} icon={customIcon} />
                      </MapContainer>
                    </div>
                  </div>
                ) : (
                  <p>ไม่ได้ระบุตำแหน่งแผนที่</p>
                )}
              </div>

              {selectedReport.image_urls && selectedReport.image_urls.length > 0 && (
                <div className="detail-section">
                  <h4>
                    <img src="https://cdn-icons-png.flaticon.com/512/685/685655.png" className="flaticon-icon" alt="evidence" />
                    รูปภาพหลักฐาน
                  </h4>
                  <div className="modal-image-grid">
                    {selectedReport.image_urls.map((url, index) => (
                      <a href={url} target="_blank" rel="noopener noreferrer" key={index}>
                        <img src={url} alt={`Evidence ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/1946/1946436.png" className="flaticon-icon" alt="department" />
                  หน่วยงานที่รับผิดชอบ
                </h4>
                <input
                  type="text"
                  className="dept-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '11pt',
                    marginTop: '0.4rem',
                    boxSizing: 'border-box'
                  }}
                  value={adminDept}
                  onChange={(e) => setAdminDept(e.target.value)}
                  onBlur={(e) => handleDepartmentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDepartmentChange(e.target.value);
                      e.target.blur();
                    }
                  }}
                  placeholder="กรอกหน่วยงาน เช่น กองช่าง, กองสาธารณสุขฯ"
                />
              </div>

              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" className="flaticon-icon" alt="officer" />
                  เจ้าหน้าที่ผู้รับเรื่อง (ในใบพิมพ์)
                </h4>
                <select
                  className="officer-select"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '11pt',
                    marginTop: '0.4rem',
                    boxSizing: 'border-box',
                    background: 'white'
                  }}
                  value={officerName}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setOfficerName(selectedName);
                    localStorage.setItem('selected_officer', selectedName);
                    const matched = OFFICERS.find(o => o.name === selectedName);
                    if (matched) {
                      setOfficerPosition(matched.position);
                      localStorage.setItem('selected_officer_position', matched.position);
                    }
                  }}
                >
                  {OFFICERS.map((o) => (
                    <option key={o.name} value={o.name}>{o.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="officer-position-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '11pt',
                    marginTop: '0.4rem',
                    boxSizing: 'border-box'
                  }}
                  value={officerPosition}
                  onChange={(e) => {
                    setOfficerPosition(e.target.value);
                    localStorage.setItem('selected_officer_position', e.target.value);
                  }}
                  placeholder="ระบุตำแหน่งเจ้าหน้าที่..."
                />
              </div>

              <div className="detail-section">
                <h4>
                  <img src="https://cdn-icons-png.flaticon.com/512/1067/1067745.png" className="flaticon-icon" alt="status" />
                  เปลี่ยนสถานะดำเนินการ
                </h4>
                <div className="status-updater-row">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      className={`status-option-btn status-${status} ${selectedReport.status === status ? 'active' : ''}`}
                      onClick={() => handleStatusChange(selectedReport.id, status)}
                      disabled={updatingId === selectedReport.id}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                {selectedReport.status === 'เสร็จสิ้น' && selectedReport.reporter_email && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      className="email-notify-btn"
                      onClick={() => handleSendEmail(selectedReport)}
                      disabled={emailSending}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: emailSending ? '#a7f3d0' : '#10b981',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '10.5pt',
                        cursor: emailSending ? 'not-allowed' : 'pointer',
                        width: '100%',
                        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => { if (!emailSending) e.currentTarget.style.background = '#059669'; }}
                      onMouseOut={(e) => { if (!emailSending) e.currentTarget.style.background = '#10b981'; }}
                    >
                      {emailSending ? (
                        <>
                          <span className="spinner" style={{ borderLeftColor: 'white', width: '14px', height: '14px', marginRight: '0.5rem' }}></span>
                          กำลังส่งอีเมล...
                        </>
                      ) : (
                        <>
                          <img src="https://cdn-icons-png.flaticon.com/512/561/561127.png" className="flaticon-btn-icon" alt="email" style={{ filter: 'brightness(0) invert(1)', width: '16px', height: '16px' }} />
                          ส่งอีเมลแจ้งผลเสร็จสิ้นถึงผู้ร้องเรียน
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINT TEMPLATE (Hidden by default, shown only during print) ================= */}
      {selectedReport && (() => {
        const thaiDate = formatThaiFullDate(selectedReport.created_at);
        const dept = (() => {
          const engineeringCats = ['road', 'electricity', 'water', 'traffic'];
          const publicHealthCats = ['garbage', 'park', 'stray', 'noise'];
          if (engineeringCats.includes(selectedReport.category)) return 'กองช่าง';
          if (publicHealthCats.includes(selectedReport.category)) return 'กองสาธารณสุขและสิ่งแวดล้อม';
          return 'สำนักปลัดเทศบาล';
        })();

        // Extract a numeric receipt number sequentially starting from 468
        const receiptNumber = getReceiptNumber(selectedReport);

        return (
          <div className="print-only-document">
            <h2 className="print-title" style={{ fontSize: '18pt', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              ร้องเรียนร้องทุกข์เทศบาลนครเจ้าพระยาสุรศักดิ์
            </h2>

            {/* ส่วนที่ 1: ช่องทางการร้องเรียน */}
            <div className="print-section">
              <h3 className="print-section-title" style={{ fontSize: '14pt', fontWeight: 'bold' }}>ส่วนที่ 1 ช่องทางการร้องเรียน</h3>
              <table className="print-info-table" style={{ marginLeft: '1rem' }}>
                <tbody>
                  <tr>
                    <td>▢ Website (เว็บไซต์) www.chaoprayasurasak.go.th / E-Mail admin@chaoprayasurasak.go.th</td>
                  </tr>
                  <tr>
                    <td>▢ Facebook Page (เฟซบุ๊ก) เทศบาลนครเจ้าพระยาสุรศักดิ์</td>
                  </tr>
                  <tr>
                    <td>▢ ตู้รับเรื่องร้องเรียนร้องทุกข์ เทศบาลนครเจ้าพระยาสุรศักดิ์</td>
                  </tr>
                  <tr>
                    <td>▢ อื่น ๆ ....................................................................</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ส่วนที่ 2: เลขรับ / วันที่ / เวลา */}
            <div className="print-section">
              <h3 className="print-section-title" style={{ fontSize: '14pt', fontWeight: 'bold' }}>ส่วนที่ 2 เลขรับ / วันที่ / เวลา</h3>
              <p style={{ fontSize: '12pt', marginLeft: '1rem', textIndent: '2.5em' }}>
                เลขรับ &nbsp; {receiptNumber} / {thaiDate.year} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                วันที่ &nbsp; {thaiDate.day} &nbsp; {thaiDate.month} &nbsp; {thaiDate.year} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                เวลา &nbsp; {thaiDate.time}
              </p>
            </div>

            {/* ส่วนที่ 3: รายละเอียดเรื่องร้องเรียน */}
            <div className="print-section">
              <h3 className="print-section-title" style={{ fontSize: '14pt', fontWeight: 'bold' }}>ส่วนที่ 3 รายละเอียดเรื่องร้องเรียน</h3>
              <p style={{ fontSize: '12pt', textIndent: '2.5em', marginLeft: '1rem', lineHeight: '1.8' }}>
                เนื่องจาก{selectedReport.description} {selectedReport.location_name ? `บริเวณจุดสังเกต ${selectedReport.location_name}` : ''} {selectedReport.latitude ? `พิกัดตำแหน่ง ${selectedReport.latitude.toFixed(6)}, ${selectedReport.longitude.toFixed(6)}` : ''} จึงอยากให้เทศบาลแก้ไขปัญหาดังกล่าว ตามเอกสารแนบ
              </p>
            </div>

            {/* ส่วนที่ 4: ข้อมูลผู้ร้องเรียน */}
            <div className="print-section">
              <h3 className="print-section-title" style={{ fontSize: '14pt', fontWeight: 'bold' }}>ส่วนที่ 4 ข้อมูลผู้ร้องเรียน</h3>
              <p style={{ fontSize: '12pt', marginLeft: '1rem', textIndent: '2.5em' }}>
                ชื่อช่องทางการร้องเรียน &nbsp; {selectedReport.reporter_name} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                เบอร์โทรศัพท์ &nbsp; {selectedReport.reporter_phone}
              </p>
              <p style={{ fontSize: '12pt', marginLeft: '1rem', textIndent: '2.5em', marginTop: '0.3rem' }}>
                อีเมล &nbsp; {selectedReport.reporter_email || 'ไม่ได้ระบุ'} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                เฟซบุ๊ก &nbsp; {selectedReport.reporter_facebook || 'ไม่ได้ระบุ'}
              </p>
            </div>
            {/* ส่วนที่ 5: หน่วยงานที่รับผิดชอบ */}
            <div className="print-section" style={{ pageBreakInside: 'avoid' }}>
              <h3 className="print-section-title" style={{ fontSize: '14pt', fontWeight: 'bold' }}>ส่วนที่ 5 หน่วยงานที่รับผิดชอบ</h3>
              <p style={{ fontSize: '12pt', marginLeft: '1rem', marginBottom: '1.5rem', textIndent: '2.5em' }}>
                หน่วยงานที่รับผิดชอบ &nbsp; {adminDept}
              </p>

              {/* กล่องครอบที่ทำให้ฝั่งซ้ายและฝั่งขวาอยู่ข้างกัน */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingRight: '1rem',
                paddingLeft: '0rem',
                marginTop: '2rem'
              }}>

                {/* ฝั่งซ้าย: เรียน ผู้อำนวยการ... */}
                <div style={{ width: '340px', fontSize: '12pt', textAlign: 'left' }}>
                  <p style={{ marginBottom: '0.8rem' }}>เรียน ผู้อำนวยการกองยุทธศาสตร์และงบประมาณ</p>
                  <p style={{ marginLeft: '2rem' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - เพื่อโปรดทราบ</p>
                </div>

                {/* ฝั่งขวา: ลงชื่ออันบน (ขยายกว้างเป็น 360px และจัดกึ่งกลางให้สวยงาม ไม่ตัดคำขึ้นบรรทัดใหม่มั่ว) */}
                <div style={{ width: '360px', fontSize: '12pt', textAlign: 'center' }}>
                  <p style={{ marginBottom: '0.8rem' }}>ลงชื่อ ...........................................................</p>
                  <p>({officerName})</p>
                  <p>ตำแหน่ง {officerPosition}</p>
                  <p style={{ marginTop: '0.3rem' }}>วันที่ {getThaiTodayDate().day} เดือน {getThaiTodayDate().month} พ.ศ. {getThaiTodayDate().year}</p>
                </div>
              </div>
            </div>

            {/* ส่วนท้ายสุด: ศูนย์รับเรื่องร้องเรียนร้องทุกข์ */}
            <div className="print-section" style={{ pageBreakInside: 'avoid', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '0px dashed #000' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '1rem' }}>

                {/* ใช้ width: '360px' และ textAlign: 'center' ขนาดเท่ากับกล่องด้านบนเป๊ะๆ ขอบจะตรงกันเสมอ */}
                <div style={{ width: '300px', fontSize: '12pt', textAlign: 'center' }}>
                  <p style={{ fontSize: '12pt', fontWeight: 'bold', marginBottom: '1.5rem' }}>ศูนย์รับเรื่องร้องเรียนร้องทุกข์ได้รับเรื่องไว้แล้ว</p>
                  <p style={{ marginBottom: '0.8rem' }}>ลงชื่อ ...........................................................</p>
                  <p>(.................................................)</p>
                  <p style={{ marginTop: '0.3rem' }}>วันที่ {getThaiTodayDate().day} เดือน {getThaiTodayDate().month} พ.ศ. {getThaiTodayDate().year}</p>
                  <p style={{ marginTop: '0.3rem' }}>เวลา ................................. น.</p>
                </div>
              </div>
            </div>

            {/* ส่วนแนบรูปภาพประกอบ */}
            {selectedReport.image_urls && selectedReport.image_urls.length > 0 && (
              <div className="print-section print-images-page">
                <h3 className="print-section-title" style={{ fontSize: '12pt', fontWeight: 'bold' }}>เอกสารแนบรูปภาพประกอบ</h3>
                <div className="print-image-grid">
                  {selectedReport.image_urls.map((url, idx) => (
                    <div className="print-image-item" key={idx}>
                      <img src={url} alt={`หลักฐานประกอบที่ ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Hidden element to force browser to preload and cache the font on screen load */}
      <div style={{ fontFamily: "'TH Sarabun PSK V-1'", opacity: 0, position: 'absolute', pointerEvents: 'none', height: 0, overflow: 'hidden' }}>
        โหลดฟอนต์ TH Sarabun PSK V-1
      </div>

      {showSettingsModal && (
        <div className="detail-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="detail-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>ตั้งค่าระบบ</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>
                  หมายเลขรับแจ้งเริ่มต้น (Starting Receipt Number)
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '11pt',
                    boxSizing: 'border-box'
                  }}
                  value={tempStartNum}
                  onChange={(e) => setTempStartNum(parseInt(e.target.value, 10) || 0)}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                  * การเปลี่ยนเลขนี้จะส่งผลต่อการคำนวณเลขรับ (เช่น {tempStartNum}/2569) ของเรื่องร้องเรียนทั้งหมดในระบบโดยอัตโนมัติ
                </p>
              </div>

              <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '1.5rem 0' }} />

              <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--primary)' }}>ตั้งค่าส่งอีเมลอัตโนมัติ (EmailJS)</h4>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.3rem', display: 'block', fontSize: '10pt' }}>
                  EmailJS Service ID
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '10.5pt',
                    boxSizing: 'border-box'
                  }}
                  value={emailServiceId}
                  onChange={(e) => setEmailServiceId(e.target.value)}
                  placeholder="เช่น service_xxxxxxx"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.3rem', display: 'block', fontSize: '10pt' }}>
                  EmailJS Template ID
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '10.5pt',
                    boxSizing: 'border-box'
                  }}
                  value={emailTemplateId}
                  onChange={(e) => setEmailTemplateId(e.target.value)}
                  placeholder="เช่น template_xxxxxxx"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.3rem', display: 'block', fontSize: '10pt' }}>
                  EmailJS Public Key
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '10.5pt',
                    boxSizing: 'border-box'
                  }}
                  value={emailPublicKey}
                  onChange={(e) => setEmailPublicKey(e.target.value)}
                  placeholder="เช่น user_xxxxxxxxxxxxxxxx"
                />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                * สมัครบริการส่งอีเมลฟรีได้ที่ <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>emailjs.com</a> เพื่อรับค่าเหล่านี้มาใช้งาน
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  className="refresh-btn"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ border: '1px solid #ccc', color: '#666' }}
                >
                  ยกเลิก
                </button>
                <button
                  className="submit-btn"
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    localStorage.setItem('starting_receipt_number', tempStartNum.toString());
                    localStorage.setItem('emailjs_service_id', emailServiceId);
                    localStorage.setItem('emailjs_template_id', emailTemplateId);
                    localStorage.setItem('emailjs_public_key', emailPublicKey);
                    setShowSettingsModal(false);
                    fetchReports();
                  }}
                >
                  บันทึกตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
