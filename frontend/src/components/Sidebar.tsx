import React, { useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { colours, rgbaToHex } from "./helpers/canvasUtils";
import { Label, SidebarProps } from "./helpers/Interfaces";


import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Spinner from "react-bootstrap/Spinner";
import * as _ from "underscore";


const Sidebar = ({ requestEmbedding, trainClassifier }: SidebarProps) => {
    // holds all the stuff on the side of the screen: train button, label frame, overlay frame and a hidden spin wheel that displays when encoding or segmenting
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <Button onClick={trainClassifier} variant="dark" style={{ marginLeft: '28%', boxShadow: "1px 1px  1px grey" }}>Train Classifier!</Button>{' '}
            <div className={`h-full w-[20%]`}>
                <LabelFrame requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} />
                <OverlaysFrame />
                <SpinWheel></SpinWheel>
            </div>
        </div>
    );
}

const LabelFrame = ({ requestEmbedding }: SidebarProps) => {
    const {
        labelType: [labelType, setLabelType],
        labelClass: [labelClass, setLabelClass],
        brushWidth: [brushWidth, setBrushWidth],
        maskIdx: [maskIdx, setMaskIdx],
    } = useContext(AppContext)!;

    const prefix = "../assets/icons/";
    const sam = { "path": "smart.png", "name": "SAM" };
    const poly = { "path": "polygon.png", "name": "Poly" };
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
                    {labels.map(l => <img key={l.name} src={prefix + l.path} style={
                        {
                            backgroundColor: 'white', borderRadius: '3px',
                            marginLeft: '7%', width: '40px', boxShadow: '2px 2px 2px black',
                            outline: _getCSSColour(l.name, labelType, "3px solid ", labelClass)
                        }
                    }
                        onClick={(e) => _setLabel(e, l.name)}
                    ></img>)}
                </>
            </Card.Body>
            <Card.Body>
                Class <p style={{ margin: "0px" }}></p>
                <ButtonGroup style={{ paddingLeft: "4%", marginLeft: '5%' }}>
                    {classes.map(i => <Button key={i} variant="light" onClick={(e) => setLabelClass(i)} style={{
                        backgroundColor: _getCSSColour(i, labelClass, "", labelClass),
                        borderColor: _getCSSColour(i, labelClass, "", labelClass),
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
    }, 15);
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
        <div>
        </div >
    )
}


export default Sidebar