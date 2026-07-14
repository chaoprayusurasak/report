import { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import './AdminLogin.css';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const supabase = getSupabase();
    if (!supabase) {
      setErrorMsg('กรุณาตั้งค่าเชื่อมต่อ Supabase ใน .env');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        onLoginSuccess(data.session);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือยังไม่ได้เปิดใช้งานบัญชี');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <lottie-player
            src="https://lottie.host/833ff554-27ff-46ba-b307-353b5c03ad96/HkG54x67Ot.json"
            background="transparent"
            speed="1"
            style={{ width: '150px', height: '150px' }}
            loop
            autoplay
          ></lottie-player>
        </div>
        <h3>เข้าสู่ระบบสำหรับเจ้าหน้าที่</h3>
      </div>

      <form onSubmit={handleLogin} className="login-form">
        {errorMsg && <div className="login-error">⚠️ {errorMsg}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="admin-email">อีเมลเจ้าหน้าที่</label>
          <input
            type="email"
            id="admin-email"
            placeholder="admin@municipality.go.th"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="admin-password">รหัสผ่าน</label>
          <input
            type="password"
            id="admin-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : (
            <>
              <img src="https://cdn-icons-png.flaticon.com/512/3064/3064197.png" className="flaticon-btn-icon" alt="key" style={{ filter: 'brightness(0) invert(1)' }} />
              เข้าสู่ระบบ
            </>
          )}
        </button>
      </form>
    </div>
  );
}
