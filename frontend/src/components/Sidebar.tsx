/* Sidebar is the series of cards on the left hand side of the screen that contain the buttons for changing states in 
the App. These are:
1) LabelFrame: change labelling type, label class, brush width, SAM label region. Also has a nice outline that changes
when current class changes
2) Overlays frame: changes the opacity of the selected overlay (segmentation or labels)
3) Navigation frame: either a slider to change which image in a TIFF stack is looked at OR a neat little thumbnail
of a large image which when clicked will change focus to that sub-image
4) A spinny wheel in a box that appears when pinging the backed (segmenting or encoding).
*/

import React, { useContext, useEffect, useRef, useState } from "react";
import AppContext from "./hooks/createContext";
import { colours, rgbaToHex, getSplitInds, getctx, getxy } from "./helpers/canvasUtils";
import { Label, LabelFrameProps, NavigationProps, SidebarProps, themeBGs, Theme } from "./helpers/Interfaces";

import { ToolTip } from "./Topbar";
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Spinner from "react-bootstrap/Spinner";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import * as _ from "underscore";
import { relative } from "path";


const _getCSSColour = (currentStateVal: any, targetStateVal: any, successPrefix: string, colourIdx: number, theme: Theme): string => {
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
        outlineStr = themeBGs[theme][2];
    }
    return outlineStr;
}


const Sidebar = ({ requestEmbedding, trainClassifier, changeToImage }: SidebarProps) => {
    const {
        labelClass: [labelClass,],
        theme: [theme,],
        processing: [processing,],
    } = useContext(AppContext)!;

    const _getTrainBtn = () => {
        if (processing === "Segmenting" || processing === "Applying") {
            return (<Button disabled variant={themeBGs[theme][0]} style={{
                marginLeft: '28%',
                boxShadow: "1px 1px  1px grey", outline: _getCSSColour("foo", "foo", "3px solid ", labelClass, theme),
            }}>
                <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                />
                &nbsp;{processing}
            </Button>)
        } else {
            return (<Button onClick={trainClassifier} variant={themeBGs[theme][0]} style={{ marginLeft: '28%', boxShadow: "1px 1px  1px grey", color: "#ffffff" }}>Train Classifier!</Button>)
        }
    }

    // holds all the stuff on the side of the screen: train button, label frame, overlay frame and a hidden spin wheel that displays when encoding or segmenting
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            {_getTrainBtn()}
            <div className={`h-full w-[20%]`}>
                <LabelFrame requestEmbedding={requestEmbedding} />
                <OverlaysFrame />
                <NavigationFrame changeToImage={changeToImage} />
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
        processing: [processing,],
        theme: [theme,],
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
        if (name == "Smart Labelling") { // if switching to SAM labelling, requestEmbedding from app (which returns early if it's already set)
            console.log('Smart Labelling')
            requestEmbedding();
        };
    };

    const _getImg = (l: any) => {
        if (l.name == "Smart Labelling" && processing === "Encoding") {
            return (
                <div style={{
                    marginLeft: '7%', width: '40px', height: '40px', position: 'relative',
                    outline: _getCSSColour(l.name, labelType, "3px solid ", labelClass, theme),
                    backgroundColor: themeBGs[theme][2], borderRadius: '3px', boxShadow: '2px 2px 2px black',
                }}>
                    < Spinner as='span' animation="border" variant="secondary" style={{ position: "absolute", left: "5px", top: "5px", width: '30px', height: '30px' }} />
                </div>
            )
        } else {
            return (<img src={prefix + l.path} style={
                {
                    backgroundColor: themeBGs[theme][2], borderRadius: '3px',
                    marginLeft: '7%', width: '40px', boxShadow: '2px 2px 2px black',
                    outline: _getCSSColour(l.name, labelType, "3px solid ", labelClass, theme)
                }
            }
                onClick={(e) => _setLabel(e, l.name)}></img>)
        }
    }

    const _setWidth = (e: any) => { setBrushWidth(e.target.value) }


    return (
        <Card className="text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }} bg={themeBGs[theme][0]}>
            <Card.Header as="h5">Label</Card.Header>
            <Card.Body className={`flex`}>
                <>
                    {labels.map(l =>
                        <OverlayTrigger
                            key={l.name}
                            placement="top"
                            delay={{ show: 250, hide: 400 }}
                            overlay={ToolTip(l.name)}>
                            {_getImg(l)}
                        </OverlayTrigger>

                    )}
                </>
            </Card.Body>
            <Card.Body>
                Class <p style={{ margin: "0px" }}></p>
                <ButtonGroup style={{ paddingLeft: "3%", marginLeft: '0%' }}>
                    {classes.map(i => <Button key={i} variant="light" onClick={(e) => setLabelClass(i)} style={{
                        backgroundColor: _getCSSColour(i, labelClass, "", labelClass, theme),
                        border: _getCSSColour(i, i, "2px solid", i, theme),
                        margin: '1px 1px 1px 1px'
                    }}>{i}</Button>)}
                </ButtonGroup>
            </Card.Body>
            {(labelType == "Brush" || labelType == "Erase") && <Card.Body>
                {labelType} Width
                <Form.Range onChange={(e) => _setWidth(e)} min="1" max="100" value={brushWidth} />
            </Card.Body>}
            {labelType == "Smart Labelling" && <Card.Body>
                Smart Label Region
                <ButtonGroup style={{ paddingLeft: "4%" }}>
                    {regionSizes.map((size, i) => <Button key={i} variant="light" onClick={(e) => setMaskIdx(3 - i)} style={{
                        backgroundColor: _getCSSColour(3 - i, maskIdx, "", labelClass, theme),
                        borderColor: _getCSSColour(3 - i, maskIdx, "", labelClass, theme)
                    }}>{size}</Button>)}
                </ButtonGroup>
            </Card.Body>}
        </Card >
    );
}

const OverlaysFrame = () => {
    const {
        overlayType: [overlayType, setOverlayType],
        segOpacity: [, setSegOpacity],
        labelOpacity: [, setLabelOpacity],
        theme: [theme,],
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
        <Card className="text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }} bg={themeBGs[theme][0]}>
            <Card.Header as="h5">Overlay</Card.Header>
            <Card.Body className="flex">
                <Form.Select onChange={e => _setOverlayType(e.target.value)} value={overlayType} style={{ backgroundColor: themeBGs[theme][2] }}>
                    <option value="None" >Overlay type</option>
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


const NavigationFrame = ({ changeToImage }: NavigationProps) => {
    const {
        imgType: [imgType,],
        theme: [theme]
    } = useContext(AppContext)!;
    const nImages = 2

    if (nImages > 1 && imgType != "single") {
        return (
            <Card className="text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }} bg={themeBGs[theme][0]}>
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
        theme: [theme,],
    } = useContext(AppContext)!;
    // Reference stord to update later.
    const canvRef = useRef<HTMLCanvasElement>(null);
    const [canvSize, setCanvSize] = useState({ width: 0, height: 0 });

    const drawCanvas = (ctx: CanvasRenderingContext2D, selectedImg: number, largeImg: HTMLImageElement, x: number | null, y: number | null) => {
        /* Given canvas context, currently chosen image, the large image and a click x, click , split the image up with
        splitInds (largest even split that's less than 1024 in each dir), draw lines across the image corresponding to
        this splitting in canvas coordinates (shrunk relative to real image). Highlight the currently chosen sub image
        with the labelling and if hovering over the canvas, draw a grey square over where the mouse is. */
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        ctx.strokeStyle = hex;
        const splitInds = getSplitInds(largeImg);
        const [dx, dy, nW, nH] = [splitInds['dx'], splitInds['dy'], splitInds['nW'], splitInds['nH']]
        drawLines(ctx, splitInds['h'], largeImg.width, largeImg.height, 'h');
        drawLines(ctx, splitInds['w'], largeImg.width, largeImg.height, 'w');
        const selectedBox = rgbaToHex(c[0], c[1], c[2], 0.55 * 255);
        const sqX = Math.round(selectedImg % nW);
        const sqY = Math.floor(selectedImg / nW);
        drawSquare(ctx, sqX, sqY, splitInds, largeImg.width, largeImg.height, selectedBox)
        if (x != null && y != null) {
            const hoverBox = rgbaToHex(182, 182, 182, 0.8 * 255);
            const sqX = Math.round((x / canvSize.width) * (nW - 1)) //n
            const sqY = Math.round((y / canvSize.height) * (nH - 1))
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

    // Throttled to avoid over drawing
    const drawOnHover = _.throttle((e: any) => {
        const res = getxy(e)
        if (largeImg === null) { return; }
        const ctx = getctx(canvRef);
        if (ctx === null) { return; }
        drawCanvas(ctx, imgIdx, largeImg, res[0], res[1]);
    }, 15)

    const onClick = (e: any) => {
        // On click, change sub image to the selected square
        const ctx = getctx(canvRef);
        if (largeImg === null || ctx === null) { return; }
        const res = getxy(e)
        const [x, y] = res
        const splitInds = getSplitInds(largeImg);
        const [dx, dy, nW, nH] = [splitInds['dx'], splitInds['dy'], splitInds['nW'], splitInds['nH']]
        const sqX = Math.round((x / canvSize.width) * (nW - 1)) //n
        const sqY = Math.round((y / canvSize.height) * (nH - 1))
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
        // Update if the user changes the image, label class (new colour) or Image idx (i.e with spinbox)
        if (largeImg === null || canvRef.current === null) { return; }
        const ctx = getctx(canvRef);
        if (ctx === null) { return; }
        drawCanvas(ctx, imgIdx, largeImg, null, null);
    }, [largeImg, labelClass, imgIdx])

    useEffect(() => {
        const canvas = canvRef.current;
        if (canvas === null) { return; }
        canvas.width = canvSize.width;
        canvas.height = canvSize.height;

    }, [canvSize]);

    useEffect(() => {
        const canvasContainer = document.getElementById('container');
        if (canvasContainer === null) { return }
        setCanvSize({
            width: canvasContainer.offsetWidth,
            height: canvasContainer.offsetHeight
        });
    }, [])

    // Two different display modes: visual navigation for large images and slider for stacks
    //width: "100%", height: "100%"
    if (imgType === "large") {
        return (
            <div>
                <div className={`flex`}>Piece: <input type="number" min={1} max={imgArrs.length}
                    value={imgIdx + 1} onChange={e => changeImageIdx(e)}
                    style={{ marginLeft: '8px', color: 'black', borderRadius: '4px', marginBottom: '10px', backgroundColor: themeBGs[theme][2] }} />
                </div>
                <div id="container" style={{ display: 'grid', width: "100%", height: "100%" }}>
                    {(largeImg !== null) ? <img src={largeImg.src} style={{ gridColumn: 1, gridRow: 1, width: "100%", height: "100%" }}></img> : <></>}
                    {(largeImg !== null) ? <canvas
                        onMouseMove={drawOnHover}
                        onMouseDown={onClick}
                        ref={canvRef}
                        style={{ gridColumn: 1, gridRow: 1, width: "100%", height: "100%" }}
                    ></canvas> : <></>}
                </div>
            </div >

        )
    } else if (imgType === "stack" || imgType === "multi") {
        return (
            <div>
                Image: <input type="number" min={1} max={imgArrs.length} value={imgIdx + 1} onChange={e => changeImageIdx(e)} style={{ marginLeft: '8px', color: 'black', borderRadius: '4px', backgroundColor: themeBGs[theme][2] }} />
                <Form.Range min={1} value={imgIdx + 1} max={imgArrs.length} onChange={e => changeImageIdx(e)} />
            </div>
        )
    } else {
        return (<></>)
    }
}


export default Sidebar