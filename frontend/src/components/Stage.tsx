import React, { useContext } from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas"
import { BigModal, PostSegToast, ErrorMessage } from "./Modals"
import AppContext from "./hooks/createContext";
import { DragDropProps, StageProps } from "./helpers/Interfaces";
import { imageDataToImage, getSplitInds } from "./helpers/canvasUtils";


const UTIF = require("./UTIF.js")


const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 50 // 50MB


const Stage = ({ loadImages, loadDefault, requestEmbedding, trainClassifier, changeToImage, saveSeg, saveLabels, saveClassifier }: StageProps) => {
  const {
    image: [image,],
    imgType: [, setImgType],
    largeImg: [, setLargeImg],
    errorObject: [, setErrorObject]
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

  const loadFromFile = (file: File) => {
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isTIF = (extension === "tif" || extension === "tiff");
    const isPNGJPG = (extension === "png" || extension === "jpg" || extension === "jpeg");
    reader.onload = () => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorObject({ msg: `File size too large, please upload smaller image (<50MB).`, stackTrace: `File size ${file.size} > ${MAX_FILE_SIZE_BYTES}` });
        return
      }
      try {
        if (isTIF) {
          loadTIFF(reader.result as ArrayBuffer);
        } else if (isPNGJPG) {
          const href = reader.result as string;
          loadPNGJPEG(href);
        } else {
          throw `Unsupported file format .${extension}`;
        };
      }
      catch (e) {
        const error = e as Error;
        setErrorObject({ msg: "Failed to upload image - must be .tif, .tiff, .png or .jpg", stackTrace: error.toString() });
      }
    };
    if (isTIF) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsDataURL(file);
    };
  }


  return (
    <div className={`w-full h-full`} >
      <Topbar loadFromFile={loadFromFile} saveSeg={saveSeg} saveLabels={saveLabels} saveClassifier={saveClassifier} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          {!image && <DragDrop loadFromFile={loadFromFile} loadDefault={loadDefault} />}
          {image && <Canvas />}
        </div>
        <Sidebar requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} changeToImage={changeToImage} />
      </div>
      <ErrorMessage />
      <PostSegToast />
      <BigModal />
    </div >
  );
};


const DragDrop = ({ loadDefault, loadFromFile }: DragDropProps) => {
  const handleDrag = (e: any) => { e.preventDefault(); }
  const handeDrop = (e: any) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const item = e.dataTransfer.items[0]
      if (item.kind === "file") {
        const file = item.getAsFile();
        loadFromFile(file);
      };
    };
  };

  return (
    <div style={{
      height: '1024px', width: '1024px', outline: '10px dashed #b5bab6', color: '#b5bab6',
      fontSize: '2em', display: 'flex', justifyContent: 'center', alignItems: 'center',
      borderRadius: '10px'
    }}
      onDragOver={handleDrag}
      onDrop={handeDrop}
    >
      <span>Drag image file(s) or&nbsp; </span> <a style={{ cursor: "pointer", color: 'blue' }} onClick={loadDefault}> view example image</a>
    </div>
  )
}



export default Stage;
