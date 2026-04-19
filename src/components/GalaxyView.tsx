import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

export default function GalaxyView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const frameRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const sphericalRef = useRef({ theta: 0, phi: Math.PI / 3, radius: 120 })
  const nodeMapRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const raycasterRef = useRef(new THREE.Raycaster())
  const tooltipRef = useRef<HTMLDivElement>(null)

  const { notes, links, setActiveNote } = useStore()

  const buildScene = useCallback(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current

    // Clear previous objects
    const toRemove: THREE.Object3D[] = []
    scene.traverse((o) => { if (o.userData.galaxy) toRemove.push(o) })
    toRemove.forEach((o) => scene.remove(o))
    nodeMapRef.current.clear()

    if (notes.length === 0) return

    // Build adjacency for sizing
    const linkCount = new Map<string, number>()
    for (const l of links) {
      linkCount.set(l.source, (linkCount.get(l.source) ?? 0) + 1)
      linkCount.set(l.target, (linkCount.get(l.target) ?? 0) + 1)
    }

    // Spread notes in 3D space using golden angle
    const positions = new Map<string, THREE.Vector3>()
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    notes.forEach((note, i) => {
      const r = 20 + Math.sqrt(i + 1) * 8
      const theta = i * goldenAngle
      const phi = Math.acos(1 - (2 * (i + 0.5)) / notes.length)
      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.6,
        r * Math.sin(phi) * Math.sin(theta)
      )
      positions.set(note.id, pos)
    })

    // Draw links as glowing beams
    for (const link of links) {
      const from = positions.get(link.source)
      const to = positions.get(link.target)
      if (!from || !to) continue

      const points = [from, to]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color: 0x7c6af7,
        transparent: true,
        opacity: 0.25,
      })
      const line = new THREE.Line(geo, mat)
      line.userData.galaxy = true
      scene.add(line)
    }

    // Draw star nodes
    for (const note of notes) {
      const pos = positions.get(note.id)
      if (!pos) continue

      const connections = linkCount.get(note.id) ?? 0
      const radius = 0.6 + Math.sqrt(connections) * 0.4

      const geo = new THREE.SphereGeometry(radius, 16, 16)
      const hue = (notes.indexOf(note) * 137.5) % 360
      const color = new THREE.Color(`hsl(${hue}, 80%, 75%)`)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8,
        metalness: 0.2,
        roughness: 0.3,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.userData.galaxy = true
      mesh.userData.noteId = note.id
      mesh.userData.title = note.title
      scene.add(mesh)
      nodeMapRef.current.set(note.id, mesh)

      // Glow sprite
      const spriteMat = new THREE.SpriteMaterial({
        map: createGlowTexture(color),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(radius * 8, radius * 8, 1)
      sprite.position.copy(pos)
      sprite.userData.galaxy = true
      scene.add(sprite)
    }

    // Ambient star field
    const starGeo = new THREE.BufferGeometry()
    const starCount = 2000
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 600
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.5,
    })
    const stars = new THREE.Points(starGeo, starMat)
    stars.userData.galaxy = true
    scene.add(stars)
  }, [notes, links])

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x0d0d0f, 1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0d0d0f, 0.004)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
    camera.position.set(0, 40, 120)
    cameraRef.current = camera

    // Lighting
    scene.add(new THREE.AmbientLight(0x6060cc, 0.6))
    const pointLight = new THREE.PointLight(0x7c6af7, 2, 200)
    pointLight.position.set(0, 50, 0)
    scene.add(pointLight)

    // Animate
    let t = 0
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      t += 0.003

      // Orbit camera
      if (!isDragging.current) {
        sphericalRef.current.theta += 0.001
      }
      const { theta, phi, radius } = sphericalRef.current
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      )
      camera.lookAt(0, 0, 0)

      // Pulse nodes
      nodeMapRef.current.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = 0.6 + Math.sin(t * 2 + mesh.position.x) * 0.25
      })

      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => { buildScene() }, [buildScene])

  // Mouse interaction
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    }

    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      sphericalRef.current.theta -= dx * 0.005
      sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI - 0.2, sphericalRef.current.phi - dy * 0.005))
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    // Hover tooltip
    if (cameraRef.current && sceneRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
      const meshes = [...nodeMapRef.current.values()]
      const hits = raycasterRef.current.intersectObjects(meshes)
      if (hits.length > 0 && tooltipRef.current) {
        tooltipRef.current.style.display = 'block'
        tooltipRef.current.style.left = e.clientX + 12 + 'px'
        tooltipRef.current.style.top = e.clientY - 8 + 'px'
        tooltipRef.current.textContent = hits[0].object.userData.title as string
      } else if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none'
      }
    }
  }

  const onMouseUp = () => { isDragging.current = false }

  const onWheel = (e: React.WheelEvent) => {
    sphericalRef.current.radius = Math.max(30, Math.min(300, sphericalRef.current.radius + e.deltaY * 0.1))
  }

  const onClick = (e: React.MouseEvent) => {
    if (!cameraRef.current) return
    const container = containerRef.current!
    const rect = container.getBoundingClientRect()
    const mouse = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycasterRef.current.setFromCamera(mouse, cameraRef.current)
    const meshes = [...nodeMapRef.current.values()]
    const hits = raycasterRef.current.intersectObjects(meshes)
    if (hits.length > 0) {
      const noteId = hits[0].object.userData.noteId as string
      setActiveNote(noteId)
    }
  }

  // Touch events for mobile
  const lastPinchDistance = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      isDragging.current = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchDistance.current = Math.hypot(dx, dy)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastMouse.current.x
      const dy = e.touches[0].clientY - lastMouse.current.y
      sphericalRef.current.theta -= dx * 0.005
      sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI - 0.2, sphericalRef.current.phi - dy * 0.005))
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.hypot(dx, dy)
      const delta = lastPinchDistance.current - distance
      sphericalRef.current.radius = Math.max(30, Math.min(300, sphericalRef.current.radius + delta * 0.3))
      lastPinchDistance.current = distance
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isDragging.current = false
      lastPinchDistance.current = null
    }
    // Tap to open note
    if (e.changedTouches.length === 1 && e.touches.length === 0 && cameraRef.current) {
      const container = containerRef.current!
      const rect = container.getBoundingClientRect()
      const touch = e.changedTouches[0]
      const mouse = {
        x: ((touch.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((touch.clientY - rect.top) / rect.height) * 2 + 1,
      }
      raycasterRef.current.setFromCamera(mouse, cameraRef.current)
      const hits = raycasterRef.current.intersectObjects([...nodeMapRef.current.values()])
      if (hits.length > 0) setActiveNote(hits[0].object.userData.noteId as string)
    }
  }

  return (
    <div className="relative w-full h-full select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 hidden pointer-events-none px-2 py-1 rounded text-sm font-medium"
        style={{
          background: 'rgba(20,20,30,0.9)',
          border: '1px solid rgba(124,106,247,0.4)',
          color: '#e8e8f0',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 text-xs text-text-muted space-y-1 pointer-events-none">
        <div>Drag to orbit • Scroll to zoom • Click to open</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-accent-purple opacity-80" />
          <span>Note</span>
          <span className="inline-block w-6 h-px bg-accent-purple opacity-40 ml-2" />
          <span>Link</span>
        </div>
      </div>

      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-30">✦</div>
            <div>Create notes to see the galaxy form</div>
          </div>
        </div>
      )}
    </div>
  )
}

function createGlowTexture(color: THREE.Color): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.3)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}
