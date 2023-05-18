import React, { RefObject, useRef, useContext, useEffect } from "react";
import AppContext from "./hooks/createContext";
import { ToolProps } from "./helpers/Interfaces";
import { rgbaToHex, colours } from "./helpers/maskUtils"


const draw = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, colour: string) => {
    ctx.fillStyle = colour; //"#43ff641a"
    console.log(colour)
    ctx.beginPath();
    ctx.ellipse(x, y, width, width, 0, 0, 2 * Math.PI);
    ctx.fill();
}

const getctx = (ref: RefObject<HTMLCanvasElement>) => { return ref.current!.getContext("2d") }

const MultiCanvas = ({ handleMouseMove }: ToolProps) => {
    const {
        image: [image],
        maskImg: [maskImg],
        labelType: [labelType],
        labelClass: [labelClass],
        brushWidth: [brushWidth],
        labelOpacity: [labelOpacity]
    } = useContext(AppContext)!;

    const imgCanvasRef = useRef<HTMLCanvasElement>(null);
    const segCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const samCanvasRef = useRef<HTMLCanvasElement>(null);
    const animatedCanvasRef = useRef<HTMLCanvasElement>(null);

    const refs = [imgCanvasRef, segCanvasRef, labelCanvasRef, samCanvasRef, animatedCanvasRef]
    const clicking = useRef<boolean>(false);

    const handleClick = (e: any) => {
        clicking.current = true;
    }

    const handleClickEnd = (e: any) => {
        clicking.current = false;
    }

    const handleClickMove = (e: any) => {
        console.log(labelType)
        let el = e.nativeEvent.target;
        const rect = el.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if ((clicking.current) && (labelType == "Brush")) {
            let ctx = getctx(labelCanvasRef);
            if (ctx != null) {
                const c = colours[labelClass]
                const hex = rgbaToHex(c[0], c[1], c[2], labelOpacity)
                draw(ctx, x, y, brushWidth, hex)
            };
        } else if (labelType == "SAM") {
            handleMouseMove(e)
        }
    };

    useEffect(() => {
        let ctx = getctx(imgCanvasRef);
        if (image === null) {
            return
        }
        ctx?.drawImage(image, 0, 0)
    }, [image])

    useEffect(() => {
        let ctx = getctx(samCanvasRef);
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height) //won't work when transformed
        if (maskImg === null) {
            return
        }
        ctx?.drawImage(maskImg, 0, 0)
    }, [maskImg])
    // Fixed canvas width will cause errors later i.e lack of resizing
    return (<div onMouseDown={handleClick} onMouseMove={handleClickMove} onMouseUp={handleClickEnd}>
        {refs.map((r, i) => <canvas key={i} ref={r} height={1024} width={1024} style={{ position: 'absolute', left: '0', top: '0' }}></canvas>)}
    </div>)
}

export default MultiCanvas