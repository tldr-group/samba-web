// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import React, { useState } from "react";
import { modelInputProps, Label, Offset } from "../helpers/Interfaces";
import AppContext from "./createContext";

const AppContextProvider = (props: {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
}) => {
  const [clicks, setClicks] = useState<Array<modelInputProps> | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imgIdx, setImgIdx] = useState<number>(0);
  const [labelArr, setLabelArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));
  const [segArr, setSegArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));

  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);

  const [maskIdx, setMaskIdx] = useState<number>(1);
  const [labelClass, setLabelClass] = useState<number>(1);
  const [labelType, setLabelType] = useState<Label>("Brush");

  const [brushWidth, setBrushWidth] = useState<number>(1);

  const [overlayType, setOverlayType] = useState<"Segmentation" | "Label">("Segmentation")
  const [labelOpacity, setLabelOpacity] = useState<number>(0.6 * 255);
  const [segOpacity, setSegOpacity] = useState<number>(0.9 * 255);
  const [cameraOffset, setCameraOffset] = useState<Offset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [processing, setProcessing] = useState<"None" | "Encoding" | "Segmenting">("None")

  return (
    <AppContext.Provider
      value={{
        clicks: [clicks, setClicks],
        image: [image, setImage],
        imgIdx: [imgIdx, setImgIdx],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr, setSegArr],
        maskImg: [maskImg, setMaskImg],
        maskIdx: [maskIdx, setMaskIdx],
        labelClass: [labelClass, setLabelClass],
        labelType: [labelType, setLabelType],
        brushWidth: [brushWidth, setBrushWidth],
        overlayType: [overlayType, setOverlayType],
        labelOpacity: [labelOpacity, setLabelOpacity],
        segOpacity: [segOpacity, setSegOpacity],
        cameraOffset: [cameraOffset, setCameraOffset],
        zoom: [zoom, setZoom],
        processing: [processing, setProcessing]
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
