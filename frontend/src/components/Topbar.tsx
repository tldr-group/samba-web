import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { imageDataToImage } from "./helpers/canvasUtils";
import { TopbarProps } from "./helpers/Interfaces";

import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';

const UTIF = require("./UTIF.js")


const Topbar = ({ loadImage }: TopbarProps) => {
    const {
        segArr: [segArr,],
        image: [image,],
    } = useContext(AppContext)!;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Common pattern for opening file dialog w/ button: hidden <input> who is clicked when button is clicked.
    const addData = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    const loadTIFF = (result: ArrayBuffer) => {
        const tifs = UTIF.decode(result)
        const tif0 = tifs[0]
        UTIF.decodeImage(result, tif0)
        const imgDataArr = new Uint8ClampedArray(UTIF.toRGBA8(tif0))
        const imgData = new ImageData(imgDataArr, tif0.width, tif0.height)
        return imageDataToImage(imgData).src
    }

    const saveAsTIFF = (arr: Uint8ClampedArray, width: number, height: number) => {
        const tiffImgDataArr = new Uint8ClampedArray(4 * arr.length);
        const maxClass = arr.reduce((a: any, b: any) => Math.max(a, b), -Infinity);
        const delta = Math.floor(255 / (maxClass - 1)); // -1 to get full dynamic range (i.e class 1 -> 0, class N -> 255)
        console.log(delta, maxClass)
        for (let i = 0; i < arr.length; i++) {
            const fill = (arr[i] - 1) * delta; // need to add -1 offset here
            tiffImgDataArr[4 * i] = fill;
            tiffImgDataArr[4 * i + 1] = fill;
            tiffImgDataArr[4 * i + 2] = fill;
            tiffImgDataArr[4 * i + 3] = 255;
        }
        const arrayBuffer = UTIF.encodeImage(tiffImgDataArr, width, height)
        const blob = new Blob([arrayBuffer], { type: 'image/tiff' });
        const blobURL = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobURL;
        link.download = "seg.tiff";
        link.click();
        URL.revokeObjectURL(blobURL);
    }

    const onSaveClick = () => {
        if (image === null || segArr === null) { return; }
        saveAsTIFF(segArr, image.width, image.height)
    }


    const handleFileUpload = (e: any) => {
        // Open file dialog and load file. TODO: add in .tiff loading (parse as image?)
        const file: File | null = e.target.files?.[0] || null;
        const reader = new FileReader();

        if (file != null) {
            const extension = file.name.split('.').pop()?.toLowerCase()
            const isTIF = (extension === "tif" || extension === "tiff")
            reader.onload = () => {
                let href = "foo";
                if (isTIF) {
                    href = loadTIFF(reader.result as ArrayBuffer);
                } else {
                    href = reader.result as string;
                }
                loadImage(href);
            };
            if (isTIF) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsDataURL(file);
            };
        }
    }

    return (
        <Navbar bg="dark" variant="dark" expand="lg" style={{ boxShadow: "1px 1px  1px grey" }}>
            <Container>
                <Navbar.Brand style={{ fontSize: "2em", padding: "0px", marginRight: "5px" }}>&#128378;</Navbar.Brand>
                <Navbar.Brand>SAMBA</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <NavDropdown title="Data" id="data-dropdown">
                            <NavDropdown.Item onClick={addData}>Add</NavDropdown.Item>
                            <input
                                type='file'
                                id='file'
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileUpload} />
                            <NavDropdown.Item>Remove</NavDropdown.Item>
                        </NavDropdown>
                        <NavDropdown title="Classifier" id="data-dropdown">
                            <NavDropdown.Item href="#action/3.2">Save</NavDropdown.Item>
                            <NavDropdown.Item href="#action/3.2">Load</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item href="#action/3.4">
                                Features
                            </NavDropdown.Item>
                        </NavDropdown>
                        <Nav.Link onClick={onSaveClick}>Save Segmentation</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}

export default Topbar;

//<Nav.Link href="#home">Home</Nav.Link>