// Heart: a pencil drawing of a heart that beats (the prototype's "Care Heart Sketch"). A shader
// squeezes the ventricles then the atria in a steady rhythm, quickening a little while the pointer
// is over it; a tap, or a dashboard pulse, sends a rose signal out along the drawn vessels. A light
// overlay redraws the few live details: a breathing rose marker and a tick line.
import type { ArtFactory, CareArt } from './types'

const IMAGE = { w: 838, h: 1128 }
const DRAWING_SRC = '/care-art/heart-drawing.webp'
// the heart's cut-out, whose alpha masks the beat: in frame space 1024×1700, scaled .558, offset 133,119
const MASK_SRC = '/care-art/heart-mask.webp'
// spheres baked into the drawing (image px: x, y, erase radius), erased so they don't beat with it
const HOLES = [215, 80, 78, 65, 697, 54, 426, 239, 10, 335, 467, 9]

const VERTEX = `attribute vec2 p; varying vec2 vP; void main(){ vP=p*.5+.5; gl_Position=vec4(p,0.,1.); }`
const FRAGMENT = `precision highp float;
varying vec2 vP;
uniform sampler2D uImg, uMask; uniform vec2 uRes, uImgSize, uClk, uTilt; uniform vec3 uHole[4];
uniform float uAtr, uBeat, uClkT;
float hm(vec2 uv){ vec2 f = (uv*uImgSize - vec2(133.,119.))/.558/vec2(1024.,1700.); return (f.x>0.&&f.x<1.&&f.y>0.&&f.y<1.) ? texture2D(uMask,f).a : 0.; }
void main(){
  float ca=uRes.x/uRes.y, ia=uImgSize.x/uImgSize.y;
  vec2 sc = ca>ia ? vec2(ia/ca, 1.) : vec2(1., ca/ia);
  vec2 uv = (vP-.5)/sc + .5; uv.y = 1.-uv.y;
  uv += uTilt*.003;
  float m = smoothstep(.05,.6, hm(uv));
  // heartbeat: ventricles squeeze, atria follow — only inside the heart
  float wV = smoothstep(.5,.66,uv.y)*m, wA = smoothstep(.3,.42,uv.y)*(1.-smoothstep(.5,.66,uv.y))*m;
  vec2 CV = vec2(.48,.7), CA = vec2(.45,.42);
  uv = CV + (uv-CV)/(1.+uBeat*.024*wV);
  uv = CA + (uv-CA)/(1.+uAtr*.012*wA);
  if(!(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)){ gl_FragColor=vec4(0.); return; }
  vec4 tx = texture2D(uImg, uv); vec3 c = tx.rgb; float a = tx.a;
  // a pale paper fill so the heart reads as a solid form
  float fillA = smoothstep(.3,.8,m)*.55; vec3 paper = vec3(.992,.982,.986);
  vec2 ip = uv*uImgSize;
  float keep = exp(-pow((length(ip-vec2(407.8,474.1))-360.1)/2.2,2.));
  float hole = 1.;
  for(int i=0;i<4;i++) hole *= smoothstep(uHole[i].z*.8, uHole[i].z, length(ip-uHole[i].xy));
  a *= max(hole, keep);
  a *= smoothstep(0.,.015,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
  float inkA = a; vec3 pre = c*a + paper*fillA*(1.-a); a = a + fillA*(1.-a);
  // the rose signal travels out along the vessels from where it started
  float pink = smoothstep(.02,.1, c.r-c.g) * smoothstep(.08,.35,inkA) * smoothstep(.5,.9,m);
  float dc = length((uv-uClk)*vec2(ia,1.)), R = uClkT*.34;
  float front = exp(-pow((dc-R)*40.,2.));
  float tail = exp(-(R-dc)*22.)*step(dc,R)*.25;
  float fade = step(0.,uClkT)*(1.-smoothstep(.6,1.6,uClkT));
  float sig = pink*(front + tail)*fade*.55;
  pre = mix(pre, vec3(.93,.3,.6)*a, clamp(sig,0.,.6));
  gl_FragColor = vec4(min(pre, vec3(a)), a);
}`

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })

/** A beat's envelope: a quick rise and a slower fall. */
const envelope = (x: number) => (x < 0 ? 0 : Math.exp(-x * 5.5) * (1 - Math.exp(-x * 28)))

export const createHeart: ArtFactory = async (container, { reducedMotion }): Promise<CareArt> => {
  const layer = (z: number) => {
    const c = document.createElement('canvas')
    c.setAttribute('aria-hidden', 'true')
    c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:${z}`
    container.appendChild(c)
    return c
  }
  const canvas = layer(0)
  const overlay = layer(1)
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true })
  const g = overlay.getContext('2d')
  if (!gl || !g) throw new Error('WebGL is not available')

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, source)
    gl.compileShader(s)
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = (name: string) => gl.getUniformLocation(program, name)
  const texture = (unit: number, img: HTMLImageElement) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  let dpr = 1
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio)
    for (const c of [canvas, overlay]) {
      c.width = Math.max(1, container.clientWidth * dpr)
      c.height = Math.max(1, container.clientHeight * dpr)
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  // where the drawing sits in the canvas, and canvas ↔ image coordinates
  const fit = () => {
    const s = Math.min(canvas.width / IMAGE.w, canvas.height / IMAGE.h)
    return { s, ox: (canvas.width - IMAGE.w * s) / 2, oy: (canvas.height - IMAGE.h * s) / 2 }
  }
  const toImage = (nx: number, ny: number): [number, number] => {
    const f = fit()
    return [(((nx + 1) / 2) * canvas.width - f.ox) / f.s, (((ny + 1) / 2) * canvas.height - f.oy) / f.s]
  }
  const inHeart = (nx: number, ny: number) => {
    const [x, y] = toImage(nx, ny)
    return x > 170 && x < 690 && y > 160 && y < 960
  }

  const ptr = { x: 9, y: 9 } // 9 = off the art
  const tilt = { x: 0, y: 0 }
  let hover = 0
  let signal = { at: [-9, -9] as [number, number], t: -9 }
  let extraBeat = -9
  const kick = (nx: number, ny: number) => {
    const now = performance.now() / 1000
    if (now - signal.t < 0.9) return // one signal at a time
    const [x, y] = toImage(nx, ny)
    signal = { at: [x / IMAGE.w, y / IMAGE.h], t: now }
    extraBeat = now
  }

  const drawOverlay = (t: number) => {
    g.clearRect(0, 0, overlay.width, overlay.height)
    const { s, ox, oy } = fit()
    const at = (x: number, y: number, k: number): [number, number] => [ox + x * s + tilt.x * 6 * k * dpr, oy + y * s + tilt.y * 5 * k * dpr]
    const [ax, ay] = at(20, 724, 0)
    const [bx, by] = at(110, 670, 0)
    g.strokeStyle = 'rgba(70,62,80,.34)'
    g.lineWidth = Math.max(1, s * 1.1)
    g.beginPath()
    g.moveTo(ax, ay)
    g.lineTo(bx, by)
    g.stroke()
    // the rose marker breathes
    const breath = 0.5 + 0.5 * Math.sin(t * 1.6)
    const [mx, my] = at(826, 495, 0)
    g.strokeStyle = `rgba(214,92,143,${0.28 * (1 - breath)})`
    g.lineWidth = dpr
    g.beginPath()
    g.arc(mx, my, (5 + breath * 7) * s, 0, Math.PI * 2)
    g.stroke()
  }

  let raf = 0
  // an object, so the check after the await sees a dispose that happened during it
  const state = { disposed: false }
  const [drawing, mask] = await Promise.all([loadImage(DRAWING_SRC), loadImage(MASK_SRC)])
  if (!state.disposed) {
    texture(0, drawing)
    texture(1, mask)
    gl.uniform1i(u('uImg'), 0)
    gl.uniform1i(u('uMask'), 1)
    gl.uniform2f(u('uImgSize'), IMAGE.w, IMAGE.h)
    gl.uniform3fv(u('uHole'), HOLES)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const t0 = performance.now() / 1000
    const frame = () => {
      const t = performance.now() / 1000
      const el = t - t0
      const on = inHeart(ptr.x, ptr.y)
      hover += (Number(on) - hover) * 0.03
      // reduced motion: one still frame of the drawing; a tap or pulse still sends its signal
      const period = 0.92 * (1 - hover * 0.05)
      const phase = reducedMotion ? 9 : el % period
      const since = t - extraBeat
      const atria = envelope(phase) + 0.4 * envelope(since)
      const beat = Math.min(1.2, envelope(phase - 0.16) + 0.5 * envelope(since - 0.1))
      // reduced motion: no tilt toward the pointer either, so the drawing holds still
      const tx = reducedMotion || Math.abs(ptr.x) > 1.5 ? 0 : ptr.x
      const ty = reducedMotion || Math.abs(ptr.y) > 1.5 ? 0 : ptr.y
      tilt.x += (tx - tilt.x) * 0.04
      tilt.y += (ty - tilt.y) * 0.04
      gl.uniform2f(u('uRes'), canvas.width, canvas.height)
      gl.uniform2f(u('uTilt'), tilt.x, tilt.y)
      gl.uniform2f(u('uClk'), signal.at[0], signal.at[1])
      gl.uniform1f(u('uClkT'), t - signal.t)
      gl.uniform1f(u('uBeat'), beat)
      gl.uniform1f(u('uAtr'), atria)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      drawOverlay(reducedMotion ? 0 : el)
      overlay.style.cursor = on ? 'pointer' : 'default'
      raf = requestAnimationFrame(frame)
    }
    frame()
  }

  return {
    // a dashboard pulse starts the signal near the middle of the heart
    pulse: () => kick(-0.08, -0.05),
    pointer: (x, y) => {
      ptr.x = x
      ptr.y = y
    },
    tap: (x, y) => {
      if (Math.abs(x) < 1.2 && Math.abs(y) < 1.2 && inHeart(x, y)) kick(x, y)
    },
    replay: () => kick(-0.08, -0.05),
    dispose: () => {
      state.disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
      overlay.remove()
    },
  }
}
