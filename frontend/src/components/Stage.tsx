// Not entirely sure I need this file anymore - could just be part of app really.
import React from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas"
import { StageProps } from "./helpers/Interfaces";

const Stage = ({ loadImages, requestEmbedding, trainClassifier, changeToImage, saveSeg }: StageProps) => {
  const flexCenterClasses = "flex items-center justify-center";
  return (
    <div className={`w-full h-full`} >
      <Topbar loadImages={loadImages} saveSeg={saveSeg} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          <Canvas />
        </div>
        <Sidebar requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} changeToImage={changeToImage} />
      </div>

    </div >
  );
};

export default Stage;
