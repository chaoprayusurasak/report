export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <p>
        © {year} ระบบแจ้งปัญหาเทศบาล | 
        สร้างด้วย <span className="footer-heart">♥</span> เพื่อชุมชนที่ดีกว่า
      </p>
    </footer>
  );
}
