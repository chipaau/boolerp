// Cell: a soft, glassy cell (the prototype's "Care Cell", light version). A crinkled bubble refracts
// its interior — a nucleus, beads and dust drifting in slow clusters — rendered to a texture first.
// The pointer dents it where it hovers; a tap squashes it and scatters the beads; a dashboard pulse
// is a two-beat heartbeat, tinted green for an opened slot and violet for the queue moving.
import * as THREE from 'three'
import type { ArtFactory, CareArt, PulseKind } from './types'

// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT), for the bubble's surface and the nucleus.
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`

const BEADS = 46
const DUST = 420
const NUC = new THREE.Vector3(0.12, 0.06, -0.08)
const NUC_R = 0.26
const INNER_R = 0.72
const SPIN_AXIS = new THREE.Vector3(0.2, 1, 0.1).normalize()
const GLOW: Record<PulseKind | 'tap', [number, number, number]> = { tap: [1, 0.72, 0.6], slot: [0.55, 1, 0.78], queue: [0.78, 0.7, 1] }

const ease = (k: number) => 1 - Math.pow(1 - k, 3)
const back = (k: number) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2)
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))

/** A soft radial glow as a texture: the shadow under the cell and the halo behind it. */
function radialTexture(rgb: string, alpha: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, `rgba(${rgb},${alpha})`)
  gr.addColorStop(0.55, `rgba(${rgb},${alpha * 0.35})`)
  gr.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/** The pale blue backdrop the bubble refracts. */
function backdropTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const blob = (x: number, y: number, r: number, col: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, col)
    gr.addColorStop(1, 'rgba(250,243,241,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 256, 256)
  }
  g.fillStyle = 'rgb(232,238,248)'
  g.fillRect(0, 0, 256, 256)
  blob(132, 142, 150, 'rgba(206,218,240,1)')
  blob(96, 88, 60, 'rgba(255,255,255,.9)')
  return new THREE.CanvasTexture(c)
}

export const createCell: ArtFactory = (container, { reducedMotion }): CareArt => {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  container.appendChild(canvas)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.setClearColor(0, 0)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0, 4.9)

  // ---------- the interior, rendered to a texture and seen only through the bubble
  const inner = new THREE.Scene()
  inner.background = new THREE.Color('#FAF3F1')
  const innerRig = new THREE.Group()
  inner.add(innerRig)
  const target = new THREE.WebGLRenderTarget(4, 4, { samples: 4 })

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: backdropTexture(), depthWrite: false }))
  backdrop.position.z = -1.4
  backdrop.renderOrder = -1
  inner.add(backdrop)

  // beads: small glossy pills; alpha carries how out of focus each is, for the bubble's blur
  const beads = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 3),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vN,vV; varying float vK,vZ; void main(){ vK=fract(float(gl_InstanceID)*.618); vN=normalize(normalMatrix*mat3(instanceMatrix)*normal); vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.); vV=-mv.xyz; vZ=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN,vV; varying float vK,vZ; void main(){ vec3 n=normalize(vN), v=normalize(vV);
        float l=clamp(dot(n,normalize(vec3(-.3,.7,.7))),0.,1.), fr=1.-max(dot(n,v),0.);
        vec3 base=mix(vec3(.52,.30,.52),vec3(.64,.42,.62),vK);
        vec3 c=base*(.8+.28*l)*(1.-.18*pow(fr,1.5))+vec3(.2,.1,.2)*pow(fr,3.)+vec3(.95,.88,.98)*pow(fr,2.)*.3;
        vec3 rv=reflect(-normalize(vec3(-.4,.7,.6)),n); c+=pow(max(dot(rv,v),0.),55.)*.8+pow(max(dot(rv,v),0.),8.)*.12;
        float defocus=clamp(abs(vZ-4.85)*1.2-.35,0.,.55);
        gl_FragColor=vec4(c,1.-defocus); }`,
    }),
    BEADS,
  )
  innerRig.add(beads)

  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(DUST * 3)
  const dustHome: { p: THREE.Vector3; ph: number }[] = []
  for (let i = 0; i < DUST; i++) {
    let p: THREE.Vector3
    do p = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(0.7)
    while (p.length() > 0.7 || p.distanceTo(NUC) < NUC_R * 1.1)
    dustHome.push({ p, ph: Math.random() * 6.28 })
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying float vZ; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vZ=-mv.z; gl_PointSize=(2.4+fract(sin(float(gl_VertexID)*12.9)*43758.5)*1.8)*(5./vZ)*${renderer.getPixelRatio().toFixed(1)}; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: 'void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vec3(.50,.36,.54),smoothstep(.5,.15,d)*.55); }',
    }),
  )
  dust.renderOrder = 1
  innerRig.add(dust)

  const nucMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader:
      NOISE +
      `uniform float uT; varying vec3 vN,vV; void main(){ vec3 p=normalize(position); float n=snoise(p*1.4+uT*.1)*.14+snoise(p*3.2-uT*.08)*.05; vec3 d=position*(1.+n); vec4 mv=modelViewMatrix*vec4(d,1.); vV=-mv.xyz; vN=normalMatrix*p; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN,vV; void main(){ vec3 n=normalize(vN), v=normalize(vV); float f=1.-max(dot(n,v),0.);
      float mot=fract(sin(dot(floor(n*9.),vec3(12.9,78.2,37.7)))*43758.5);
      vec3 c=mix(vec3(.60,.52,.76),vec3(.80,.74,.92),f)-mot*.06; c+=pow(max(dot(reflect(-normalize(vec3(-.4,.7,.6)),n),v),0.),16.)*.15;
      gl_FragColor=vec4(c,.42+.4*pow(f,1.8)); }`,
  })
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(NUC_R, 32), nucMat)
  nucleus.scale.set(1.18, 0.92, 1)
  nucleus.renderOrder = 2
  innerRig.add(nucleus)

  // bead homes spread through the volume, clear of the nucleus and of each other
  const homes: THREE.Vector3[] = []
  for (let tries = 0; homes.length < BEADS && tries < 4000; tries++) {
    const p = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(0.62)
    if (p.length() > 0.62 || p.distanceTo(NUC) < NUC_R + 0.08) continue
    if (homes.every((q) => q.distanceTo(p) > 0.14)) homes.push(p)
  }
  const beadState = Array.from({ length: BEADS }, (_, i) => {
    const r = Math.random
    return {
      kick: 0,
      v: new THREE.Vector3(),
      h: homes[i] ?? new THREE.Vector3(),
      p: new THREE.Vector3(),
      s: i % 5 === 0 ? 0.026 + r() * 0.01 : 0.03 + r() * 0.034,
      e: i % 5 === 0 ? 2.6 + r() * 0.8 : 1 + r() * 0.25,
      ph: r() * 6.28,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)),
      ax: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      w: (r() - 0.5) * 0.12,
    }
  })

  // ---------- the bubble
  const scene = new THREE.Scene()
  const rig = new THREE.Group()
  scene.add(rig)
  const U = {
    uT: { value: 0 },
    uAmp: { value: 0.1 },
    uScale: { value: 0 },
    uPoke: { value: 0 },
    uWob: { value: 0 },
    uHit: { value: new THREE.Vector3(0, 0, 1) },
    uTex: { value: target.texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uLight: { value: 1 },
    uGlow: { value: 0 },
    uGlowC: { value: new THREE.Vector3(1, 0.72, 0.6) },
  }
  const bubble = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 96),
    new THREE.ShaderMaterial({
      uniforms: U,
      transparent: true,
      vertexShader:
        NOISE +
        `
        uniform float uT,uAmp,uScale,uPoke,uWob; uniform vec3 uHit; varying vec3 vN,vV,vO;
        vec3 disp(vec3 p){
          float big=snoise(p*.8+vec3(0.,uT*.12,uT*.05));
          float mid=snoise(p*2.+vec3(uT*.1,-uT*.08,0.));
          float fold=snoise(p*2.6+vec3(0.,uT*.14,uT*.08));
          float crinkle=fold*fold*sign(fold)*.55;
          float d=distance(p,uHit), fall=exp(-d*d*3.4), ring=exp(-pow((d-.7)*3.,2.));
          float wob=uWob*.06*sin(d*9.-uT*8.)*exp(-d*1.);
          vec3 q=p*vec3(.88,1.08,.9); q.y+=.06*p.x*p.x;
          return q*(1.+uAmp*big*1.25+.025*mid+.022*crinkle-uPoke*.11*fall+uPoke*.035*ring+wob); }
        void main(){
          vec3 p=normalize(position); vec3 t=normalize(cross(p,abs(p.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.))); vec3 b=cross(p,t);
          vec3 d=disp(p), dt=disp(normalize(p+t*.006)), db=disp(normalize(p+b*.006)); vec3 n=normalize(cross(dt-d,db-d)); if(dot(n,d)<0.) n=-n;
          vO=d; vec4 mv=modelViewMatrix*vec4(d*uScale,1.); vV=-mv.xyz; vN=normalMatrix*n; gl_Position=projectionMatrix*mv; }`,
      fragmentShader:
        NOISE +
        `
        uniform float uT,uLight,uGlow; uniform vec3 uGlowC; uniform sampler2D uTex; uniform vec2 uRes; varying vec3 vN,vV,vO;
        vec3 env(vec3 r){
          float w=snoise(r*2.2+vec3(0.,uT*.04,0.))*.28;
          float box1=smoothstep(.62,.9,sin((r.y+w)*4.2+.6)*.5+.5);
          float box2=smoothstep(.75,.98,sin((r.x-w*.8)*3.3-r.y*1.2)*.5+.5);
          float box3=smoothstep(.8,1.,-r.y*.9+r.z*.2+w);
          vec3 c=mix(mix(vec3(.10,.08,.13),vec3(.55,.5,.62),smoothstep(-.4,1.,r.y)*.6),mix(vec3(.62,.70,.86),vec3(.93,.95,1.),smoothstep(-.6,.9,r.y)),uLight);
          c+=vec3(1.,.98,.97)*box1*1.6+vec3(.92,.9,1.)*box2*1.1+vec3(1.,.93,.88)*box3*1.2;
          c+=vec3(.48,.42,.92)*smoothstep(.1,1.,-r.x)*.5+vec3(.35,.55,1.)*smoothstep(.4,1.,r.x*.6-r.y*.5)*.45+vec3(1.,.55,.5)*smoothstep(.3,1.,r.x*.7+r.y*.2)*.35;
          float st=sin((r.x*2.+r.y*5.+w*3.)*3.)*.5+.5; c+=vec3(.9,.85,1.)*smoothstep(.85,1.,st)*.5;
          float sw=sin((r.x*3.-r.y*2.+snoise(r*2.5+uT*.03)*1.6)*4.)*.5+.5; c+=vec3(.95,.92,1.)*smoothstep(.9,1.,sw)*.6+vec3(.4,.5,1.)*smoothstep(.8,.9,sw)*smoothstep(1.,.92,sw)*.25;
          return c; }
        void main(){
          vec3 n=normalize(vN), v=normalize(vV); float ndv=max(dot(n,v),0.), edge=1.-ndv;
          float F=.03+.97*pow(edge,3.);
          vec2 uv=gl_FragCoord.xy/uRes;
          vec2 o=n.xy*(.015+.34*pow(edge,1.4));
          vec3 refr=vec3(0.);
          for(int i=0;i<6;i++){ float k=float(i)/5.; vec2 oo=o*(.75+k*.5);
            refr+=vec3(texture2D(uTex,uv-oo*1.07).r,texture2D(uTex,uv-oo).g,texture2D(uTex,uv-oo*.93).b); }
          refr/=6.;
          float df=1.-texture2D(uTex,uv-o).a;
          if(df>.02){ vec3 acc=vec3(0.); float rad=df*.016;
            for(int i=0;i<14;i++){ float a=float(i)*2.39996, rr=sqrt((float(i)+.5)/14.)*rad; acc+=texture2D(uTex,uv-o+vec2(cos(a),sin(a))*rr*vec2(uRes.y/uRes.x,1.)).rgb; }
            refr=mix(refr,acc/14.,df); }
          refr*=mix(1.,.72,pow(edge,2.)*(1.-uLight)); refr=mix(refr,vec3(.55,.64,.82),pow(edge,2.)*.5*uLight);
          vec3 r=reflect(-v,n), e=env(r);
          float spec=pow(max(dot(r,normalize(vec3(-.35,.75,.55))),0.),90.)*1.2;
          vec3 col=mix(refr,e,clamp(F*mix(1.25,.45,uLight),0.,1.))+spec;
          col+=(e*.12*pow(edge,1.2)+vec3(.95,.92,1.)*pow(edge,5.)*.5)*mix(1.,.3,uLight);
          col+=vec3(1.)*smoothstep(.94,.99,edge)*.25*uLight; col+=uGlowC*pow(edge,2.2)*uGlow*.6; gl_FragColor=vec4(col,1.); }`,
    }),
  )
  rig.add(bubble)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.36), new THREE.MeshBasicMaterial({ map: radialTexture('70,60,110', 0.38), transparent: true, depthWrite: false }))
  shadow.position.set(0, -1.02, -0.4)
  shadow.renderOrder = -2
  scene.add(shadow)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.9), new THREE.MeshBasicMaterial({ map: radialTexture('150,168,212', 0.38), transparent: true, depthWrite: false }))
  halo.position.set(0.1, -0.14, -0.9)
  halo.renderOrder = -3
  scene.add(halo)

  // ---------- interaction
  const ray = new THREE.Raycaster()
  const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ visible: false }))
  rig.add(hitSphere)
  const mouse = new THREE.Vector2(9, 9) // normalised device coordinates; 9 = off the canvas
  const ptr = { x: 0, y: 0 }
  const rot = { x: 0, y: 0 }
  const aim = new THREE.Vector3(0, 0, 1)
  let over = false
  let poke = 0
  let pokeV = 0
  let wob = 0
  let stir = 0
  let squash = 0
  let squashV = 0
  let glow = 0
  const timers: number[] = []

  const hover = () => {
    ray.setFromCamera(mouse, camera)
    const hits = ray.intersectObject(hitSphere)
    over = hits.length > 0
    if (over) aim.copy(rig.worldToLocal(hits[0].point.clone())).normalize()
  }
  const setGlow = (kind: PulseKind | 'tap') => {
    U.uGlowC.value.set(...GLOW[kind])
    glow = 1
  }
  const tap = (touch: boolean, force: boolean) => {
    if (!over && !force) return
    if (!over) aim.set(ptr.x, -ptr.y, 0.8).normalize()
    const m = touch ? 1.4 : 1
    pokeV += 3 * m
    wob = 1
    stir = 1
    squashV -= 4.2 * m
    const hp = aim.clone().multiplyScalar(0.6)
    for (const b of beadState) {
      const d = b.p.clone().sub(hp)
      const l = d.length()
      d.x += (Math.random() - 0.5) * 0.3
      d.y += (Math.random() - 0.5) * 0.3
      d.z += (Math.random() - 0.5) * 0.3
      b.v.addScaledVector(d.normalize(), m * (0.9 + 1.5 * Math.exp(-l * l * 1.8)))
      b.kick = 1
    }
    setGlow('tap')
    // a small haptic tap where the browser offers one (iOS Safari does not)
    if (touch && 'vibrate' in navigator) navigator.vibrate(12)
  }

  const resize = () => {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    const pr = renderer.getPixelRatio()
    renderer.setSize(w, h, false)
    target.setSize(Math.floor(w * pr), Math.floor(h * pr))
    U.uRes.value.set(w * pr, h * pr)
    camera.aspect = w / h
    camera.fov = camera.aspect < 1 ? 42 : 30
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  // ---------- animation
  const M4 = new THREE.Matrix4()
  const S = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const hitL = new THREE.Vector3()
  const dq = new THREE.Quaternion()
  let start = performance.now() - (reducedMotion ? 1e5 : 0)
  let last = performance.now()
  let spin = 0
  // reduced motion: the cell holds still; time stops, so taps and pulses leave it as it is
  const motion = reducedMotion ? 0 : 1

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000) * motion
    last = now
    const el = (now - start) / 1000
    const t = (now / 1000) * motion
    U.uT.value = t
    const k = clamp(el / 1.6)
    const scale = k < 1 ? back(k) : 1
    U.uScale.value = scale
    U.uAmp.value = 0.06 + 0.02 * Math.sin(t * 0.5) + 0.15 * (1 - ease(clamp(el / 2.2)))

    hover()
    canvas.style.cursor = over ? 'pointer' : 'default'
    U.uHit.value.lerp(aim, 0.06).normalize()
    squashV += (-squash * 60 - squashV * 7) * dt
    squash += squashV * dt
    glow = Math.max(0, glow - dt * 1.1)
    pokeV += ((Number(over) - poke) * 14 - pokeV * 6) * dt
    poke += pokeV * dt
    wob = Math.max(0, wob - dt * 0.7)
    stir = Math.max(0, stir - dt * 0.5)
    U.uPoke.value = poke
    U.uWob.value = wob
    U.uGlow.value = glow

    rot.x += (ptr.y * 0.08 - rot.x) * 0.03
    rot.y += (ptr.x * 0.14 - rot.y) * 0.03
    rig.rotation.set(rot.x + Math.sin(t * 0.19) * 0.07, rot.y + Math.sin(t * 0.11) * 0.35, Math.sin(t * 0.15) * 0.06)
    rig.position.y = Math.sin(t * 0.55) * 0.04
    rig.scale.set(1 - squash * 0.1, 1 + squash * 0.14, 1 - squash * 0.1)
    innerRig.rotation.copy(rig.rotation)
    innerRig.position.copy(rig.position)
    innerRig.scale.copy(rig.scale).multiplyScalar(scale)

    const flow = 1 + stir * 2.5
    hitL.copy(U.uHit.value).multiplyScalar(0.75)
    spin += dt * 0.12 * flow
    for (let i = 0; i < DUST; i++) {
      const d = dustHome[i]
      tmp.copy(d.p).applyAxisAngle(SPIN_AXIS, spin * 0.9)
      dustPos[i * 3] = tmp.x + Math.sin(t * 0.3 + d.ph) * 0.02
      dustPos[i * 3 + 1] = tmp.y + Math.cos(t * 0.26 + d.ph) * 0.02
      dustPos[i * 3 + 2] = tmp.z
    }
    dustGeo.attributes.position.needsUpdate = true
    nucleus.position.copy(NUC).applyAxisAngle(SPIN_AXIS, spin)
    nucleus.position.y += Math.sin(t * 0.3) * 0.02
    nucMat.uniforms.uT.value = t
    nucleus.rotation.set(0.3, t * 0.1, 0.4)
    beadState.forEach((b, i) => {
      tmp.copy(b.h).applyAxisAngle(SPIN_AXIS, spin)
      tmp.x += Math.sin(t * 0.28 + b.ph) * 0.09
      tmp.y += Math.cos(t * 0.23 + b.ph * 1.3) * 0.08
      tmp.z += Math.sin(t * 0.2 + b.ph * 0.7) * 0.07
      b.p.lerp(tmp, b.p.lengthSq() === 0 ? 1 : 1 - Math.exp(-dt * (1.2 - b.kick * 1.05)))
      b.kick *= Math.exp(-dt * 0.7)
      b.p.addScaledVector(b.v, dt)
      b.v.multiplyScalar(Math.exp(-dt * 2.1))
      tmp.copy(b.p).sub(hitL)
      const dh = tmp.length()
      b.p.addScaledVector(tmp.normalize(), poke * 0.12 * dt * Math.exp(-dh * dh * 4))
      if (b.p.length() > INNER_R) {
        const n = tmp.copy(b.p).normalize()
        const vn = b.v.dot(n)
        if (vn > 0) b.v.addScaledVector(n, -1.6 * vn)
        b.p.setLength(INNER_R)
      }
      b.q.multiply(dq.setFromAxisAngle(b.ax, b.w * dt * (1.5 * flow + b.v.length() * 8)))
      S.set(b.s, b.s * b.e, b.s)
      M4.compose(b.p, b.q, S)
      beads.setMatrixAt(i, M4)
    })
    beads.instanceMatrix.needsUpdate = true

    backdrop.position.x = -rig.rotation.y * 0.25
    backdrop.position.y = rig.position.y + rig.rotation.x * 0.25
    const lift = rig.position.y / 0.04
    shadow.scale.set(1 - lift * 0.05, 1 - lift * 0.05, 1)
    shadow.material.opacity = 1 - lift * 0.12
    halo.position.y = -0.14 + rig.position.y * 0.6

    renderer.setRenderTarget(target)
    renderer.render(inner, camera)
    renderer.setRenderTarget(null)
    renderer.setClearColor(0, 0)
    renderer.clear()
    renderer.render(scene, camera)
  })

  return {
    // a heartbeat: two soft beats, tinted by what happened
    pulse: (kind) => {
      setGlow(kind)
      stir = Math.max(stir, 0.7)
      wob = Math.max(wob, 0.7)
      squashV -= 1.6
      timers.push(
        window.setTimeout(() => {
          squashV -= 1.1
          glow = Math.max(glow, 0.7)
        }, 190),
      )
    },
    pointer: (x, y) => {
      ptr.x = x
      ptr.y = y
      mouse.set(x, -y)
    },
    tap: (x, y, touch) => {
      mouse.set(x, -y)
      hover()
      tap(touch, Math.abs(x) < 1.2 && Math.abs(y) < 1.2)
    },
    replay: () => {
      start = performance.now()
      wob = 1
      stir = 0.6
    },
    dispose: () => {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      timers.forEach((id) => window.clearTimeout(id))
      // free every GPU resource the scene holds, then the context itself
      for (const root of [scene, inner]) {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.InstancedMesh) {
            o.geometry.dispose()
            const mat = o.material as THREE.Material & { map?: THREE.Texture | null }
            mat.map?.dispose()
            mat.dispose()
          }
        })
      }
      target.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
