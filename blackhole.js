import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const mount = document.getElementById("blackholeWrap");

if (!mount) {
  console.warn("[blackhole] #blackholeWrap not found");
} else {
  // --------- Device / motion flags ----------
  const isMobile = matchMedia("(max-width: 980px)").matches;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // FPS limiter (30 on mobile/reduced motion)
  const FPS = isMobile || reduceMotion ? 30 : 60;
  const frameInterval = 1000 / FPS;
  let lastFrameTime = 0;

  // Overscan + DPR caps
  const OVERSCAN = isMobile ? 1.0 : 1.2; // was 1.25
  const DPR_CAP = isMobile ? 1.0 : 1.5;

  // --------- Scene constants ----------
  const BLACK_HOLE_RADIUS = 1.3;
  const DISK_INNER_RADIUS = BLACK_HOLE_RADIUS + 0.2;
  const DISK_OUTER_RADIUS = 8.0;
  const DISK_TILT_ANGLE = Math.PI / 3.0;

  // --------- Core three setup ----------
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);
  camera.position.set(-3.5, 5.0, 4.5);
  camera.lookAt(0, 0, 0);
  camera.position.multiplyScalar(1.6);

  // Transparent renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: true,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  renderer.setClearColor(0x000000, 0); // transparent clear
  mount.appendChild(renderer.domElement);

  // Composer
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    0.65,
    0.75,
    0.85
  );
  composer.addPass(bloomPass);

  // Mobile: disable or reduce bloom (pick one)
  if (isMobile || reduceMotion) {
    bloomPass.enabled = true; // strongest perf win
    // Or instead of disabling:
    // bloomPass.strength = 0.25;
    // bloomPass.radius = 0.35;
    // bloomPass.threshold = 0.90;
  }

  // --------- Lensing shader ----------
  const lensingShader = {
    uniforms: {
      tDiffuse: { value: null },
      blackHoleScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
      lensingStrength: { value: 0.12 },
      lensingRadius: { value: 0.3 },
      aspectRatio: { value: 1 },
      chromaticAberration: { value: 0.005 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 blackHoleScreenPos;
      uniform float lensingStrength;
      uniform float lensingRadius;
      uniform float aspectRatio;
      uniform float chromaticAberration;
      varying vec2 vUv;

      void main() {
        vec2 screenPos = vUv;
        vec2 toCenter = screenPos - blackHoleScreenPos;
        toCenter.x *= aspectRatio;
        float dist = length(toCenter);

        float distortionAmount = lensingStrength / (dist * dist + 0.003);
        distortionAmount = clamp(distortionAmount, 0.0, 0.7);
        float falloff = smoothstep(lensingRadius, lensingRadius * 0.3, dist);
        distortionAmount *= falloff;

        vec2 offset = normalize(toCenter) * distortionAmount;
        offset.x /= aspectRatio;

        vec2 distortedUvR = screenPos - offset * (1.0 + chromaticAberration);
        vec2 distortedUvG = screenPos - offset;
        vec2 distortedUvB = screenPos - offset * (1.0 - chromaticAberration);

        vec4 cR = texture2D(tDiffuse, distortedUvR);
        vec4 cG = texture2D(tDiffuse, distortedUvG);
        vec4 cB = texture2D(tDiffuse, distortedUvB);

        vec3 rgb = vec3(cR.r, cG.g, cB.b);

        // alpha from brightness => dark areas become transparent
        float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
        float a = smoothstep(0.04, 0.14, lum);

        gl_FragColor = vec4(rgb, a);
      }
    `,
  };

  const lensingPass = new ShaderPass(lensingShader);
  composer.addPass(lensingPass);

  // --------- Event horizon glow ----------
  // Reduced geometry a bit for performance (was 128,64)
  const eventHorizonGeom = new THREE.SphereGeometry(
    BLACK_HOLE_RADIUS * 1.05,
    isMobile ? 64 : 96,
    isMobile ? 32 : 48
  );

  const eventHorizonMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCameraPosition: { value: camera.position.clone() },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCameraPosition;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 viewDirection = normalize(uCameraPosition - vPosition);
        float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
        fresnel = pow(fresnel, 2.5);

        vec3 glowColor = vec3(0.85, 0.45, 1.0);
        float pulse = sin(uTime * 2.5) * 0.15 + 0.85;

        gl_FragColor = vec4(glowColor * fresnel * pulse, fresnel * 0.4);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const eventHorizon = new THREE.Mesh(eventHorizonGeom, eventHorizonMat);
  scene.add(eventHorizon);

  // --------- Black hole core ----------
  const blackHoleGeom = new THREE.SphereGeometry(
    BLACK_HOLE_RADIUS,
    isMobile ? 64 : 96,
    isMobile ? 32 : 48
  );

  const blackHoleMat = new THREE.ShaderMaterial({
    uniforms: {
      uCameraPosition: { value: camera.position.clone() },
      uInnerColor: { value: new THREE.Color(0x050308) },
      uEdgeColor: { value: new THREE.Color(0x4b1d7a) },
      uRimColor: { value: new THREE.Color(0xff4fd8) },
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosW = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uCameraPosition;
      uniform vec3 uInnerColor;
      uniform vec3 uEdgeColor;
      uniform vec3 uRimColor;
      uniform float uOpacity;

      varying vec3 vNormalW;
      varying vec3 vPosW;

      void main() {
        vec3 V = normalize(uCameraPosition - vPosW);

        float fres = 1.0 - max(dot(normalize(vNormalW), V), 0.0);
        float rim = pow(fres, 3.0);

        vec3 base = mix(uInnerColor, uEdgeColor, smoothstep(0.15, 0.9, rim));
        vec3 color = base + uRimColor * rim * 0.35;

        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const blackHoleMesh = new THREE.Mesh(blackHoleGeom, blackHoleMat);
  blackHoleMesh.renderOrder = 0;
  scene.add(blackHoleMesh);

  // --------- Accretion disk ----------
  // Reduced segments for perf (was 256,128)
  const diskGeometry = new THREE.RingGeometry(
    DISK_INNER_RADIUS,
    DISK_OUTER_RADIUS,
    isMobile ? 128 : 192,
    isMobile ? 64 : 96
  );

  const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uColorHot: { value: new THREE.Color("#E9B6FF") },
      uColorMid1: { value: new THREE.Color("#FF4FD8") },
      uColorMid2: { value: new THREE.Color("#B35CFF") },
      uColorMid3: { value: new THREE.Color("#6A4CFF") },
      uColorOuter: { value: new THREE.Color("#2D2A5A") },
      uNoiseScale: { value: 2.5 },
      uFlowSpeed: { value: 0.22 },
      uDensity: { value: 1.3 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vRadius;
      varying float vAngle;
      void main() {
        vUv = uv;
        vRadius = length(position.xy);
        vAngle = atan(position.y, position.x);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorHot;
      uniform vec3 uColorMid1;
      uniform vec3 uColorMid2;
      uniform vec3 uColorMid3;
      uniform vec3 uColorOuter;
      uniform float uNoiseScale;
      uniform float uFlowSpeed;
      uniform float uDensity;

      varying vec2 vUv;
      varying float vRadius;
      varying float vAngle;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        float normalizedRadius = smoothstep(${DISK_INNER_RADIUS.toFixed(
          2
        )}, ${DISK_OUTER_RADIUS.toFixed(2)}, vRadius);

        float spiral = vAngle * 3.0 - (1.0 / (normalizedRadius + 0.1)) * 2.0;
        vec2 noiseUv = vec2(
          vUv.x + uTime * uFlowSpeed * (2.0 / (vRadius * 0.3 + 1.0)) + sin(spiral) * 0.1,
          vUv.y * 0.8 + cos(spiral) * 0.1
        );

        float noiseVal1 = snoise(vec3(noiseUv * uNoiseScale, uTime * 0.15));
        float noiseVal2 = snoise(vec3(noiseUv * uNoiseScale * 3.0 + 0.8, uTime * 0.22));
        float noiseVal3 = snoise(vec3(noiseUv * uNoiseScale * 6.0 + 1.5, uTime * 0.3));

        float noiseVal = (noiseVal1 * 0.45 + noiseVal2 * 0.35 + noiseVal3 * 0.2);
        noiseVal = (noiseVal + 1.0) * 0.5;

        vec3 color = uColorOuter;
        color = mix(color, uColorMid3, smoothstep(0.0, 0.25, normalizedRadius));
        color = mix(color, uColorMid2, smoothstep(0.2, 0.55, normalizedRadius));
        color = mix(color, uColorMid1, smoothstep(0.5, 0.75, normalizedRadius));
        color = mix(color, uColorHot, smoothstep(0.7, 0.95, normalizedRadius));

        color *= (0.5 + noiseVal * 1.0);
        float brightness = pow(1.0 - normalizedRadius, 1.0) * 3.5 + 0.5;
        brightness *= (0.3 + noiseVal * 2.2);

        float pulse = sin(uTime * 1.8 + normalizedRadius * 12.0 + vAngle * 2.0) * 0.15 + 0.85;
        brightness *= pulse;

        float alpha = uDensity * (0.2 + noiseVal * 0.9);
        alpha *= smoothstep(0.0, 0.15, normalizedRadius);
        alpha *= (1.0 - smoothstep(0.85, 1.0, normalizedRadius));
        alpha = clamp(alpha, 0.0, 1.0);

        gl_FragColor = vec4(color * brightness, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
  accretionDisk.rotation.x = DISK_TILT_ANGLE;
  accretionDisk.renderOrder = 1;
  scene.add(accretionDisk);

  // --------- Resize handling (container-based) ----------
  function resizeToMount() {
    const w = Math.max(1, mount.clientWidth);
    const h = Math.max(1, mount.clientHeight);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const rw = Math.floor(w * OVERSCAN);
    const rh = Math.floor(h * OVERSCAN);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    renderer.setSize(rw, rh, false);

    composer.setSize(rw, rh);
    bloomPass.setSize(rw, rh);

    lensingPass.uniforms.aspectRatio.value = rw / rh;

    const canvas = renderer.domElement;
    canvas.style.width = `${rw}px`;
    canvas.style.height = `${rh}px`;
  }

  const ro = new ResizeObserver(resizeToMount);
  ro.observe(mount);
  resizeToMount();

  // --------- Pause rendering when not needed ----------
  let running = true; // tab visibility
  let visible = true; // in viewport

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0.05 }
  );
  io.observe(mount);

  // --------- Animation ----------
  const clock = new THREE.Clock();
  const blackHoleScreenPosVec3 = new THREE.Vector3();

  function animate(now) {
    requestAnimationFrame(animate);

    if (!running || !visible) return;

    // FPS limiter
    if (now - lastFrameTime < frameInterval) return;
    lastFrameTime = now;

    const elapsedTime = clock.getElapsedTime();

    diskMaterial.uniforms.uTime.value = elapsedTime;
    eventHorizonMat.uniforms.uTime.value = elapsedTime;

    // Keep camera uniforms updated
    eventHorizonMat.uniforms.uCameraPosition.value.copy(camera.position);
    blackHoleMat.uniforms.uCameraPosition.value.copy(camera.position);

    // lensing centered on black hole
    blackHoleScreenPosVec3.copy(blackHoleMesh.position).project(camera);
    lensingPass.uniforms.blackHoleScreenPos.value.set(
      (blackHoleScreenPosVec3.x + 1) / 2,
      (blackHoleScreenPosVec3.y + 1) / 2
    );

    composer.render();
  }

  requestAnimationFrame(animate);

  // --------- Optional cleanup if you ever remove the section ----------
  // export function destroyBlackhole() {
  //   io.disconnect();
  //   ro.disconnect();
  //   renderer.dispose();
  //   diskGeometry.dispose();
  //   diskMaterial.dispose();
  //   blackHoleGeom.dispose();
  //   blackHoleMat.dispose();
  //   eventHorizonGeom.dispose();
  //   eventHorizonMat.dispose();
  //   mount.removeChild(renderer.domElement);
  // }
}
