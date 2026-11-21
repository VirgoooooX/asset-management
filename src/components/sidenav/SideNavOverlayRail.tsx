import React, { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

const MIN_THUMB_PX = 24
const RAIL_HIDE_MS = 800

type RailMetrics = {
  length: number
  offset: number
  range: number
  movable: number
}

function measureRail(content: number, viewport: number, scroll: number, track: number): RailMetrics | null {
  const range = Math.max(0, content - viewport)
  if (range <= 1 || track <= 0) return null
  const length = Math.min(track, Math.max(MIN_THUMB_PX, (track * viewport) / content))
  const movable = Math.max(0, track - length)
  const offset = movable * Math.min(1, Math.max(0, scroll / range))
  return { length, offset, range, movable }
}

interface SideNavOverlayRailProps {
  viewportRef: React.RefObject<HTMLDivElement>
}

const SideNavOverlayRail: React.FC<SideNavOverlayRailProps> = ({ viewportRef }) => {
  const theme = useTheme()
  const railRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    const shell = viewport?.parentElement
    const rail = railRef.current
    const thumb = thumbRef.current
    if (!viewport || !shell || !rail || !thumb) return

    let currentMetrics: RailMetrics | null = null
    let frame = 0
    let hideTimer = 0
    let inside = shell.matches(':hover')
    let isDragging = false
    let scrollHold = false
    let drag: {
      pointerId: number
      startPointer: number
      startScroll: number
      range: number
      movable: number
    } | null = null

    const syncVisibility = () => {
      setVisible((isDragging || inside || scrollHold) && Boolean(currentMetrics))
    }

    const apply = () => {
      const overflow = viewport.scrollHeight - viewport.clientHeight > 1
      currentMetrics = overflow
        ? measureRail(viewport.scrollHeight, viewport.clientHeight, viewport.scrollTop, rail.clientHeight)
        : null
      if (currentMetrics) {
        thumb.style.height = `${currentMetrics.length}px`
        thumb.style.transform = `translate3d(0, ${currentMetrics.offset}px, 0)`
        thumb.style.opacity = '1'
      } else {
        thumb.style.opacity = '0'
      }
      syncVisibility()
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    }

    const revealFromScroll = () => {
      scrollHold = true
      window.clearTimeout(hideTimer)
      syncVisibility()
      hideTimer = window.setTimeout(() => {
        scrollHold = false
        syncVisibility()
      }, RAIL_HIDE_MS)
    }

    const onScroll = () => {
      revealFromScroll()
      schedule()
    }

    const endDrag = () => {
      drag = null
      isDragging = false
      setDragging(false)
      syncVisibility()
    }

    const onThumbDown = (event: PointerEvent) => {
      if (event.button !== 0 || !currentMetrics || currentMetrics.range <= 0 || currentMetrics.movable <= 0) return
      event.preventDefault()
      event.stopPropagation()
      drag = {
        pointerId: event.pointerId,
        startPointer: event.clientY,
        startScroll: viewport.scrollTop,
        range: currentMetrics.range,
        movable: currentMetrics.movable,
      }
      isDragging = true
      setDragging(true)
      thumb.setPointerCapture(event.pointerId)
      syncVisibility()
    }

    const onThumbMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      const delta = event.clientY - drag.startPointer
      viewport.scrollTop = Math.min(drag.range, Math.max(0, drag.startScroll + (delta * drag.range) / drag.movable))
    }

    const onThumbUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      endDrag()
    }

    const onRailDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== event.currentTarget || !currentMetrics) return
      event.preventDefault()
      const rect = rail.getBoundingClientRect()
      const local = event.clientY - rect.top
      const thumbStart = Math.min(currentMetrics.movable, Math.max(0, local - currentMetrics.length / 2))
      viewport.scrollTop =
        currentMetrics.movable === 0 ? 0 : (thumbStart / currentMetrics.movable) * currentMetrics.range
    }

    const onEnter = () => {
      inside = true
      syncVisibility()
    }

    const onLeave = () => {
      inside = false
      syncVisibility()
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    shell.addEventListener('pointerenter', onEnter)
    shell.addEventListener('pointerleave', onLeave)
    thumb.addEventListener('pointerdown', onThumbDown)
    thumb.addEventListener('pointermove', onThumbMove)
    thumb.addEventListener('pointerup', onThumbUp)
    thumb.addEventListener('pointercancel', onThumbUp)
    thumb.addEventListener('lostpointercapture', onThumbUp)
    rail.addEventListener('pointerdown', onRailDown)

    const observer = new ResizeObserver(() => schedule())
    observer.observe(viewport)
    for (const child of Array.from(viewport.children)) observer.observe(child)
    schedule()

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(hideTimer)
      observer.disconnect()
      endDrag()
      viewport.removeEventListener('scroll', onScroll)
      shell.removeEventListener('pointerenter', onEnter)
      shell.removeEventListener('pointerleave', onLeave)
      thumb.removeEventListener('pointerdown', onThumbDown)
      thumb.removeEventListener('pointermove', onThumbMove)
      thumb.removeEventListener('pointerup', onThumbUp)
      thumb.removeEventListener('pointercancel', onThumbUp)
      thumb.removeEventListener('lostpointercapture', onThumbUp)
      rail.removeEventListener('pointerdown', onRailDown)
    }
  }, [viewportRef])

  const thumbColor = dragging
    ? alpha(theme.palette.text.primary, 0.42)
    : alpha(theme.palette.text.primary, 0.26)

  return (
    <Box
      ref={railRef}
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: 6,
        right: 2,
        bottom: 6,
        width: 8,
        zIndex: 20,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        touchAction: 'none',
        transition: 'opacity 160ms ease',
      }}
    >
      <Box
        ref={thumbRef}
        sx={{
          position: 'absolute',
          left: '2px',
          width: '4px',
          borderRadius: 999,
          backgroundColor: thumbColor,
          touchAction: 'none',
          userSelect: 'none',
          transition: 'background-color 140ms ease',
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.42),
          },
        }}
      />
    </Box>
  )
}

export default SideNavOverlayRail
