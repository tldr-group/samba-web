import React, { useContext, useEffect, useState } from "react";
import AppContext from "./hooks/createContext";
import { colours, rgbaToHex } from "./helpers/maskUtils";
import { Label } from "./helpers/Interfaces";


import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ButtonGroup from "react-bootstrap/ButtonGroup";
import ToggleButton from "react-bootstrap/ToggleButton";


const Sidebar = () => {
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <Button variant="dark" style={{ marginLeft: '28%', boxShadow: "1px 1px  1px grey" }}>Train Classifier!</Button>{' '}
            <div className={`h-full w-[20%]`}>
                <LabelFrame />
                <OverlaysFrame />
            </div>
        </div>
    );
}

const LabelFrame = () => {
    const {
        labelType: [labelType, setLabelType],
        labelClass: [labelClass],
        brushWidth: [brushWidth, setBrushWidth],
    } = useContext(AppContext)!;

    const prefix = "../assets/icons/"
    const sam = { "path": "smart.png", "name": "SAM", "fn": "foo" }
    const poly = { "path": "polygon.png", "name": "Poly", "fn": "foo" }
    const brush = { "path": "brush.png", "name": "Brush", "fn": "foo" }
    const erase = { "path": "erase.png", "name": "Erase", "fn": "foo" }
    const labels = [sam, poly, brush, erase]

    const classes: number[] = [1, 2, 3, 4, 5, 6]
    const _setLabel = (e: any, name: string) => { setLabelType(name as Label) }
    const _setWidth = (e: any) => { setBrushWidth(e.target.value) }
    const _getOutline = (name: Label) => {
        const c = colours[labelClass];
        const hex = rgbaToHex(c[0], c[1], c[2], 255);
        const matches: boolean = (name == labelType)

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
                <Form.Range onChange={(e) => _setWidth(e)} min="1" max="100" value={brushWidth} />
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
    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header>Overlay</Card.Header>
            <Card.Body className="flex">
                <Form.Select>
                    <option>Overlay type</option>
                    <option value="0">Segmentation</option>
                    <option value="1">Labels</option>
                </Form.Select>
            </Card.Body>
            <Card.Body>
                Opacity
                <Form.Range />
            </Card.Body>
        </Card>
    );
}


export default Sidebar