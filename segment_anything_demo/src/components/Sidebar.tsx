import React, { useContext, useEffect, useState } from "react";
import { LabelFrameProps, SidebarProps } from "./helpers/Interfaces";


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
    const prefix = "../assets/icons/"
    const sam = { "path": "smart.png", "name": "SAM", "fn": "foo" }
    const poly = { "path": "polygon.png", "name": "Polygon", "fn": "foo" }
    const brush = { "path": "brush.png", "name": "Brush", "fn": "foo" }
    const erase = { "path": "erase.png", "name": "Erase", "fn": "foo" }
    const labels = [sam, poly, brush, erase]

    const classes: number[] = [1, 2, 3, 4, 5, 6]

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%', boxShadow: "1px 1px  1px grey" }}>
            <Card.Header>Label</Card.Header>
            <Card.Body className={`flex`}>
                <>
                    {labels.map(l => <img key={l.name} src={prefix + l.path} style={
                        {
                            backgroundColor: "white", borderRadius: "8px",
                            marginLeft: '7%', width: "40px", boxShadow: "2px 2px 2px black"
                        }
                    }></img>)}
                </>
            </Card.Body>
            <Card.Body>
                Brush Width
                <Form.Range />
            </Card.Body>
            <Card.Body>
                Class
                <ButtonGroup>
                    {classes.map(i => <Button variant="dark">{i}</Button>)}
                </ButtonGroup>
            </Card.Body>
        </Card>
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