import React, { RefObject, useRef, useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps, Offset, MultiCanvasProps } from "./helpers/Interfaces";
import {
    getctx, transferLabels, addImageDataToArray, clearctx, getxy, getZoomPanXY,
    getZoomPanCoords, rgbaToHex, colours, arrayToImageData, draw, drawImage,
    imageDataToImage, erase, drawErase, drawPolygon, computeNewZoomOffset,
    computeCentreOffset, drawRect, getCropImg, drawCropCursor, drawDashedRect,
    GreyscaleToImageData, getMaxZoom
} from "./helpers/canvasUtils"
import * as _ from "underscore";
import '../assets/scss/styles.css'


const MAX_ZOOM = 10
const MIN_ZOOM = 0.4
const SCROLL_SENSITIVITY = 0.0005
const SCROLL_SPEED = 1
const PAN_OFFSET = 20

const UA = navigator.userAgent
const firefox = (UA.search("Firefox") == -1) ? false : true

const appendArr = (oldArr: Array<any>, newVal: any) => {
    return [...oldArr, newVal];
};

const MultiCanvas = ({ updateAll }: MultiCanvasProps) => {
    const {
        image: [image, setImage],
        imgIdx: [imgIdx,],
        imgType: [imgType],
        imgArrs: [, setImgArrs],
        uncertainArrs: [uncertainArrs,],
        maskImg: [maskImg, setMaskImg],
        clicks: [, setClicks],
        processing: [, setProcessing],
        labelType: [labelType, setLabelType],
        labelClass: [labelClass, setLabelClass],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr, setSegArr],
        uncertainArr: [uncertainArr, setUncertainArr],
        brushWidth: [brushWidth],
        overlayType: [overlayType, setOverlayType],
        labelOpacity: [labelOpacity, setLabelOpacity],
        uncertaintyOpacity: [uncertaintyOpacity, setUncertaintyOpacity],
        segOpacity: [segOpacity, setSegOpacity],
        maskIdx: [maskIdx, setMaskIdx],
        errorObject: [, setErrorObject],
    } = useContext(AppContext)!;

    // We use references here because we don't want to re-render every time these change (they do that already as they're canvases!)
    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const uncertainCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedOverlayRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const polyPoints = useRef<Array<Offset>>([]); //current polygon points
    const animationRef = useRef<number>(0);

    const zoom = useRef<number>(1);
    const minZoom = useRef<number>(0.4);
    const cameraOffset = useRef<Offset>({ x: 0, y: 0 });
    const mousePos = useRef<Offset>({ x: 0, y: 0 });
    const cropStart = useRef<Offset>({ x: -1000, y: -1000 });

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvSize, setCanvSize] = useState<Offset>({ x: 300, y: 150 });

    const [labelImg, setLabelImg] = useState<HTMLImageElement | null>(null);
    const [segImg, setSegImg] = useState<HTMLImageElement | null>(null);
    const [uncertainImg, setUncertainImg] = useState<HTMLImageElement | null>(null);

    // Our images - when we update them their corresponding canvas changes. 
    const groundTruths = [image, segImg, labelImg, uncertainImg, maskImg];
    // Our canvases - updated when our images update but also can update them (i.e when drawing labels.)
    const refs = [imgCanvasRef, segCanvasRef, labelCanvasRef, uncertainCanvasRef, animatedCanvasRef, animatedOverlayRef];
    // Track mouse state (for drag drawing)
    const clicking = useRef<boolean>(false);

    const uniqueLabels = useRef<Set<number>>(new Set()); // used to track when we can press segment 

    const frame = useRef<number>(0);

    const updateSAM = () => {
        /* Called when user clicks using SAM labelling: gets natural (image) coordinates of click and 
        adds that to clicks state, which has a listener in app to feed them into the decoder.*/
        const canvX = mousePos.current.x;
        const canvY = mousePos.current.y;
        const ctx = getctx(animatedCanvasRef);
        if (ctx === null || image === null) { return };
        const [x, y] = getZoomPanXY(canvX, canvY, ctx, image, cameraOffset.current, zoom.current);
        const click = getClick(x, y);
        if (click) setClicks([click]);
    };

    const getClick = (x: number, y: number): modelInputProps => {
        // used for ONNX
        const clickType = 1;
        return { x, y, clickType };
    };

    const handleClick = (e: any) => {
        // Start tracking user click
        const drawing = (labelType == "Brush" || labelType == "Erase" || labelType == "Crop");
        if (drawing) { clicking.current = true; }
        if (labelType == "Crop" && clicking.current) { cropStart.current = mousePos.current }
    };

    const addCanvasToArr = (canvas: HTMLCanvasElement, img: HTMLImageElement, oldArr: Uint8ClampedArray, erase = false) => {
        /* Once label confirmed, transfer the data from the animation canvas to the label canvas. Start by drawing animated
        canvas to the right size (i.e natural coordinates), then get image data from that, then add that image data to
        to the labels arr by looping over every element and setting unset elements in labelArr to the class value of
        the new image data. */
        const transferCtx = transferLabels(canvas, img, cameraOffset.current, zoom.current);
        if (transferCtx === undefined || image === null) { return; };
        // (relatively) slow operation as needs to draw onto full image size
        const imageData = transferCtx.getImageData(0, 0, image?.width, image?.height);
        const currentClass = labelClass//(erase === true) ? 0 : labelClass;
        if (labelClass > 0) {
            const set = uniqueLabels.current;
            const n_labels = (set.has(labelClass)) ? set.size : set.size + 1;
            set.add(labelClass);
            if (n_labels > 1) { setProcessing("None") }
        }
        const arr = addImageDataToArray(imageData, oldArr, currentClass, erase);
        return arr
    }

    const finishPolygon = (polygon: Array<Offset>, labelIdx: number, labelImg: HTMLImageElement, ctx: CanvasRenderingContext2D) => {
        // Finish polygon, add it to label arr, reset polygon.
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        drawPolygon(ctx, polygon, hex, true);
        const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr);
        if (arr !== undefined) { setLabelArr(arr); }
        polyPoints.current = [];
    }

    const checkSnap = (x: number, y: number, points: Array<Offset>) => {
        // Check if mouse hover close enough to the starting polygon point to 'snap'
        if (points.length <= 1) {
            return { success: false, x: -1, y: -1 };
        }
        const x0 = points[0].x;
        const y0 = points[0].y;
        if ((x - x0) ** 2 + (y - y0) ** 2 < 250) {
            return { success: true, x: x0, y: y0 };
        } else {
            return { success: false, x: -1, y: -1 };
        };
    };

    const finishCrop = (ctx: CanvasRenderingContext2D) => {
        if (imgType != "single") { return }
        const imgCtx = getctx(imgCanvasRef);
        if (imgCtx === null) { return }
        const newImg = getCropImg(imgCtx, cropStart.current, mousePos.current);
        newImg.onload = () => {
            const tempLabelArr = new Uint8ClampedArray(newImg.width * newImg.height).fill(0);
            const tempSegArr = new Uint8ClampedArray(newImg.width * newImg.height).fill(0);
            const newOffset = computeCentreOffset(newImg, ctx.canvas.width, ctx.canvas.height)
            cameraOffset.current = newOffset
            updateAll([newImg], [tempLabelArr], [tempSegArr], [null]);
            setLabelArr(tempLabelArr);
            setSegArr(tempSegArr);
            setLabelType("Brush");

            //drawAllCanvases(zoom.current, newOffset)
        }
    }

    const handleClickEnd = (e: any) => {
        // Once a click finishes, get current labelling state and apply correct action
        const drawing = (labelType == "Brush" || labelType == "Erase" || labelType == "Crop");
        const leftClick = (e.button == 0);
        const rightClick = (e.button == 2);

        const ctx = getctx(animatedCanvasRef);
        if (ctx === null || image === null || labelImg === null) {
            return;
        }
        // Stop clicking status
        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "Smart Labelling") && leftClick) {
            // Draw what was on our animated canvas (brush or SAM) onto the label canvas
            const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr);
            if (arr !== undefined) { setLabelArr(arr); }
            clearctx(animatedCanvasRef);
        } else if (labelType == "Smart Labelling" && rightClick) {
            // Update SAM type when right clicking
            const newMaskIdx = (maskIdx % 3) + 1;
            setMaskIdx((newMaskIdx));
            updateSAM();
        } else if (labelType == "Erase") {
            // Erase directly on labels (so get real time preview).
            const labelctx = getctx(labelCanvasRef);
            if (labelctx === null) { return }
            const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr, true);
            if (arr !== undefined) { setLabelArr(arr); }
            clearctx(animatedCanvasRef);
            //setLabelArr(arr);
        } else if (labelType === "Polygon" && leftClick) {
            // Check for snap and finish or add another point
            const snap = checkSnap(mousePos.current.x, mousePos.current.y, polyPoints.current);
            if (snap.success) {
                finishPolygon(polyPoints.current, labelClass, labelImg, ctx);
                clearctx(animatedCanvasRef);
            } else {
                const newPoly = appendArr(polyPoints.current, mousePos.current);
                polyPoints.current = newPoly;
            }
        } else if (labelType === "Polygon" && rightClick) {
            // Finish on right click
            const animctx = getctx(animatedOverlayRef);
            if (animctx === null) { return }
            const newPoly = appendArr(polyPoints.current, mousePos.current);
            finishPolygon(newPoly, labelClass, labelImg, ctx);
            clearctx(animatedCanvasRef);
        } else if (labelType === "Crop") {
            try {
                finishCrop(ctx)
            } catch (e) {
                const error = e as Error;
                setErrorObject({ msg: "Failed to crop", stackTrace: error.toString() });
            }

        }
    };

    // Throttled to avoid over rendering the canvases (or over-requesting SAM model)
    const handleClickMove = _.throttle((e: any) => {
        const res = getxy(e);
        const canvX = res[0];
        const canvY = res[1];
        const ctx = getctx(animatedCanvasRef);
        const labelctx = getctx(labelCanvasRef);
        mousePos.current = { x: canvX, y: canvY } //cache mouse pos for overlay

        if (ctx === null || image === null || labelctx === null) { return; }

        if ((clicking.current) && (labelType == "Brush")) {
            const c = colours[labelClass];
            const hex = rgbaToHex(c[0], c[1], c[2], 255); // was label opacity
            draw(ctx, canvX, canvY, brushWidth, hex);
        } else if (labelType == "Smart Labelling") {
            // Get mouse position and scale the (x, y) coordinates back to the natural
            // scale of the image. Update the state of clicks with setClicks to trigger
            // the ONNX model to run and generate a new mask via a useEffect in App.tsx
            const [naturalX, naturalY] = getZoomPanXY(canvX, canvY, ctx, image, cameraOffset.current, zoom.current)
            const click = getClick(naturalX, naturalY);
            if (click) setClicks([click]);
        } else if ((clicking.current) && (labelType == "Erase")) {
            erase(labelctx, canvX, canvY, brushWidth);
            const c = colours[0];
            const hex = rgbaToHex(c[0], c[1], c[2], 1); // was label opacity
            drawErase(ctx, canvX, canvY, brushWidth, true, hex);
        }
    }, 15);

    const handleScroll = (e: any) => {
        // Adjust the zoom level based on scroll wheel delta
        //e.preventDefault()
        const delta = e.deltaY * SCROLL_SENSITIVITY > 0 ? -0.1 : 0.1; // Change the zoom increment as needed
        const speed = (zoom.current < 1) ? SCROLL_SPEED * zoom.current : SCROLL_SPEED;
        let newZoom = zoom.current + delta * speed;
        newZoom = Math.min(newZoom, MAX_ZOOM);
        newZoom = Math.max(newZoom, minZoom.current);
        if (image === null) { return }
        const newOffset = computeNewZoomOffset(zoom.current, newZoom, mousePos.current, cameraOffset.current);
        drawAllCanvases(newZoom, newOffset); //cameraOffset.current
        resetLabels();
        zoom.current = newZoom;
        setOffset(newOffset, newZoom);
    };

    const setOffset = (setOffset: Offset, newZoom: number) => {
        const ctx = getctx(imgCanvasRef);
        if (image === null || ctx === null) { return }
        const cw = ctx.canvas.width
        const ch = ctx.canvas.height
        const iw = image.width
        const ih = image.height
        const max_x = 0;
        const max_y = 0;
        const min_x = (cw - newZoom * iw) / 2;
        const min_y = (ch - newZoom * ih) / 2;

        const ub_x = Math.min(setOffset.x, max_x)
        const ub_lb_x = Math.max(ub_x, min_x)
        const ub_y = Math.min(setOffset.y, max_y)
        const ub_lb_y = Math.max(ub_y, min_y)
        const newOffset = { x: ub_lb_x, y: ub_lb_y }

        resetLabels();
        drawAllCanvases(newZoom, newOffset);
        cameraOffset.current = newOffset;
    }

    const handleKeyPress = (e: any) => {
        // Keypresses are either: setting class, cancelling, changing visibility or panning
        if (e.key >= '0' && e.key <= '6') {
            // Perform desired actions for number key press
            setLabelClass(parseInt(e.key));
            if (labelType === "Smart Labelling") {
                updateSAM();
            }
        } else if (e.key === 'Escape') {
            resetLabels();
        } else if (e.key === 'v') {
            toggleVisibility();
        } else {
            handlePanKey(e);
        }
    }

    const toggleVisibility = () => {
        // Cycle through overlay visibilities
        if (overlayType === "Segmentation") {
            setSegOpacity(0);
            setLabelOpacity(200);
            setOverlayType("Label");
        } else if (overlayType === "Label") {
            setSegOpacity(0);
            setLabelOpacity(0);
            setOverlayType("None");
        } else if (overlayType === "None") {
            setSegOpacity(200);
            setLabelOpacity(0);
            setOverlayType("Segmentation");
        }
    }

    const handlePanKey = (e: any) => {
        // Move image around with arrow keys
        let newOffset: Offset;
        const c = cameraOffset.current;
        const delta = PAN_OFFSET // zoom.current;
        if (e.key == "w" || e.key == "ArrowUp") {
            newOffset = { x: c.x, y: c.y - delta };
        }
        else if (e.key == "s" || e.key == "ArrowDown") {
            newOffset = { x: c.x, y: c.y + delta };
        } else if (e.key == "a" || e.key == "ArrowLeft") {
            newOffset = { x: c.x - delta, y: c.y };
        } else if (e.key == "d" || e.key == "ArrowRight") {
            newOffset = { x: c.x + delta, y: c.y };
        } else {
            newOffset = c;
        }
        setOffset(newOffset, zoom.current)
    }

    const resetLabels = () => {
        // Simple reset, triggered on esc key or moving out of bounds
        polyPoints.current = [];
        clearctx(animatedCanvasRef);
        clearctx(animatedOverlayRef);
        setMaskImg(null);
    }

    const resetAnimation = () => {
        window.cancelAnimationFrame(animationRef.current);
        animation();
    }

    const animation = () => {
        /* Uses requestAnimationFrame to update animation canvas every user frame, allowing
        for brush/erase/polygon preview. Needs to be erased and drawn every frame. */
        if (animatedOverlayRef.current === null) { return; }
        const ctx = getctx(animatedOverlayRef);
        if (ctx === null) { return; }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        if (labelType === "Brush") {
            draw(ctx, mousePos.current.x, mousePos.current.y, brushWidth, hex, false);
        } else if (labelType === "Erase") {
            drawErase(ctx, mousePos.current.x, mousePos.current.y, brushWidth, false);
        } else if (labelType === "Polygon") {
            const pointsPlaced = (polyPoints.current.length > 0);
            if (pointsPlaced) {
                drawPolygon(ctx, polyPoints.current, hex);
                drawPolygon(ctx, [polyPoints.current[polyPoints.current.length - 1], mousePos.current], hex);
                const snap = checkSnap(mousePos.current.x, mousePos.current.y, polyPoints.current);
                if (snap.success) {
                    draw(ctx, snap.x, snap.y, 10, hex, false);
                }
            }
        } else if (labelType === "Crop" && clicking.current) {
            drawRect(ctx, cropStart.current, mousePos.current, "#00000064");
            drawCropCursor(ctx, mousePos.current);
        } else if (labelType === "Crop") {
            drawCropCursor(ctx, mousePos.current);
        }

        if (uncertaintyOpacity > 0.05 * 255) {
            const newOpacity = uncertaintyOpacity - 4
            setUncertaintyOpacity(newOpacity)
        }

        animationRef.current = requestAnimationFrame(animation);
    }

    const drawAllCanvases = (updateZoom: number, updateOffset: Offset) => {
        // For each of our 4 canvases, clear them then draw the data.
        for (let i = 0; i < refs.length - 1; i++) {
            const ctx = getctx(refs[i])
            const gt = groundTruths[i]
            if (gt === null || ctx?.canvas == undefined || ctx === null) {
                return;
            }
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.imageSmoothingEnabled = false
            drawImage(ctx, gt, updateOffset, updateZoom);
        };
    }

    const asyncImgDraw = async (canvasRef: RefObject<HTMLCanvasElement>, img: HTMLImageElement | null) => {
        // Firefox needs slight delay between labels added and arrs updating for some reason
        const ctx = getctx(canvasRef);
        if (img === null || ctx === null) {
            return;
        };
        clearctx(canvasRef);
        await new Promise(r => setTimeout(r, 0.1));
        drawImage(ctx, img, cameraOffset.current, zoom.current);
    }

    const instantImgDraw = (canvasRef: RefObject<HTMLCanvasElement>, img: HTMLImageElement | null) => {
        // Chromium broswers don't need an update so this avoids the flickering
        const ctx = getctx(canvasRef);
        if (img === null || ctx === null) {
            return;
        };
        clearctx(canvasRef);
        drawImage(ctx, img, cameraOffset.current, zoom.current);
    }

    const drawImgOnUpdate = (firefox) ? asyncImgDraw : instantImgDraw

    const updateImgOnArr = (arr: Uint8ClampedArray, img: HTMLImageElement | null, opacity: number, setterFn: any, uncertain: boolean = false) => {
        /* 'Polymorphic' function used in listeners to set the image on the canvas when the corresponding array 
        is changed (i.e when a label is added) */
        if (img === null) { return; }
        const newImageData = (uncertain) ? GreyscaleToImageData(arr, img.height, img.width, opacity) : arrayToImageData(arr, img.height, img.width, 0, null, opacity);
        const newImage = imageDataToImage(newImageData);
        setterFn(newImage);
    }

    // Global state listeners, mostly of arrays.
    useEffect(() => {
        console.log('Image changed');
        let ctx = getctx(imgCanvasRef);
        if (image === null || ctx?.canvas == undefined) { return; }
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const newLabelImg = new Image(image.width, image.height);
        const newSegImg = new Image(image.width, image.height);
        setLabelImg(newLabelImg);
        setSegImg(newSegImg);
        const newZoom = getMaxZoom(image.height, image.width, ctx.canvas.width, ctx.canvas.height)
        minZoom.current = newZoom //image.width / ctx.canvas.width
        const centreOffset = computeCentreOffset(image, ctx.canvas.width, ctx.canvas.height)
        const newOffset = computeNewZoomOffset(1, newZoom, mousePos.current, centreOffset);
        setOffset(newOffset, newZoom)

        //if (ctx !== null) { drawImage(ctx, image, newOffset, newZoom); }
        animation(); //start the animation loop
    }, [image])

    useEffect(() => {
        drawImgOnUpdate(animatedCanvasRef, maskImg);
    }, [maskImg])

    useEffect(() => {
        updateImgOnArr(labelArr, image, labelOpacity, setLabelImg);
    }, [labelArr, labelOpacity]) //update the label img when opacity changed OR when label arr changes

    useEffect(() => {
        updateImgOnArr(segArr, image, segOpacity, setSegImg);
    }, [segArr, segOpacity])

    useEffect(() => {
        updateImgOnArr(uncertainArr, image, uncertaintyOpacity, setUncertainImg, true);
    }, [uncertainArr, uncertaintyOpacity])

    useEffect(() => {
        drawImgOnUpdate(labelCanvasRef, labelImg);
    }, [labelImg])

    useEffect(() => {
        drawImgOnUpdate(segCanvasRef, segImg);
    }, [segImg])

    useEffect(() => {
        drawImgOnUpdate(uncertainCanvasRef, uncertainImg);
    }, [uncertainImg])

    useEffect(() => {
        resetLabels();
    }, [labelType]) // clear animated canvas when switching


    useEffect(() => {
        // Window resize listener
        for (let ref of refs) {
            const canv = ref.current;
            if (canv) {
                canv.width = canvSize.x;
                canv.height = canvSize.y;
            }
        }
        if (image === null) { return }
        const centreOffset = computeCentreOffset(image, canvSize.x, canvSize.y);
        const newZoom = getMaxZoom(image.height, image.width, canvSize.x, canvSize.y)
        const newOffset = computeNewZoomOffset(1, newZoom, mousePos.current, centreOffset);
        setOffset(newOffset, newZoom)
        minZoom.current = newZoom
        zoom.current = newZoom
    }, [canvSize])

    useEffect(() => {
        // When first load listener
        const resizeCanvs = () => {
            const container = containerRef.current;
            if (container) {
                const newCanvSize = { x: container.clientWidth, y: container.clientHeight };
                setCanvSize(newCanvSize);
            }
        }
        resizeCanvs();
        window.addEventListener('resize', resizeCanvs);
    }, [])

    useEffect(() => { resetAnimation() }, [labelType, brushWidth, labelClass, uncertaintyOpacity]);

    return (
        <div onMouseDown={handleClick}
            onMouseMove={handleClickMove}
            onMouseUp={handleClickEnd}
            onContextMenu={(e) => e.preventDefault()}
            onMouseLeave={e => resetLabels()}
            onKeyDown={e => handleKeyPress(e)}
            tabIndex={0}
            onWheel={e => handleScroll(e)}
            style={{ height: '80vh', width: '75vw' }}
            ref={containerRef}
            id="canvContainer"
            className="container"
        >
            {refs.map((r, i) => <canvas key={i} ref={r} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
        </div>) //was height={1024} width={1024}
}

export default MultiCanvas