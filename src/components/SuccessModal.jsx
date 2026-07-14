export default function SuccessModal({ referenceId, receiptNumber, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} id="success-modal">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px' }}>
          <lottie-player
            src="https://lottie.host/80e927ef-0518-47ad-bc66-51f4c7816174/6v9Fms74Z9.json"
            background="transparent"
            speed="1"
            style={{ width: '100px', height: '100px' }}
            autoplay
          ></lottie-player>
        </div>
        <h2 className="modal-title">แจ้งปัญหาสำเร็จ!</h2>
        <p className="modal-message">
          ข้อมูลของท่านถูกส่งเข้าระบบเรียบร้อยแล้ว<br />
          เจ้าหน้าที่จะดำเนินการตรวจสอบและแก้ไขโดยเร็วที่สุด
        </p>
        {receiptNumber ? (
          <div className="modal-ref">
            เลขรับแจ้งปัญหา
            <strong>{receiptNumber}</strong>
          </div>
        ) : referenceId ? (
          <div className="modal-ref">
            หมายเลขอ้างอิง
            <strong>{referenceId}</strong>
          </div>
        ) : null}
        <button className="modal-btn" onClick={onClose} id="btn-new-report">
          <img src="https://cdn-icons-png.flaticon.com/512/483/483488.png" className="flaticon-btn-icon" alt="refresh" style={{ filter: 'brightness(0) invert(1)' }} />
          แจ้งปัญหาใหม่
        </button>
      </div>
    </div>
  );
}
