import { Tensor } from "onnxruntime-web";

export type Label = "Smart Labelling" | "Polygon" | "Brush" | "Erase"

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
  trainClassifier: () => void;
  changeToImage: (oldIdx: number, newIdx: number) => void;
  saveSeg: () => void;
  saveLabels: () => void;
  saveClassifier: () => void;
}

export interface TopbarProps {
  loadFromFile: (file: File) => void;
  saveSeg: () => void;
  saveLabels: () => void;
  saveClassifier: () => void;
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
  label: Label;
  class: number;
  labelOpacity: number;
  brushWidth: number;
}

export type Offset = { x: number, y: number }
export type Pan = { x0: number, y0: number, cx0: number, cy0: number }

export const getHTTPRequest = (url: string) => {
  const http = new XMLHttpRequest()
  http.open("POST", url, true)
  http.setRequestHeader("Content-type", "application/json;charset=utf-8")
  return http
}

export interface ErrorMessage {
  msg: string;
  stackTrace: string;
}

export interface SegmentFeatureState {
  feature: boolean;
  segment: boolean;
}

export interface ModalShow {
  welcome: boolean;
  settings: boolean;
  features: boolean;
}


export interface closeModal {
  closeModal: () => void;
}

export interface FeatureModalProps {
  closeModal: () => void;
  requestEmbedding: () => void;
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
  "Difference of Gaussians": 1,
  "Membrane Projections": 1,
  "Mean": 0,
  "Minimum": 0,
  "Maximum": 0,
  "Median": 0,
  "Bilateral": 0,
  "Derivatives": 0,
  "Structure": 0,
  "Entropy": 0,
  "Neighbours": 1,
  "Membrane Thickness": 1,
  "Membrane Patch Size": 17,
  "Minimum Sigma": 0.5,
  "Maximum Sigma": 16,
}

export type Theme = "default" | "dark" | "blue" | "grey" | "green" | "yellow" | "red" | "light-blue"
export type ThemeObj = { name: string, colour: string }
// in form name: [bootstrap name, bg colour]
export const themeBGs = {
  "default": ["dark", "#ffffff"], "dark": ["dark", "#303030"], "blue": ["primary", "#D7DAE5"],
  "red": ["danger", "#ECE2D0"], "green": ["success", "#CCDDB7"], "yellow": ["warning", "#ffffff"],
  "grey": ["secondary", "#ffffff"], "light-blue": ["info", "#F6E8EA"]
}