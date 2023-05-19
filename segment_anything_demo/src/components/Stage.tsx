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
import { modelInputProps, TopbarProps, Label } from "./helpers/Interfaces";
import AppContext from "./hooks/createContext";

const Stage = ({ loadImage }: TopbarProps) => {
  const {
    labelClass: [, setLabelClass],
    zoom: [zoom, setZoom],
    clicks: [clicks, setClicks],
  } = useContext(AppContext)!;


  const handleKeyPress = _.throttle((e: any) => {
    if (e.key >= '0' && e.key <= '6') {
      // Perform desired actions for number key press
      console.log('Number key pressed:', e.key);
      setLabelClass(parseInt(e.key));
      const newClicks = clicks
      setClicks(newClicks);
    }
  }, 15)

  // add global event listener for keypress when Stage mounted and remove when unmounted.
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const flexCenterClasses = "flex items-center justify-center";
  return (
    <div className={`w-full h-full`} >
      <Topbar loadImage={loadImage} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          <Canvas />
        </div>
        <Sidebar />
      </div>

    </div >
  );
};

export default Stage;
