// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

import { InferenceSession, Tensor } from "onnxruntime-web";
import React, { useContext, useEffect, useState } from "react";
import "./assets/scss/App.scss";
import 'bootstrap/dist/css/bootstrap.min.css';
import { handleImageScale } from "./components/helpers/scaleHelper";
import { modelScaleProps, getHTTPRequest } from "./components/helpers/Interfaces";
import { onnxMaskToImage, imageDataToImage } from "./components/helpers/maskUtils";
import { modelData } from "./components/helpers/onnxModelAPI";
import Stage from "./components/Stage";
import AppContext from "./components/hooks/createContext";
const ort = require("onnxruntime-web");
/* @ts-ignore */
import npyjs from "npyjs";
import { List } from "underscore";

// Define image, embedding and model paths
//const IMAGE_PATH = "/assets/data/dogs.jpg";
const IMAGE_EMBEDDING = "/assets/data/dogs_embedding.npy";
const MODEL_DIR = "/model/sam_onnx_quantized_example.onnx";

const ENCODE_ENDPOINT = "http://127.0.0.1:5000/encoding"
const SEGMENT_ENDPOINT = "http://127.0.0.1:5000/segmenting"

const getb64Image = (img: HTMLImageElement): string => {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.width
  tempCanvas.height = img.height
  const ctx = tempCanvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, img.width, img.height)
  const b64image = tempCanvas.toDataURL("image/jpeg")
  return b64image
}

const App = () => {
  const {
    clicks: [clicks],
    image: [image, setImage],
    labelArr: [labelArr, setLabelArr],
    segArr: [, setSegArr],
    maskImg: [, setMaskImg],
    maskIdx: [maskIdx],
    labelClass: [labelClass],
    zoom: [zoom]
  } = useContext(AppContext)!;
  const [model, setModel] = useState<InferenceSession | null>(null); // ONNX model
  const [tensor, setTensor] = useState<Tensor | null>(null); // Image embedding tensor
  // maybe I want label and segs arrays (0-6) as states that when updated uodate their respective canvases. will let you check against it when getting sam mask
  // a decoupling of data and canvas representations could be useful for image as well 
  // update labelData by looping through every pixel in the animated canvas != 0 & set to currentClass! 

  // The ONNX model expects the input to be rescaled to 1024. 
  // The modelScale state variable keeps track of the scale values.
  const [modelScale, setModelScale] = useState<modelScaleProps | null>(null);

  // Initialize the ONNX model. load the image, and load the SAM
  // pre-computed image embedding
  useEffect(() => {
    // Initialize the ONNX model
    const initModel = async () => {
      try {
        if (MODEL_DIR === undefined) return;
        const URL: string = MODEL_DIR;
        const model = await InferenceSession.create(URL);
        setModel(model);
      } catch (e) {
        console.log(e);
      }
    };
    initModel();

    // Load the image
    //const url = new URL(IMAGE_PATH, location.origin);
    //loadImageURL(url);

    // Load the Segment Anything pre-computed embedding
    /*
    Promise.resolve(loadNpyTensor(IMAGE_EMBEDDING, "float32")).then(
      (embedding) => setTensor(embedding)
    );
    */
  }, []);

  const loadImageURL = async (url: URL) => {
    loadImage(url.href)
  }

  const loadImage = async (href: string) => {
    try {
      const img = new Image();
      img.src = href;
      img.onload = () => {
        const { height, width, samScale } = handleImageScale(img);
        setModelScale({
          height: height,  // original image height
          width: width,  // original image width
          samScale: samScale, // scaling factor for image which has been resized to longest side 1024
        });
        img.width = width;
        img.height = height;
        setImage(img);
        setLabelArr(new Uint8ClampedArray(width * height).fill(0));
        setSegArr(new Uint8ClampedArray(width * height).fill(0));
      };
    } catch (error) {
      console.log(error);
    }
  };

  const requestEmbedding = async () => {
    // early return if we already have one
    if (tensor != null || image === null) {
      return;
    }
    const b64image = getb64Image(image)
    let npLoader = new npyjs();
    const headers = new Headers()
    headers.append('Content-Type', 'application/json;charset=utf-8')
    // this works and I am so smart - basically took the parsing code that npyjs uses behind the scenes for files and applied it to my server (which returs in the right format)
    const resp = await fetch(ENCODE_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "message": b64image }) })
    const arrayBuf = await resp.arrayBuffer();
    const result = await npLoader.parse(arrayBuf);
    const embedding = new ort.Tensor("float32", result.data, result.shape);
    setTensor(embedding)
  };

  const trainClassifier = async () => {
    if (image === null || labelArr === null) {
      return;
    }
    const b64image = getb64Image(image)
    const headers = new Headers()
    headers.append('Content-Type', 'application/json;charset=utf-8')
    console.log("Started Segementing")
    let resp = await fetch(SEGMENT_ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "image": b64image, "labels": labelArr }) })
    const buffer = await resp.arrayBuffer();
    const dataView = new DataView(buffer);
    const arrayLength = buffer.byteLength;
    const arr = new Uint8ClampedArray(image.width * image.height).fill(0);
    for (let i = 0; i < arrayLength; i++) {
      arr[i] = dataView.getUint8(i);
    }

    /*
    const json = await resp.json()
    const seg = json["message"]
    const arr = new Uint8ClampedArray(image.width * image.height).fill(1)
    console.log(seg.length)
    let i = 0
    // this is really slow
    /*
    for (let r = 0; r < seg.length; i++) {
      const column = seg[r]
      for (let c = 0; c < column.length; c++) {
        arr[i] = column[c] as unknown as number;
        i++;
      };
    };
    */
    console.log("Finished segmenting")
    //console.log(seg)
    setSegArr(arr)
  }

  // Decode a Numpy file into a tensor. 
  const loadNpyTensor = async (tensorFile: string, dType: string) => {
    let npLoader = new npyjs();
    const npArray = await npLoader.load(tensorFile);
    const tensor = new ort.Tensor(dType, npArray.data, npArray.shape);
    return tensor;
  };

  // Run the ONNX model every time clicks has changed i.e monitors state of clicks - useful for zooming!
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
        // The modelData function is from onnxModelAPI.tsx.
        const feeds = modelData({
          clicks,
          tensor,
          modelScale,
        });

        if (feeds === undefined) return;
        // Run the SAM ONNX model with the feeds returned from modelData()
        const results = await model.run(feeds);
        // outputNames = ['masks', 'iou', 'low res']
        const output = results[model.outputNames[0]];
        // output dims are [1, 4, 603, 1072] ?= [b, n_masks, h, w] 
        // The predicted mask returned from the ONNX model is an array which is 
        // rendered as an HTML image using onnxMaskToImage() from maskUtils.tsx.
        setMaskImg(onnxMaskToImage(output.data, output.dims[2], output.dims[3], maskIdx, labelClass, zoom));
      }
    } catch (e) {
      console.log(e);
    }
  };

  return <Stage loadImage={loadImage} requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} />;
};

export default App;
