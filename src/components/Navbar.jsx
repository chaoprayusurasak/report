import { useState } from 'react';
import './Navbar.css';

export default function Navbar({ activeTab, setActiveTab, session, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    onLogout();
    setIsOpen(false);
  };

  return (
    <nav className="global-navbar">
      <div className="nav-container">
        {/* Left Side: Logo & Circular Icons */}
        <div className="nav-left" onClick={() => handleTabClick('report')}>
          <img src="https://cdn-icons-png.flaticon.com/512/1067/1067745.png" className="flaticon-logo-icon" alt="logo" />
          <span className="logo-text">
            Surasak city<span className="star-orange"></span>
          </span>
        </div>

        {/* Hamburger Toggle Button (Mobile Only) */}
        <button 
          className={`nav-toggle ${isOpen ? 'open' : ''}`} 
          onClick={() => setIsOpen(!isOpen)} 
          aria-label="Toggle navigation"
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>

        {/* Center/Right Side: Menus */}
        <div className={`nav-right ${isOpen ? 'mobile-open' : ''}`}>
          <button
            className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`}
            onClick={() => handleTabClick('tracker')}
          >
            <img src="https://cdn-icons-png.flaticon.com/512/428/428032.png" className="flaticon-btn-icon" alt="stats" />
            สถิติ/ติดตามปัญหา
          </button>
          
          <button
            className={`nav-item ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => handleTabClick('report')}
          >
            <img src="https://cdn-icons-png.flaticon.com/512/541/541415.png" className="flaticon-btn-icon" alt="report" />
            แจ้งปัญหา
          </button>

          <button
            className={`nav-item staff-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabClick('admin')}
          >
            <img src="https://cdn-icons-png.flaticon.com/512/1144/1144760.png" className="flaticon-btn-icon" alt="staff" />
            {session ? 'แดชบอร์ดเจ้าหน้าที่' : 'เข้าสู่ระบบเจ้าหน้าที่'}
          </button>

          {session && (
            <button className="nav-item logout-btn" onClick={handleLogoutClick}>
              <img src="https://cdn-icons-png.flaticon.com/512/1828/1828490.png" className="flaticon-btn-icon" alt="logout" />
              ออกจากระบบ
            </button>
          )}

          {/* Far Right Logo (NSTDA representation) */}
          <div className="nstda-logo">
            <span className="nstda-text">เทศบาล</span>
          </div>
        </div>
      </div>
    </nav>
  );
}


