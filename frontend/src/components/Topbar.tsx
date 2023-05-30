import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { imageDataToImage, getSplitInds } from "./helpers/canvasUtils";
import { TopbarProps } from "./helpers/Interfaces";

import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';

const UTIF = require("./UTIF.js")


const Topbar = ({ loadImages }: TopbarProps) => {
    const {
        largeImg: [, setLargeImg],
        imgType: [, setImgType],
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
        const tifs = UTIF.decode(result);
        const hrefs: Array<string> = []
        for (let tif of tifs) {
            UTIF.decodeImage(result, tif);
            const imgDataArr = new Uint8ClampedArray(UTIF.toRGBA8(tif));
            const imgData = new ImageData(imgDataArr, tif.width, tif.height);
            hrefs.push(imageDataToImage(imgData).src);
        }
        const isSmall = (tifs[0].width < 1024 && tifs[0].height < 1024)
        if (tifs.length > 1 && isSmall) {
            loadImages(hrefs);
            setImgType("stack");
        } else if (tifs.length == 1 && isSmall) {
            loadImages(hrefs);
            setImgType("single");
        } else if (!isSmall) {
            const img = new Image();
            img.src = hrefs[0];
            img.onload = () => {
                loadLargeImage(img)
                setImgType("large");
            }
        }
    }

    const loadPNGJPEG = (href: string) => {
        const img = new Image();
        img.src = href;
        img.onload = () => {
            if (img.width > 1024 || img.height > 1024) {
                console.log('large')
                loadLargeImage(img); //load large image
                setImgType("large")
            }
            else {
                loadImages([href]);
                setImgType("single")
            }
        }
    }

    const loadLargeImage = (img: HTMLImageElement) => {
        const hrefs: string[] = []
        const inds = getSplitInds(img)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx === null) { return; }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0)
        const [widths, heights] = [inds.w, inds.h]
        for (let y = 0; y < heights.length - 1; y++) {
            const [h0, h1] = [heights[y], heights[y + 1]]
            for (let x = 0; x < widths.length - 1; x++) {
                const [w0, w1] = [widths[x], widths[x + 1]]
                const imgData = ctx.getImageData(w0, h0, w1 - w0, h1 - h0)
                const cropImg = imageDataToImage(imgData)
                hrefs.push(cropImg.src)
            }
        }
        loadImages(hrefs)
        setLargeImg(img)
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
        saveAsTIFF(segArr, image.width, image.height);
    }


    // TODO: 
    const handleFileUpload = (e: any) => {
        // Open file dialog and load file.
        const file: File | null = e.target.files?.[0] || null;
        const reader = new FileReader();

        if (file != null) {
            const extension = file.name.split('.').pop()?.toLowerCase()
            const isTIF = (extension === "tif" || extension === "tiff")
            reader.onload = () => {
                if (isTIF) {
                    loadTIFF(reader.result as ArrayBuffer);
                } else {
                    const href = reader.result as string;
                    loadPNGJPEG(href);
                };
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