import { ChangeEvent, useRef, useState } from 'react'

interface Props {
  label: string
  onFileSelected: (file: File) => void
  busy?: boolean
}

export default function PhotoInput({ label, onFileSelected, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    onFileSelected(file)
  }

  return (
    <div className="photo-input">
      {preview && <img src={preview} alt="Vorschau" className="photo-preview" />}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Analysiere…' : label}
      </button>
    </div>
  )
}
