// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import React, { useState } from "react";
import { modelInputProps, Label } from "../helpers/Interfaces";
import AppContext from "./createContext";

const AppContextProvider = (props: {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
}) => {
  const [clicks, setClicks] = useState<Array<modelInputProps> | null>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);

  const [maskIdx, setMaskIdx] = useState<number>(1);
  const [labelClass, setLabelClass] = useState<number>(1);
  const [labelType, setLabelType] = useState<Label>("Brush");

  const [brushWidth, setBrushWidth] = useState<number>(1);

  const [labelOpacity, setLabelOpacity] = useState<number>(255);
  const [zoom, setZoom] = useState<number>(1);

  return (
    <AppContext.Provider
      value={{
        clicks: [clicks, setClicks],
        image: [image, setImage],
        maskImg: [maskImg, setMaskImg],
        maskIdx: [maskIdx, setMaskIdx],
        labelClass: [labelClass, setLabelClass],
        labelType: [labelType, setLabelType],
        brushWidth: [brushWidth, setBrushWidth],
        labelOpacity: [labelOpacity, setLabelOpacity],
        zoom: [zoom, setZoom],
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
