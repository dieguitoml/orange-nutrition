import { Flashlight, FlashlightOff, Keyboard, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui/button'

type CamState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'error'

/**
 * Full-screen camera barcode scanner (EAN/UPC/Code128) using @zxing/browser,
 * since iOS Safari has no native BarcodeDetector. The torch toggle only renders
 * when the camera track reports torch support (iOS Safari currently does not).
 */
export function BarcodeScanner({
  onDetected,
  onClose,
  onManual,
}: {
  onDetected: (code: string) => void
  onClose: () => void
  onManual: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CamState>('starting')
  const [message, setMessage] = useState('')
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const detectedRef = useRef(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        setMessage(window.isSecureContext ? 'This browser does not support camera access.' : 'Camera access requires HTTPS.')
        return
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ])
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true
              controls.stop()
              navigator.vibrate?.(30)
              onDetected(result.getText())
            }
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        stop = () => controls.stop()
        setState('scanning')
        const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        setTorchSupported(!!caps?.torch)
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied')
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setState('unavailable')
          setMessage('No camera was found on this device.')
        } else {
          setState('error')
          setMessage(err instanceof Error ? err.message : 'The camera could not be started.')
        }
      }
    }
    start()
    return () => {
      cancelled = true
      stop?.()
    }
    // onDetected is intentionally captured once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleTorch() {
    const track = (videoRef.current?.srcObject as MediaStream | null)?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] })
      setTorchOn(!torchOn)
    } catch {
      setTorchSupported(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted autoPlay />
      {/* Dim everything except the scan window */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="relative h-40 w-[min(78vw,320px)] rounded-3xl shadow-[0_0_0_200vmax_rgba(0,0,0,0.55)]"
          style={{ ['--scan-h' as string]: '160px' }}
        >
          {(['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl'] as const).map((c) => (
            <span key={c} className={`absolute size-9 border-white ${c}`} />
          ))}
          {state === 'scanning' && <span className="absolute inset-x-4 top-0 h-0.5 animate-scan rounded-full bg-[#9fd3a8] shadow-[0_0_12px_#9fd3a8]" />}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+10px)]">
        <button type="button" onClick={onClose} aria-label="Cancel scanning" className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur">
          <X className="size-5" />
        </button>
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </button>
        )}
      </div>

      <div className="relative z-10 mt-auto px-6 pb-[calc(var(--safe-bottom)+24px)] text-center">
        {state === 'starting' && <p className="text-[15px] text-white/80">Starting camera…</p>}
        {state === 'scanning' && <p className="text-[15px] text-white/85">Align the barcode inside the frame</p>}
        {state === 'denied' && (
          <div className="mx-auto max-w-xs rounded-3xl bg-white/10 p-5 backdrop-blur">
            <p className="font-semibold">Camera access is off</p>
            <p className="mt-1 text-sm text-white/75">
              Allow camera access in Settings › Safari › Camera (or in this web app's settings), then try again. You can also type the barcode.
            </p>
          </div>
        )}
        {(state === 'unavailable' || state === 'error') && (
          <div className="mx-auto max-w-xs rounded-3xl bg-white/10 p-5 backdrop-blur">
            <p className="font-semibold">Camera unavailable</p>
            <p className="mt-1 text-sm text-white/75">{message}</p>
          </div>
        )}
        <Button variant="outline" className="mt-4 border-white/25 bg-white/15 text-white hover:bg-white/20" onClick={onManual}>
          <Keyboard className="size-4" /> Enter barcode manually
        </Button>
      </div>
    </div>,
    document.body,
  )
}
