// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

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
  requestEmbedding: () => void;
  trainClassifier: () => void;
  changeToImage: (oldIdx: number, newIdx: number) => void;
  saveSeg: () => void;
  saveClassifier: () => void;
}

export interface TopbarProps {
  loadImages: (hrefs: string[]) => void;
  saveSeg: () => void;
  saveClassifier: () => void;
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