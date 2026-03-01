'use client'

import { useState, useEffect } from 'react'

const IMAGES = ['/heroes/cycling.png', '/heroes/chess.png', '/heroes/football.png']
const INTERVAL = 4000

export default function ImageCycler() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % IMAGES.length)
    }, INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {IMAGES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === activeIndex ? 1 : 0 }}
          {...(i === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
        />
      ))}
    </>
  )
}
