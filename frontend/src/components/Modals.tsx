/*Modals.tsx
The three large modals: Welcome, Settings, Features, the smaller error modal and post segmentation toast.

*/

import React, { useContext, useEffect, useRef, useState } from "react";
import AppContext from "./hooks/createContext";


import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

import Toast from 'react-bootstrap/Toast'
import ToastContainer from "react-bootstrap/ToastContainer";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form"

const BigModal = () => {
    const {
        modalShow: [modalShow, setModalShow]
    } = useContext(AppContext)!;

    const handleClose = () => { setModalShow({ welcome: false, settings: false, features: false }) }

    return (
        <Modal show={modalShow.welcome || modalShow.settings || modalShow.features} onHide={handleClose}>
            {(modalShow.welcome && <WelcomeModalContent />)}
        </Modal>
    )
}

const WelcomeModalContent = () => {
    const setNoShow = (e: any) => {
        console.log(e.target.checked)
        if (e.target.checked == true) {
            localStorage.setItem("showHelp", "false")
        } else {
            localStorage.setItem("showHelp", "true")
        }
    }

    return (
        <>
            <Modal.Header closeButton>
                <Modal.Title>Welcome!</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>SAMBA is a <b>web-based trainable segmentation app</b>. It has deep-learning powered label suggestions and a random-forest classifier backend.</p>
                <p>Load an image, choose your brush on the sidebar and place some labels with <b>left click</b>. Zoom with the <b>scroll wheel</b> and pan with <b>arrow keys</b> or <b>WASD</b>. <b>Right click</b> to change the smart label focus size or to finish a polygon. </p>
                <p>Once you've labelled an example of each class, press <b>"Train Classifier"</b> to segment the image. If you still need help, check out the <a href="https://github.com/tldr-group/samba-web/manual.md">manual</a> or watch a <a href="coming-soon">video tutorial</a>. Have fun!</p>
            </Modal.Body>
            <Modal.Footer>
                <Form.Check type="checkbox" label="Do not show again" onChange={setNoShow} />
            </Modal.Footer>
        </>
    )
}

const ErrorMessage = () => {
    const {
        errorObject: [errorObject, setErrorObject]
    } = useContext(AppContext)!;


    const handleClose = () => { setErrorObject({ msg: "", stackTrace: "" }) };

    return (
        <>
            <Modal show={errorObject.msg !== ""} onHide={handleClose}>
                <Modal.Header style={{ backgroundColor: '#eb4034', color: '#ffffff' }} closeVariant="white" closeButton>
                    <Modal.Title>Error</Modal.Title>
                </Modal.Header>
                <Modal.Body>{errorObject.msg}</Modal.Body>
                <Modal.Body>
                    <Accordion defaultActiveKey="0">
                        <Accordion.Item eventKey="1">
                            <Accordion.Header>Stack trace</Accordion.Header>
                            <Accordion.Body>
                                {errorObject.stackTrace}
                            </Accordion.Body>
                        </Accordion.Item>
                    </Accordion>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="dark" onClick={handleClose}>
                        Understood!
                    </Button>
                </Modal.Footer>
            </Modal >
        </>
    );
}


const PostSegToast = () => {
    const {
        showToast: [showToast, setShowToast]
    } = useContext(AppContext)!;

    const toggleToast = () => { setShowToast(!showToast) }

    return (
        <ToastContainer className="p-5" position="bottom-end">
            <Toast show={showToast} onClose={toggleToast}>
                <Toast.Header className="roundedme-2"><strong className="me-auto">Share Segmentation?</strong></Toast.Header>
                <Toast.Body>
                    <InputGroup>
                        <InputGroup.Text>Segmentation quality:</InputGroup.Text>
                        <Form.Control type="number" min={0} max={10} defaultValue={5} width={1} size="sm"></Form.Control>
                    </InputGroup>

                    <Form style={{ margin: '10px' }}>
                        <Form.Check type="switch" id="share-seg" label="Share segmentation in a future open dataset?"></Form.Check>
                        <Form.Check type="switch" id="share-gallery" label="Share segmentation in the gallery page?"></Form.Check>
                    </Form>
                    <Button variant="dark" onClick={toggleToast} style={{ marginLeft: '16rem' }} >Send!</Button>
                </Toast.Body>
            </Toast>
        </ToastContainer >

    )
}

export { BigModal, PostSegToast, ErrorMessage }
