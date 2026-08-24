import { useEffect, useState } from 'react'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJSON(key, initial))

  useEffect(() => {
    saveJSON(key, value)
  }, [key, value])

  return [value, setValue] as const
}
