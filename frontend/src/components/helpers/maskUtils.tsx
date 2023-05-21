// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.

export function rgbaToHex(r: number, g: number, b: number, a: number) {
  // from user 'Sotos' https://stackoverflow.com/questions/49974145/how-to-convert-rgba-to-hex-color-code-using-javascript
  const red = r.toString(16).padStart(2, '0');
  const green = g.toString(16).padStart(2, '0');
  const blue = b.toString(16).padStart(2, '0');
  const alpha = Math.round(a).toString(16).padStart(2, '0');
  return `#${red}${green}${blue}${alpha}`;
}

export const colours: number[][] = [[255, 255, 255, 255], [31, 119, 180, 255], [255, 127, 14, 255], [44, 160, 44, 255], [214, 39, 40, 255], [148, 103, 189, 255], [140, 86, 75, 255]]

// Convert the onnx model mask prediction to ImageData
export function arrayToImageData(input: any, width: number, height: number, mask_idx: number, mask_colour: number): ImageData {
  const [r, g, b, a] = colours[mask_colour]; // the masks's blue color
  // flat array here that is reshaped implictly in ImageData
  const arr = new Uint8ClampedArray(4 * width * height).fill(0);
  /*The way this worked previously was that the first mask was the 'best' mask by (predicted) IoU, so they looped
  over *every* pixel in *all four* of the masks i.e i=0 => i=length of all 4 masks. They then wrote the value of
  the mask at i to the output array, and once they went passed the first arr the rest of the writes were overrange
  so didn't do anything. Mad. */
  const offset = mask_idx * width * height;
  for (let i = 0; i < width * height; i++) {

    // Threshold the onnx model mask prediction at 0.0
    // This is equivalent to thresholding the mask using predictor.model.mask_threshold
    // in python
    if (input[i + offset] > 0.0) {
      arr[4 * i + 0] = r;
      arr[4 * i + 1] = g;
      arr[4 * i + 2] = b;
      arr[4 * i + 3] = 0.4 * 255;
    }
  }
  // their tensor is the wrong way round 
  return new ImageData(arr, height, width);
}

function isPixelSet(p: number[]) { return (p[0] > 0 || p[1] > 0 || p[2] > 0) }

export function addImageDataToArray(imageData: ImageData, arr: Uint8ClampedArray, classVal: number): Uint8ClampedArray {
  const newArr = new Uint8ClampedArray(arr.length)
  const data = imageData.data
  console.log(data.length)
  console.log(arr.length)
  console.log(classVal)
  for (let i = 0; i < arr.length; i++) {
    // check if this pixel is set in the image and not set in the arr
    if (isPixelSet([data[4 * i], data[4 * i + 1], data[4 * i + 2]]) && arr[i] == 0) {
      newArr[i] = classVal
    } else {
      newArr[i] = arr[i]
    }
  }
  //newArr.fill(3)
  return newArr
}


// Use a Canvas element to produce an image from ImageData
export function imageDataToImage(imageData: ImageData, zoom: number) {
  const canvas = imageDataToCanvas(imageData, zoom);
  const image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

// Canvas elements can be created from ImageData
function imageDataToCanvas(imageData: ImageData, zoom: number) {
  // canvas created on demand?
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = zoom * imageData.width;
  canvas.height = zoom * imageData.height;
  // put image data in form: imageData, dx, dy, xoffset, yoffset, widthToDraw, heightToDraw
  ctx?.putImageData(imageData, 0, 0, 0, 0, canvas.width, canvas.height); //was putImageData
  return canvas;
}

// Convert the onnx model mask output to an HTMLImageElement
export function onnxMaskToImage(input: any, width: number, height: number, mask_idx: number, mask_colour: number, zoom: number) {
  return imageDataToImage(arrayToImageData(input, width, height, mask_idx, mask_colour), zoom);
}