import { useState, useRef } from 'react';

export default function ImageUpload({ images, setImages }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_IMAGES = 5;
  const MAX_SIZE_MB = 5;

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
        return false;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`ไฟล์ ${file.name} มีขนาดเกิน ${MAX_SIZE_MB}MB`);
        return false;
      }
      return true;
    });

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      alert(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }

    const newFiles = validFiles.slice(0, remaining);
    const newImages = newFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemove = (id) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="form-group">
      <label className="form-label">📷 แนบรูปภาพ</label>
      <p className="form-hint">สูงสุด {MAX_IMAGES} รูป (แต่ละไฟล์ไม่เกิน {MAX_SIZE_MB}MB)</p>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        id="image-upload-zone"
      >
        <span className="upload-icon">📁</span>
        <p className="upload-text">
          ลากไฟล์มาวางที่นี่ หรือ <span className="upload-browse">เลือกไฟล์</span>
        </p>
        <p className="upload-hint">รองรับ JPG, PNG, WEBP</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="upload-input"
          onChange={handleInputChange}
          id="image-file-input"
        />
      </div>

      {images.length > 0 && (
        <div className="image-preview-grid">
          {images.map((img) => (
            <div key={img.id} className="image-preview-item">
              <img src={img.preview} alt="Preview" />
              <button
                type="button"
                className="image-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(img.id);
                }}
                title="ลบรูปนี้"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
