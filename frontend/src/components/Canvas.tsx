import React, { RefObject, useRef, useContext, useEffect, useState, SetStateAction } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps } from "./helpers/Interfaces";
import {
    getctx, transferLabels, addImageDataToArray, clearctx, getxy, getZoomPanXY,
    getZoomPanCoords, rgbaToHex, colours, arrayToImageData, draw, drawImage, imageDataToImage, erase
} from "./helpers/canvasUtils"
import * as _ from "underscore";


const MAX_ZOOM = 10
const MIN_ZOOM = 0.1
const SCROLL_SENSITIVITY = 0.0005
const PAN_OFFSET = 20


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
        // used for ONNX
        const clickType = 1;
        return { x, y, clickType };
    };

    const handleClick = (e: any) => {
        // Start tracking user click
        const drawing = (labelType == "Brush" || labelType == "Erase")
        if (drawing) { clicking.current = true; }
    }


    const handleClickEnd = (e: any) => {
        // Once a click finishes, get current labelling state and apply correct action
        const drawing = (labelType == "Brush" || labelType == "Erase");
        const leftClick = (e.button == 0);
        const rightClick = (e.button == 2);

        const ctx = getctx(animatedCanvasRef);
        if (ctx === null || image === null || labelImg === null) {
            return;
        }
        // Stop clicking status
        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "SAM") && leftClick) {
            // Draw what was on our animated canvas (brush or SAM) onto the label canvas
            const transferCtx = transferLabels(ctx.canvas, labelImg, cameraOffset, zoom)
            if (transferCtx === undefined) { return }
            // (relatively) slow operation as needs to draw onto full image size
            const labelImageData = transferCtx.getImageData(0, 0, image?.width, image?.height);
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
            const click = getClick(x, y);
            if (click) setClicks([click]); // reload mask with new MaskIdx
        } else if (labelType == "Erase") {
            // Erase directly on labels (so get real time preview). Not currently working
            const labelctx = getctx(labelCanvasRef);
            if (labelctx === null) { return }
            const transferCtx = transferLabels(labelctx.canvas, labelImg, cameraOffset, zoom, true)
            if (transferCtx === undefined) { return }
            const labelImageData = transferCtx.getImageData(0, 0, image?.width, image?.height); // was cameraOffset.x, cameraOffset.y
            const arr = addImageDataToArray(labelImageData, labelArr, labelClass, true);
            setLabelArr(arr);
        }
    };

    // Throttled to avoid over rendering the canvases (or over-requesting SAM model)
    const handleClickMove = _.throttle((e: any) => {
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
    }, 15);

    const handleScroll = (e: any) => {
        // Adjust the zoom level based on scroll wheel delta
        //e.preventDefault()
        const delta = e.deltaY * SCROLL_SENSITIVITY > 0 ? -0.1 : 0.1; // Change the zoom increment as needed
        let newZoom = zoom + delta
        newZoom = Math.min(newZoom, MAX_ZOOM)
        newZoom = Math.max(newZoom, MIN_ZOOM)
        //console.log(newZoom, getxy(e))
        setZoom(newZoom);
    };


    const handleKeyPress = (e: any) => {
        //console.log(e.key)
        const delta = PAN_OFFSET / zoom
        if (e.key >= '0' && e.key <= '6') {
            // Perform desired actions for number key press
            console.log('Number key pressed:', e.key);
            setLabelClass(parseInt(e.key));
        } else if (e.key == "w" || e.key == "ArrowUp") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x, y: Math.max(c.y - delta, 0) });
        }
        else if (e.key == "s" || e.key == "ArrowDown") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x, y: c.y + delta })
        } else if (e.key == "a" || e.key == "ArrowLeft") {
            const c = cameraOffset;
            setCameraOffset({ x: Math.max(c.x - delta, 0), y: c.y });
        } else if (e.key == "d" || e.key == "ArrowRight") {
            const c = cameraOffset;
            setCameraOffset({ x: c.x + delta, y: c.y });
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

    const updateImgOnArr = (arr: Uint8ClampedArray, img: HTMLImageElement | null, opacity: number, setterFn: any) => {
        if (img === null) { return; }
        const newImageData = arrayToImageData(arr, img.height, img.width, 0, null, labelOpacity);
        const newImage = imageDataToImage(newImageData);
        setterFn(newImage);
    }

    useEffect(() => {
        drawImgOnUpdate(animatedCanvasRef, maskImg)
    }, [maskImg])

    useEffect(() => {
        updateImgOnArr(labelArr, image, labelOpacity, setLabelImg)
    }, [labelArr, labelOpacity])

    useEffect(() => {
        updateImgOnArr(segArr, image, segOpacity, setSegImg)
    }, [segArr, segOpacity])

    useEffect(() => {
        drawImgOnUpdate(labelCanvasRef, labelImg)
    }, [labelImg])

    useEffect(() => {
        drawImgOnUpdate(segCanvasRef, segImg)
    }, [segImg])

    useEffect(() => { clearctx(animatedCanvasRef) }, [labelType]) // clear animated canvas when switching

    useEffect(() => {
        //console.log(cameraOffset);
        for (let i = 0; i < refs.length; i++) {
            const ctx = getctx(refs[i])
            const gt = groundTruths[i]
            if (gt === null || ctx?.canvas == undefined || ctx === null) {
                return;
            }
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (i < 3) {
                drawImage(ctx, gt, cameraOffset, zoom);
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