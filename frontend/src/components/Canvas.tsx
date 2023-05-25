import React, { RefObject, useRef, useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps, Offset, Pan } from "./helpers/Interfaces";
import { rgbaToHex, colours, addImageDataToArray, arrayToImageData, imageDataToImage } from "./helpers/canvasUtils"
import * as _ from "underscore";
import { off } from "process";


const MAX_ZOOM = 5
const MIN_ZOOM = 0.1
const SCROLL_SENSITIVITY = 0.0005


const draw = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colour: string) => {
    ctx.fillStyle = colour; //"#43ff641a"
    ctx.beginPath();
    ctx.ellipse(x, y, width, width, 0, 0, 2 * Math.PI);
    ctx.fill();
}

const erase = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number) => {
    ctx.clearRect(x - width / 2, y - width / 2, width, width)
}

const getctx = (ref: RefObject<HTMLCanvasElement>): CanvasRenderingContext2D | null => { return ref.current!.getContext("2d", { willReadFrequently: true }) }
const clearctx = (ref: RefObject<HTMLCanvasElement>) => {
    const ctx = getctx(ref)
    ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

const filled = (p: number[]) => { return (p[0] > 0 && p[1] > 0 && p[2] > 0) }

const getxy = (e: any): [number, number] => {
    // if i make this work with zoom will everything just work?
    let el = e.nativeEvent.target;
    const rect = el.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    return [x, y]
}

const transferLabels = (animCanv: HTMLCanvasElement, labelImage: HTMLImageElement, offset: Offset, zoom: number, drawOriginal: boolean = true) => {
    const [sx0, sy0, sw, sh, dx, dy, dw, dh] = getZoomPanCoords(animCanv.width, animCanv.height, labelImage, offset, zoom)
    const transferCanvas = document.createElement("canvas");
    const transferCtx = transferCanvas.getContext("2d");
    if (transferCtx === null) { return; };
    transferCanvas.width = labelImage.width;
    transferCanvas.height = labelImage.height;
    if (drawOriginal === true) { transferCtx.drawImage(labelImage, 0, 0) };
    transferCtx.drawImage(animCanv, dx, dy, dw, dh, sx0, sy0, sw, sh);
    return transferCtx;
}
/*Given a (potnetially zoomed) animated canvas* with labels on it, create a transfer canvas, draw LabelImg onto it (full size),
then draw correct bit of animCanv onto it in the right position on transfer canvas(inverse of my drawImg - maybe generalise that) 
then just get all of transfer canvas and convert it to label array as before. */

const getZoomPanCoords = (cw: number, ch: number, image: HTMLImageElement, offset: Offset, zoom: number) => {
    const [w, h] = [image.width, image.height]
    const [zw, zh] = [w * zoom, h * zoom]
    let [sx0, sx1, sy0, sy1] = [0, 0, 0, 0]
    let [dx, dy, dw, dh] = [0, 0, 0, 0]
    if (zw <= cw) {
        console.log("smaller width")
        sx0 = 0
        sx1 = w
        dx = offset.x
        dw = zw
    } else {
        sx0 = offset.x
        sx1 = cw / zoom
        dx = 0
        dw = cw
    }

    if (zh <= ch) {
        sy0 = 0
        sy1 = h
        dy = offset.y
        dh = zh
    } else {
        sy0 = offset.y
        sy1 = ch / zoom
        dy = 0
        dh = ch
    }
    return [sx0, sy0, sx1, sy1, dx, dy, dw, dh]
}

const getZoomPanXY = (canvX: number, canvY: number, ctx: CanvasRenderingContext2D, image: HTMLImageElement, offset: Offset, zoom: number) => {
    const [sx0, sy0, sw, sh, dx, dy, dw, dh] = getZoomPanCoords(ctx.canvas.width, ctx.canvas.height, image, offset, zoom)
    const fracX = (canvX - dx) / dw
    const fracY = (canvY - dy) / dh
    const naturalX = (fracX * sw) + sx0
    const naturalY = (fracY * sh) + sy0
    return [naturalX, naturalY]
}

const drawImage = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, offset: Offset, zoom: number) => {
    // split into 2 funcitons - one to get coords and one to draw, then reverse the coords for transfert.
    const [sx0, sy0, sx1, sy1, dx, dy, dw, dh] = getZoomPanCoords(ctx.canvas.width, ctx.canvas.height, image, offset, zoom)
    console.log(sx0, sy0, sx1, sy1, dx, dy, dw, dh)
    ctx.drawImage(image, sx0, sy0, sx1, sy1, dx, dy, dw, dh)
}


const MultiCanvas = () => {
    const {
        image: [image],
        maskImg: [maskImg],
        clicks: [, setClicks],
        labelType: [labelType],
        labelClass: [labelClass, setLabelClass],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr,],
        brushWidth: [brushWidth],
        labelOpacity: [labelOpacity],
        segOpacity: [segOpacity,],
        maskIdx: [maskIdx, setMaskIdx],
        cameraOffset: [cameraOffset, setCameraOffset],
        zoom: [zoom, setZoom],
    } = useContext(AppContext)!;

    // We use references here because we don't want to re-render every time these change (they do that already as they're canvases!)
    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const [labelImg, setLabelImg] = useState<HTMLImageElement | null>(null);
    const [segImg, setSegImg] = useState<HTMLImageElement | null>(null);

    // Our images - when we update them their corresponding canvas changes. 
    const groundTruths = [image, segImg, labelImg, maskImg]
    // Our canvases - updated when our images update but also can update them (i.e when drawing labels.)
    const refs = [imgCanvasRef, segCanvasRef, labelCanvasRef, animatedCanvasRef]
    // Track mouse state (for drag drawing)
    const clicking = useRef<boolean>(false);

    const getClick = (x: number, y: number): modelInputProps => {
        const clickType = 1;
        return { x, y, clickType };
    };

    const handleClick = (e: any) => {
        const drawing = (labelType == "Brush" || labelType == "Erase")
        if (drawing) { clicking.current = true; }
    }

    // Throttled to avoid over rendering the canvases (or over-requesting SAM model)
    const handleClickEnd = _.throttle((e: any) => {
        // Once a click finishes, get current labelling state and apply correct action
        const drawing = (labelType == "Brush" || labelType == "Erase");
        const leftClick = (e.button == 0);
        const rightClick = (e.button == 2);

        const ctx = getctx(animatedCanvasRef);
        if (ctx === null || image === null || labelImg === null) {
            return;
        }

        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "SAM") && leftClick) {
            // Draw onto our animated canvas, accounting for offsets
            const transferCtx = transferLabels(ctx.canvas, labelImg, cameraOffset, zoom)
            if (transferCtx === undefined) { return }
            const labelImageData = transferCtx.getImageData(0, 0, image?.width, image?.height); // was cameraOffset.x, cameraOffset.y
            const arr = addImageDataToArray(labelImageData, labelArr, labelClass);
            setLabelArr(arr);
            clearctx(animatedCanvasRef);
        } else if (labelType == "SAM" && rightClick) {
            // Update SAM type when right clicking
            const newMaskIdx = (maskIdx % 3) + 1;
            setMaskIdx((newMaskIdx));
            const res = getxy(e);
            const canvX = res[0];
            const canvY = res[1];
            const [x, y] = getZoomPanXY(canvX, canvY, ctx, image, cameraOffset, zoom)
            // modify this!
            const click = getClick(x, y);
            if (click) setClicks([click]); // reload mask with new MaskIdx
        } else if (labelType == "Erase") {
            // Erase directly on labels (so get real time preview)
            const labelctx = getctx(labelCanvasRef);
            if (labelctx === null) { return }
            const transferCtx = transferLabels(labelctx.canvas, labelImg, cameraOffset, zoom, false)
            if (transferCtx === undefined) { return }
            const labelImageData = transferCtx.getImageData(0, 0, image?.width, image?.height); // was cameraOffset.x, cameraOffset.y
            const arr = addImageDataToArray(labelImageData, labelArr, labelClass);
            setLabelArr(arr);
            /*
            const labelImageData = ctx?.getImageData(0, 0, image?.width, image?.height);
            const arr = addImageDataToArray(labelImageData, labelArr, 0, true);
            setLabelArr(arr);
            */
        }
    }, 15);


    const handleClickMove = (e: any) => {
        const res = getxy(e);
        const canvX = res[0];
        const canvY = res[1];
        const ctx = getctx(animatedCanvasRef);
        const labelctx = getctx(labelCanvasRef);

        if (ctx === null || image === null || labelctx === null) { return; }

        if ((clicking.current) && (labelType == "Brush")) {
            const c = colours[labelClass];
            const hex = rgbaToHex(c[0], c[1], c[2], 255); // was label opacity
            draw(ctx, canvX, canvY, brushWidth, hex);
        } else if (labelType == "SAM") {
            // Get mouse position and scale the (x, y) coordinates back to the natural
            // scale of the image. Update the state of clicks with setClicks to trigger
            // the ONNX model to run and generate a new mask via a useEffect in App.tsx
            const [naturalX, naturalY] = getZoomPanXY(canvX, canvY, ctx, image, cameraOffset, zoom)
            const click = getClick(naturalX, naturalY);
            if (click) setClicks([click]);
        } else if ((clicking.current) && (labelType == "Erase")) {
            erase(labelctx, canvX, canvY, brushWidth);
        }
    };

    const handleScroll = (e: any) => {
        // Adjust the zoom level based on scroll wheel delta
        e.preventDefault()
        const delta = e.deltaY * SCROLL_SENSITIVITY > 0 ? -0.1 : 0.1; // Change the zoom increment as needed
        let newZoom = zoom + delta
        newZoom = Math.min(newZoom, MAX_ZOOM)
        newZoom = Math.max(newZoom, MIN_ZOOM)
        console.log(newZoom, getxy(e))
        setZoom(newZoom);
    };


    const handleKeyPress = (e: any) => {
        console.log(e.key)
        if (e.key >= '0' && e.key <= '6') {
            // Perform desired actions for number key press
            console.log('Number key pressed:', e.key);
            setLabelClass(parseInt(e.key));
        } else if (e.key == "w" || e.key == "ArrowUp") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x, y: Math.max(c.y - 10, 0) });
        }
        else if (e.key == "s" || e.key == "ArrowDown") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x, y: c.y + 10 })
        } else if (e.key == "a" || e.key == "ArrowLeft") {
            const c = cameraOffset;
            setCameraOffset({ x: Math.max(c.x - 10, 0), y: c.y });
        } else if (e.key == "d" || e.key == "ArrowRight") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x + 10, y: c.y });
        }
    }

    useEffect(() => {
        console.log('Image changed');
        let ctx = getctx(imgCanvasRef);
        if (image === null || ctx?.canvas == undefined) { return; }
        const newLabelImg = new Image(image.width, image.height);
        const newSegImg = new Image(image.width, image.height);
        setLabelImg(newLabelImg);
        setSegImg(newSegImg);

        if (ctx !== null) { drawImage(ctx, image, cameraOffset, zoom); }
    }, [image])

    const drawImgOnUpdate = (canvasRef: RefObject<HTMLCanvasElement>, img: HTMLImageElement | null) => {
        const ctx = getctx(canvasRef);
        if (img === null || ctx === null) {
            return;
        };
        clearctx(canvasRef);
        drawImage(ctx, img, cameraOffset, zoom);
    }

    useEffect(() => {
        drawImgOnUpdate(animatedCanvasRef, maskImg)
    }, [maskImg])

    useEffect(() => {
        if (image === null) {
            return;
        }
        const newImageData = arrayToImageData(labelArr, image.height, image.width, 0, null, labelOpacity)
        const newImage = imageDataToImage(newImageData)
        setLabelImg(newImage)
    }, [labelArr, labelOpacity])
    // bit of a dupe of this one: need a cleanup to stop me repeating myself
    useEffect(() => {
        if (image === null) {
            return;
        }
        console.log("Seg array updated")
        const newImageData = arrayToImageData(segArr, image.height, image.width, 0, null, segOpacity)
        const newImage = imageDataToImage(newImageData)
        setSegImg(newImage)
    }, [segArr, segOpacity])

    useEffect(() => {
        drawImgOnUpdate(labelCanvasRef, labelImg)
        //ctx?.drawImage(labelImg, 0, 0, labelImg.width, labelImg.height, cameraOffset.x, cameraOffset.y, labelImg.width, labelImg.height);
    }, [labelImg])

    useEffect(() => {
        drawImgOnUpdate(segCanvasRef, segImg)
        //ctx?.drawImage(segImg, 0, 0, segImg.width, segImg.height, cameraOffset.x, cameraOffset.y, segImg.width, segImg.height);
    }, [segImg])

    useEffect(() => { clearctx(animatedCanvasRef) }, [labelType]) // clear animated canvas when switching

    useEffect(() => {
        console.log(cameraOffset);
        for (let i = 0; i < refs.length; i++) {
            const ctx = getctx(refs[i])
            const gt = groundTruths[i]
            if (gt === null || ctx?.canvas == undefined || ctx === null) {
                return;
            }
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (i < 3) {
                drawImage(ctx, gt, cameraOffset, zoom)
                //ctx?.drawImage(gt, 0, 0, gt.width, gt.height, cameraOffset.x, cameraOffset.y, gt.width, gt.height);
            };
        };
    }, [cameraOffset, zoom])

    // Fixed canvas width will cause errors later i.e lack of resizing //onWheel={handleScroll} onKeyUp={e => onKeyUp(e)}
    return (
        <div onMouseDown={handleClick}
            onMouseMove={handleClickMove}
            onMouseUp={handleClickEnd}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={e => clearctx(animatedCanvasRef)}
            onKeyDown={e => handleKeyPress(e)}
            tabIndex={0}
            onWheel={e => handleScroll(e)}>
            {refs.map((r, i) => <canvas key={i} ref={r} height={1024} width={1024} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
        </div>)
}

export default MultiCanvas