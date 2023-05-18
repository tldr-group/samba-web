// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import React, { useState } from "react";
import { modelInputProps } from "../helpers/Interfaces";
import AppContext from "./createContext";

const AppContextProvider = (props: {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
}) => {
  const [clicks, setClicks] = useState<Array<modelInputProps> | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
  const [maskIdx, setMaskIdx] = useState<number>(1);
  const [maskClass, setMaskClass] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);

  return (
    <AppContext.Provider
      value={{
        clicks: [clicks, setClicks],
        image: [image, setImage],
        maskImg: [maskImg, setMaskImg],
        maskIdx: [maskIdx, setMaskIdx],
        maskClass: [maskClass, setMaskClass],
        zoom: [zoom, setZoom],
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
