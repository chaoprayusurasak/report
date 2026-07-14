export default function Header({ activeTab }) {
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'report':
        return {
          icon: <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="flaticon-card-header" alt="report" />,
          title: 'แบบฟอร์มแจ้งร้องเรียน/แจ้งซ่อม',
          sub: 'กรุณากรอกข้อมูลรายละเอียดปัญหาของท่านให้ครบถ้วนเพื่อแจ้งงาน',
        };
      case 'tracker':
        return {
          icon: <img src="https://cdn-icons-png.flaticon.com/512/428/428032.png" className="flaticon-card-header" alt="stats" />,
          title: 'สถิติและติดตามปัญหาในท้องที่',
          sub: 'ดูข้อมูลปัญหาของชุมชน สถานะการแก้ไขแบบเรียลไทม์',
        };
      case 'admin':
        return {
          title: 'ระบบบริหารจัดการสำหรับเจ้าหน้าที่',
          sub: 'ส่วนการตรวจสอบข้อมูลเรื่องร้องเรียนและปรับสถานะดำเนินการ',
        };
      default:
        return {
          icon: <img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" className="flaticon-card-header" alt="default" />,
          title: 'ข้อมูลการแจ้งปัญหา',
          sub: 'กรุณากรอกข้อมูลให้ครบถ้วนเพื่อดำเนินการ',
        };
    }
  };

  const info = getHeaderInfo();

  return (
    <div className="card-header">
      <div className="card-header-icon">{info.icon}</div>
      <div className="card-header-text">
        <h1>{info.title}</h1>
        <p>{info.sub}</p>
      </div>
    </div>
  );
}
