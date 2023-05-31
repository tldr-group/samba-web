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
  // Multi-image states. TODO: add list of encoding tensors (Array<any | null>)
  const [largeImg, setLargeImg] = useState<HTMLImageElement | null>(null);
  const [imgType, setImgType] = useState<"large" | "stack" | "multi" | "single">("single");
  const [imgIdx, setImgIdx] = useState<number>(0);
  const [imgArrs, setImgArrs] = useState<Array<HTMLImageElement>>([]);
  const [labelArrs, setLabelArrs] = useState<Array<Uint8ClampedArray>>([]);
  const [segArrs, setSegArrs] = useState<Array<Uint8ClampedArray>>([]);
  const [tensorArrs, setTensorArrs] = useState<Array<any | null>>([]);

  // Current canvas states (i.e things corresponding to currently selected image)
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // this why not work - should be null
  const [labelArr, setLabelArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));
  const [segArr, setSegArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));

  // Labelling stuff
  const [clicks, setClicks] = useState<Array<modelInputProps> | null>(null);
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
  const [maskIdx, setMaskIdx] = useState<number>(1);
  const [labelClass, setLabelClass] = useState<number>(1);
  const [labelType, setLabelType] = useState<Label>("Brush");
  const [brushWidth, setBrushWidth] = useState<number>(1);

  // Canvas display stuff
  const [overlayType, setOverlayType] = useState<"Segmentation" | "Label">("Segmentation");
  const [labelOpacity, setLabelOpacity] = useState<number>(0.6 * 255);
  const [segOpacity, setSegOpacity] = useState<number>(0.9 * 255);
  const [cameraOffset, setCameraOffset] = useState<Offset>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [processing, setProcessing] = useState<"None" | "Encoding" | "Segmenting">("None");

  return (
    <AppContext.Provider
      value={{
        largeImg: [largeImg, setLargeImg],
        imgType: [imgType, setImgType],
        imgIdx: [imgIdx, setImgIdx],
        imgArrs: [imgArrs, setImgArrs],
        labelArrs: [labelArrs, setLabelArrs],
        segArrs: [segArrs, setSegArrs],
        tensorArrs: [tensorArrs, setTensorArrs],

        image: [image, setImage],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr, setSegArr],

        clicks: [clicks, setClicks],
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
