// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import { Tensor } from "onnxruntime-web";

export type Label = "SAM" | "Poly" | "Brush" | "Erase"

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
  loadImage: (href: string) => void;
  requestEmbedding: () => void;
}

export interface TopbarProps {
  loadImage: (href: string) => void;
}

export interface SidebarProps {
  requestEmbedding: () => void;
}


export interface LabelFrameProps {
  icon_path: string;
}



export interface MultiCanvasProps {
  label: Label;
  class: number;
  labelOpacity: number;
  brushWidth: number;
}

export type Offset = { x: number, y: number }

export const sendHTTPRequest = (url: string, data: any) => {
  const http = new XMLHttpRequest()
  http.open("POST", url, true)
  http.setRequestHeader("Content-type", "application/json;charset=utf-8")
  http.onreadystatechange = () => {
    console.log('Return from ' + url)
    // early returns for errors
    if (http.readyState !== 4) { return }
    if (http.status !== 200) { return }
    let returnData = http.responseText
    console.log(returnData)
  }
  http.send(JSON.stringify({ "message": data }))
}