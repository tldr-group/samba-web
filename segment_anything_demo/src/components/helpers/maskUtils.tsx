// Copyright (c) Meta Platforms, Inc. and affiliates.
// All rights reserved.

// This source code is licensed under the license found in the
// LICENSE file in the root directory of this source tree.
const colours: number[][] = [[255, 255, 255, 255], [31, 119, 180, 255], [255, 127, 14, 255], [44, 160, 44, 255], [214, 39, 40, 255], [148, 103, 189, 255], [140, 86, 75, 255]]

// Convert the onnx model mask prediction to ImageData
function arrayToImageData(input: any, width: number, height: number, mask_idx: number, mask_colour: number) {
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
      arr[4 * i + 3] = a;
    }
  }
  return new ImageData(arr, height, width);
}

// Use a Canvas element to produce an image from ImageData
function imageDataToImage(imageData: ImageData) {
  const canvas = imageDataToCanvas(imageData);
  const image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

// Canvas elements can be created from ImageData
function imageDataToCanvas(imageData: ImageData) {
  // canvas created on demand?
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx?.putImageData(imageData, 0, 0);
  return canvas;
}

// Convert the onnx model mask output to an HTMLImageElement
export function onnxMaskToImage(input: any, width: number, height: number, mask_idx: number, mask_colour: number) {
  return imageDataToImage(arrayToImageData(input, width, height, mask_idx, mask_colour));
}
