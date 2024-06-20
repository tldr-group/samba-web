/* Topbar of the app, holding the buttons to add/remove data, save/load classifier


*/

import React, { useRef, useContext } from "react";
import AppContext from "./hooks/createContext";
import { TopbarProps, ModalShow, themeBGs } from "./helpers/Interfaces";

import { useNavigate } from 'react-router-dom'
import Form from 'react-bootstrap/Form';
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



const Topbar = ({ loadFromFile, loadLabelFile, deleteAll, deleteCurrent, saveSeg, saveLabels, saveClassifier, loadClassifier, applyClassifier }: TopbarProps) => {
    const {
        modalShow: [modalShow, setModalShow],
        labelType: [, setLabelType],
        theme: [theme,],
        postProcess: [, setPostProcess],
    } = useContext(AppContext)!;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const labelInputRef = useRef<HTMLInputElement>(null);
    const loadClassifierRef = useRef<HTMLInputElement>(null);

    // Common pattern for opening file dialog w/ button: hidden <input> who is clicked when button is clicked.
    const addData = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }

    const addLabel = () => {
        if (labelInputRef.current) {
            labelInputRef.current.click();
        }
    }

    const loadClassifierClick = () => {
        if (loadClassifierRef.current) {
            loadClassifierRef.current.click();
        }
    }

    const togglePostProcess = (e: any) => {
        setPostProcess(e.target.checked);
    }


    const handleFileUpload = (e: any, type: "image" | "classifier" | "label") => {
        // Open file dialog and load file.
        const file: File | null = e.target.files?.[0] || null;
        if (file != null) {
            if (type === "image") {
                loadFromFile(file);
            } else if (type === "label") {
                loadLabelFile(file);
            }
            else {
                console.log("classifier");
                loadClassifier(file);
            }
        };
    }

    const showMetrics = () => {
        setModalShow("Metrics")
    }

    const icons: string[][] = [
        ["Settings", "settings.png", "", ''],
        ["Gallery", "gallery.png", "", ''],
        ["Paper", "paper.png", "https://joss.theoj.org/papers/10.21105/joss.06159#", '_blank'],
        ["Help", "help.png", "https://github.com/tldr-group/samba-web/blob/main/MANUAL.md", '_blank'],
        ["Contact", "mail.png", "", ""],
        ["TLDR Group", "tldr.png", "https://tldr-group.github.io/#/", '_blank']
    ]

    const navigate = useNavigate(); // goto gallery 'page' in the SPA (if use link then hosting doesn't work)

    const iconClick = (e: any, i: string) => {
        // For out link icon click, perform correct action
        if (i === "Settings" || i === "Features" || i === "Contact") {
            setModalShow(i);
        } else if (i === "Gallery") {
            navigate("/gallery");
        }
    };

    return (
        <Navbar bg={themeBGs[theme][0]} variant="dark" expand="lg" style={{ boxShadow: "1px 1px  1px grey" }
        }>
            <Container>
                <Navbar.Brand><img src="/assets/icons/favicon.png" width="40" height="40" className="d-inline-block align-top" /></Navbar.Brand>
                {(window.innerWidth > 1000) ? <Navbar.Brand style={{ marginLeft: "-25px", marginTop: "3px" }}>AMBA</Navbar.Brand> : <></>}
                {/*<Navbar.Toggle aria-controls="basic-navbar-nav" /> */}
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <NavDropdown title="Data" id="data-dropdown">
                            <NavDropdown.Item onClick={addData}>Load Image(s)</NavDropdown.Item>
                            <input
                                type='file'
                                id='file_load'
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e, "image")} />
                            <NavDropdown.Item onClick={addLabel}>Load Labels</NavDropdown.Item>
                            <input
                                type='file'
                                id='file_load'
                                ref={labelInputRef}
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e, "label")} />
                            <NavDropdown.Item onClick={deleteCurrent}>Remove Image</NavDropdown.Item>
                            <NavDropdown.Item onClick={e => setLabelType("Crop")}>Crop</NavDropdown.Item>
                            <NavDropdown.Divider />
                            <NavDropdown.Item onClick={deleteAll}>Clear All</NavDropdown.Item>
                        </NavDropdown>
                        <NavDropdown title="Classifier" id="class-dropdown">
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
                        <NavDropdown title="Save" id="save-dropdown">
                            <NavDropdown.Item onClick={saveLabels}>Save Labels</NavDropdown.Item>
                            <NavDropdown.Item onClick={saveSeg}>Save Segmentation</NavDropdown.Item>
                        </NavDropdown>

                        <Nav.Link onClick={showMetrics}>Metrics</Nav.Link>
                        <Navbar.Text>
                            <Form >
                                <Form.Check
                                    type="switch"
                                    label="&nbsp;&nbsp;&nbsp;&nbsp;Post-Process:"
                                    id="post_process_switch"
                                    reverse
                                    onChange={togglePostProcess}
                                />
                            </Form>
                        </Navbar.Text>

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