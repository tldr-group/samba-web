// Not entirely sure I need this file anymore - could just be part of app really.
import React, { useContext } from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas"
import AppContext from "./hooks/createContext";
import { DragDropProps, StageProps } from "./helpers/Interfaces";
import { imageDataToImage, getSplitInds, getXYfromI, getIfromXY } from "./helpers/canvasUtils";

const UTIF = require("./UTIF.js")

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

const Stage = ({ loadImages, requestEmbedding, trainClassifier, changeToImage, saveSeg, saveClassifier }: StageProps) => {
  const {
    image: [image,],
    imgType: [, setImgType],
    largeImg: [, setLargeImg]
  } = useContext(AppContext)!;
  const flexCenterClasses = "flex items-center justify-center";

  const loadTIFF = (result: ArrayBuffer) => {
    const tifs = UTIF.decode(result);
    const hrefs: Array<string> = [];
    for (let tif of tifs) {
      UTIF.decodeImage(result, tif);
      const imgDataArr = new Uint8ClampedArray(UTIF.toRGBA8(tif));
      const imgData = new ImageData(imgDataArr, tif.width, tif.height);
      hrefs.push(imageDataToImage(imgData).src);
    }
    const isSmall = (tifs[0].width < 1024 && tifs[0].height < 1024)
    if (tifs.length > 1 && isSmall) {
      loadImages(hrefs);
      setImgType("stack");
    } else if (tifs.length == 1 && isSmall) {
      loadImages(hrefs);
      setImgType("single");
    } else if (!isSmall) {
      const img = new Image();
      img.src = hrefs[0];
      img.onload = () => {
        loadLargeImage(img);
        setImgType("large");
      }
    }
  }

  const loadPNGJPEG = (href: string) => {
    const img = new Image();
    img.src = href;
    img.onload = () => {
      if (img.width > 1024 || img.height > 1024) {
        loadLargeImage(img); //load large image
        setImgType("large");
      }
      else {
        loadImages([href]);
        setImgType("single");
      }
    }
  }

  const loadLargeImage = (img: HTMLImageElement) => {
    const hrefs: string[] = [];
    const inds = getSplitInds(img);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) { return; }
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const [widths, heights] = [inds.w, inds.h];
    // need to add the ends of the image
    widths.push(img.width);
    heights.push(img.height);
    for (let y = 0; y < heights.length - 1; y++) {
      const [h0, h1] = [heights[y], heights[y + 1]];
      for (let x = 0; x < widths.length - 1; x++) {
        const [w0, w1] = [widths[x], widths[x + 1]];
        const imgData = ctx.getImageData(w0, h0, w1 - w0, h1 - h0);
        const cropImg = imageDataToImage(imgData);
        hrefs.push(cropImg.src);
      }
    }
    console.log(hrefs.length, widths, heights);
    loadImages(hrefs);
    setLargeImg(img);
  }


  return (
    <div className={`w-full h-full`} >
      <Topbar loadTIFF={loadTIFF} loadPNGJPEG={loadPNGJPEG} saveSeg={saveSeg} saveClassifier={saveClassifier} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          {!image && <DragDrop loadTIFF={loadTIFF} loadPNGJPEG={loadPNGJPEG} />}
          {image && <Canvas />}
        </div>
        <Sidebar requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} changeToImage={changeToImage} />
      </div>
      <ErrorMessage />
    </div >
  );
};

const ErrorMessage = () => {
  const {
    errorObject: [errorObject, setErrorObject]
  } = useContext(AppContext)!;


  const handleClose = () => { setErrorObject({ msg: "", stackTrace: "" }) };

  return (
    <>
      <Modal show={errorObject.msg !== ""} onHide={handleClose}>
        <Modal.Header style={{ backgroundColor: '#eb4034', color: '#ffffff' }} closeVariant="white" closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>{errorObject.msg}</Modal.Body>
        <Modal.Body>
          <Accordion defaultActiveKey="0">
            <Accordion.Item eventKey="1">
              <Accordion.Header>Stack trace</Accordion.Header>
              <Accordion.Body>
                {errorObject.stackTrace}
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={handleClose}>
            Understood!
          </Button>
        </Modal.Footer>
      </Modal >
    </>
  );
}


const DragDrop = ({ loadTIFF, loadPNGJPEG }: DragDropProps) => {
  return (
    <div style={{
      height: '800px', width: '800px', outline: '10px dashed #b5bab6', color: '#b5bab6',
      fontSize: '2em', display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}> <span>Drag image file(s) or </span> <a href='foo'> load default micrograph</a>
    </div>
  )
}

export default Stage;
