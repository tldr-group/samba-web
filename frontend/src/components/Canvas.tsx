import React, { RefObject, useRef, useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps, Offset } from "./helpers/Interfaces";
import { rgbaToHex, colours, addImageDataToArray, arrayToImageData, imageDataToImage } from "./helpers/maskUtils"
import * as _ from "underscore";


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
    let el = e.nativeEvent.target;
    const rect = el.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    return [x, y]
}


const MultiCanvas = () => {
    const {
        image: [image],
        maskImg: [maskImg],
        clicks: [, setClicks],
        labelType: [labelType],
        labelClass: [labelClass, setLabelClass],
        labelArr: [labelArr, setLabelArr],
        brushWidth: [brushWidth],
        labelOpacity: [labelOpacity],
        maskIdx: [maskIdx, setMaskIdx],
        cameraOffset: [cameraOffset, setCameraOffset],
        zoom: [zoom, setZoom],
    } = useContext(AppContext)!;

    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const [labelImg, setLabelImg] = useState<HTMLImageElement | null>(null);

    const groundTruths = [image, labelImg, maskImg]
    const refs = [imgCanvasRef, labelCanvasRef, animatedCanvasRef]
    const clicking = useRef<boolean>(false);

    const getClick = (x: number, y: number): modelInputProps => {
        const clickType = 1;
        return { x, y, clickType };
    };

    const handleClick = (e: any) => {
        const drawing = (labelType == "Brush" || labelType == "Erase")
        if (drawing) { clicking.current = true; }
    }

    const handleClickEnd = _.throttle((e: any) => {
        const drawing = (labelType == "Brush" || labelType == "Erase");
        const leftClick = (e.button == 0);
        const rightClick = (e.button == 2);

        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "SAM") && leftClick) {
            console.log(labelOpacity);
            const ctx = getctx(animatedCanvasRef)
            if (ctx === null || image === null) {
                return
            }
            const labelImageData = ctx?.getImageData(cameraOffset.x, cameraOffset.y, image?.width, image?.height)
            const arr = addImageDataToArray(labelImageData, labelArr, labelClass)
            setLabelArr(arr)
            clearctx(animatedCanvasRef);
        } else if (labelType == "SAM" && rightClick) {
            const newMaskIdx = (maskIdx % 3) + 1;
            setMaskIdx((newMaskIdx));
            console.log(newMaskIdx);
            const res = getxy(e)
            const x = res[0]
            const y = res[1]
            const click = getClick(x - cameraOffset.x, y - cameraOffset.y);
            if (click) setClicks([click]); // reload mask with new MaskIdx
        } else if (labelType == "Erase") {
            const ctx = getctx(labelCanvasRef)
            if (image === null || ctx === null) {
                return
            }
            const labelImageData = ctx?.getImageData(cameraOffset.x, cameraOffset.y, image?.width, image?.height)
            const arr = addImageDataToArray(labelImageData, labelArr, 0, true)
            setLabelArr(arr)
        }
    }, 15)

    const handleClickMove = (e: any) => {
        const res = getxy(e)
        const x = res[0]
        const y = res[1]

        if ((clicking.current) && (labelType == "Brush")) {
            let ctx = getctx(animatedCanvasRef);
            if (ctx != null) {
                const c = colours[labelClass];
                const hex = rgbaToHex(c[0], c[1], c[2], 255); // was label opacity
                draw(ctx, x, y, brushWidth, hex);
            };
        } else if (labelType == "SAM") {
            // Get mouse position and scale the (x, y) coordinates back to the natural
            // scale of the image. Update the state of clicks with setClicks to trigger
            // the ONNX model to run and generate a new mask via a useEffect in App.tsx
            const click = getClick(x - cameraOffset.x, y - cameraOffset.y);
            if (click) setClicks([click]);
        } else if ((clicking.current) && (labelType == "Erase")) {
            let ctx = getctx(labelCanvasRef);
            if (ctx != null) {
                erase(ctx, x, y, brushWidth);
            };
        }
    };

    const handleScroll = (e: any) => {
        // Adjust the zoom level based on scroll wheel delta
        const delta = e.deltaY * SCROLL_SENSITIVITY > 0 ? -0.1 : 0.1; // Change the zoom increment as needed
        let newZoom = zoom + delta
        newZoom = Math.min(newZoom, MAX_ZOOM)
        newZoom = Math.max(newZoom, MIN_ZOOM)
        console.log(newZoom)
        setZoom(newZoom);
    };

    const handleKeyPress = (e: any) => {
        if (e.key >= '0' && e.key <= '6') {
            // Perform desired actions for number key press
            console.log('Number key pressed:', e.key);
            setLabelClass(parseInt(e.key));
        } else if (e.key == "w") {
            console.log("Pan up")
            const c = cameraOffset
            setCameraOffset({ x: c.x, y: c.y - 10 })
        }
        else if (e.key == "s") {
            console.log("Pan up")
            const c = cameraOffset
            setCameraOffset({ x: c.x, y: c.y + 10 })
        } else if (e.key == "a") {
            console.log("Pan up")
            const c = cameraOffset
            setCameraOffset({ x: c.x - 10, y: c.y })
        } else if (e.key == "d") {
            console.log("Pan up")
            const c = cameraOffset
            setCameraOffset({ x: c.x + 10, y: c.y })
        }
    }

    useEffect(() => {
        console.log('Image changed')
        let ctx = getctx(imgCanvasRef);
        if (image === null || ctx?.canvas == undefined) {
            return;
        }
        const dx = (ctx?.canvas.width - image.width) / 2;
        const dy = (ctx?.canvas.height - image.height) / 2;
        setCameraOffset({ x: dx, y: dy });
        const newLabelImg = new Image(image.width, image.height)
        setLabelImg(newLabelImg)

        // if i work with sx, sy, sw and sh properly i can do zooming like this
        ctx?.drawImage(image, 0, 0, image.width, image.height, dx, dy, image.width, image.height);
    }, [image])

    useEffect(() => {
        let ctx = getctx(animatedCanvasRef);
        clearctx(animatedCanvasRef)
        if (maskImg === null) {
            return;
        }
        ctx?.drawImage(maskImg, 0, 0, maskImg.width, maskImg.height, cameraOffset.x, cameraOffset.y, maskImg.width, maskImg.height);
    }, [maskImg])

    useEffect(() => {
        if (image === null) {
            return;
        }
        const newImageData = arrayToImageData(labelArr, image.height, image.width, 0, null, labelOpacity)
        const newImage = imageDataToImage(newImageData, zoom)
        setLabelImg(newImage)
    }, [labelArr, labelOpacity])

    useEffect(() => {
        const ctx = getctx(labelCanvasRef)
        ctx?.clearRect(0, 0, ctx?.canvas.width, ctx?.canvas.height)
        if (labelImg === null) {
            return;
        }
        ctx?.drawImage(labelImg, 0, 0, labelImg.width, labelImg.height, cameraOffset.x, cameraOffset.y, labelImg.width, labelImg.height);
    }, [labelImg])

    useEffect(() => { clearctx(animatedCanvasRef) }, [labelType]) // clear animated canvas when switching

    useEffect(() => {
        console.log(cameraOffset);
        for (let i = 0; i < refs.length; i++) {
            const ctx = getctx(refs[i])
            const gt = groundTruths[i]
            if (gt === null || ctx?.canvas == undefined) {
                return;
            }
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            if (i < 2) {
                ctx?.drawImage(gt, 0, 0, gt.width, gt.height, cameraOffset.x, cameraOffset.y, gt.width, gt.height);
            };
        };
    }, [cameraOffset])

    // Fixed canvas width will cause errors later i.e lack of resizing //onWheel={handleScroll}
    return (
        <div onMouseDown={handleClick} onMouseMove={handleClickMove} onMouseUp={handleClickEnd} onContextMenu={(e) => e.preventDefault()} onMouseLeave={e => clearctx(animatedCanvasRef)} onKeyDown={e => handleKeyPress(e)} tabIndex={0}>
            {refs.map((r, i) => <canvas key={i} ref={r} height={1024} width={1024} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
        </div>)
}

export default MultiCanvas