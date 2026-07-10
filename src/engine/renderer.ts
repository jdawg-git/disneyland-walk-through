import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { N8AOPostPass } from "n8ao";
import {
  HalfFloatType,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

export interface RendererBundle {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly camera: PerspectiveCamera;
  readonly setBloomIntensity: (intensity: number) => void;
  readonly render: (dt: number) => void;
}

/**
 * WebGL2 renderer + post chain: Render → N8AO → (Bloom, Vignette, ACES tone
 * mapping, SMAA). Tone mapping happens in the composer, so the renderer's own
 * tone mapping is off. This chain is where the "stylized but gorgeous" look
 * is won — bloom picks up emissive windows at night.
 */
export function createRenderer(container: HTMLElement, scene: Scene): RendererBundle {
  const camera = new PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1200,
  );

  const renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: false,
    stencil: false,
    depth: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  // Composer passes each call renderer.render(); reset stats once per frame
  // (in render() below) so renderer.info reflects the whole frame.
  renderer.info.autoReset = false;
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const aoPass = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
  aoPass.configuration.aoRadius = 2.5;
  aoPass.configuration.distanceFalloff = 1.0;
  aoPass.configuration.intensity = 3.0;
  composer.addPass(aoPass);

  const bloom = new BloomEffect({
    intensity: 0.3,
    luminanceThreshold: 0.85,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
  });
  const vignette = new VignetteEffect({ darkness: 0.42, offset: 0.28 });
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const smaa = new SMAAEffect();
  composer.addPass(new EffectPass(camera, bloom, vignette, toneMapping, smaa));

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    composer,
    camera,
    setBloomIntensity: (intensity: number) => {
      bloom.intensity = intensity;
    },
    render: (dt: number) => {
      renderer.info.reset();
      composer.render(dt);
    },
  };
}
