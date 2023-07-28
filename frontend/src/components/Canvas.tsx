import React, { RefObject, useRef, useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps, Offset } from "./helpers/Interfaces";
import {
    getctx, transferLabels, addImageDataToArray, clearctx, getxy, getZoomPanXY,
    getZoomPanCoords, rgbaToHex, colours, arrayToImageData, draw, drawImage,
    imageDataToImage, erase, drawErase, drawPolygon, computeNewZoomOffset,
    computeCentreOffset
} from "./helpers/canvasUtils"
import * as _ from "underscore";
import '../assets/scss/styles.css'


const MAX_ZOOM = 10
const MIN_ZOOM = 0.4
const SCROLL_SENSITIVITY = 0.0005
const SCROLL_SPEED = 1
const PAN_OFFSET = 20

const appendArr = (oldArr: Array<any>, newVal: any) => {
    return [...oldArr, newVal];
};

const MultiCanvas = () => {
    const {
        image: [image],
        imgIdx: [imgIdx,],
        maskImg: [maskImg, setMaskImg],
        clicks: [, setClicks],
        labelType: [labelType],
        labelClass: [labelClass, setLabelClass],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr,],
        brushWidth: [brushWidth],
        overlayType: [overlayType, setOverlayType],
        labelOpacity: [labelOpacity, setLabelOpacity],
        segOpacity: [segOpacity, setSegOpacity],
        maskIdx: [maskIdx, setMaskIdx],
    } = useContext(AppContext)!;

    // We use references here because we don't want to re-render every time these change (they do that already as they're canvases!)
    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedOverlayRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const polyPoints = useRef<Array<Offset>>([]);
    const animationRef = useRef<number>(0);

    const zoom = useRef<number>(1);
    const cameraOffset = useRef<Offset>({ x: 0, y: 0 })
    const mousePos = useRef<Offset>({ x: 0, y: 0 })

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvSize, setCanvSize] = useState<Offset>({ x: 300, y: 150 })

    const [labelImg, setLabelImg] = useState<HTMLImageElement | null>(null);
    const [segImg, setSegImg] = useState<HTMLImageElement | null>(null);

    // Our images - when we update them their corresponding canvas changes. 
    const groundTruths = [image, segImg, labelImg, maskImg]
    // Our canvases - updated when our images update but also can update them (i.e when drawing labels.)
    const refs = [imgCanvasRef, segCanvasRef, labelCanvasRef, animatedCanvasRef, animatedOverlayRef]
    // Track mouse state (for drag drawing)
    const clicking = useRef<boolean>(false);

    const updateSAM = () => {
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
        const drawing = (labelType == "Brush" || labelType == "Erase")
        if (drawing) { clicking.current = true; }
    };

    const addCanvasToArr = (canvas: HTMLCanvasElement, img: HTMLImageElement, oldArr: Uint8ClampedArray, erase = false) => {
        const transferCtx = transferLabels(canvas, img, cameraOffset.current, zoom.current);
        if (transferCtx === undefined || image === null) { return; };
        // (relatively) slow operation as needs to draw onto full image size
        const imageData = transferCtx.getImageData(0, 0, image?.width, image?.height);
        const currentClass = (erase === true) ? 0 : labelClass
        const arr = addImageDataToArray(imageData, oldArr, currentClass, erase);
        return arr
    }

    const finishPolygon = (polygon: Array<Offset>, labelIdx: number, labelImg: HTMLImageElement, ctx: CanvasRenderingContext2D) => {
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        drawPolygon(ctx, polygon, hex, true)
        const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr)
        if (arr !== undefined) { setLabelArr(arr); }
        polyPoints.current = []
    }

    const checkSnap = (x: number, y: number, points: Array<Offset>) => {
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
        if ((labelType == "Brush" || labelType == "Smart Labelling") && leftClick) {
            // Draw what was on our animated canvas (brush or SAM) onto the label canvas
            const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr)
            if (arr !== undefined) { setLabelArr(arr); }
            clearctx(animatedCanvasRef);
        } else if (labelType == "Smart Labelling" && rightClick) {
            // Update SAM type when right clicking
            const newMaskIdx = (maskIdx % 3) + 1;
            setMaskIdx((newMaskIdx));
            updateSAM()
        } else if (labelType == "Erase") {
            // Erase directly on labels (so get real time preview). Not currently working
            const labelctx = getctx(labelCanvasRef);
            if (labelctx === null) { return }
            const arr = addCanvasToArr(ctx.canvas, labelImg, labelArr, true)
            if (arr !== undefined) { setLabelArr(arr); }
            clearctx(animatedCanvasRef);
            //setLabelArr(arr);
        } else if (labelType === "Polygon" && leftClick) {
            const snap = checkSnap(mousePos.current.x, mousePos.current.y, polyPoints.current)
            if (snap.success) {
                finishPolygon(polyPoints.current, labelClass, labelImg, ctx)
                clearctx(animatedCanvasRef)
            } else {
                const newPoly = appendArr(polyPoints.current, mousePos.current);
                polyPoints.current = newPoly;
            }
        } else if (labelType === "Polygon" && rightClick) {
            const animctx = getctx(animatedOverlayRef)
            if (animctx === null) { return }
            const newPoly = appendArr(polyPoints.current, mousePos.current);
            finishPolygon(newPoly, labelClass, labelImg, ctx)
            clearctx(animatedCanvasRef)
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
        const speed = (zoom.current < 1) ? SCROLL_SPEED * zoom.current : SCROLL_SPEED
        let newZoom = zoom.current + delta * speed;
        newZoom = Math.min(newZoom, MAX_ZOOM);
        newZoom = Math.max(newZoom, MIN_ZOOM);
        if (image === null) { return }
        const newOffset = computeNewZoomOffset(zoom.current, newZoom, mousePos.current, cameraOffset.current)
        drawAllCanvases(newZoom, newOffset); //cameraOffset.current
        //drawAllCanvases(newZoom, cameraOffset.current)
        resetLabels();
        zoom.current = newZoom;
        cameraOffset.current = newOffset
    };

    const handleKeyPress = (e: any) => {
        console.log(e.key)
        if (e.key >= '0' && e.key <= '6') {
            // Perform desired actions for number key press
            console.log('Number key pressed:', e.key);
            setLabelClass(parseInt(e.key));
            if (labelType === "Smart Labelling") {
                updateSAM();
            }
        } else if (e.key === 'Escape') {
            resetLabels()
        } else if (e.key === 'v') {
            toggleVisibility()
        } else {
            handlePanKey(e);
        }
    }

    const toggleVisibility = () => {
        if (overlayType === "Segmentation") {
            setSegOpacity(0)
            setLabelOpacity(200)
            setOverlayType("Label")
        } else if (overlayType === "Label") {
            setSegOpacity(0)
            setLabelOpacity(0)
            setOverlayType("None")
        } else if (overlayType === "None") {
            setSegOpacity(200)
            setLabelOpacity(0)
            setOverlayType("Segmentation")
        }
    }

    const handlePanKey = (e: any) => {
        let redraw = false;
        let newOffset: Offset;
        const c = cameraOffset.current;
        const delta = PAN_OFFSET / zoom.current;
        if (e.key == "w" || e.key == "ArrowUp") {
            newOffset = { x: c.x, y: c.y - delta };
            redraw = true;
        }
        else if (e.key == "s" || e.key == "ArrowDown") {
            newOffset = { x: c.x, y: c.y + delta };
            redraw = true;
        } else if (e.key == "a" || e.key == "ArrowLeft") {
            newOffset = { x: c.x - delta, y: c.y };
            redraw = true;
        } else if (e.key == "d" || e.key == "ArrowRight") {
            newOffset = { x: c.x + delta, y: c.y };
            redraw = true;
        } else {
            newOffset = c;
        }

        if (redraw) {
            resetLabels();
            drawAllCanvases(zoom.current, newOffset);
            cameraOffset.current = newOffset;
        }
    }

    const resetLabels = () => {
        polyPoints.current = []
        clearctx(animatedCanvasRef)
        clearctx(animatedOverlayRef)
        setMaskImg(null)
    }

    const resetAnimation = () => {
        window.cancelAnimationFrame(animationRef.current)
        animation()
    }

    const animation = () => {
        if (animatedOverlayRef.current === null) { return; }
        const ctx = getctx(animatedOverlayRef)
        if (ctx === null) { return; }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        if (labelType === "Brush") {
            draw(ctx, mousePos.current.x, mousePos.current.y, brushWidth, hex, false);
        } else if (labelType === "Erase") {
            drawErase(ctx, mousePos.current.x, mousePos.current.y, brushWidth, false);
        } else if (labelType === "Polygon") {
            const pointsPlaced = (polyPoints.current.length > 0)
            if (pointsPlaced) {
                drawPolygon(ctx, polyPoints.current, hex);
                drawPolygon(ctx, [polyPoints.current[polyPoints.current.length - 1], mousePos.current], hex);
                const snap = checkSnap(mousePos.current.x, mousePos.current.y, polyPoints.current)
                if (snap.success) {
                    draw(ctx, snap.x, snap.y, 10, hex, false);
                }
            }
        }
        animationRef.current = requestAnimationFrame(animation);
    }

    const drawAllCanvases = (updateZoom: number, updateOffset: Offset) => {
        for (let i = 0; i < refs.length - 1; i++) {
            const ctx = getctx(refs[i])
            const gt = groundTruths[i]
            if (gt === null || ctx?.canvas == undefined || ctx === null) {
                return;
            }
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            drawImage(ctx, gt, updateOffset, updateZoom);
        };
    }

    const drawImgOnUpdate = (canvasRef: RefObject<HTMLCanvasElement>, img: HTMLImageElement | null) => {
        const ctx = getctx(canvasRef);
        if (img === null || ctx === null) {
            return;
        };
        clearctx(canvasRef);
        drawImage(ctx, img, cameraOffset.current, zoom.current);
    }

    const updateImgOnArr = (arr: Uint8ClampedArray, img: HTMLImageElement | null, opacity: number, setterFn: any) => {
        if (img === null) { return; }
        const newImageData = arrayToImageData(arr, img.height, img.width, 0, null, opacity);
        const newImage = imageDataToImage(newImageData);
        setterFn(newImage);
    }

    useEffect(() => {
        console.log('Image changed');
        let ctx = getctx(imgCanvasRef);
        if (image === null || ctx?.canvas == undefined) { return; }
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const newLabelImg = new Image(image.width, image.height);
        const newSegImg = new Image(image.width, image.height);
        setLabelImg(newLabelImg);
        setSegImg(newSegImg);

        if (ctx !== null) { drawImage(ctx, image, cameraOffset.current, zoom.current); }
        animation()
    }, [image])

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

    useEffect(() => {
        resetLabels()
    }, [labelType]) // clear animated canvas when switching

    useEffect(() => {
        for (let ref of refs) {
            const canv = ref.current
            if (canv) {
                canv.width = canvSize.x
                canv.height = canvSize.y
            }
        }
        if (image === null) { return }
        const centreOffset = computeCentreOffset(image, canvSize.x, canvSize.y)
        console.log(centreOffset)
        cameraOffset.current = centreOffset
        drawAllCanvases(zoom.current, centreOffset)
    }, [canvSize])

    useEffect(() => {
        const resizeCanvs = () => {
            const container = containerRef.current
            if (container) {
                const newCanvSize = { x: container.clientWidth, y: container.clientHeight }
                setCanvSize(newCanvSize)
            }
        }
        resizeCanvs()
        window.addEventListener('resize', resizeCanvs)
    }, [])

    useEffect(() => { resetAnimation() }, [labelType, brushWidth, labelClass])


    // Fixed canvas width will cause errors later i.e lack of resizing //onWheel={handleScroll} onKeyUp={e => onKeyUp(e)}
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