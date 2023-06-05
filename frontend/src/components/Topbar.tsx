/* Topbar of the app, holding the buttons to add/remove data, save/load classifier


*/

import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { TopbarProps } from "./helpers/Interfaces";

import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";



export const ToolTip = (str: string) => {
    return (
        <Tooltip id={str} style={{
            pointerEvents: 'none', fontSize: '1.2em'
        }}> {str}</Tooltip >
    )
}


const Topbar = ({ loadTIFF, loadPNGJPEG, saveSeg, saveClassifier }: TopbarProps) => {
    const {
        errorObject: [, setErrorObject],
    } = useContext(AppContext)!;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Common pattern for opening file dialog w/ button: hidden <input> who is clicked when button is clicked.
    const addData = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    const handleFileUpload = (e: any) => {
        // Open file dialog and load file.
        const file: File | null = e.target.files?.[0] || null;
        const reader = new FileReader();
        if (file != null) {
            const extension = file.name.split('.').pop()?.toLowerCase()
            const isTIF = (extension === "tif" || extension === "tiff")
            const isPNGJPG = (extension === "png" || extension === "jpg" || extension === "jpeg")
            reader.onload = () => {
                try {
                    if (isTIF) {
                        loadTIFF(reader.result as ArrayBuffer);
                    } else if (isPNGJPG) {
                        const href = reader.result as string;
                        loadPNGJPEG(href);
                    } else {
                        throw `Unsupported file format .${extension}`;
                    }
                }
                catch (e) {
                    const error = e as Error;
                    setErrorObject({ msg: "Failed to upload image - must be .tif, .tiff, .png or .jpg", stackTrace: error.toString() });
                }
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
                            <NavDropdown.Item onClick={saveClassifier}>Save</NavDropdown.Item>
                            <NavDropdown.Item href="#action/3.2">Load</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item href="#action/3.4">
                                Features
                            </NavDropdown.Item>
                        </NavDropdown>
                        <Nav.Link onClick={saveSeg}>Save Segmentation</Nav.Link>
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