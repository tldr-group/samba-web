/* Topbar of the app, holding the buttons to add/remove data, save/load classifier


*/

import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { TopbarProps, ModalShow, themeBGs } from "./helpers/Interfaces";

import { Link, useNavigate } from 'react-router-dom'
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



const Topbar = ({ loadFromFile, deleteAll, deleteCurrent, saveSeg, saveLabels, saveClassifier, loadClassifier, applyClassifier }: TopbarProps) => {
    const {
        modalShow: [modalShow, setModalShow],
        theme: [theme,],
    } = useContext(AppContext)!;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadClassifierRef = useRef<HTMLInputElement>(null);

    // Common pattern for opening file dialog w/ button: hidden <input> who is clicked when button is clicked.
    const addData = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    const loadClassifierClick = () => {
        if (loadClassifierRef.current) {
            loadClassifierRef.current.click();
        }
    }


    const handleFileUpload = (e: any, type: "image" | "classifier") => {
        // Open file dialog and load file.
        const file: File | null = e.target.files?.[0] || null;
        if (file != null) {
            if (type === "image") {
                loadFromFile(file);
            } else {
                console.log("classifier")
                loadClassifier(file)
            }
        };
    }

    const icons: string[][] = [
        ["Settings", "settings.png", "", ''],
        ["Gallery", "gallery.png", "", ''],
        ["Paper", "paper.png", "coming_soon", '_blank'],
        ["Help", "help.png", "https://github.com/tldr-group/samba-web", '_blank'],
        ["TLDR Group", "tldr.png", "https://tldr-group.github.io/#/", '_blank']
    ]

    const navigate = useNavigate(); // goto gallery 'page' in the SPA (if use link then hosting doesn't work)

    const iconClick = (e: any, i: string) => {
        if (i === "Settings") {
            const newModalShow: ModalShow = { welcome: false, settings: true, features: false }
            setModalShow(newModalShow)
        } else if (i === "Gallery") {
            navigate("/gallery")
        } else if (i === "Features") {
            const newModalShow: ModalShow = { welcome: false, settings: false, features: true }
            setModalShow(newModalShow)
        }
    };

    return (
        <Navbar bg={themeBGs[theme][0]} variant="dark" expand="lg" style={{ boxShadow: "1px 1px  1px grey" }
        }>
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
                                onChange={e => handleFileUpload(e, "image")} />
                            <NavDropdown.Item onClick={deleteCurrent}>Remove</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item onClick={deleteAll}>Clear All</NavDropdown.Item>
                        </NavDropdown>
                        <NavDropdown title="Classifier" id="data-dropdown">
                            <NavDropdown.Item onClick={saveClassifier}>Save</NavDropdown.Item>
                            <NavDropdown.Item onClick={loadClassifierClick} >Load</NavDropdown.Item>
                            <input
                                type='file'
                                id='loadClassifier'
                                ref={loadClassifierRef}
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e, "classifier")} />
                            <NavDropdown.Item onClick={applyClassifier} >Apply</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item onClick={(e) => iconClick(e, "Features")}>
                                Features
                            </NavDropdown.Item>
                        </NavDropdown>
                        <Nav.Link onClick={saveLabels}>Save Labels</Nav.Link>
                        <Nav.Link onClick={saveSeg}>Save Segmentation</Nav.Link>
                    </Nav>
                </Navbar.Collapse>
            </Container>
            {
                icons.map(i => <OverlayTrigger
                    key={i[0]}
                    placement="bottom"
                    delay={{ show: 250, hide: 400 }}
                    overlay={ToolTip(i[0])}
                >
                    <Navbar.Brand href={i[2]} target={i[3]}>
                        <img
                            src={"/assets/icons/" + i[1]}
                            width="30"
                            height="30"
                            className="d-inline-block align-top"
                            style={{ backgroundColor: themeBGs[theme][2], borderRadius: '20px' }}
                            onClick={(e) => iconClick(e, i[0])}
                        />
                    </Navbar.Brand>
                </OverlayTrigger>
                )
            }
        </Navbar >
    );
}

export default Topbar;

//<Nav.Link href="#home">Home</Nav.Link>