declare module "@met4citizen/talkinghead" {
  export type TalkingHeadAvatar = {
    url: string;
    body?: "M" | "F";
    lipsyncLang?: string;
    ttsLang?: string;
    ttsVoice?: string;
    avatarMood?: string;
    avatarMute?: boolean;
    [key: string]: unknown;
  };

  export type TalkingHeadOptions = {
    ttsEndpoint?: string;
    ttsApikey?: string | null;
    lipsyncModules?: string[];
    lipsyncLang?: string;
    cameraView?: "full" | "mid" | "upper" | "head";
    cameraDistance?: number;
    cameraX?: number;
    cameraY?: number;
    cameraRotateEnable?: boolean;
    cameraPanEnable?: boolean;
    cameraZoomEnable?: boolean;
    modelPixelRatio?: number;
    lightAmbientIntensity?: number;
    lightDirectIntensity?: number;
    [key: string]: unknown;
  };

  export class TalkingHead {
    audioCtx: AudioContext;
    lipsync: Record<string, unknown>;
    renderer?: import("three").WebGLRenderer;
    camera?: import("three").PerspectiveCamera;
    nodeAvatar?: HTMLElement;
    onResize?: () => void;
    constructor(node: HTMLElement, opt?: TalkingHeadOptions | null);
    showAvatar(
      avatar: TalkingHeadAvatar,
      onprogress?: ((ev: ProgressEvent) => void) | null,
    ): Promise<void>;
    /** VRM convenience alias (Karen patch / factory polyfill). */
    loadVRM?(
      url: string,
      onprogress?: ((ev: ProgressEvent) => void) | null,
    ): Promise<void>;
    /** Populated when a VRM is loaded via @pixiv/three-vrm. */
    vrm?: { scene?: import("three").Object3D; [key: string]: unknown } | null;
    setView(
      view: "full" | "mid" | "upper" | "head",
      opt?: Record<string, number> | null,
    ): void;
    setMood(mood: string): void;
    setBaselineValue(mt: string, val: number | null): void;
    setFixedValue(mt: string, val: number | null, ms?: number | null): void;
    speakText(
      text: string,
      opt?: Record<string, unknown> | null,
      onsubtitles?: ((node: unknown) => void) | null,
      excludes?: [number, number][] | null,
    ): void;
    speakAudio(
      audio: {
        audio?: AudioBuffer | ArrayBuffer | Int16Array | Int16Array[];
        words?: string[];
        wtimes?: number[];
        wdurations?: number[];
        visemes?: string[];
        vtimes?: number[];
        vdurations?: number[];
        [key: string]: unknown;
      },
      opt?: Record<string, unknown> | null,
      onsubtitles?: ((node: unknown) => void) | null,
    ): void;
    /** Turn head/eyes toward viewport coords (ms blend). */
    lookAt(x: number | null, y: number | null, t?: number): void;
    lookAtCamera(t?: number): void;
    start(): void;
    stop(): void;
  }
}

declare module "@met4citizen/talkinghead/modules/lipsync-en.mjs" {
  export class LipsyncEn {
    preProcessText(s: string): string;
    wordsToVisemes(word: string): {
      visemes: string[];
      times: number[];
      durations: number[];
    };
  }
}

declare module "@met4citizen/talkinghead/modules/*" {
  const mod: Record<string, unknown>;
  export default mod;
}
