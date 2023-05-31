import React, { useContext, useEffect, useRef, useState } from "react";
import AppContext from "./hooks/createContext";
import { colours, rgbaToHex, getSplitInds, getctx, getxy } from "./helpers/canvasUtils";
import { Label, LabelFrameProps, NavigationProps, SidebarProps } from "./helpers/Interfaces";

import { ToolTip } from "./Topbar";
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Spinner from "react-bootstrap/Spinner";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import * as _ from "underscore";


const Sidebar = ({ requestEmbedding, trainClassifier, changeToImage }: SidebarProps) => {
    // holds all the stuff on the side of the screen: train button, label frame, overlay frame and a hidden spin wheel that displays when encoding or segmenting
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <Button onClick={trainClassifier} variant="dark" style={{ marginLeft: '28%', boxShadow: "1px 1px  1px grey" }}>Train Classifier!</Button>{' '}
            <div className={`h-full w-[20%]`}>
                <LabelFrame requestEmbedding={requestEmbedding} />
                <OverlaysFrame />
                <NavigationFrame changeToImage={changeToImage} />
                <SpinWheel></SpinWheel>
            </div>
        </div>
    );
}

const LabelFrame = ({ requestEmbedding }: LabelFrameProps) => {
    const {
        labelType: [labelType, setLabelType],
        labelClass: [labelClass, setLabelClass],
        brushWidth: [brushWidth, setBrushWidth],
        maskIdx: [maskIdx, setMaskIdx],
    } = useContext(AppContext)!;

    const prefix = "../assets/icons/";
    const sam = { "path": "smart.png", "name": "Smart Labelling" };
    const poly = { "path": "polygon.png", "name": "Polygon" };
    const brush = { "path": "brush.png", "name": "Brush" };
    const erase = { "path": "erase.png", "name": "Erase" };
    const labels = [sam, poly, brush, erase]; // loop over these to generate icons

    const regionSizes = ["Small", "Medium", "Large"] // text for button group
    const classes: number[] = [1, 2, 3, 4, 5, 6]
    const _setLabel = (e: any, name: string) => {
        setLabelType(name as Label);
        if (name == "SAM") { // if switching to SAM labelling, requestEmbedding from app (which returns early if it's already set)
            requestEmbedding();
        };
    };
    const _setWidth = (e: any) => { setBrushWidth(e.target.value) }
    const _getCSSColour = (currentStateVal: any, targetStateVal: any, successPrefix: string, colourIdx: number): string => {
        // Boring function to map a success to current labelling colour. Used for GUI elements.
        const c = colours[colourIdx];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        const matches: boolean = (currentStateVal === targetStateVal);
        const erase: boolean = (targetStateVal === "Erase" && matches);

        let outlineStr: string;
        if (erase) {
            outlineStr = successPrefix + "#ffffff";
        } else if (matches) {
            outlineStr = successPrefix + hex;
        } else {
            outlineStr = "";
        }
        return outlineStr;
    }

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header as="h5">Label</Card.Header>
            <Card.Body className={`flex`}>
                <>
                    {labels.map(l =>
                        <OverlayTrigger
                            key={l.name}
                            placement="left"
                            delay={{ show: 250, hide: 400 }}
                            overlay={ToolTip(l.name)}>
                            <img src={prefix + l.path} style={
                                {
                                    backgroundColor: 'white', borderRadius: '3px',
                                    marginLeft: '7%', width: '40px', boxShadow: '2px 2px 2px black',
                                    outline: _getCSSColour(l.name, labelType, "3px solid ", labelClass)
                                }
                            }
                                onClick={(e) => _setLabel(e, l.name)}></img>
                        </OverlayTrigger>

                    )}
                </>
            </Card.Body>
            <Card.Body>
                Class <p style={{ margin: "0px" }}></p>
                <ButtonGroup style={{ paddingLeft: "4%", marginLeft: '5%' }}>
                    {classes.map(i => <Button key={i} variant="light" onClick={(e) => setLabelClass(i)} style={{
                        backgroundColor: _getCSSColour(i, labelClass, "", labelClass),
                        border: _getCSSColour(i, labelClass, "2px solid", labelClass),
                    }}>{i}</Button>)}
                </ButtonGroup>
            </Card.Body>
            <Card.Body>
                Brush Width
                <Form.Range onChange={(e) => _setWidth(e)} min="1" max="100" value={brushWidth} />
            </Card.Body>
            <Card.Body>
                Smart Label Region
                <ButtonGroup style={{ paddingLeft: "4%" }}>
                    {regionSizes.map((size, i) => <Button key={i} variant="light" onClick={(e) => setMaskIdx(3 - i)} style={{
                        backgroundColor: _getCSSColour(3 - i, maskIdx, "", labelClass),
                        borderColor: _getCSSColour(3 - i, maskIdx, "", labelClass)
                    }}>{size}</Button>)}
                </ButtonGroup>
            </Card.Body>

        </Card >
    );
}

const OverlaysFrame = () => {
    const {
        overlayType: [overlayType, setOverlayType],
        segOpacity: [, setSegOpacity],
        labelOpacity: [, setLabelOpacity],
    } = useContext(AppContext)!;
    // Throttled to avoid over rendering and slowing down too much
    const changeOpacity = _.throttle((e: any) => {
        if (overlayType == "Label") {
            setLabelOpacity(e.target.value);
        } else if (overlayType == "Segmentation") {
            setSegOpacity(e.target.value);
        }
    }, 13);
    const _setOverlayType = (val: string) => {
        if (val == "Segmentation") {
            setOverlayType("Segmentation");
        } else if (val == "Label") {
            setOverlayType("Label");
        };
    };

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header as="h5">Overlay</Card.Header>
            <Card.Body className="flex">
                <Form.Select onChange={e => _setOverlayType(e.target.value)}>
                    <option >Overlay type</option>
                    <option value="Segmentation">Segmentation</option>
                    <option value="Label">Labels</option>
                </Form.Select>
            </Card.Body>
            <Card.Body>
                Opacity
                <Form.Range onChange={e => changeOpacity(e)} min="0" max="255" />
            </Card.Body>
        </Card>
    );
}

const SpinWheel = () => {
    // Spinny wheel and text that shows up when processing state is true. Has same bg colour as labelling colour.
    const {
        processing: [processing,],
        labelClass: [labelClass,],
    } = useContext(AppContext)!;

    const c = colours[labelClass];
    const hex = rgbaToHex(c[0], c[1], c[2], 255);

    if (processing !== "None") {
        return (<div>
            <Button disabled style={{
                backgroundColor: hex, borderColor: hex, width: '18rem', margin: '15%'
            }}>
                < Spinner as='span' animation="border" />
                <p style={{ marginBottom: '-4px' }}>{processing}</p>
            </Button>
        </div >)
    }

    return (
        <div></div >
    )
}

const NavigationFrame = ({ changeToImage }: NavigationProps) => {
    const { imgType: [imgType,] } = useContext(AppContext)!;
    const nImages = 2

    if (nImages > 1 && imgType != "single") {
        return (
            <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
                <Card.Header as="h5">Navigation</Card.Header>
                <Card.Body>
                    <ImgSelect changeToImage={changeToImage} />
                </Card.Body>
            </Card>
        )
    } else {
        return (
            <div></div >
        )
    }
}

const ImgSelect = ({ changeToImage }: NavigationProps) => {
    const {
        largeImg: [largeImg,],
        imgArrs: [imgArrs,],
        labelClass: [labelClass,],
        imgIdx: [imgIdx, setImgIdx],
        imgType: [imgType,],
    } = useContext(AppContext)!;
    const canvRef = useRef<HTMLCanvasElement>(null);

    const drawCanvas = (ctx: CanvasRenderingContext2D, selectedImg: number, largeImg: HTMLImageElement, x: number | null, y: number | null) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        ctx.strokeStyle = hex;
        const splitInds = getSplitInds(largeImg);
        const [dx, dy, nW] = [splitInds['dx'], splitInds['dy'], splitInds['nW']]
        drawLines(ctx, splitInds['h'], largeImg.width, largeImg.height, 'h');
        drawLines(ctx, splitInds['w'], largeImg.width, largeImg.height, 'w');
        const selectedBox = rgbaToHex(c[0], c[1], c[2], 0.55 * 255);
        const sqX = Math.round(selectedImg % nW);
        const sqY = Math.floor(selectedImg / nW);
        drawSquare(ctx, sqX, sqY, splitInds, largeImg.width, largeImg.height, selectedBox)
        if (x != null && y != null) {
            const hoverBox = rgbaToHex(182, 182, 182, 0.8 * 255);
            const sqX = Math.round((x / ctx.canvas.width) * largeImg.width / dx) //n
            const sqY = Math.floor((y / ctx.canvas.height) * largeImg.height / dy)
            drawSquare(ctx, sqX, sqY, splitInds, largeImg.width, largeImg.height, hoverBox)
        }
    }

    const drawLines = (ctx: CanvasRenderingContext2D, endpoints: number[], iw: number, ih: number, mode: 'h' | 'w') => {
        let sf: number;
        if (mode == 'w') {
            sf = ctx.canvas.width / iw;
        } else {
            sf = ctx.canvas.height / ih;
        }
        for (let i of endpoints.slice(1)) {
            const ri = i * sf;
            ctx.lineWidth = 3;
            ctx.beginPath();
            (mode === 'w') ? ctx.moveTo(ri, 0) : ctx.moveTo(0, ri);
            (mode === 'w') ? ctx.lineTo(ri, ctx.canvas.height) : ctx.lineTo(ctx.canvas.width, ri);
            ctx.stroke();
        };
    }

    const drawSquare = (ctx: CanvasRenderingContext2D, sqX: number, sqY: number, inds: any,
        iw: number, ih: number, color: string) => {
        const [dx, dy] = [inds['dx'], inds['dy']]
        ctx.fillStyle = color;
        const sfW = ctx.canvas.width / iw;
        const sfH = ctx.canvas.height / ih;
        ctx.fillRect(sqX * sfW * dx, sqY * sfH * dy, dx * sfW, dy * sfH);
    }

    const drawOnHover = _.throttle((e: any) => {
        const res = getxy(e)
        if (largeImg === null) { return; }
        const ctx = getctx(canvRef);
        if (ctx === null) { return; }
        drawCanvas(ctx, imgIdx, largeImg, res[0], res[1]);
    }, 4)

    const onClick = (e: any) => {
        const ctx = getctx(canvRef);
        if (largeImg === null || ctx === null) { return; }
        const res = getxy(e)
        const [x, y] = res
        const splitInds = getSplitInds(largeImg);
        const [dx, dy, nW] = [splitInds['dx'], splitInds['dy'], splitInds['nW']]
        const sqX = Math.round((x / ctx.canvas.width) * largeImg.width / dx)
        const sqY = Math.floor((y / ctx.canvas.height) * largeImg.height / dy)
        // TODO: bug here. When click on bottom half of bottom row, rounds up and tries to index square outside range. Clamping as temporary solution
        const sq = Math.min(sqX + nW * sqY, imgArrs.length - 1)
        changeToImage(imgIdx, sq)
        setImgIdx(sq)
    }

    const changeImageIdx = (e: any) => {
        changeToImage(imgIdx, e.target.value - 1)
        setImgIdx(e.target.value - 1)
    }

    useEffect(() => {
        if (largeImg === null || canvRef.current === null) { return; }
        const ctx = getctx(canvRef);
        if (ctx === null) { return; }
        drawCanvas(ctx, imgIdx, largeImg, null, null);
    }, [largeImg, labelClass, imgIdx])

    if (imgType === "large") {
        return (
            <div>
                <div className={`flex`}>Piece: <input type="number" min={1} max={imgArrs.length}
                    value={imgIdx + 1} onChange={e => changeImageIdx(e)}
                    style={{ marginLeft: '8px', color: 'black', borderRadius: '4px', marginBottom: '10px' }} />
                </div>
                <div style={{ display: 'grid' }}>
                    {(largeImg !== null) ? <img src={largeImg.src} style={{ gridColumn: 1, gridRow: 1, width: "100%", height: "100%" }}></img> : <></>}
                    {(largeImg !== null) ? <canvas
                        onMouseMove={drawOnHover}
                        onMouseDown={onClick}
                        ref={canvRef}
                        style={{ gridColumn: 1, gridRow: 1, width: "100%", height: "100%" }}
                    ></canvas> : <></>}
                </div>
            </div>

        )
    } else if (imgType === "stack") {
        return (
            <div>
                Image: <input type="number" min={1} max={imgArrs.length} value={imgIdx + 1} onChange={e => changeImageIdx(e)} style={{ marginLeft: '8px', color: 'black', borderRadius: '4px' }} />
                <Form.Range min={1} value={imgIdx} max={imgArrs.length} onChange={e => changeImageIdx(e)} />
            </div>
        )
    } else {
        return (<></>)
    }
}


export default Sidebar