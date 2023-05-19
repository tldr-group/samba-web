import React, { RefObject, useRef, useContext, useEffect } from "react";
import AppContext from "./hooks/createContext";
import { ToolProps, modelInputProps } from "./helpers/Interfaces";
import { rgbaToHex, colours } from "./helpers/maskUtils"
import { get } from "underscore";


const draw = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colour: string) => {
    ctx.fillStyle = colour; //"#43ff641a"
    ctx.beginPath();
    ctx.ellipse(x, y, width, width, 0, 0, 2 * Math.PI);
    ctx.fill();
}

const getctx = (ref: RefObject<HTMLCanvasElement>) => { return ref.current!.getContext("2d", { willReadFrequently: true }) }
const clearctx = (ref: RefObject<HTMLCanvasElement>) => {
    const ctx = getctx(ref)
    ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

const filled = (p: number[]) => { return (p[0] > 0 && p[1] > 0 && p[2] > 0 && p[3] > 0) }

const MultiCanvas = () => {
    const {
        image: [image],
        maskImg: [maskImg],
        clicks: [, setClicks],
        labelType: [labelType],
        labelClass: [labelClass],
        brushWidth: [brushWidth],
        labelOpacity: [labelOpacity]
    } = useContext(AppContext)!;

    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

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
        const drawing = (labelType == "Brush" || labelType == "Erase")
        const leftClick = (e.button == 0)

        if (drawing && leftClick) { clicking.current = false; };
        if ((labelType == "Brush" || labelType == "SAM") && leftClick) {
            console.log(labelOpacity)
            drawCanv1onCanv2(animatedCanvasRef, labelCanvasRef, labelOpacity); // TODO: change this to make label canv ref right opacity
            clearctx(animatedCanvasRef);
        };
    }

    const handleClickMove = (e: any) => {
        let el = e.nativeEvent.target;
        const rect = el.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if ((clicking.current) && (labelType == "Brush")) {
            let ctx = getctx(animatedCanvasRef);
            if (ctx != null) {
                const c = colours[labelClass]
                const hex = rgbaToHex(c[0], c[1], c[2], 255) // was label opacity
                draw(ctx, x, y, brushWidth, hex)
            };
        } else if (labelType == "SAM") {
            //handleMouseMove(e)
            const click = getClick(x, y);
            if (click) setClicks([click]);
        }
    };

    const drawCanv1onCanv2 = (ref1: RefObject<HTMLCanvasElement>, ref2: RefObject<HTMLCanvasElement>, draw_opacity: number = 255) => {
        const ctx1 = getctx(ref1)
        const ctx2 = getctx(ref2)
        const imageData1 = ctx1?.getImageData(0, 0, ctx1.canvas.width, ctx1.canvas.height)
        const imageData2 = ctx2?.getImageData(0, 0, ctx2.canvas.width, ctx2.canvas.height)

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
            }
            ctx2?.putImageData(imageData2, 0, 0)
        }
    };

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
    // Fixed canvas width will cause errors later i.e lack of resizing
    return (<div onMouseDown={handleClick} onMouseMove={handleClickMove} onMouseUp={handleClickEnd}>
        {refs.map((r, i) => <canvas key={i} ref={r} height={1024} width={1024} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
    </div>)
}

export default MultiCanvas