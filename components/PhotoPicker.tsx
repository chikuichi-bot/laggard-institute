"use client";

import { useEffect, useRef, useState } from "react";

type PhotoPickerProps = {
  files: FileList | null;
  onChange: (files: FileList | null) => void;
  label?: string;
  hint?: string;
};

function fileListFromArray(files: File[]): FileList | null {
  if (files.length === 0) return null;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  return transfer.files;
}

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

  function removeAt(index: number) {
    if (!files) return;
    const next = Array.from(files);
    next.splice(index, 1);
    onChange(fileListFromArray(next));
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function appendFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const merged = [...Array.from(files ?? []), ...Array.from(incoming)];
    onChange(fileListFromArray(merged));
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

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
        onChange={(e) => appendFiles(e.target.files)}
      />

      {previews.length > 0 ? (
        <div className="photo-picker-previews">
          {previews.map((src, index) => (
            <div key={src} className="photo-existing-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`プレビュー ${index + 1}`} />
              <button
                type="button"
                className="photo-existing-remove"
                onClick={() => removeAt(index)}
                aria-label={`プレビュー ${index + 1} を外す`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
