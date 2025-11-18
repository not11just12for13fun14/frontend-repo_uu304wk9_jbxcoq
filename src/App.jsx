import { useEffect, useMemo, useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

function useFFmpeg() {
  const ffmpegRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingMsg('Fetching FFmpeg core…')
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
        const ffmpeg = new FFmpeg()
        ffmpeg.on('log', ({ message }) => {
          // optionally handle logs
          // console.debug('[ffmpeg]', message)
        })
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-worker.js`, 'text/javascript'),
        })
        ffmpegRef.current = ffmpeg
        setReady(true)
        setLoadingMsg('')
      } catch (e) {
        setLoadingMsg(`Failed to load FFmpeg: ${e.message}`)
      }
    }
    load()
  }, [])

  return { ffmpeg: ffmpegRef.current, ready, loadingMsg }
}

const presets = [
  { id: '1080p', label: '1080p (max width 1920)', scale: 1920 },
  { id: '720p', label: '720p (max width 1280)', scale: 1280 },
  { id: '480p', label: '480p (max width 854)', scale: 854 },
  { id: 'original', label: 'Original size', scale: null },
]

function App() {
  const { ffmpeg, ready, loadingMsg } = useFFmpeg()
  const [queue, setQueue] = useState([]) // {id, file, name, status, progress, outputUrl, error}
  const [running, setRunning] = useState(false)
  const [crf, setCrf] = useState(24) // lower = better quality
  const [preset, setPreset] = useState('medium') // ultrafast .. placebo
  const [sizePreset, setSizePreset] = useState('720p')
  const idCounter = useRef(0)

  const selectedScale = useMemo(() => presets.find(p => p.id === sizePreset)?.scale ?? null, [sizePreset])

  const addFiles = (files) => {
    const items = Array.from(files).map(f => ({
      id: `${Date.now()}-${idCounter.current++}`,
      file: f,
      name: f.name,
      status: 'queued',
      progress: 0,
      outputUrl: null,
      error: null,
    }))
    setQueue(prev => [...prev, ...items])
  }

  const onDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }
  const onBrowse = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
  }

  useEffect(() => {
    const processNext = async () => {
      if (!ready || !ffmpeg) return
      if (!running) return
      const nextIndex = queue.findIndex(item => item.status === 'queued')
      if (nextIndex === -1) {
        // nothing queued, keep running in case new files arrive
        return
      }
      const item = queue[nextIndex]
      try {
        updateItem(item.id, { status: 'processing', progress: 0, error: null })
        const inputName = `in_${item.id}`
        const outputName = `out_${item.id}.mp4`
        await ffmpeg.writeFile(inputName, await item.file.arrayBuffer())

        ffmpeg.on('progress', ({ progress }) => {
          updateItem(item.id, { progress: Math.round((progress || 0) * 100) })
        })

        const vfArgs = selectedScale ? ['-vf', `scale='min(${selectedScale},iw)':-2`] : []
        const args = [
          '-i', inputName,
          ...vfArgs,
          '-c:v', 'libx264',
          '-crf', String(crf),
          '-preset', preset,
          '-c:a', 'aac', '-b:a', '128k',
          '-movflags', '+faststart',
          outputName,
        ]
        await ffmpeg.exec(args)
        const data = await ffmpeg.readFile(outputName)
        const blob = new Blob([data.buffer], { type: 'video/mp4' })
        const url = URL.createObjectURL(blob)
        updateItem(item.id, { status: 'done', progress: 100, outputUrl: url })

        // cleanup
        try { await ffmpeg.deleteFile(inputName) } catch {}
        try { await ffmpeg.deleteFile(outputName) } catch {}
      } catch (err) {
        updateItem(item.id, { status: 'error', error: err?.message || String(err) })
      }
    }

    processNext()
  }, [queue, running, ready, ffmpeg, selectedScale, crf, preset])

  const updateItem = (id, patch) => {
    setQueue(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  const clearFinished = () => {
    setQueue(prev => prev.filter(it => it.status !== 'done' && it.status !== 'error'))
  }

  const cancelItem = (id) => {
    // ffmpeg.wasm does not support mid-job cancel cleanly; mark as skipped
    updateItem(id, { status: 'skipped' })
  }

  const totalQueued = queue.filter(q => q.status === 'queued').length
  const totalProcessing = queue.filter(q => q.status === 'processing').length
  const totalDone = queue.filter(q => q.status === 'done').length

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="px-6 py-8 text-center">
        <h1 className="text-3xl font-bold">Infinite Video Compressor</h1>
        <p className="text-slate-300 mt-2">Drop videos and they will compress continuously in your browser. Add more at any time.</p>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        {!ready ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-lg">{loadingMsg || 'Initializing…'}</p>
            <p className="text-slate-400 mt-2">This loads a WebAssembly build of FFmpeg (~3–4 MB). It runs fully locally.</p>
          </div>
        ) : (
          <>
            <section className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={onDrop}
                  className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-8 text-center bg-slate-900/40">
                  <p className="text-slate-200 font-medium">Drag & drop videos here</p>
                  <p className="text-slate-400 text-sm mt-1">MP4/MOV/WEBM, multiple files supported</p>
                  <div className="mt-4">
                    <label className="inline-block">
                      <input type="file" accept="video/*" multiple className="hidden" onChange={onBrowse} />
                      <span className="cursor-pointer bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">Browse Files</span>
                    </label>
                  </div>
                </div>

                <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="font-semibold">Queue</h2>
                    <div className="text-sm text-slate-400">Queued: {totalQueued} • Processing: {totalProcessing} • Done: {totalDone}</div>
                  </div>
                  <ul className="divide-y divide-slate-800">
                    {queue.length === 0 && (
                      <li className="p-4 text-slate-400">No videos yet. Add some to get started.</li>
                    )}
                    {queue.map(item => (
                      <li key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="truncate font-medium">{item.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{item.status}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded mt-2 overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${item.progress || 0}%` }} />
                          </div>
                          {item.error && <p className="text-red-400 text-sm mt-1">{item.error}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.outputUrl && (
                            <a href={item.outputUrl} download={item.name.replace(/\.[^.]+$/, '') + '-compressed.mp4'} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-sm">Download</a>
                          )}
                          {!['done','error','skipped'].includes(item.status) && (
                            <button onClick={() => cancelItem(item.id)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-sm">Skip</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {queue.length > 0 && (
                    <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                      <button onClick={clearFinished} className="text-sm text-slate-300 hover:text-white">Clear finished</button>
                      <div className="flex items-center gap-3">
                        {!running ? (
                          <button onClick={() => setRunning(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-semibold">Start</button>
                        ) : (
                          <button onClick={() => setRunning(false)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-semibold">Pause</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <h2 className="font-semibold mb-3">Compression Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Max Size</label>
                    <select value={sizePreset} onChange={e => setSizePreset(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2">
                      {presets.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Quality (CRF {crf})</label>
                    <input type="range" min={18} max={32} value={crf} onChange={e => setCrf(Number(e.target.value))} className="w-full" />
                    <p className="text-xs text-slate-400 mt-1">Lower = better quality/larger file. 23–25 is a good balance.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Speed Preset</label>
                    <select value={preset} onChange={e => setPreset(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2">
                      {['ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Faster = bigger file. Slower = smaller file, more CPU.</p>
                  </div>
                  <div className="text-xs text-slate-400">
                    Tip: Keep this tab open. The queue will keep processing infinitely—add files anytime.
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>

      <footer className="text-center text-slate-500 text-sm py-8">
        Powered by FFmpeg.wasm. Your videos never leave your device.
      </footer>
    </div>
  )
}

export default App
