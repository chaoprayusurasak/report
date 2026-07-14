import { useState, useEffect } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './PublicTracker.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Category and status translators
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

const STATUS_ICONS = {
  เสร็จสิ้น: 'https://cdn-icons-png.flaticon.com/512/5610/5610944.png', // checkmark/completed
  กำลังดำเนินการ: 'https://cdn-icons-png.flaticon.com/512/483/483488.png', // in progress
  รอดำเนินการ: 'https://cdn-icons-png.flaticon.com/512/1022/1022204.png', // clock
};

export default function PublicTracker() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Load Lottie Player script dynamically
  useEffect(() => {
    if (!document.querySelector('script[data-lottie-player]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
      script.setAttribute('data-lottie-player', 'true');
      document.head.appendChild(script);
    }
  }, []);

  const totalCount = reports.length;
  const pendingCount = reports.filter((r) => r.status === 'รอดำเนินการ').length;
  const progressCount = reports.filter((r) => r.status === 'กำลังดำเนินการ').length;
  const completedCount = reports.filter((r) => r.status === 'เสร็จสิ้น').length;
  const ratedReports = reports.filter((r) => r.rating !== null && r.rating !== undefined && r.rating > 0);
  const averageRating = ratedReports.length > 0 
    ? (ratedReports.reduce((sum, r) => sum + r.rating, 0) / ratedReports.length).toFixed(1)
    : '0.0';

  // Default Chonburi (Sriracha/Chaophraya Surasak) center
  const defaultCenter = [13.1500, 100.9800];

  const createCustomMarker = (status, category) => {
    let color = '#e74c3c'; // Red for 'รอดำเนินการ'
    if (status === 'กำลังดำเนินการ') color = '#f1c40f'; // Yellow for 'กำลังดำเนินการ'
    if (status === 'เสร็จสิ้น') color = '#27ae60'; // Green for 'เสร็จสิ้น'

    const iconUrl = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div class="marker-pin" style="background-color: ${color};">
          <img src="${iconUrl}" class="marker-img-icon" />
        </div>
      `,
      iconSize: [32, 38],
      iconAnchor: [16, 38],
      popupAnchor: [0, -32],
    });
  };

  const fetchReports = async () => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    // Setup Supabase Real-time listener
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel('realtime-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload) => {
          console.log('Real-time change received:', payload);
          if (payload.eventType === 'INSERT') {
            setReports((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReports((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setReports((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredReports = reports.filter((item) => {
    const matchesStatus = filterStatus ? item.status === filterStatus : true;
    const matchesSearch = search
      ? item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.location_name && item.location_name.toLowerCase().includes(search.toLowerCase())) ||
        (item.reference_id && item.reference_id.toLowerCase().includes(search.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="public-tracker">

      {/* === Lottie Hero Banner === */}
      <div className="tracker-hero">
        <div className="tracker-hero-left">
          <div className="tracker-hero-badge">ระบบติดตามปัญหาสาธารณะ</div>
          <h1 className="tracker-hero-title">ติดตามสถานะ<br /><span>เรื่องร้องเรียนเรียลไทม์</span></h1>
          <p className="tracker-hero-subtitle">ตรวจสอบความคืบหน้าและสถิติการแก้ไขปัญหาในชุมชน</p>
          <p className="realtime-badge">
            <span className="live-dot"></span>
            อัปเดตข้อมูลอัตโนมัติ (Real-time)
          </p>
        </div>
        <div className="tracker-hero-right">
          <lottie-player
            src="https://lottie.host/3a0dbd9f-5e30-4c73-8c5b-4f4e4ed74ddc/ry5RPGiHBJ.json"
            background="transparent"
            speed="0.8"
            style={{ width: '180px', height: '180px' }}
            loop
            autoplay
          ></lottie-player>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="stats-summary-grid">
        <div className="stats-card total">
          <div className="stats-card-icon-wrapper">
            <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="stats-card-icon" alt="all" />
          </div>
          <div className="stats-card-info">
            <span className="stats-label">เรื่องร้องเรียนทั้งหมด</span>
            <strong className="stats-value">{totalCount}</strong>
          </div>
        </div>
        <div className="stats-card pending">
          <div className="stats-card-icon-wrapper">
            <img src="https://cdn-icons-png.flaticon.com/512/1022/1022204.png" className="stats-card-icon" alt="pending" />
          </div>
          <div className="stats-card-info">
            <span className="stats-label">รอดำเนินการ</span>
            <strong className="stats-value">{pendingCount}</strong>
          </div>
        </div>
        <div className="stats-card progress">
          <div className="stats-card-icon-wrapper">
            <img src="https://cdn-icons-png.flaticon.com/512/483/483488.png" className="stats-card-icon" alt="progress" />
          </div>
          <div className="stats-card-info">
            <span className="stats-label">กำลังดำเนินการ</span>
            <strong className="stats-value">{progressCount}</strong>
          </div>
        </div>
        <div className="stats-card completed">
          <div className="stats-card-icon-wrapper">
            <img src="https://cdn-icons-png.flaticon.com/512/5610/5610944.png" className="stats-card-icon" alt="completed" />
          </div>
          <div className="stats-card-info">
            <span className="stats-label">เสร็จสิ้น</span>
            <strong className="stats-value">{completedCount}</strong>
          </div>
        </div>
        <div className="stats-card rating">
          <div className="stats-card-icon-wrapper" style={{ background: '#fff9e6' }}>
            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828884.png" className="stats-card-icon" alt="rating" />
          </div>
          <div className="stats-card-info">
            <span className="stats-label">ความพึงพอใจเฉลี่ย ({ratedReports.length} งาน)</span>
            <strong className="stats-value" style={{ color: '#F4B400' }}>
              {ratedReports.length > 0 ? `${averageRating} / 5.0` : 'ไม่มีข้อมูล'}
            </strong>
          </div>
        </div>
      </div>

      {/* Map Overview */}
      <div className="tracker-map-wrapper">
        <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom={true} style={{ height: '320px', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          {reports
            .filter((r) => r.latitude && r.longitude)
            .map((report) => (
              <Marker key={report.id} position={[report.latitude, report.longitude]} icon={createCustomMarker(report.status, report.category)}>
                <Popup>
                  <div className="map-popup-content">
                    <span className="popup-ref">{report.reference_id}</span>
                    <strong>
                      <img src={CATEGORY_ICONS[report.category] || CATEGORY_ICONS.other} className="flaticon-icon" alt={report.category} />
                      {CATEGORY_LABELS[report.category] || report.category}
                    </strong>
                    <p className="popup-desc">{report.description}</p>
                    <span className={`status-badge status-${report.status}`}>
                      <img src={STATUS_ICONS[report.status]} className="flaticon-btn-icon" alt={report.status} style={{ filter: 'brightness(0) invert(1)' }} />
                      {report.status}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* Search & Filter */}
      <div className="tracker-controls">
        <input
          type="text"
          placeholder="ค้นหาข้อความ/หมายเลขอ้างอิง..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">ทุกสถานะดำเนินการ</option>
          <option value="รอดำเนินการ">รอดำเนินการ</option>
          <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
          <option value="เสร็จสิ้น">เสร็จสิ้น</option>
        </select>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="tracker-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', color: '#8b6348' }}>
          <lottie-player
            src="https://lottie.host/8c0678d4-539c-469b-90f7-111dbfe7ff6b/Ww3aXF7b3S.json"
            background="transparent"
            speed="1.2"
            style={{ width: '80px', height: '80px' }}
            loop
            autoplay
          ></lottie-player>
          <span style={{ fontSize: '10.5pt', fontWeight: '500' }}>กำลังโหลดรายการปัญหาล่าสุด...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="tracker-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', color: '#999' }}>
          <lottie-player
            src="https://lottie.host/b089c250-be9c-4b68-80f4-5fdf32fca614/Jlyo9u9zG1.json"
            background="transparent"
            speed="1"
            style={{ width: '100px', height: '100px' }}
            loop
            autoplay
          ></lottie-player>
          <span style={{ fontSize: '10.5pt', fontWeight: '500' }}>ไม่พบรายงานปัญหาที่ค้นหา</span>
        </div>
      ) : (
        <div className="tracker-list">
          {filteredReports.map((report) => (
            <div key={report.id} className="tracker-card">
              <div className="tracker-card-header">
                <span className="tracker-ref">{report.reference_id}</span>
                <span className={`status-tag status-${report.status}`}>
                  <img src={STATUS_ICONS[report.status]} className="flaticon-btn-icon" alt={report.status} style={{ filter: report.status === 'เสร็จสิ้น' || report.status === 'กำลังดำเนินการ' ? 'brightness(0) invert(1)' : 'none' }} />
                  {report.status}
                </span>
              </div>
              <div className="tracker-card-body">
                <div className="tracker-details">
                  <span className="tracker-category">
                    <img src={CATEGORY_ICONS[report.category] || CATEGORY_ICONS.other} className="flaticon-icon" alt={report.category} />
                    {CATEGORY_LABELS[report.category] || report.category}
                  </span>
                  <p className="tracker-desc">{report.description}</p>
                  {report.location_name && (
                    <p className="tracker-loc">
                      <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" className="flaticon-btn-icon" alt="loc" />
                      จุดสังเกต: {report.location_name}
                    </p>
                  )}
                  <span className="tracker-time">
                    <img src="https://cdn-icons-png.flaticon.com/512/1022/1022204.png" className="flaticon-btn-icon" alt="time" />
                    แจ้งเมื่อ: {formatDate(report.created_at)}
                  </span>
                  {report.rating && report.rating > 0 && (
                    <div className="tracker-rating" style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '0.25rem' }}>ความพึงพอใจ:</span>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx} style={{ color: idx < report.rating ? '#F4B400' : '#E0E0E0', fontSize: '15px' }}>★</span>
                      ))}
                    </div>
                  )}
                </div>

                {report.image_urls && report.image_urls.length > 0 && (
                  <div className="tracker-images">
                    <img src={report.image_urls[0]} alt="Evidence" />
                    {report.image_urls.length > 1 && (
                      <span className="more-images-badge">+{report.image_urls.length - 1} รูป</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

