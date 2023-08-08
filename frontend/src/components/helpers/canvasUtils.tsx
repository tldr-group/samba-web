import { Offset } from "./Interfaces"
import { RefObject } from "react";

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
export function arrayToImageData(input: any, width: number, height: number,
  mask_idx: number, mask_colour: number | null = null, opacity: number = 0.4 * 255, refArr: Uint8ClampedArray | null = null): ImageData {

  // flat array here that is reshaped implictly in ImageData
  const arr = new Uint8ClampedArray(4 * width * height).fill(0);
  /*The way this worked previously was that the first mask was the 'best' mask by (predicted) IoU, so they looped
  over *every* pixel in *all four* of the masks i.e i=0 => i=length of all 4 masks. They then wrote the value of
  the mask at i to the output array, and once they went passed the first arr the rest of the writes were overrange
  so didn't do anything. */
  const offset = mask_idx * width * height;
  for (let i = 0; i < width * height; i++) {
    // Threshold the onnx model mask prediction at 0.0
    // This is equivalent to thresholding the mask using predictor.model.mask_threshold
    // in python
    const arrVal = input[i + offset]
    let valid: boolean = true
    if (refArr === null) {
      valid = (arrVal > 0.0)
    } else {
      valid = (arrVal > 0.0 && refArr[i] == 0)
    }

    if (valid) {
      let [r, g, b, a] = [0, 0, 0, 0]
      if (mask_colour == null) {
        [r, g, b, a] = colours[arrVal];
      } else {
        [r, g, b, a] = colours[mask_colour];
      }
      arr[4 * i + 0] = r;
      arr[4 * i + 1] = g;
      arr[4 * i + 2] = b;
      arr[4 * i + 3] = opacity;
    }
  }
  // their tensor is the wrong way round 
  return new ImageData(arr, height, width);
}

function isPixelSet(p: number[]) { return (p[0] > 0 || p[1] > 0 || p[2] > 0) }

export function addImageDataToArray(imageData: ImageData, arr: Uint8ClampedArray, classVal: number, erase: boolean = false): Uint8ClampedArray {
  /* Given some $imageData (i.e a new label from animated canvas) and an $arr, loop through the image data, find pixels that
  have been set and set the corresponding pixel in $arr with the $classVal. This assumes the label class the animated canvas
  was set with is the same label class we're labelling with, but they're set in the same place so this is always true. If
  we're erasing, set the erased pixels to 0 in the arr. */
  const newArr = new Uint8ClampedArray(arr.length);
  const data = imageData.data;
  for (let i = 0; i < arr.length; i++) {
    // check if this pixel is set in the image and not set in the arr
    if (isPixelSet([data[4 * i], data[4 * i + 1], data[4 * i + 2]]) && arr[i] == 0) {
      newArr[i] = classVal;
    } else if (erase && isPixelSet([data[4 * i], data[4 * i + 1], data[4 * i + 2]])) {
      newArr[i] = 0;
    } else {
      newArr[i] = arr[i];
    }
  }
  return newArr;
}

export function getCropImg(imgCtx: CanvasRenderingContext2D, canv_p0: Offset, canv_p1: Offset) {
  const x0 = (canv_p0.x)
  const y0 = (canv_p0.y)
  const x1 = (canv_p1.x)
  const y1 = (canv_p1.y)
  const imgData = imgCtx.getImageData(x0, y0, x1 - x0, y1 - y0)
  return imageDataToImage(imgData)
}

// Use a Canvas element to produce an image from ImageData
export function imageDataToImage(imageData: ImageData) {
  const canvas = imageDataToCanvas(imageData);
  const image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

// Canvas elements can be created from ImageData
function imageDataToCanvas(imageData: ImageData) {
  // canvas created on demand
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  // put image data in form: imageData, dx, dy, xoffset, yoffset, widthToDraw, heightToDraw
  ctx?.putImageData(imageData, 0, 0, 0, 0, canvas.width, canvas.height); //was putImageData
  return canvas;
}

// Convert the onnx model mask output to an HTMLImageElement
export function onnxMaskToImage(input: any, width: number, height: number, mask_idx: number, mask_colour: number, refArr: Uint8ClampedArray) {
  return imageDataToImage(arrayToImageData(input, width, height, mask_idx, mask_colour, 0.4 * 255, refArr));
}


export const draw = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colour: string, fill: boolean = true) => {
  // Brushstroke: a circle at x, y with radius and colour
  ctx.fillStyle = colour; //"#43ff641a"
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, width, width, 0, 0, 2 * Math.PI);
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

export const erase = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number) => {
  // Erase: clearing a rect on label canvas.
  ctx.clearRect(x - width, y - width, 2 * width, 2 * width)
}

export const drawErase = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, fill = true, hex = "#ffffff") => {
  ctx.strokeStyle = "#000000"; //"#43ff641a"
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.rect(x - width, y - width, 2 * width, 2 * width)
  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

export const drawRect = (ctx: CanvasRenderingContext2D, p0: Offset, p1: Offset, hex = "#ffffffff") => {
  ctx.strokeStyle = hex;
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.rect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  ctx.closePath();
  ctx.fill();
}

export const drawPolygon = (ctx: CanvasRenderingContext2D, polygon: Array<Offset>, colour: string, fill: boolean = false) => {
  // Loop through each point in polygon and draw it.
  const p0 = polygon[0];
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < polygon.length; i++) {
    const p = polygon[i];
    ctx.lineTo(p.x, p.y);
  }
  if (fill === true) {
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

export const drawCropCursor = (ctx: CanvasRenderingContext2D, p0: Offset, width: number = 16) => {
  const lowerPoints: Array<Offset> = [{ 'x': p0.x, 'y': p0.y - width / 2 }, { 'x': p0.x, 'y': p0.y + width }, { 'x': p0.x + (3 / 2) * width, 'y': p0.y + width }]
  const upperPoints: Array<Offset> = [{ 'x': p0.x - width / 2, 'y': p0.y }, { 'x': p0.x + width, 'y': p0.y }, { 'x': p0.x + width, 'y': p0.y + (3 / 2) * width }]
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  for (let polygon of [lowerPoints, upperPoints]) {
    const np0 = polygon[0]
    ctx.beginPath();
    ctx.moveTo(np0.x, np0.y);

    for (let i = 1; i < polygon.length; i++) {
      const p = polygon[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.closePath();
  }
}

export const getctx = (ref: RefObject<HTMLCanvasElement>): CanvasRenderingContext2D | null => { return ref.current!.getContext("2d", { willReadFrequently: true }) }
export const clearctx = (ref: RefObject<HTMLCanvasElement>) => {
  const ctx = getctx(ref);
  ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

const filled = (p: number[]) => { return (p[0] > 0 && p[1] > 0 && p[2] > 0) }

export const getxy = (e: any): [number, number] => {
  let el = e.nativeEvent.target;
  const rect = el.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  return [x, y]
}

export const transferLabels = (animCanv: HTMLCanvasElement, labelImage: HTMLImageElement, offset: Offset, zoom: number) => {
  /*Given a (potnetially zoomed) animated canvas* with labels on it, create a transfer canvas, draw LabelImg onto it (full size),
  then draw correct bit of animCanv onto it in the right position on transfer canvas
  then just get all of transfer canvas and convert it to label array as before. */
  const [sx0, sy0, sw, sh, dx, dy, dw, dh] = getZoomPanCoords(animCanv.width, animCanv.height, labelImage, offset, zoom);
  const transferCanvas = document.createElement("canvas");
  const transferCtx = transferCanvas.getContext("2d");
  if (transferCtx === null) { return; };
  transferCanvas.width = labelImage.width;
  transferCanvas.height = labelImage.height;
  transferCtx.clearRect(sx0, sy0, sw, sh);
  transferCtx.drawImage(animCanv, dx, dy, dw, dh, sx0, sy0, sw, sh);
  return transferCtx;
}


export const getZoomPanCoords = (cw: number, ch: number, image: HTMLImageElement, offset: Offset, zoom: number) => {
  // Get the zoomed&panned coordinates with which to draw the images.
  const [w, h] = [image.width, image.height];
  const [zw, zh] = [w * zoom, h * zoom];
  let [sx0, sx1, sy0, sy1] = [0, 0, 0, 0];
  let [dx, dy, dw, dh] = [0, 0, 0, 0];

  sx1 = w;
  sy1 = h;
  dw = zw;
  dh = zh;
  dx = offset.x;
  dy = offset.y;

  return [sx0, sy0, sx1, sy1, dx, dy, dw, dh]
}

export const getZoomPanXY = (canvX: number, canvY: number, ctx: CanvasRenderingContext2D, image: HTMLImageElement, offset: Offset, zoom: number) => {
  // Get the natural (image) coordinates of a click at (canvX, canvY) given our zoom and pan
  const [sx0, sy0, sw, sh, dx, dy, dw, dh] = getZoomPanCoords(ctx.canvas.width, ctx.canvas.height, image, offset, zoom);
  const fracX = (canvX - dx) / dw;
  const fracY = (canvY - dy) / dh;
  const naturalX = (fracX * sw) + sx0;
  const naturalY = (fracY * sh) + sy0;
  return [naturalX, naturalY]
}

export const computeCentreOffset = (image: HTMLImageElement, cx: number, cy: number): Offset => {
  // Get the offset with which to centre our image
  const [iw, ih] = [image.width, image.height];
  return { x: (cx - iw) / 2, y: (cy - ih) / 2 }
}

export const computeNewZoomOffset = (currentZoom: number, newZoom: number, mousePos: Offset, currentOffset: Offset) => {
  const [ix, iy] = [(mousePos.x - currentOffset.x) / currentZoom, (mousePos.y - currentOffset.y) / currentZoom];
  const [ox, oy] = [mousePos.x - newZoom * ix, mousePos.y - newZoom * iy];
  return { x: ox, y: oy }
}


export const drawImage = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, offset: Offset, zoom: number) => {
  // split into 2 funcitons - one to get coords and one to draw, then reverse the coords for transfert.
  const [sx0, sy0, sx1, sy1, dx, dy, dw, dh] = getZoomPanCoords(ctx.canvas.width, ctx.canvas.height, image, offset, zoom);
  //console.log(sx0, sy0, sx1, sy1, dx, dy, dw, dh)
  ctx.drawImage(image, sx0, sy0, sx1, sy1, dx, dy, dw, dh);
}

// Methods to map our large image into a smaller one
export const getSplitInds = (image: HTMLImageElement) => {
  const nW = Math.ceil(image.width / 1024);
  const nH = Math.ceil(image.height / 1024);
  const dx = image.width / nW;
  const dy = image.height / nH;
  const wInds = Array.from({ length: nW }, (x, i) => dx * i);
  const hInds = Array.from({ length: nH }, (x, i) => dy * i);
  const inds = { 'w': wInds, 'h': hInds, 'dx': dx, 'dy': dy, 'nW': nW, 'nH': nH };
  return inds
}


export const getXYfromI = (i: number, arrW: number) => {
  const y = Math.floor(i / arrW);
  const x = i % arrW;
  return [x, y]
}

export const getIfromXY = (x: number, y: number, arrW: number) => {
  return y * arrW + x;
}