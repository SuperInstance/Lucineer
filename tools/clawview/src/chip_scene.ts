/**
 * ClawView — 3D Chip Visualization Scene
 *
 * Three.js scene for rendering GDSII layouts, thermal heatmaps,
 * and timing paths in an interactive 3D view.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ---------- Types ----------

export interface GDSIILayer {
  id: number;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  zOffset: number; // vertical position in 3D stack
  thickness: number;
  polygons: GDSIIPolygon[];
}

export interface GDSIIPolygon {
  points: Array<{ x: number; y: number }>;
  cellName: string;
  netName?: string;
}

export interface ThermalData {
  width: number;
  height: number;
  resolution: number; // microns per pixel
  data: Float32Array; // temperature in °C
  minTemp: number;
  maxTemp: number;
}

export interface TimingPath {
  name: string;
  slack: number; // nanoseconds (positive = met, negative = violated)
  startFlop: { x: number; y: number; name: string };
  endFlop: { x: number; y: number; name: string };
  waypoints: Array<{ x: number; y: number }>;
}

export interface ChipSceneConfig {
  container: HTMLElement;
  width: number;
  height: number;
  backgroundColor?: number;
  enableShadows?: boolean;
}

// ---------- Color Scales ----------

const LAYER_COLORS: Record<string, number> = {
  M1: 0x4a90d9, // Blue
  M2: 0x7b68ee, // Medium slate blue
  M3: 0x50c878, // Emerald
  M4: 0xff6b35, // Orange (weight layer)
  M5: 0xffd700, // Gold
  M6: 0xff4444, // Red (weight layer)
  VIA: 0xcccccc, // Gray
  POLY: 0x888888, // Dark gray
  DIFF: 0xaadd77, // Light green
  NWELL: 0xddddaa, // Beige
};

function thermalColor(temp: number, minTemp: number, maxTemp: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

  // Blue → Green → Yellow → Red
  if (t < 0.33) {
    return new THREE.Color().setHSL(0.6 - t * 0.9, 0.8, 0.5);
  } else if (t < 0.66) {
    return new THREE.Color().setHSL(0.3 - (t - 0.33) * 0.9, 0.9, 0.5);
  } else {
    return new THREE.Color().setHSL(0.0, 0.9, 0.35 + (1 - t) * 0.3);
  }
}

function timingColor(slack: number): THREE.Color {
  if (slack >= 0.5) return new THREE.Color(0x00cc00); // Green — well met
  if (slack >= 0.0) return new THREE.Color(0xcccc00); // Yellow — tight
  return new THREE.Color(0xff0000); // Red — violated
}

// ---------- Main Scene ----------

export class ChipScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private layerGroups: Map<string, THREE.Group> = new Map();
  private thermalMesh: THREE.Mesh | null = null;
  private timingGroup: THREE.Group;
  private rauGroup: THREE.Group;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private animationId: number = 0;

  // Callbacks
  onCellClick?: (cellName: string, netName?: string) => void;

  constructor(config: ChipSceneConfig) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.backgroundColor ?? 0x1a1a2e);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      config.width / config.height,
      0.1,
      10000
    );
    this.camera.position.set(500, 800, 500);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(config.width, config.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    if (config.enableShadows) {
      this.renderer.shadowMap.enabled = true;
    }
    config.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 500, 300);
    this.scene.add(directionalLight);

    // Groups
    this.timingGroup = new THREE.Group();
    this.timingGroup.name = "timing_paths";
    this.scene.add(this.timingGroup);

    this.rauGroup = new THREE.Group();
    this.rauGroup.name = "rau_array";
    this.scene.add(this.rauGroup);

    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Event listeners
    this.renderer.domElement.addEventListener("click", (event) =>
      this.onClick(event, config.container)
    );

    // Grid helper
    const grid = new THREE.GridHelper(1000, 50, 0x333355, 0x222244);
    grid.position.y = -1;
    this.scene.add(grid);
  }

  // ---------- GDSII Layer Rendering ----------

  loadLayers(layers: GDSIILayer[]): void {
    for (const layer of layers) {
      const group = new THREE.Group();
      group.name = layer.name;
      group.visible = layer.visible;

      const color = LAYER_COLORS[layer.name] ?? 0x888888;
      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: layer.opacity,
        side: THREE.DoubleSide,
      });

      for (const polygon of layer.polygons) {
        const shape = new THREE.Shape();
        if (polygon.points.length < 3) continue;

        shape.moveTo(polygon.points[0].x, polygon.points[0].y);
        for (let i = 1; i < polygon.points.length; i++) {
          shape.lineTo(polygon.points[i].x, polygon.points[i].y);
        }
        shape.closePath();

        const extrudeSettings = {
          depth: layer.thickness,
          bevelEnabled: false,
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = layer.zOffset;
        mesh.userData = {
          cellName: polygon.cellName,
          netName: polygon.netName,
          layerName: layer.name,
        };
        group.add(mesh);
      }

      this.layerGroups.set(layer.name, group);
      this.scene.add(group);
    }
  }

  setLayerVisibility(layerName: string, visible: boolean): void {
    const group = this.layerGroups.get(layerName);
    if (group) group.visible = visible;
  }

  // ---------- Thermal Overlay ----------

  loadThermalData(data: ThermalData): void {
    // Remove existing thermal mesh
    if (this.thermalMesh) {
      this.scene.remove(this.thermalMesh);
      this.thermalMesh.geometry.dispose();
      (this.thermalMesh.material as THREE.Material).dispose();
    }

    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(data.width, data.height);

    for (let i = 0; i < data.data.length; i++) {
      const color = thermalColor(data.data[i], data.minTemp, data.maxTemp);
      imageData.data[i * 4 + 0] = Math.round(color.r * 255);
      imageData.data[i * 4 + 1] = Math.round(color.g * 255);
      imageData.data[i * 4 + 2] = Math.round(color.b * 255);
      imageData.data[i * 4 + 3] = 180; // Semi-transparent
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(
      data.width * data.resolution,
      data.height * data.resolution
    );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });

    this.thermalMesh = new THREE.Mesh(geometry, material);
    this.thermalMesh.rotation.x = -Math.PI / 2;
    this.thermalMesh.position.y = 50; // Above chip layers
    this.thermalMesh.name = "thermal_overlay";
    this.scene.add(this.thermalMesh);
  }

  setThermalVisible(visible: boolean): void {
    if (this.thermalMesh) this.thermalMesh.visible = visible;
  }

  // ---------- Timing Paths ----------

  loadTimingPaths(paths: TimingPath[]): void {
    // Clear existing
    while (this.timingGroup.children.length > 0) {
      const child = this.timingGroup.children[0];
      this.timingGroup.remove(child);
    }

    for (const path of paths) {
      const color = timingColor(path.slack);
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
      });

      const points: THREE.Vector3[] = [
        new THREE.Vector3(path.startFlop.x, 30, path.startFlop.y),
        ...path.waypoints.map(
          (wp) => new THREE.Vector3(wp.x, 30, wp.y)
        ),
        new THREE.Vector3(path.endFlop.x, 30, path.endFlop.y),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      line.userData = {
        pathName: path.name,
        slack: path.slack,
        startFlop: path.startFlop.name,
        endFlop: path.endFlop.name,
      };
      this.timingGroup.add(line);

      // Flop markers
      const sphereGeo = new THREE.SphereGeometry(3);
      const sphereMat = new THREE.MeshPhongMaterial({ color: color.getHex() });

      const startSphere = new THREE.Mesh(sphereGeo, sphereMat);
      startSphere.position.set(path.startFlop.x, 30, path.startFlop.y);
      this.timingGroup.add(startSphere);

      const endSphere = new THREE.Mesh(sphereGeo, sphereMat);
      endSphere.position.set(path.endFlop.x, 30, path.endFlop.y);
      this.timingGroup.add(endSphere);
    }
  }

  // ---------- RAU Array Visualization ----------

  renderRAUArray(
    rows: number,
    cols: number,
    weights: Array<Array<number>>, // 0=+1, 1=0, 2=-1
    cellSize: number = 8
  ): void {
    while (this.rauGroup.children.length > 0) {
      this.rauGroup.remove(this.rauGroup.children[0]);
    }

    const geometry = new THREE.BoxGeometry(cellSize * 0.9, cellSize * 0.5, cellSize * 0.9);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const weight = weights[r]?.[c] ?? 0;

        let color: number;
        let opacity: number;
        switch (weight) {
          case 0: // +1
            color = 0x00aaff;
            opacity = 1.0;
            break;
          case 1: // 0 (zero-skip, transparent)
            color = 0x444444;
            opacity = 0.15;
            break;
          case 2: // -1
            color = 0xff4444;
            opacity = 1.0;
            break;
          default:
            color = 0xffff00; // Reserved (warning)
            opacity = 1.0;
        }

        const material = new THREE.MeshPhongMaterial({
          color,
          transparent: opacity < 1.0,
          opacity,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          c * cellSize - (cols * cellSize) / 2,
          0,
          r * cellSize - (rows * cellSize) / 2
        );
        mesh.userData = { row: r, col: c, weight };
        this.rauGroup.add(mesh);
      }
    }
  }

  // ---------- Interaction ----------

  private onClick(event: MouseEvent, container: HTMLElement): void {
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersects.length > 0 && this.onCellClick) {
      const hit = intersects[0].object;
      if (hit.userData.cellName) {
        this.onCellClick(hit.userData.cellName, hit.userData.netName);
      }
    }
  }

  // ---------- Animation Loop ----------

  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.stop();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
