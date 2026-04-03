import { useState } from 'react'
import styles from './TagRow.module.css'

interface TagRowProps {
  tags: string[]
  onDismiss: (tag: string) => void
  onAdd: (tag: string) => void
  placeholder?: string
}

export function TagRow({ tags, onDismiss, onAdd, placeholder = 'add tag...' }: TagRowProps) {
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAdd(inputValue.trim().toLowerCase())
      setInputValue('')
      setShowInput(false)
    }
    if (e.key === 'Escape') {
      setInputValue('')
      setShowInput(false)
    }
  }

  return (
    <div className={styles.row}>
      {tags.map((tag, i) => (
        <span
          key={tag}
          className={styles.tag}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {tag}
          <button className={styles.dismiss} onClick={() => onDismiss(tag)}>×</button>
        </span>
      ))}
      {showInput ? (
        <input
          className={styles.input}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { setShowInput(false); setInputValue('') }}
          placeholder={placeholder}
          autoFocus
        />
      ) : (
        <button className={styles.addBtn} onClick={() => setShowInput(true)}>+</button>
      )}
    </div>
  )
}
