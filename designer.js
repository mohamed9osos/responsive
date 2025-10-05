import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { modelsConfig } from "./model_config.js";

class MugDesigner {
  constructor() {
    this.meshes = {};
    this.mug = null;
    this.currentType = 'mugs';
    this.currentModelId = 'mug1';
    this.modelConfig = modelsConfig[this.currentType][this.currentModelId];
    this.currentArea = Object.keys(this.modelConfig.parts)[0];
    this.init();
    this.setupScene();
    this.setupLights();
    this.setupControls();
    this.setupFabric();
    this.setupEventListeners();
    this.loadMug();
    this.animate();
  }

  init() {
    this.container = document.getElementById("modelViewer");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 10);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
  }

  setupScene() {
    this.scene.background = new THREE.Color(0xffffff);
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(10, 10, 10);
    this.scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-10, 0, -10);
    this.scene.add(fillLight);
    const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
    topLight.position.set(0, 10, 0);
    this.scene.add(topLight);
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
    frontLight.position.set(0, 0, 20);
    this.scene.add(frontLight);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 0, 0);
    this.controls.minPolarAngle = Math.PI / 3;
    this.controls.maxPolarAngle = Math.PI / 1.7;
    this.controls.enablePan = false;
  }

  setupFabric() {
    const currentPart = this.currentPart || Object.keys(this.modelConfig.parts)[0];
    const partConfig = this.modelConfig.parts[currentPart];
    const marginTop = partConfig.margins.top;
    const marginBottom = partConfig.margins.bottom;
    const marginLeft = partConfig.margins.left;
    const marginRight = partConfig.margins.right;
    const printWidth = partConfig.canvasWidth;
    const printHeight = partConfig.canvasHeight;

    this.canvas = new fabric.Canvas("designCanvas", {
      backgroundColor: "white",
      width: printWidth,
      height: printHeight,
      preserveObjectStacking: true,
    });

    this.safeRect = new fabric.Rect({
      left: marginLeft,
      top: marginTop,
      width: printWidth - (marginLeft + marginRight),
      height: printHeight - (marginTop + marginBottom),
      fill: "transparent",
      stroke: "#ef4444",
      strokeWidth: 0.4,
      strokeDashArray: [15, 10],
      selectable: false,
      evented: false,
      excludeFromLayers: true,
      excludeFromExport: true,
    });
    this.canvas.add(this.safeRect);
    this.canvas.sendToBack(this.safeRect);

    this.vGuide = new fabric.Line([printWidth / 2, 0, printWidth / 2, printHeight], {
      stroke: partConfig.guideLinesColor || "rgba(37, 99, 235, 0.5)",
      selectable: false,
      evented: false,
      visible: false,
      excludeFromLayers: true,
      excludeFromExport: true,
    });
    this.hGuide = new fabric.Line([0, printHeight / 2, printWidth, printHeight / 2], {
      stroke: partConfig.guideLinesColor || "rgba(37, 99, 235, 0.5)",
      selectable: false,
      evented: false,
      visible: false,
      excludeFromLayers: true,
      excludeFromExport: true,
    });
    this.canvas.add(this.vGuide, this.hGuide);

    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerStyle = "circle";
    fabric.Object.prototype.cornerColor = "rgba(37, 99, 235, 0.9)";
    fabric.Object.prototype.borderColor = "rgba(37, 99, 235, 0.6)";
    fabric.Object.prototype.cornerSize = 10;
    fabric.Object.prototype.padding = 5;
  }

  setupEventListeners() {
    this.debouncedUpdate = this.debounce(() => this.updateMugTexture(), 300);

    document.getElementById("toggleSafeZone").addEventListener("click", () => {
      this.safeZoneVisible = !this.safeZoneVisible;
      this.safeRect.set({ visible: this.safeZoneVisible });
      this.canvas.renderAll();
      const btn = document.getElementById("toggleSafeZone");
      btn.classList.toggle("active", this.safeZoneVisible);
    });

    window.addEventListener("resize", () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    this.setupSplitter();
  }

  setupSplitter() {
    const splitter = document.querySelector(".splitter");
    const handle = document.querySelector(".splitter-handle");
    const modelContainer = document.querySelector(".model-container");
    const canvasContainer = document.querySelector(".canvas-container");
    const splitContainer = document.querySelector(".split-container");
    const canvasWrapper = canvasContainer.querySelector(".canvas-wrapper");

    let isDragging = false;
    let baseCanvasSize = null;

    const startDrag = (e) => {
      isDragging = true;
      e.preventDefault();
      document.body.style.userSelect = "none";
      const flexDirection = getComputedStyle(splitContainer).flexDirection;
      document.body.style.cursor = flexDirection === "row" ? "col-resize" : "row-resize";
      baseCanvasSize = flexDirection === "row" ? canvasContainer.clientWidth : canvasContainer.clientHeight;
    };

    const drag = (e) => {
      if (!isDragging) return;
      const rect = splitContainer.getBoundingClientRect();
      const flexDirection = getComputedStyle(splitContainer).flexDirection;
      const minSize = 300;
      const splitterSize = flexDirection === "row" ? splitter.offsetWidth : splitter.offsetHeight;

      if (flexDirection === "row") {
        const x = e.clientX - rect.left;
        const maxWidth = rect.width - minSize - splitterSize;
        const modelWidth = Math.max(minSize, Math.min(x, maxWidth));
        const canvasWidth = rect.width - modelWidth - splitterSize;
        modelContainer.style.flex = `0 0 ${modelWidth}px`;
        canvasContainer.style.flex = `0 0 ${canvasWidth}px`;
        let ratio = canvasWidth / baseCanvasSize;
        ratio = Math.min(Math.max(ratio, 0.4), 1);
        canvasWrapper.style.transform = `scale(${ratio})`;
        canvasWrapper.style.transformOrigin = "center top";
      } else {
        const y = e.clientY - rect.top;
        const maxHeight = rect.height - minSize - splitterSize;
        const modelHeight = Math.max(minSize, Math.min(y, maxHeight));
        const canvasHeight = rect.height - modelHeight - splitterSize;
        modelContainer.style.flex = `0 0 ${modelHeight}px`;
        canvasContainer.style.flex = `0 0 ${canvasHeight}px`;
        let ratio = canvasHeight / baseCanvasSize;
        ratio = Math.min(Math.max(ratio, 0.4), 1);
        canvasWrapper.style.transform = `scale(${ratio})`;
        canvasWrapper.style.transformOrigin = "top center";
      }

      this.renderer.setSize(modelContainer.clientWidth, modelContainer.clientHeight);
      this.camera.aspect = modelContainer.clientWidth / modelContainer.clientHeight;
      this.camera.updateProjectionMatrix();
    };

    const stopDrag = () => {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    handle.addEventListener("mousedown", startDrag);
    splitter.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
    handle.addEventListener("touchstart", (e) => startDrag(e.touches[0]));
    document.addEventListener("touchmove", (e) => {
      if (isDragging) drag(e.touches[0]);
    });
    document.addEventListener("touchend", stopDrag);

    if (canvasWrapper) {
      canvasWrapper.style.transition = "transform 0.2s ease";
    }
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  updateMugTexture() {
    const outerMug = this.meshes["Object_4"];
    if (!outerMug) return;
    this.canvas.getObjects().forEach((obj) => {
      if (obj.excludeFromExport) {
        obj.set({ visible: false });
      }
    });
    this.canvas.renderAll();
    const multiplier = Math.min(4, window.innerWidth / 500);
    const dataURL = this.canvas.toDataURL({
      format: "png",
      multiplier,
      quality: 1,
    });
    this.canvas.getObjects().forEach((obj) => {
      if (obj.excludeFromExport) {
        obj.set({ visible: true });
      }
    });
    this.canvas.renderAll();
    const texture = new THREE.TextureLoader().load(dataURL, (tex) => {
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      tex.encoding = THREE.sRGBEncoding;
      if (outerMug.material.map) outerMug.material.map.dispose();
      outerMug.material.map = tex;
      outerMug.material.needsUpdate = true;
    });
  }

  async loadMug() {
    const loader = new GLTFLoader();
    try {
      const modelUrl = this.modelConfig?.glbPath;
      if (!modelUrl) throw new Error("Model path not found in config");
      const gltf = await new Promise((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });
      if (this.mug) this.scene.remove(this.mug);
      this.mug = gltf.scene;
      this.mug.traverse((child) => {
        if (child.isMesh) {
          this.meshes[child.name] = child;
          if (!child.material) {
            child.material = new THREE.MeshStandardMaterial({
              metalness: 0.3,
              roughness: 0.4,
              color: 0xffffff,
            });
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      const scale = this.modelConfig?.scale || 30;
      this.mug.scale.set(scale, scale, scale);
      const box = new THREE.Box3().setFromObject(this.mug);
      const center = box.getCenter(new THREE.Vector3());
      this.mug.position.sub(center);
      if (this.modelConfig?.initialRotation?.y) {
        this.mug.rotation.y = this.modelConfig.initialRotation.y;
      } else {
        this.mug.rotation.y = Math.PI * 0.3;
      }
      this.scene.add(this.mug);
      const camPos = this.modelConfig?.cameraPosition || { x: 0, y: 5, z: 15 };
      this.camera.position.set(camPos.x, camPos.y, camPos.z);
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.minDistance = this.modelConfig?.minDistance || 10;
      this.controls.maxDistance = this.modelConfig?.maxDistance || 25;
      this.controls.update();
    } catch (error) {
      console.error("Error loading model:", error);
      this.createFallbackMug();
    }
  }

  createFallbackMug() {
    const geometry = new THREE.CylinderGeometry(8, 10, 15, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.4,
    });
    this.mug = new THREE.Mesh(geometry, material);
    this.meshes["Object_4"] = this.mug;
    this.meshes["Object_5"] = this.mug;
    this.scene.add(this.mug);
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 0, 40);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

new MugDesigner();