// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import React, { useContext, useEffect, useRef } from "react";
import * as _ from "underscore";
import Tool from "./Tool";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas"
import { modelInputProps, TopbarProps, Label, StageProps } from "./helpers/Interfaces";
import AppContext from "./hooks/createContext";

const Stage = ({ loadImage, requestEmbedding, trainClassifier }: StageProps) => {
  const {
    labelClass: [, setLabelClass],
  } = useContext(AppContext)!;


  const flexCenterClasses = "flex items-center justify-center";
  return (
    <div className={`w-full h-full`} >
      <Topbar loadImage={loadImage} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          <Canvas />
        </div>
        <Sidebar requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} />
      </div>

    </div >
  );
};

export default Stage;
