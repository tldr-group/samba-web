import React, { useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { colours, rgbaToHex } from "./helpers/maskUtils";
import { Label, SidebarProps } from "./helpers/Interfaces";


import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ButtonGroup from "react-bootstrap/ButtonGroup";
import * as _ from "underscore";

const OPACITY_MIN: number = 25; //really hacky - if opacity gets too low then can't recover the data on label canvas - need better fix (hidden canvas?)


const Sidebar = ({ requestEmbedding, trainClassifier }: SidebarProps) => {
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <Button onClick={trainClassifier} variant="dark" style={{ marginLeft: '28%', boxShadow: "1px 1px  1px grey" }}>Train Classifier!</Button>{' '}
            <div className={`h-full w-[20%]`}>
                <LabelFrame requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} />
                <OverlaysFrame />
            </div>
        </div>
    );
}

const LabelFrame = ({ requestEmbedding }: SidebarProps) => {
    const {
        labelType: [labelType, setLabelType],
        labelClass: [labelClass],
        brushWidth: [brushWidth, setBrushWidth],
    } = useContext(AppContext)!;

    const prefix = "../assets/icons/";
    const sam = { "path": "smart.png", "name": "SAM", "fn": "foo" };
    const poly = { "path": "polygon.png", "name": "Poly", "fn": "foo" };
    const brush = { "path": "brush.png", "name": "Brush", "fn": "foo" };
    const erase = { "path": "erase.png", "name": "Erase", "fn": "foo" };
    const labels = [sam, poly, brush, erase];

    const classes: number[] = [1, 2, 3, 4, 5, 6]
    const _setLabel = (e: any, name: string) => {
        setLabelType(name as Label);
        if (name == "SAM") {
            requestEmbedding();
        };
    }
    const _setWidth = (e: any) => { setBrushWidth(e.target.value) }
    const _getOutline = (name: Label) => {
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        const matches: boolean = (name == labelType);

        let outlineStr: string;
        if (matches && (name != "Erase")) {
            outlineStr = "3px solid " + hex;
        } else if (matches && (name === "Erase")) {
            outlineStr = "3px solid " + "#ffffff";
        } else {
            outlineStr = "#000000 solid 0px";
        }
        return outlineStr
    }

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header>Label</Card.Header>
            <Card.Body className={`flex`}>
                <>
                    {labels.map(l => <img key={l.name} src={prefix + l.path} style={
                        {
                            backgroundColor: 'white', borderRadius: '3px',
                            marginLeft: '7%', width: '40px', boxShadow: '2px 2px 2px black',
                            outline: _getOutline(l.name as Label)
                        }
                    }
                        onClick={(e) => _setLabel(e, l.name)}
                    ></img>)}
                </>
            </Card.Body>
            <Card.Body>
                Brush Width
                <Form.Range onChange={(e) => _setWidth(e)} min={OPACITY_MIN} max="100" value={brushWidth} />
            </Card.Body>
            <Card.Body>
                Class
                <ButtonGroup>
                    {classes.map(i => <Button key={i} variant="dark">{i}</Button>)}
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
    const changeOpacity = _.throttle((e: any) => {
        if (overlayType == "Label") {
            setLabelOpacity(e.target.value)
        } else if (overlayType == "Segmentation") {
            setSegOpacity(e.target.value)
        }
    }, 15)
    const _setOverlayType = (val: string) => {
        if (val == "Segmentation") {
            setOverlayType("Segmentation")
        } else if (val == "Label") {
            setOverlayType("Label")
        }
    }

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header>Overlay</Card.Header>
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


export default Sidebar