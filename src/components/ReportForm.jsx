import { useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import MapPicker from './MapPicker';
import ImageUpload from './ImageUpload';
import SuccessModal from './SuccessModal';

const CATEGORIES = [
  { value: '', label: '-- เลือกประเภทปัญหา --' },
  { value: 'road', label: 'ถนน/ทางเท้าชำรุด' },
  { value: 'electricity', label: 'ไฟฟ้าสาธารณะ' },
  { value: 'water', label: 'ท่อน้ำ/ระบบระบายน้ำ' },
  { value: 'garbage', label: 'ขยะ/ความสะอาด' },
  { value: 'park', label: 'สวนสาธารณะ' },
  { value: 'traffic', label: 'สัญญาณไฟจราจร/ป้ายจราจร' },
  { value: 'noise', label: 'เสียงรบกวน/มลพิษ' },
  { value: 'stray', label: 'สัตว์จรจัด' },
  { value: 'other', label: 'อื่นๆ' },
];

const initialFormState = {
  reporterName: '',
  reporterPhone: '',
  reporterEmail: '',
  reporterFacebook: '',
  reporterAddress: '',
  category: '',
  description: '',
  locationName: '',
};

export default function ReportForm() {
  const [form, setForm] = useState(initialFormState);
  const [position, setPosition] = useState(null);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!form.reporterName.trim()) {
      newErrors.reporterName = 'กรุณากรอกชื่อ-นามสกุล';
    }

    if (!form.reporterPhone.trim()) {
      newErrors.reporterPhone = 'กรุณากรอกเบอร์โทรศัพท์';
    } else if (!/^(0[0-9]{8,9})$/.test(form.reporterPhone.replace(/[-\s]/g, ''))) {
      newErrors.reporterPhone = 'เบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)';
    }

    if (!form.reporterEmail.trim()) {
      newErrors.reporterEmail = 'กรุณากรอกอีเมล';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reporterEmail.trim())) {
      newErrors.reporterEmail = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (!form.reporterFacebook.trim()) {
      newErrors.reporterFacebook = 'กรุณากรอกชื่อเฟสบุ๊ค';
    }

    if (!form.category) {
      newErrors.category = 'กรุณาเลือกประเภทปัญหา';
    }

    if (!form.description.trim()) {
      newErrors.description = 'กรุณากรอกรายละเอียดปัญหา';
    }

    if (!position) {
      newErrors.position = 'กรุณาเลือกตำแหน่งบนแผนที่';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadImages = async () => {
    const supabase = getSupabase();
    if (!supabase) return [];
    const urls = [];
    for (const img of images) {
      const ext = img.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('report-images')
        .upload(fileName, img.file);

      if (error) {
        console.error('Upload error:', error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('report-images')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  };

  const generateRefId = () => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `RPT-${y}${m}${d}-${rand}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      alert('ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาตั้งค่า Supabase ใน .env ก่อน');
      return;
    }

    setSubmitting(true);
    try {
      // Upload images first
      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadImages();
      }

      const refId = generateRefId();

      const { error } = await supabase.from('reports').insert([
        {
          reporter_name: form.reporterName.trim(),
          reporter_phone: form.reporterPhone.replace(/[-\s]/g, ''),
          reporter_email: form.reporterEmail.trim(),
          reporter_facebook: form.reporterFacebook.trim(),
          reporter_address: form.reporterAddress.trim(),
          category: form.category,
          description: form.description.trim(),
          location_name: form.locationName.trim(),
          latitude: position.lat,
          longitude: position.lng,
          image_urls: imageUrls,
          status: 'รอดำเนินการ',
          reference_id: refId,
        },
      ]);

      if (error) throw error;

      // Query the count of all reports to determine this report's receipt number
      const { count: dbCount, error: countError } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true });

      const savedStart = localStorage.getItem('starting_receipt_number');
      const startNum = savedStart ? parseInt(savedStart, 10) : 468;
      const totalCount = (!countError && dbCount !== null) ? dbCount : 1;
      const runningNum = startNum + totalCount - 1;
      const currentYear = new Date().getFullYear() + 543;

      setReceiptNumber(`${runningNum}/${currentYear}`);
      setReferenceId(refId);
      setShowSuccess(true);
    } catch (err) {
      console.error('Submit error:', err);
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm(initialFormState);
    setPosition(null);
    setImages([]);
    setErrors({});
    setShowSuccess(false);
    setReferenceId('');
    setReceiptNumber('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <form onSubmit={handleSubmit} id="report-form">

        {/* === ข้อมูลผู้แจ้ง === */}
        <div className="section-group">
          <div className="section-label">
            <img src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" className="flaticon-icon" alt="user" />
            ข้อมูลผู้แจ้ง
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reporterName">
                ชื่อ-นามสกุล <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" className="flaticon-btn-icon" alt="user" />
                </span>
                <input
                  type="text"
                  id="reporterName"
                  name="reporterName"
                  className={`form-input has-icon ${errors.reporterName ? 'error' : ''}`}
                  placeholder="กรอกชื่อ-นามสกุล"
                  value={form.reporterName}
                  onChange={handleChange}
                />
              </div>
              {errors.reporterName && (
                <p className="error-message">⚠️ {errors.reporterName}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reporterPhone">
                เบอร์โทรศัพท์ <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="https://cdn-icons-png.flaticon.com/512/455/455705.png" className="flaticon-btn-icon" alt="phone" />
                </span>
                <input
                  type="tel"
                  id="reporterPhone"
                  name="reporterPhone"
                  className={`form-input has-icon ${errors.reporterPhone ? 'error' : ''}`}
                  placeholder="0812345678"
                  value={form.reporterPhone}
                  onChange={handleChange}
                  maxLength={10}
                />
              </div>
              {errors.reporterPhone && (
                <p className="error-message">⚠️ {errors.reporterPhone}</p>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reporterEmail">
                อีเมล <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="https://cdn-icons-png.flaticon.com/512/561/561127.png" className="flaticon-btn-icon" alt="email" />
                </span>
                <input
                  type="email"
                  id="reporterEmail"
                  name="reporterEmail"
                  className={`form-input has-icon ${errors.reporterEmail ? 'error' : ''}`}
                  placeholder="example@email.com"
                  value={form.reporterEmail}
                  onChange={handleChange}
                />
              </div>
              {errors.reporterEmail && (
                <p className="error-message">⚠️ {errors.reporterEmail}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reporterFacebook">
                ชื่อเฟสบุ๊ค <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" className="flaticon-btn-icon" alt="facebook" />
                </span>
                <input
                  type="text"
                  id="reporterFacebook"
                  name="reporterFacebook"
                  className={`form-input has-icon ${errors.reporterFacebook ? 'error' : ''}`}
                  placeholder="ชื่อบัญชี Facebook ของท่าน"
                  value={form.reporterFacebook}
                  onChange={handleChange}
                />
              </div>
              {errors.reporterFacebook && (
                <p className="error-message">⚠️ {errors.reporterFacebook}</p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reporterAddress">
              ที่อยู่ผู้แจ้ง
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <img src="https://cdn-icons-png.flaticon.com/512/1946/1946436.png" className="flaticon-btn-icon" alt="home" />
              </span>
              <input
                type="text"
                id="reporterAddress"
                name="reporterAddress"
                className="form-input has-icon"
                placeholder="บ้านเลขที่ ซอย ถนน ตำบล อำเภอ"
                value={form.reporterAddress}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* === รายละเอียดปัญหา === */}
        <div className="section-group">
          <div className="section-label">
            <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="flaticon-icon" alt="desc" />
            รายละเอียดปัญหา
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="category">
              ประเภทปัญหา <span className="required">*</span>
            </label>
            <select
              id="category"
              name="category"
              className={`form-select ${errors.category ? 'error' : ''}`}
              value={form.category}
              onChange={handleChange}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="error-message">⚠️ {errors.category}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              รายละเอียดปัญหา <span className="required">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              placeholder="อธิบายปัญหาที่พบ เช่น ถนนเป็นหลุม ไฟฟ้าดับ ท่อน้ำแตก..."
              value={form.description}
              onChange={handleChange}
              rows={4}
            />
            {errors.description && (
              <p className="error-message">⚠️ {errors.description}</p>
            )}
          </div>
        </div>

        {/* === สถานที่ === */}
        <div className="section-group">
          <div className="section-label">
            <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" className="flaticon-icon" alt="location" />
            สถานที่แจ้งปัญหา
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="locationName">
              ชื่อสถานที่ / จุดสังเกต
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <img src="https://cdn-icons-png.flaticon.com/512/484/484167.png" className="flaticon-btn-icon" alt="loc" />
              </span>
              <input
                type="text"
                id="locationName"
                name="locationName"
                className="form-input has-icon"
                placeholder="เช่น หน้าวัด... ซอย... ใกล้ร้าน..."
                value={form.locationName}
                onChange={handleChange}
              />
            </div>
          </div>

          <MapPicker position={position} setPosition={setPosition} />
          {errors.position && (
            <p className="error-message">⚠️ {errors.position}</p>
          )}
        </div>

        {/* === แนบรูปภาพ === */}
        <div className="section-group">
          <div className="section-label">
            <img src="https://cdn-icons-png.flaticon.com/512/685/685655.png" className="flaticon-icon" alt="images" />
            หลักฐานรูปภาพ
          </div>
          <ImageUpload images={images} setImages={setImages} />
        </div>

        {/* === ปุ่ม Submit === */}
        <div className="submit-section">
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
            id="btn-submit"
          >
            {submitting ? (
              <>
                <span className="spinner"></span>
                กำลังส่งข้อมูล...
              </>
            ) : (
              <>
                <img src="https://cdn-icons-png.flaticon.com/512/2989/2989839.png" className="flaticon-btn-icon" alt="submit" style={{ filter: 'brightness(0) invert(1)' }} />
                ส่งแจ้งปัญหา
              </>
            )}
          </button>
        </div>
      </form>

      {showSuccess && (
        <SuccessModal referenceId={referenceId} receiptNumber={receiptNumber} onClose={handleReset} />
      )}
    </>
  );
}

