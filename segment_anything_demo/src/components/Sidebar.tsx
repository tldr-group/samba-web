import React, { useContext, useEffect, useState } from "react";
import { LabelFrameProps, SidebarProps } from "./helpers/Interfaces";


import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table'


const Sidebar = () => {
    return (
        <div className="items-center" style={{ padding: '10px 10px', alignItems: 'center' }}>
            <Button variant="outline-dark" style={{ marginLeft: '28%', }}>Train Classifier!</Button>{' '}
            <div className={`h-full w-[20%]`}>
                <LabelFrame />
                <OverlaysFrame />
                <Treeview />
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

    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%' }}>
            <Card.Header>Label</Card.Header>
            <Card.Body className={`flex`}>
                <>
                    {labels.map(l => <img key={l.name} src={prefix + l.path} style={
                        { backgroundColor: "white", borderRadius: "10px", marginLeft: '7%', width: "40px" }
                    }></img>)}
                </>
            </Card.Body>
            <Card.Body>
                Brush Width
                <Form.Range />
            </Card.Body>
        </Card>
    );
}

const OverlaysFrame = () => {
    return (
        <Card className="bg-dark text-white" style={{ width: '18rem', margin: '15%' }}>
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

const Treeview = () => {
    const data = { "Class 1": ["Label 1"], "Class 2": ["Label 2"] }

    return (
        <Table striped bordered hover style={{ width: '100%', margin: '15%' }}>
            <thead>
                <tr>
                    <th>Class</th>
                    <th>Label</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colSpan={2}>Class 1</td>
                </tr>
                <tr>
                    <td colSpan={2}>Class 2</td>
                </tr>
            </tbody>
        </Table>
    );
}


export default Sidebar