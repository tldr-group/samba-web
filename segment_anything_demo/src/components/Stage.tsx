// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import React, { useContext, useEffect } from "react";
import * as _ from "underscore";
import Tool from "./Tool";
import Topbar from "./Topbar"
import Sidebar from "./Sidebar"
import { modelInputProps } from "./helpers/Interfaces";
import AppContext from "./hooks/createContext";

const Stage = () => {
  const {
    clicks: [, setClicks],
    image: [image],
    maskIdx: [maskIdx, setMaskIdx],
    maskClass: [, setMaskClass],
  } = useContext(AppContext)!;
  // This is where mosue events are handled.
  const getClick = (x: number, y: number): modelInputProps => {
    const clickType = 1;
    return { x, y, clickType };
  };

  // Get mouse position and scale the (x, y) coordinates back to the natural
  // scale of the image. Update the state of clicks with setClicks to trigger
  // the ONNX model to run and generate a new mask via a useEffect in App.tsx
  const handleMouseMove = _.throttle((e: any) => {
    let el = e.nativeEvent.target;
    const rect = el.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    const imageScale = image ? image.width / el.offsetWidth : 1;
    x *= imageScale;
    y *= imageScale;
    const click = getClick(x, y);
    if (click) setClicks([click]);
  }, 15);

  // onContextMenu = right click. Need to assign it to the 
  const handleMouseClick = (e: any) => {
    e.preventDefault(); //stop menu popping up
    let click_type = e.button;
    if (click_type == 2) {
      const newMaskIdx = (maskIdx % 3) + 1
      setMaskIdx((newMaskIdx));
      console.log(newMaskIdx);
      handleMouseMove(e) // reload mask with new MaskIdx
    }
  };

  const handleKeyPress = _.throttle((e: any) => {
    if (e.key >= '0' && e.key <= '6') {
      // Perform desired actions for number key press
      console.log('Number key pressed:', e.key);
      setMaskClass(parseInt(e.key))
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
      <Topbar />
      <div className={`flex w-full h-full`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`} onContextMenu={handleMouseClick}>
          <Tool handleMouseMove={handleMouseMove} />
        </div>
        <Sidebar />
      </div>

    </div>
  );
};

export default Stage;
