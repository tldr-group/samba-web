/*Modals.tsx
The three large modals: Welcome, Settings, Features, the smaller error modal and post segmentation toast.

*/

import React, { useContext, useEffect, useRef, useState } from "react";
import AppContext from "./hooks/createContext";
import { Features, closeModal, LabelFrameProps, FeatureModalProps, themeBGs, Theme, Settings } from "./helpers/Interfaces"


import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

import Toast from 'react-bootstrap/Toast'
import ToastContainer from "react-bootstrap/ToastContainer";
import InputGroup from "react-bootstrap/InputGroup";
import Form from "react-bootstrap/Form"

const BigModal = ({ requestEmbedding }: LabelFrameProps) => {
    const {
        modalShow: [modalShow, setModalShow],
        theme: [theme,]
    } = useContext(AppContext)!;

    const handleClose = () => { setModalShow({ welcome: false, settings: false, features: false }) }

    return (
        <Modal show={modalShow.welcome || modalShow.settings || modalShow.features} onHide={handleClose} size="lg" >
            {(modalShow.welcome && <WelcomeModalContent />)}
            {(modalShow.features) && <FeatureModalContent closeModal={handleClose} requestEmbedding={requestEmbedding} />}
            {(modalShow.settings) && <SettingsModalContent />}
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

const FeatureModalContent = ({ closeModal, requestEmbedding }: FeatureModalProps) => {
    const {
        features: [features, setFeatures]
    } = useContext(AppContext)!;

    const updateClose = () => {
        closeModal()
        requestEmbedding()
    }

    const updateFeatures = (prev: any, newKey: string, newVal: string) => {
        const newFeats = prev
        newFeats[newKey] = parseFloat(newVal)
        setFeatures(newFeats as Features)
    }

    const change = (e: any, feats: Features, newKey: string, newVal: string) => {
        updateFeatures(feats, newKey, newVal)
    }


    const getElemForDict = (key: string, value: string, i: number) => {
        const numeric = ["Membrane Thickness", "Membrane Patch Size", "Minimum Sigma", "Maximum Sigma"]
        const startVal = 14
        const vals: number[][] = [[1, 5, 1, 1], [5, 25, 17, 2], [0, 64, 0.5, 0.5], [0, 64, 16, 0.5]]
        if (numeric.includes(key)) {
            let [a, b, c, d] = vals[i - startVal]
            return (<InputGroup key={i}>
                <InputGroup.Text>{key}</InputGroup.Text>
                <Form.Control type="number" width={3}
                    key={key} min={a} max={b} defaultValue={parseFloat(value)} step={d} onChange={(e) => change(e, features, key, e.target.value)}>
                </Form.Control >
            </InputGroup>)
        } else {
            return <Form.Check type="checkbox" label={key} key={key} onChange={(e) => change(e, features, key, e.target.value)} style={{ gridColumn: (i % 2) + 1 }} defaultChecked={parseInt(value) as unknown as boolean} />
        }
    }

    return (
        <>
            <Modal.Header closeButton>
                <Modal.Title>Features</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>Choose features for the random forest segmenter. <b>Sigma</b> controls the minimum and maximum scale parameters. <span style={{ color: "#eb4034" }}><b>Warning:</b> more features means slower training!</span></p>
                <div style={{ display: "grid", gridTemplateColumns: "2 1fr", gap: "10px" }}>
                    {Object.entries(features).map(([key, value], i) => getElemForDict(key as string, value as string, i))}
                </div>
            </Modal.Body >
            <Modal.Footer>
                <Button variant="dark" onClick={updateClose}>Done!</Button>
            </Modal.Footer>
        </>
    )
}


const SettingsModalContent = () => {
    const {
        theme: [theme, setTheme],
        settings: [settings, setSettings],
    } = useContext(AppContext)!;

    const themes = Object.keys(themeBGs)
    const change = (e: any) => { setTheme(e.target.value as Theme) }
    const setN = (e: any) => {
        console.log(typeof (e.target.value))
        setSettings({ nPoints: parseInt(e.target.value), trainAll: settings.trainAll, rescale: settings.rescale, format: settings.format })
    }
    const setAll = (e: any) => {
        const state = e.target.value == "on" ? true : false
        setSettings({ nPoints: settings.nPoints, trainAll: state, rescale: settings.rescale, format: settings.format })
    }
    const setRescale = (e: any) => {
        const state = e.target.value == "on" ? true : false
        setSettings({ nPoints: settings.nPoints, trainAll: settings.trainAll, rescale: state, format: settings.format })
    }

    const setFormat = (e: any) => {
        setSettings({ nPoints: settings.nPoints, trainAll: settings.trainAll, rescale: settings.rescale, format: e.target.value })
    }

    return (
        <>
            <Modal.Header closeButton>
                <Modal.Title>Settings</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <InputGroup>
                    <InputGroup.Text>Theme:</InputGroup.Text>
                    <Form.Select onChange={e => change(e)} defaultValue={theme}>
                        {themes.map((x, i) => <option value={x} key={i} >{x}</option>)}
                    </Form.Select>
                </InputGroup>
            </Modal.Body >
            <Modal.Body>
                <InputGroup>
                    <InputGroup.Text>Classifier format:</InputGroup.Text>
                    <Form.Select onChange={e => setFormat(e)} defaultValue={settings.format}>
                        <option value={".skops"} key="0">.skops</option>
                        <option value={".pkl"} key="1">.pkl</option>
                    </Form.Select>
                </InputGroup>
            </Modal.Body >
            <Modal.Body>
                <InputGroup onChange={(e) => setN(e)} >
                    <InputGroup.Text>Number of training points:</InputGroup.Text>
                    <Form.Control type="number" min={1000} max={1000000} step={5000} defaultValue={settings.nPoints}></Form.Control>
                </InputGroup>
            </Modal.Body >
            <Modal.Body>
                <Form.Check type="checkbox" label="Train on all data" defaultChecked={settings.trainAll} onChange={e => setAll(e)}></Form.Check>
            </Modal.Body>
            <Modal.Body>
                <Form.Check type="checkbox" label="Rescale segmentations & labels" defaultChecked={settings.rescale} onChange={e => setRescale(e)}></Form.Check>
            </Modal.Body>
            <Modal.Body>
                {(settings.trainAll == true || settings.nPoints > 100000) && <p style={{ color: "#eb4034" }}><b>Warning:</b> more data points means slower training!</p>}
            </Modal.Body>

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

const WarningModal = (text: string, closeFunction: CallableFunction) => {

}


const PostSegToast = () => {
    const {
        showToast: [showToast, setShowToast],
        errorObject: [errorObject, setErrorObject],
        path: [path, ],
        UID: [UID, ],

    } = useContext(AppContext)!;


    const [shareSeg, setShareSeg] = useState(false)
    const SAVE_TO_GALLERY_ENDPOINT = path + '/saveToGallery'

    const saveToGallery = async (ENDPOINT: string) => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json;charset=utf-8');
        try {
          let resp = await fetch(ENDPOINT, { method: 'POST', headers: headers, body: JSON.stringify({ "id": UID })})
        } catch (e) {
          const error = e as Error;
          setErrorObject({ msg: "Failed to save to gallery.", stackTrace: error.toString() });
        }
      }

    const toggleToast = () => { setShowToast(!showToast) }
    const handleShareSend = (e: any) => {
        if (shareSeg) {
            console.log("sending to gallery")
            saveToGallery(SAVE_TO_GALLERY_ENDPOINT)
        }
        toggleToast()
    }


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
                        <Form.Check type="switch" id="share-seg" label="Share segmentation in a future open dataset?">
                        </Form.Check>
                        <Form.Check type="switch" id="share-gallery">
                        <Form.Check.Input type="checkbox" onChange={(e) => setShareSeg(e.target.checked)} />
                        <Form.Check.Label>Share segmentation in the gallery page?</Form.Check.Label>
                        </Form.Check>
                    </Form>
                    <Button variant="dark" onClick={handleShareSend} style={{ marginLeft: '16rem' }} >Send!</Button>
                </Toast.Body>
            </Toast>
        </ToastContainer >

    )
}

export { BigModal, PostSegToast, ErrorMessage }
