import React, { useRef } from "react";

const Canvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const clicking = useRef<boolean>(false);

    const draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        ctx.fillStyle = "#43ff641a";
        ctx.fillRect(x, y, 10, 10);
    }

    const handleClick = (e: any) => {
        clicking.current = true
    }

    const handleClickEnd = (e: any) => {
        clicking.current = false
    }

    const handleClickMove = (e: any) => {
        if (clicking.current) {
            let el = e.nativeEvent.target;
            const rect = el.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            let ctx = canvasRef.current!.getContext("2d");
            if (ctx != null) {
                draw(ctx, x, y)
            };
        };

    };



    return <canvas width={500} height={350}
        onMouseMove={handleClickMove}
        onMouseDown={handleClick}
        onMouseUp={handleClickEnd}
        ref={canvasRef}></canvas>
}

export default Canvas