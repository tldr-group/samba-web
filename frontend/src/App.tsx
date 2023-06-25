/* Heavily adapted from Meta AI's segment anything demo, i.e SAM model interface kept and the rest
thrown away.

App is the entrypoint for the client. It holds the user-uploaded images, their associated labels
and the backend generated SAM embeddings and segmentations. It contains the functions that
interact with the backend API and the code to run the ONNX quantised lightweight decoder head
of the SAM model (with the image encoding part run on the backed.).
*/

import { InferenceSession, Tensor } from "onnxruntime-web";
import React, { useContext, useEffect, useRef, useState } from "react";
import "./assets/scss/App.scss";
import 'bootstrap/dist/css/bootstrap.min.css';
import { handleImageScale } from "./components/helpers/scaleHelper";
import { modelScaleProps, getHTTPRequest } from "./components/helpers/Interfaces";
import { onnxMaskToImage, imageDataToImage } from "./components/helpers/canvasUtils";
import { modelData } from "./components/helpers/onnxModelAPI";
import Stage from "./components/Stage";
import AppContext from "./components/hooks/createContext";
const ort = require("onnxruntime-web");
/* @ts-ignore */
import npyjs from "npyjs";
import { size } from "underscore";


const MODEL_DIR = "/model/sam_onnx_quantized_example.onnx";
const DEFAULT_IMAGE = "/assets/data/default_image.png"
const DEFAULT_EMBEDDING = "/assets/data/default_encoding.npy"

// URLS of our API endpoints - change when live
//const PATH = "https://samba-web-demo.azurewebsites.net"
const PATH = "http://127.0.0.1:5000"
const INIT_ENDPOINT = PATH + "/init"
const ENCODE_ENDPOINT = PATH + "/encoding"
const FEATURISE_ENDPOINT = PATH + "/featurising"
const SEGMENT_ENDPOINT = PATH + "/segmenting"
const APPLY_ENDPOINT = PATH + "/applying"
const SAVE_ENDPOINT = PATH + "/saving"
const CLASSIFIER_ENDPOINT = PATH + "/classifier"
const LOAD_CLASSIFIER_ENDPOINT = PATH + "/lclassifier"
const SAVE_LABEL_ENDPOINT = PATH + "/slabel"

const getb64Image = (img: HTMLImageElement): string => {
  // Convert HTML Image to b64 string encoding by drawing onto canvas. Used for sending over HTTP
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.width
  tempCanvas.height = img.height
  const ctx = tempCanvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, img.width, img.height)
  const b64image = tempCanvas.toDataURL("image/jpeg")
  return b64image
}


const updateArr = (oldArr: Array<any>, idx: number, setVal: any) => {
  // React is functional - we don't mutate the state of our states but instead replace with fresh copy
  const newArr = oldArr.map((v, i) => (i === idx) ? setVal : v);
  return newArr;
};

const appendToArr = (oldArr: Array<any>, toAdd: Array<any>) => {
  return oldArr.concat(toAdd)
}


const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * max);
}

const getUID = () => {
  // 'Unique' session identifier for a client: UNIX timestamp + 5 digit random code. Odds of collision negligible.
  const maxes = [9, 9, 9, 9, 9]
  const id = maxes.map((v, i) => String(getRandomInt(v)))
  return String(Date.now()) + id.join('')
}

const UID = getUID()

const App = () => {
  const {
    clicks: [clicks],
    imgType: [imgType,],
    imgIdx: [imgIdx,],
    largeImg: [largeImg,],
    imgArrs: [imgArrs, setImgArrs],
    segArrs: [segArrs, setSegArrs],
    labelArrs: [labelArrs, setLabelArrs],
    tensorArrs: [tensorArrs, setTensorArrs],
    image: [image, setImage],
    labelArr: [labelArr, setLabelArr],
    segArr: [segArr, setSegArr],
    maskImg: [, setMaskImg],
    maskIdx: [maskIdx],
    labelType: [, setLabelType],
    labelClass: [labelClass],
    features: [features,],
    processing: [, setProcessing],
    errorObject: [errorObject, setErrorObject],
    showToast: [, setShowToast],
    modalShow: [, setModalShow],
    settings: [settings,],
  } = useContext(AppContext)!;

  const [model, setModel] = useState<InferenceSession | null>(null); // ONNX model
  const [tensor, setTensor] = useState<Tensor | null>(null); // Image embedding tensor

  // The ONNX model expects the input to be rescaled to 1024. 
  // The modelScale state variable keeps track of the scale values.
  const [modelScale, setModelScale] = useState<modelScaleProps | null>(null);

  const [segmentFlag, setSegmentFlag] = useState<boolean>(false)
  const [featureFlag, setFeatureFlag] = useState<boolean>(false)
  const [applyFlag, setApplyFlag] = useState<boolean>(false)

  useEffect(() => {
    // Initialize the ONNX model on load
    const initModel = async () => {
      try {
        if (MODEL_DIR === undefined) return;
        const URL: string = MODEL_DIR;
        const model = await InferenceSession.create(URL);
        setModel(model);
      } catch (e) {
        const error = e as Error
        setErrorObject({ msg: "Failed to initialise model", stackTrace: error.toString() })
        console.log(e);
      }
    };
    initModel();
    initBackend();
    const showHelp = localStorage.getItem("showHelp")
    if (showHelp === null || showHelp === "true") {
      setModalShow({ welcome: true, settings: false, features: false })
    }
  }, []);

  const initBackend = async () => {
    try {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json;charset=utf-8');
      await fetch(INIT_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "id": UID }) });
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to connect to backend.", stackTrace: error.toString() });
    }
  }

  const loadImages = async (hrefs: string[]) => {
    /* Start by initing the empty arrs for the imgs, labels, segs and tensors. Then, for each
    href, init a new image, fill it with href, create new label and seg arr. Append the imgs,
    segs, labels and tensors. For the very first image, make the current seg and label arrays
    of the right shape and fill with 0. For the last image, update the global arrays. This will
    trigger a listener event. */
    try {
      const imgs: Array<HTMLImageElement> = [];
      const nullLabels: Array<Uint8ClampedArray> = [];
      const nullSegs: Array<Uint8ClampedArray> = [];
      const nullTensors: Array<any | null> = [];
      for (let i = 0; i < hrefs.length; i++) {
        const href = hrefs[i]
        const img = new Image();
        img.src = href;
        img.onload = () => {
          const { height, width, samScale } = handleImageScale(img);
          img.width = width;
          img.height = height;
          const tempLabelArr = new Uint8ClampedArray(width * height).fill(0);
          const tempSegArr = new Uint8ClampedArray(width * height).fill(0);
          imgs.push(img);
          nullLabels.push(tempLabelArr);
          nullSegs.push(tempSegArr);
          nullTensors.push(null);
          if (i === 0) { // for very first arr, init these to be empty but the right shape
            setSegArr(tempSegArr);
            setLabelArr(tempLabelArr);
          }
          // Set the arrays once only when very last image is loaded
          if (i === hrefs.length - 1) {
            updateAllArrs(imgs, nullLabels, nullSegs, nullTensors)
          }
        };
      }
    } catch (e) {
      const error = e as Error
      setErrorObject({ msg: "Failed to load images from href", stackTrace: error.toString() })
      console.log(e);
    }
  };

  const updateAllArrs = (imgs: Array<HTMLImageElement>, labels: Array<Uint8ClampedArray>,
    segs: Array<Uint8ClampedArray>, tensors: Array<any>) => {
    if (imgArrs.length > 0) {
      const isStack = (imgType === "stack")
      const sizeMatches = (imgs[0].width === imgArrs[0].width && imgs[0].height === imgArrs[0].height)
      if (isStack && !sizeMatches) {
        setErrorObject({ msg: "Size of two stacks don't match!", stackTrace: "" })
        return
      }
    }
    const newImgs = appendToArr(imgArrs, imgs)
    setImgArrs(newImgs);
    const newLabels = appendToArr(labelArrs, labels)
    setLabelArrs(newLabels);
    const newSegArrs = appendToArr(segArrs, segs)
    setSegArrs(newSegArrs);
    const newTensors = appendToArr(tensorArrs, tensors)
    setTensorArrs(newTensors);
    requestFeatures(imgs)
  }

  const changeToImage = (oldIdx: number, newIdx: number) => {
    // Update arrs with arrs of old image, then switch to new one.
    const newLabelArrs = updateArr(labelArrs, oldIdx, labelArr)
    const newSegArrs = updateArr(segArrs, oldIdx, segArr)
    const newTensorArrs = updateArr(tensorArrs, oldIdx, tensor)
    setLabelArrs(newLabelArrs)
    setSegArrs(newSegArrs)
    setTensorArrs(newTensorArrs)

    // Set samScale of model for new image
    const img = imgArrs[newIdx]
    const { height, width, samScale } = handleImageScale(img);
    setModelScale({
      height: height,
      width: width,
      samScale: samScale,
    });
    img.width = width;
    img.height = height;
    setImage(img);
    setLabelArr(newLabelArrs[newIdx]);
    setSegArr(newSegArrs[newIdx]);
    setTensor(newTensorArrs[newIdx])
  }

  const loadDefault = async () => {
    const url = new URL(DEFAULT_IMAGE, location.origin);
    await loadImages([url.href]);
    let npLoader = new npyjs();
    const npArray = await npLoader.load(DEFAULT_EMBEDDING);
    const tensor = new ort.Tensor("float32", npArray.data, npArray.shape);
    setTensor(tensor);
    setLabelType('Smart Labelling');
  }

  const requestFeatures = async (imgs: Array<HTMLImageElement>) => {
    const b64images: string[] = imgs.map((img, i) => getb64Image(img));
    const headers = new Headers();
    headers.append('Content-Type', 'application/json;charset=utf-8');
    console.log("Started Featurising");
    try {
      await fetch(FEATURISE_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "images": b64images, "id": UID, "features": features }) });
      console.log("Finished Featurising");
      //const segFeat = { feature: true, segment: segmentFeature.segment }
      //setSegmentFeature(segFeat)
      setFeatureFlag(true)
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to featurise.", stackTrace: error.toString() });
    }
  }

  const requestEmbedding = async () => {
    // Ping our encode enpoint, request and await an embedding, then set it.
    if (tensor != null || image === null) { // Early return if we already have one
      return;
    }
    console.log(UID)
    setProcessing("Encoding")
    const b64image = getb64Image(image);
    let npLoader = new npyjs();
    const headers = new Headers();
    headers.append('Content-Type', 'application/json;charset=utf-8');
    // this works and I am so smart - basically took the parsing code that npyjs uses behind the scenes for files and applied it to my server (which returns a file in the right format)
    try {
      const resp = await fetch(ENCODE_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "message": b64image, "id": UID, "img_idx": imgIdx }) })
      const arrayBuf = await resp.arrayBuffer();
      const result = await npLoader.parse(arrayBuf);
      const embedding = new ort.Tensor("float32", result.data, result.shape);
      setTensor(embedding);
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to encode image.", stackTrace: error.toString() });
      setLabelType("Brush")
    }
    setProcessing("None");
    return
  };

  const checkToSegment = (featFlag: boolean, segFlag: boolean, appFlag: boolean) => {
    if (featFlag == true && segFlag == true) {
      trainClassifier()
    } else if (featFlag == true && appFlag == true) {
      trainClassifier(true)
    }
  }

  const trainPressed = () => {
    if (image == null || labelArr == null) { return }

    if (segmentFlag === true) {
      checkToSegment(featureFlag, true, false)
    } else {
      setSegmentFlag(true)
    }
    setProcessing("Segmenting");
  }

  const applyPressed = () => {
    if (image == null) { return }
    if (applyFlag === true) {
      checkToSegment(featureFlag, false, true)
    } else {
      setApplyFlag(true)
    }
    setProcessing("Applying");
  }

  const trainClassifier = async (apply: boolean = false) => {
    // Ping our segment endpoint, send it our image and labels then await the array.
    if (image === null) {
      return;
    }
    const b64images: string[] = imgArrs.map((img, i) => getb64Image(img));
    const headers = new Headers();
    headers.append('Content-Type', 'application/json;charset=utf-8');
    console.log("Started Segementing");
    let [largeW, largeH]: Array<number> = [0, 0];
    if (imgType === "large" && largeImg !== null) {
      largeW = largeImg.width;
      largeH = largeImg.height;
    }

    let msg
    let ENDPOINT: string
    if (apply == false && labelArr != null) {
      const newLabelArrs = updateArr(labelArrs, imgIdx, labelArr);
      setLabelArrs(newLabelArrs);
      msg = {
        "images": b64images, "labels": newLabelArrs, "id": UID, "save_mode": imgType,
        "large_w": largeW, "large_h": largeH, "n_points": settings.nPoints,
        "train_all": settings.trainAll, "rescale": settings.rescale
      };
      ENDPOINT = SEGMENT_ENDPOINT;
    } else {
      msg = {
        "images": b64images, "id": UID, "save_mode": imgType,
        "large_w": largeW, "large_h": largeH, "n_points": settings.nPoints,
        "train_all": settings.trainAll, "rescale": settings.rescale
      };
      ENDPOINT = APPLY_ENDPOINT;
    }

    try {
      let resp = await fetch(ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify(msg) })
      const buffer = await resp.arrayBuffer();
      loadSegmentationsFromHTTP(buffer);
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to segment.", stackTrace: error.toString() });
    }
    if (apply === false) {
      setSegmentFlag(false)
    } else {
      setApplyFlag(false)
    }
    setProcessing("None");
    setShowToast(true);
  }

  const loadSegmentationsFromHTTP = (buffer: ArrayBuffer) => {
    /*The arr we recieve from segment endpoint is *every* segmentation in flat byte list. Here we loop
    over each byte in the arraybuffer and use a second loop variable that keeps track of where we are
    inside of the current image.*/
    const dataView = new DataView(buffer);
    const arrayLength = buffer.byteLength;

    let newSegArrs: Array<Uint8ClampedArray> = []
    let [idx, j, limit]: number[] = [1, 0, imgArrs[0].width * imgArrs[0].height]
    let tempArr = new Uint8ClampedArray(limit).fill(0);

    for (let i = 0; i < arrayLength; i++) {
      if (j == limit) {
        j = 0
        newSegArrs.push(tempArr)
        if (idx < imgArrs.length) {
          limit = imgArrs[idx].width * imgArrs[idx].height
          tempArr = new Uint8ClampedArray(limit).fill(0);
          idx += 1
        }
      }
      tempArr[j] = dataView.getUint8(i);
      j += 1
    }
    newSegArrs.push(tempArr); //needed for the last one where j < limit
    setSegArrs(newSegArrs);
    console.log("Finished segmenting");
  }

  const saveArrAsTIFF = async (ENDPOINT: string, body_text: any, fname: string) => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json;charset=utf-8');
    try {
      let resp = await fetch(ENDPOINT, { method: 'POST', headers: headers, body: body_text })
      const buffer = await resp.arrayBuffer();
      const a = document.createElement("a")
      a.download = fname
      const file = new Blob([buffer], { type: "image/tiff" });
      a.href = URL.createObjectURL(file);
      a.click()
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to dowload TIFF.", stackTrace: error.toString() });
    }
  }

  const onSaveClick = async () => {
    if (image === null || segArr === null) { return; }
    saveArrAsTIFF(SAVE_ENDPOINT, JSON.stringify({ "id": UID, "rescale": settings.rescale }), "seg.tiff")
  }

  const saveLabels = async () => {
    if (image === null || labelArr === null) { return; }
    const newLabelArrs = updateArr(labelArrs, imgIdx, labelArr);
    setLabelArrs(newLabelArrs);
    const b64images: string[] = imgArrs.map((img, i) => getb64Image(img));
    let [largeW, largeH]: Array<number> = [0, 0]
    if (imgType === "large" && largeImg !== null) {
      largeW = largeImg.width
      largeH = largeImg.height
    }
    const dict = {
      "images": b64images, "labels": newLabelArrs, "id": UID, "save_mode": imgType,
      "large_w": largeW, "large_h": largeH, "rescale": settings.rescale
    }
    const msg = JSON.stringify(dict)
    saveArrAsTIFF(SAVE_LABEL_ENDPOINT, msg, "label.tiff")
  }

  const saveClassifier = async () => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json;charset=utf-8');
    try {
      let resp = await fetch(CLASSIFIER_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "id": UID, "format": settings.format }) })
      const buffer = await resp.arrayBuffer();
      const a = document.createElement("a")
      a.download = "classifier" + settings.format
      const file = new Blob([buffer], { type: "application/octet-stream" });
      a.href = URL.createObjectURL(file);
      a.click()
    } catch (e) {
      const error = e as Error;
      setErrorObject({ msg: "Failed to dowload classifier.", stackTrace: error.toString() });
    }
  }

  const loadClassifier = async (file: File) => {
    const headers = new Headers();
    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isSkops = (extension == "skops");
    reader.readAsDataURL(file)

    reader.onload = () => {
      console.log("loading classifier")
      if (isSkops) {
        headers.append('Content-Type', 'application/json;charset=utf-8');
        try {
          const b64 = reader.result
          let resp = fetch(LOAD_CLASSIFIER_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "id": UID, "bytes": b64 }) });
        } catch (error: any) {
          setErrorObject({ msg: "Failed to load classifier", stackTrace: error.message as string });
        }
      } else {
        setErrorObject({ msg: "Must load a .skops file for classifier.", stackTrace: ".pkl files are insecure and so won't be loaded serverside" });
        return
      }
    }

  }

  // Run the ONNX model every time clicks state changes - updated in Canvas
  useEffect(() => {
    runONNX();
  }, [clicks]);

  const runONNX = async () => {
    try {
      if (
        model === null ||
        clicks === null ||
        tensor === null ||
        modelScale === null
      )
        return;
      else {
        // Preapre the model input in the correct format for SAM. 
        const feeds = modelData({
          clicks,
          tensor,
          modelScale,
        });

        if (feeds === undefined) return;
        // Run the SAM ONNX model with the feeds returned from modelData()
        const results = await model.run(feeds);
        const output = results[model.outputNames[0]];
        /* The predicted mask returned from the ONNX model is an array which is 
         rendered as an HTML image using onnxMaskToImage() from canvasUtils.tsx. We also feed
         in the index of the mask we want to look it, the current labelling class and current label array. */
        setMaskImg(onnxMaskToImage(output.data, output.dims[2], output.dims[3], maskIdx, labelClass, labelArr));
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Called once when stack/image loaded
  useEffect(() => {
    if (imgArrs.length === 0) { return; }
    changeToImage(0, 0);
  }, [imgArrs])

  useEffect(() => {
    if (segArrs.length === 0) { return; }
    setSegArr(segArrs[imgIdx]);
  }, [segArrs])

  useEffect(() => {
    checkToSegment(featureFlag, segmentFlag, applyFlag)
  }, [segmentFlag, featureFlag, applyFlag])

  return <Stage
    loadImages={loadImages}
    loadDefault={loadDefault}
    requestEmbedding={requestEmbedding}
    trainClassifier={trainPressed}
    applyClassifier={applyPressed}
    changeToImage={changeToImage}
    saveSeg={onSaveClick}
    saveLabels={saveLabels}
    saveClassifier={saveClassifier}
    loadClassifier={loadClassifier}
  />;
};

export default App;
