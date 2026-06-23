"use client";

import { useEffect, useRef, useState } from "react";

type PhotoPickerProps = {
  files: FileList | null;
  onChange: (files: FileList | null) => void;
  label?: string;
  hint?: string;
};

export default function PhotoPicker({
  files,
  onChange,
  label = "写真",
  hint = "タップして撮影、または写真を選ぶ（複数可）",
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!files || files.length === 0) {
      setPreviews([]);
      return;
    }
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="photo-picker">
      <span className="form-label">{label}</span>
      <p className="photo-picker-hint">{hint}</p>

      <button
        type="button"
        className="photo-picker-btn"
        onClick={() => inputRef.current?.click()}
      >
        写真を撮る / 選ぶ
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="photo-picker-input"
        onChange={(e) => onChange(e.target.files)}
      />

      {previews.length > 0 ? (
        <div className="photo-picker-previews">
          {previews.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt={`プレビュー ${index + 1}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
