import { Tensor } from "onnxruntime-web";

export type Label = "Smart Labelling" | "Polygon" | "Brush" | "Erase" | "Crop"

export interface modelScaleProps {
  samScale: number;
  height: number;
  width: number;
}

export interface modelInputProps {
  x: number;
  y: number;
  clickType: number;
}

export interface modeDataProps {
  clicks?: Array<modelInputProps>;
  tensor: Tensor;
  modelScale: modelScaleProps;
}

export interface ToolProps {
  handleMouseMove: (e: any) => void;
}

export interface StageProps {
  loadImages: (hrefs: string[]) => void;
  loadDefault: () => void;
  requestEmbedding: () => void;
  featuresUpdated: () => void;
  trainClassifier: () => void;
  applyClassifier: () => void;
  updateAll: (imgs: Array<HTMLImageElement>, labels: Array<Uint8ClampedArray>,
    segs: Array<Uint8ClampedArray>, tensors: Array<any>) => void;
  deleteAll: () => void;
  deleteCurrent: () => void;
  changeToImage: (oldIdx: number, newIdx: number) => void;
  saveSeg: () => void;
  saveLabels: () => void;
  saveClassifier: () => void;
  loadClassifier: (file: File) => void;
}

export interface TopbarProps {
  loadFromFile: (file: File) => void;
  loadLabelFile: (file: File) => void;
  deleteAll: () => void;
  deleteCurrent: () => void;
  saveSeg: () => void;
  saveLabels: () => void;
  saveClassifier: () => void;
  applyClassifier: () => void;
  loadClassifier: (file: File) => void;
}

export interface DragDropProps {
  loadDefault: () => void;
  loadFromFile: (file: File) => void;
}

export interface SidebarProps {
  requestEmbedding: () => void;
  trainClassifier: () => void;
  changeToImage: (oldIdx: number, newIdx: number) => void;
}

export interface LabelFrameProps {
  requestEmbedding: () => void;
}

export interface NavigationProps {
  changeToImage: (oldIdx: number, newIdx: number) => void;
}


export interface MultiCanvasProps {
  updateAll: (imgs: Array<HTMLImageElement>, labels: Array<Uint8ClampedArray>,
    segs: Array<Uint8ClampedArray>, tensors: Array<any>) => void;
}

export type Offset = { x: number, y: number }
export type Pan = { x0: number, y0: number, cx0: number, cy0: number }

export const getHTTPRequest = (url: string) => {
  const http = new XMLHttpRequest()
  http.open("POST", url, true)
  http.setRequestHeader("Content-type", "application/json;charset=utf-8")
  return http
}

export interface BigModalProps {
  requestFeatures: () => void;
}

export interface ErrorMessage {
  msg: string;
  stackTrace: string;
}

export interface SegmentFeatureState {
  feature: boolean;
  segment: boolean;
}

// refactor this to just be a literal - custom type is weird
export type ModalShow = "None" | "Welcome" | "Settings" | "Features" | "Contact" | "Metrics"

export interface closeModal {
  closeModal: () => void;
}

export interface MetricsModalProps {
  phaseFractions: number[]
}

export interface FeatureModalProps {
  closeModal: () => void;
  requestFeatures: () => void;
}

export interface Features {
  "Gaussian Blur": number;
  "Sobel Filter": number;
  "Hessian": number;
  "Difference of Gaussians": number;
  "Membrane Projections": number;
  "Mean": number;
  "Minimum": number;
  "Maximum": number;
  "Median": number;
  "Bilateral": number;
  "Derivatives": number;
  "Structure": number;
  "Entropy": number;
  "Neighbours": number;
  "Membrane Thickness": number;
  "Membrane Patch Size": number;
  "Minimum Sigma": number;
  "Maximum Sigma": number;
}

export const defaultFeatures = {
  "Gaussian Blur": 1,
  "Sobel Filter": 1,
  "Hessian": 1,
  "Difference of Gaussians": 0,
  "Membrane Projections": 0,
  "Mean": 0,
  "Minimum": 0,
  "Maximum": 0,
  "Median": 0,
  "Bilateral": 0,
  "Derivatives": 0,
  "Structure": 0,
  "Entropy": 0,
  "Neighbours": 0,
  "Membrane Thickness": 1,
  "Membrane Patch Size": 19,
  "Minimum Sigma": 0,
  "Maximum Sigma": 16,
}

export type Theme = "default" | "dark" | "blue" | "grey" | "green" | "yellow" | "red" | "light-blue"
// in form name: [bootstrap name, bg colour, button color (=bg color for all but dark)]
export const themeBGs = {
  "default": ["dark", "#ffffff", "#ffffff"], "dark": ["dark", "#303030", "#ffffff"], "blue": ["primary", "#D7DAE5", "#D7DAE5"],
  "red": ["danger", "#ECE2D0", "#ECE2D0"], "green": ["success", "#CCDDB7", "#CCDDB7"], "yellow": ["warning", "#ffffff", "#ffffff"],
  "grey": ["secondary", "#ffffff", "#ffffff"], "light-blue": ["info", "#F6E8EA", "#F6E8EA"]
}

export interface Settings {
  nPoints: number;
  trainAll: boolean;
  rescale: boolean;
  format: ".skops" | ".pkl";
  balance: boolean;
}