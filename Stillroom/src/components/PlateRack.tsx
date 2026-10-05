// The plate rack: every sampled frame as a glass plate standing in a rack, flipped through like
// prints in a box. Plates you've passed lean forward, the current one stands upright and lifts,
// the rest wait behind. One InstancedMesh per contact sheet; each plate cuts its own tile out of
// the sheet texture in the shader. The rack position is one damped number, so every plate moves
// as a single gesture. The contact sheet shows the same frames without 3D.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'motion/react';
import { sampleOf } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';

const GAP = 0.09; // space between plates, in plate heights
const LEAN = 1.22; // how far a passed plate leans forward (radians)
const LIFT = 0.16; // how far the current plate rises
const DAMPING = 10; // larger settles faster
const SHOWN_PASSED = 6; // passed plates fade out after this many, so they don't pile up in front
const FILL = 0.58; // share of the canvas width the current plate fills
const VIEW = new THREE.Vector3(0.42, 0.3, 1).normalize(); // the camera's three-quarter angle

const vertexShader = /* glsl */ `
  attribute vec2 aCell;
  attribute vec3 aState;
  uniform vec2 uGrid;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vState;
  void main() {
    vLocal = uv;
    vUv = vec2((aCell.x + uv.x) / uGrid.x, 1.0 - (aCell.y + 1.0 - uv.y) / uGrid.y);
    vState = aState;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uChalk;
  uniform vec3 uMount;
  uniform float uAspect;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vState; // x: kept, y: brightness, z: emphasis
  void main() {
    vec3 color = texture2D(map, vUv).rgb * vState.y;
    vec2 edge = min(vLocal, 1.0 - vLocal);
    edge.x *= uAspect;
    float rim = mix(0.012, 0.03, vState.z);
    float onRim = 1.0 - step(rim, min(edge.x, edge.y));
    color = mix(color, uChalk, onRim * mix(0.28, 1.0, vState.z));
    // a faint diagonal sheen, as light catches a glass negative
    color += vec3(0.07) * smoothstep(0.3, 0.0, abs(vLocal.x * 0.8 - vLocal.y + 0.25)) * vState.y;
    if (vState.x > 0.5 && vLocal.x > 0.04 && vLocal.x < 0.2 && vLocal.y > 0.88 && vLocal.y < 0.97) color = uMount;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

interface RackProps {
  video: VideoRow;
  sheets: readonly string[];
  frame: number;
  kept: ReadonlySet<number>;
  onSelect: (frame: number) => void;
}

interface Rack {
  setTarget: (sample: number) => void;
  setKept: (samples: ReadonlySet<number>) => void;
}

export default function PlateRack({ video, sheets, frame, kept, onSelect }: RackProps) {
  const host = useRef<HTMLDivElement>(null);
  const rack = useRef<Rack | null>(null);
  const select = useRef(onSelect);
  const reduced = useReducedMotion();
  const [unsupported, setUnsupported] = useState(false);
  const current = sampleOf(frame, video.sample_step);
  const currentRef = useRef(current);
  currentRef.current = current;
  select.current = onSelect;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch {
      setUnsupported(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor('#121211');
    renderer.domElement.className = 'rack-canvas';
    element.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    const aspect = video.tile_width / video.tile_height;
    const plateW = aspect >= 1 ? 1.4 : 1.4 * aspect;
    const plateH = plateW / aspect;
    const geometry = new THREE.PlaneGeometry(plateW, plateH);
    geometry.translate(0, plateH / 2, 0); // pivot on the bottom edge, like a plate standing in a rack

    const perSheet = video.sheet_cols * video.sheet_rows;
    const total = video.sample_count;
    const loader = new THREE.TextureLoader();
    const meshes: THREE.InstancedMesh[] = [];
    const states: THREE.InstancedBufferAttribute[] = [];
    const textures: THREE.Texture[] = [];
    const materials: THREE.ShaderMaterial[] = [];
    let keptSamples: ReadonlySet<number> = new Set();

    for (let s = 0; s * perSheet < total; s++) {
      const count = Math.min(perSheet, total - s * perSheet);
      const texture = loader.load(sheets[s] ?? '', () => wake());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          map: { value: texture },
          uGrid: { value: new THREE.Vector2(video.sheet_cols, video.sheet_rows) },
          uChalk: { value: new THREE.Color('#ece7da') },
          uMount: { value: new THREE.Color('#d3c9b0') },
          uAspect: { value: aspect },
        },
      });
      const cells = new Float32Array(count * 2);
      for (let k = 0; k < count; k++) {
        cells[k * 2] = k % video.sheet_cols;
        cells[k * 2 + 1] = Math.floor(k / video.sheet_cols);
      }
      const meshGeometry = geometry.clone();
      meshGeometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
      const state = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      state.setUsage(THREE.DynamicDrawUsage);
      meshGeometry.setAttribute('aState', state);
      const mesh = new THREE.InstancedMesh(meshGeometry, material, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; // instances move far from the base geometry's bounds
      mesh.userData.offset = s * perSheet;
      scene.add(mesh);
      meshes.push(mesh);
      states.push(state);
      textures.push(texture);
      materials.push(material);
    }

    // The glass itself: a thin slab behind every image, its faces shaded like lit glass edges.
    const depth = plateH * 0.022;
    const slabGeometry = new THREE.BoxGeometry(plateW, plateH, depth);
    slabGeometry.translate(0, plateH / 2, -depth / 2 - 0.002);
    // Faces: right, left, top, bottom, front, back. The front face sits just behind the image and is
    // never drawn, so it can't fight the image for depth at grazing angles.
    const slabMaterials = ['#4d4b42', '#4d4b42', '#8d887a', '#24231f', null, '#34332d'].map(
      (color) => new THREE.MeshBasicMaterial(color ? { color } : { visible: false }),
    );
    const slabs = new THREE.InstancedMesh(slabGeometry, slabMaterials, total);
    slabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    slabs.frustumCulled = false;
    scene.add(slabs);

    // The current plate's number, printed on its top edge (an HTML label kept over the 3D corner).
    const label = document.createElement('span');
    label.className = 'rack-label';
    label.setAttribute('aria-hidden', 'true');
    element.append(label);

    // ---- Layout: everything follows one damped position `p` ----
    let p = currentRef.current;
    let target = p;
    let hover = -1;
    let distance = plateH * 3;
    const dummy = new THREE.Object3D();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    const targetMatrix = new THREE.Matrix4();
    const corner = new THREE.Vector3();
    const focus = new THREE.Vector3();
    const smooth = (t: number) => t * t * (3 - 2 * t);

    // Back the camera off until the current plate fills FILL of the width and fits the height,
    // whatever the canvas's aspect (a phone's tall canvas needs it further away).
    function fit() {
      const vertical = THREE.MathUtils.degToRad(camera.fov);
      const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
      distance = Math.max(plateW / FILL / 2 / Math.tan(horizontal / 2), (plateH * 1.7) / 2 / Math.tan(vertical / 2));
    }

    function layout() {
      for (const [m, mesh] of meshes.entries()) {
        const offset = mesh.userData.offset as number;
        const state = states[m]!;
        for (let k = 0; k < mesh.count; k++) {
          const i = offset + k;
          const d = i - p;
          if (d < -SHOWN_PASSED - 1) {
            mesh.setMatrixAt(k, hidden);
            slabs.setMatrixAt(i, hidden);
            continue;
          }
          const passed = smooth(Math.min(1, Math.max(0, -d)));
          const near = Math.max(0, 1 - Math.abs(d));
          dummy.position.set(0, LIFT * plateH * near - passed * 0.02, -i * GAP * plateH + passed * GAP * plateH * 0.6);
          dummy.rotation.set(-LEAN * passed + (d > 0 ? 0.1 * Math.min(1, d) : 0), 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(k, dummy.matrix);
          slabs.setMatrixAt(i, dummy.matrix);
          if (i === target) targetMatrix.copy(dummy.matrix);
          const fade = Math.min(1, Math.max(0, (d + SHOWN_PASSED + 1) / 2)); // last passed plates fade out
          const brightness = (d < 0 ? 0.34 + 0.4 * (1 - passed) : Math.max(0.15, 1 - Math.max(0, d - 1) * 0.07)) * fade;
          state.setXYZ(k, keptSamples.has(i) ? 1 : 0, i === hover ? Math.min(1, brightness + 0.25) : brightness, near);
        }
        mesh.instanceMatrix.needsUpdate = true;
        state.needsUpdate = true;
      }
      slabs.instanceMatrix.needsUpdate = true;

      const z = -p * GAP * plateH;
      focus.set(plateW * 0.12, plateH * 0.62, z - plateH * 0.25);
      camera.position.copy(focus).addScaledVector(VIEW, distance);
      camera.lookAt(focus);
      camera.updateMatrixWorld();

      // Pin the label to the target plate's top-left corner.
      corner.set(-plateW / 2, plateH, 0).applyMatrix4(targetMatrix).project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      label.style.transform = `translate(${((corner.x + 1) / 2) * rect.width}px, ${((1 - corner.y) / 2) * rect.height}px) translateY(calc(-100% - 6px))`;
    }

    // ---- Render loop: runs only while something is moving ----
    let frameId = 0;
    let last = 0;
    function tick(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      p = reduced ? target : p + (target - p) * (1 - Math.exp(-DAMPING * dt));
      if (Math.abs(target - p) < 0.0005) p = target;
      layout();
      renderer.render(scene, camera);
      frameId = p === target ? 0 : requestAnimationFrame(tick);
      if (!frameId) last = 0;
    }
    function wake() {
      if (!frameId) frameId = requestAnimationFrame(tick);
    }

    const resize = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const height = entry?.contentRect.height ?? 0;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fit();
      layout();
      renderer.render(scene, camera);
    });
    resize.observe(element);

    // ---- Pointer: hover, click to choose, wheel or drag to flip ----
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function pick(event: PointerEvent | MouseEvent): number {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit && hit.instanceId !== undefined ? (hit.object.userData.offset as number) + hit.instanceId : -1;
    }
    // Several steps can arrive before React re-renders (a fast wheel), so count from our own copy.
    const step = (delta: number) => {
      const next = Math.min(total - 1, Math.max(0, currentRef.current + delta));
      if (next === currentRef.current) return;
      currentRef.current = next;
      select.current(next * video.sample_step);
    };

    let wheel = 0;
    const onWheel = (event: WheelEvent) => {
      // At the first or last plate the wheel scrolls the page again, so the rack never traps it.
      const direction = Math.sign(event.deltaY);
      if ((direction < 0 && currentRef.current === 0) || (direction > 0 && currentRef.current === total - 1)) return;
      event.preventDefault();
      wheel += event.deltaY;
      while (Math.abs(wheel) >= 60) {
        step(Math.sign(wheel));
        wheel -= Math.sign(wheel) * 60;
      }
    };
    let drag: { y: number; moved: boolean } | null = null;
    const onDown = (event: PointerEvent) => {
      drag = { y: event.clientY, moved: false };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (drag) {
        const dy = event.clientY - drag.y;
        if (Math.abs(dy) >= 22) {
          step(dy < 0 ? 1 : -1);
          drag = { y: event.clientY, moved: true };
        }
        return;
      }
      const next = pick(event);
      if (next !== hover) {
        hover = next;
        renderer.domElement.style.cursor = next >= 0 ? 'pointer' : '';
        layout();
        renderer.render(scene, camera);
      }
    };
    const onUp = (event: PointerEvent) => {
      const wasDrag = drag?.moved;
      drag = null;
      if (wasDrag) return;
      const chosen = pick(event);
      if (chosen >= 0) select.current(chosen * video.sample_step);
    };
    const onLeave = () => {
      if (hover === -1) return;
      hover = -1;
      layout();
      renderer.render(scene, camera);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    const name = (sample: number) => {
      label.textContent = `Plate ${sample + 1} · frame ${sample * video.sample_step}`;
    };
    name(target);

    rack.current = {
      setTarget(sample) {
        target = sample;
        name(sample);
        wake();
      },
      setKept(samples) {
        keptSamples = samples;
        wake();
        layout();
        renderer.render(scene, camera);
      },
    };
    wake();

    return () => {
      cancelAnimationFrame(frameId);
      resize.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      meshes.forEach((mesh) => mesh.geometry.dispose());
      slabGeometry.dispose();
      slabMaterials.forEach((material) => material.dispose());
      label.remove();
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      canvas.remove();
      rack.current = null;
    };
  }, [video, sheets, reduced]);

  useEffect(() => {
    rack.current?.setTarget(current);
  }, [current]);

  useEffect(() => {
    rack.current?.setKept(new Set([...kept].map((f) => sampleOf(f, video.sample_step))));
  }, [kept, video.sample_step]);

  if (unsupported) {
    return (
      <p className="rack-unsupported" role="status">
        This browser can’t draw the 3D rack (WebGL is unavailable). The contact sheet shows the same frames.
      </p>
    );
  }

  return (
    <div
      className="rack"
      ref={host}
      role="group"
      aria-roledescription="3D plate rack"
      aria-label={`Plate rack. Plate ${current + 1} of ${video.sample_count}. Scroll or drag to flip through the plates, click one to open it; the arrow keys work here too.`}
    />
  );
}
