/* Topbar of the app, holding the buttons to add/remove data, save/load classifier


*/

import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { imageDataToImage, getSplitInds, getXYfromI, getIfromXY } from "./helpers/canvasUtils";
import { TopbarProps } from "./helpers/Interfaces";

import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";

const UTIF = require("./UTIF.js")

export const ToolTip = (str: string) => {
    return (
        <Tooltip id={str} style={{
            pointerEvents: 'none', fontSize: '1.2em'
        }}> {str}</Tooltip >
    )
}


const Topbar = ({ loadImages }: TopbarProps) => {
    const {
        largeImg: [largeImg, setLargeImg],
        imgType: [imgType, setImgType],
        segArrs: [segArrs,],
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
        const hrefs: string[] = [];
        const inds = getSplitInds(img);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx === null) { return; }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const [widths, heights] = [inds.w, inds.h];
        // need to add the ends of the image
        widths.push(img.width);
        heights.push(img.height);
        for (let y = 0; y < heights.length - 1; y++) {
            const [h0, h1] = [heights[y], heights[y + 1]];
            for (let x = 0; x < widths.length - 1; x++) {
                const [w0, w1] = [widths[x], widths[x + 1]];
                const imgData = ctx.getImageData(w0, h0, w1 - w0, h1 - h0);
                const cropImg = imageDataToImage(imgData);
                hrefs.push(cropImg.src);
            }
        }
        console.log(hrefs.length, widths, heights);
        loadImages(hrefs);
        setLargeImg(img);
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
        if (imgType === "single") {
            saveAsTIFF(segArr, image.width, image.height);
        } else if (imgType === "large" && largeImg !== null) {
            // TODO: fix line artefact here
            const [w, h] = [largeImg.width, largeImg.height];
            const inds = getSplitInds(largeImg);
            const wholeImgData = new Uint8ClampedArray(largeImg.width * largeImg.height)
            console.log(wholeImgData.length, inds);
            for (let i = 0; i < wholeImgData.length; i++) {
                const [x, y] = getXYfromI(i, w);
                const [sqX, sqY] = [Math.floor(x / inds.dx), Math.floor(y / inds.dy)];
                const sq = sqY * inds.nW + sqX;
                const j = (x - inds.dx) + (y % inds.dy) * inds.dx;
                try {
                    const data = segArrs[sq][j];
                    wholeImgData[i] = data;
                } catch {
                    console.log(sq, sqX, sqY, i, j);
                }
            }
            saveAsTIFF(wholeImgData, largeImg.width, largeImg.height);
        } //TODO: add in stack saving here
    }

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

    const icons: string[][] = [
        ["Paper", "paper.png", "coming_soon"],
        ["Help", "help.png", "https://github.com/tldr-group/samba-web"],
        ["TLDR Group", "tldr.png", "https://tldr-group.github.io/#/"]
    ]

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

            {icons.map(i => <OverlayTrigger
                key={i[0]}
                placement="bottom"
                delay={{ show: 250, hide: 400 }}
                overlay={ToolTip(i[0])}
            >
                <Navbar.Brand href={i[2]}>
                    <img
                        src={"/assets/icons/" + i[1]}
                        width="30"
                        height="30"
                        className="d-inline-block align-top"
                        style={{ backgroundColor: '#ffffff', borderRadius: '20px' }}
                    />
                </Navbar.Brand>
            </OverlayTrigger>
            )}
        </Navbar>
    );
}

export default Topbar;

//<Nav.Link href="#home">Home</Nav.Link>