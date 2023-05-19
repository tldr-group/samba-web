import React, { RefObject, useRef, useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { modelInputProps, Offset } from "./helpers/Interfaces";
import { rgbaToHex, colours } from "./helpers/maskUtils"


const MAX_ZOOM = 5
const MIN_ZOOM = 0.1
const SCROLL_SENSITIVITY = 0.0005

//let cameraOffset = { x: 0, y: 0 }

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
        labelClass: [labelClass],
        brushWidth: [brushWidth],
        labelOpacity: [labelOpacity],
        maskIdx: [maskIdx, setMaskIdx],
        zoom: [zoom, setZoom],
    } = useContext(AppContext)!;

    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const init_offset = { x: window.innerWidth / 2, y: window.innerHeight / 2, clickType: 1 }
    const [cameraOffset, setCameraOffset] = useState<Offset>(init_offset);

    const refs = [imgCanvasRef, segCanvasRef, labelCanvasRef, animatedCanvasRef]
    const clicking = useRef<boolean>(false);

    const getClick = (x: number, y: number): modelInputProps => {
        const clickType = 1;
        return { x, y, clickType };
    };

    const handleClick = (e: any) => {
        const drawing = (labelType == "Brush" || labelType == "Erase")
        if (drawing) { clicking.current = true; }
    }

    const handleClickEnd = (e: any) => {
        const drawing = (labelType == "Brush" || labelType == "Erase");
        const leftClick = (e.button == 0);
        const rightClick = (e.button == 2);

        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "SAM") && leftClick) {
            console.log(labelOpacity);
            drawCanv1onCanv2(animatedCanvasRef, labelCanvasRef, labelOpacity); // TODO: change this to make label canv ref right opacity
            clearctx(animatedCanvasRef);

        } else if (labelType == "SAM" && rightClick) {
            const newMaskIdx = (maskIdx % 3) + 1;
            setMaskIdx((newMaskIdx));
            console.log(newMaskIdx);
            const res = getxy(e)
            const x = res[0]
            const y = res[1]
            const click = getClick(x, y);
            if (click) setClicks([click]); // reload mask with new MaskIdx

        }
    }

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
            const click = getClick(x, y);
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

    const drawCanv1onCanv2 = (ref1: RefObject<HTMLCanvasElement>, ref2: RefObject<HTMLCanvasElement>, draw_opacity: number = 255) => {
        const ctx1 = getctx(ref1)
        const ctx2 = getctx(ref2)
        const imageData1 = ctx1?.getImageData(0, 0, ctx1.canvas.width, ctx1.canvas.height);
        const imageData2 = ctx2?.getImageData(0, 0, ctx2.canvas.width, ctx2.canvas.height);

        if (imageData1 != undefined && imageData2 != undefined) {
            const data1 = imageData1.data;
            const data2 = imageData2.data;
            for (let i = 0; i < data1.length; i += 4) {
                if (filled([data1[i], data1[i + 1], data1[i + 2], data1[i + 3]])) {
                    data2[i] = data1[i];
                    data2[i + 1] = data1[i + 1];
                    data2[i + 2] = data1[i + 2];
                    data2[i + 3] = draw_opacity;
                }
            };
            ctx2?.putImageData(imageData2, 0, 0);
        }
    };

    const zoomCanvas = (ctx: CanvasRenderingContext2D, newZoom: number) => {
        /*
        console.log("zooming")
        ctx?.translate(window.innerWidth / 2, window.innerHeight / 2)
        ctx?.scale(newZoom, newZoom)
        ctx?.translate(-window.innerWidth / 2 + cameraOffset.x, -window.innerHeight / 2 + cameraOffset.y)
        const afterTranslate = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx?.putImageData(afterTranslate, 0, 0)
        */

    }

    // is the reason the image stays the sane bc we have a listener here (i.e is this called every render?)
    useEffect(() => {
        let ctx = getctx(imgCanvasRef);
        if (image === null) {
            return;
        }
        ctx?.drawImage(image, 0, 0);
    }, [image])


    useEffect(() => {
        let ctx = getctx(animatedCanvasRef);
        clearctx(animatedCanvasRef)
        if (maskImg === null) {
            return;
        }
        ctx?.drawImage(maskImg, 0, 0);
    }, [maskImg])

    useEffect(() => { clearctx(animatedCanvasRef) }, [labelType]) // clear animated canvas when switching

    useEffect(() => { drawCanv1onCanv2(labelCanvasRef, labelCanvasRef, labelOpacity) }, [labelOpacity])

    useEffect(() => {
        const ctxs = refs.map(ref => getctx(ref))
        for (let i = 0; i < ctxs.length; i++) {
            const ctx = ctxs[i]
            if (ctx != null) {
                zoomCanvas(ctx, zoom)
            }
        }
    }, [zoom])

    // Fixed canvas width will cause errors later i.e lack of resizing //onWheel={handleScroll}
    return (
        <div onMouseDown={handleClick} onMouseMove={handleClickMove} onMouseUp={handleClickEnd} onContextMenu={(e) => e.preventDefault()} onMouseLeave={e => clearctx(animatedCanvasRef)}>
            {refs.map((r, i) => <canvas key={i} ref={r} height={1024} width={1024} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
        </div>)
}

export default MultiCanvas