import React, { useRef, useContext, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom'
import AppContext from "./components/hooks/createContext";
import { ModalShow, themeBGs } from "./components/helpers/Interfaces";

import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Tooltip from "react-bootstrap/Tooltip";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form'
import InputGroup from "react-bootstrap/InputGroup";
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';


import { BlobServiceClient } from '@azure/storage-blob';


const url = `https://sambasegment.blob.core.windows.net`
const blobServiceClient = new BlobServiceClient(
    url,
);

const containerClient = await blobServiceClient.getContainerClient('gallery')

export const ToolTip = (str: string) => {
    return (
        <Tooltip id={str} style={{
            pointerEvents: 'none', fontSize: '1.2em'
        }}> {str}</Tooltip >
    )
}



const Gallery = () => {

    const {
        modalShow: [modalShow, setModalShow],
        theme: [theme,],
    } = useContext(AppContext)!;

    const [gallerySegArray, setSegGalleryArray] = useState<any[]>([])
    const [galleryImgArray, setImgGalleryArray] = useState<any[]>([])
    const [galleryMetaArray, setGalleryMetaArray] = useState<any[]>([])
    const [activeMaterialName, setActiveMaterialName] = useState<string>("")
    const [activeResolution, setActiveResolution] = useState<string>("")
    const [activeInstrumentType, setActiveInstrumentType] = useState<string>("")
    const [activeImgHeight, setActiveImgHeight] = useState<string>("")
    const [activeImgWidth, setActiveImgWidth] = useState<string>("")
    const [activeSegQuality, setActiveSegQuality] = useState<string>("")
    const [activeAdditionalNotes, setActiveAdditionalNotes] = useState<string>("")
    const [activeIndex, setActiveIndex] = useState<number>(0)
    const [activeUID, setActiveUID] = useState<string>("")
    const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
    const [segFlag, setSegFlag] = useState<boolean>(false)

    const navigate = useNavigate();

    const sortAlphanumericArray = (inputArray: Array<string>) => {
        const sortedArray = [...inputArray].sort((a, b) => {
            return a.localeCompare(b, 'en', { numeric: true });
        });
        return (sortedArray);
    };

    interface Metadata {
        id: string,
        segQual: number,
        materialName: string,
        resolution: string,
        instrumentType: string,
        imgHeight: string,
        imgWidth: string,
        additionalNotes: string

    }

    const sortAlphanumericMeta = (inputArray: Array<Metadata>) => {
        const sortedArray = inputArray.sort((a, b) => {
            return a['id'].localeCompare(b['id'], 'en', { numeric: true })
        });
        return (sortedArray);
    }


    async function getGalleryArray(containerClient: any) {
        // need to add a unique reference to the data resource here

        let iterator = containerClient.listBlobsFlat()
        const segArr = [];
        const imgArr = [];
        const metaArr: Array<Metadata> = [];

        for await (const i of iterator) {
            if (i.name.includes('seg.jpg')) { segArr.push(i.name) }
            else if (i.name.includes('img.jpg')) { imgArr.push(i.name) }
            else if (i.name.includes('metadata.json')) {
                fetch(url + '/gallery/' + i.name)
                    .then((response) => response.json())
                    .then((json) => metaArr.push(json));
            }
        }

        setImgGalleryArray(sortAlphanumericArray(imgArr))
        setSegGalleryArray(sortAlphanumericArray(segArr))
        setGalleryMetaArray(sortAlphanumericMeta(metaArr))

    }


    const toggleInfoModal = () => {
        setShowInfoModal(!showInfoModal)
    }


    const handleImageClick = (props: any) => {
        setGalleryMetaArray(sortAlphanumericMeta(galleryMetaArray))
        const metadata = galleryMetaArray[props.index]
        setActiveMaterialName(metadata.materialName)
        setActiveResolution(metadata.resolution)
        setActiveInstrumentType(metadata.instrumentType)
        setActiveImgHeight(metadata.imgHeight)
        setActiveImgWidth(metadata.imgWidth)
        setActiveSegQuality(metadata.segQual)
        setActiveAdditionalNotes(metadata.additionalNotes)
        setActiveUID(metadata.id)
        setActiveIndex(props.index)
        setShowInfoModal(true)

    }

    const ImageCard = (props: any) => {
        return (
            <Card className='m-auto' style={{ width: '300px', height: '300px', cursor: 'pointer' }} onClick={() => handleImageClick(props)}>
                <Card.Img
                    variant="top"
                    src={props.src_img}
                    style={{
                        opacity: props.segFlag ? 0 : 1,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        transition: 'opacity 0.5s ease', // Add a transition for smooth fading
                    }}
                />
                <Card.Img
                    variant="top"
                    src={props.src_seg}
                    style={{
                        opacity: props.segFlag ? 1 : 0,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        transition: 'opacity 0.5s ease', // Add a transition for smooth fading
                    }}
                />
            </Card>
        )
    }


    const icons: string[][] = [
        ["App", "app.png", "/", ''],
        ["Paper", "paper.png", "coming_soon", '_blank'],
        ["Help", "help.png", "https://github.com/tldr-group/samba-web/blob/development/MANUAL.md", '_blank'],
        ["Contact", "mail.png", "", ""],
        ["TLDR Group", "tldr.png", "https://tldr-group.github.io/#/", '_blank']
    ]

    const iconClick = (e: any, i: string) => {
        if (i === "Settings") {
            const newModalShow: ModalShow = { welcome: false, settings: true, features: false, contact: false }
            setModalShow(newModalShow)
        } else if (i === "Features") {
            const newModalShow: ModalShow = { welcome: false, settings: false, features: true, contact: false }
            setModalShow(newModalShow)
        } else if (i === "Features") {
            const newModalShow: ModalShow = { welcome: false, settings: false, features: true, contact: false }
            setModalShow(newModalShow)
        }
    };

    const handleDownload = async (e: any) => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json;charset=utf-8');
        const a = document.createElement("a")
        a.download = activeUID + '.zip'
        a.href = url + '/gallery/' + activeUID + '.zip'
        a.click()
    }

    const handleLoad = (e: any) => {
        const selectedData = galleryMetaArray[activeIndex]
        navigate('/', { state: { id: selectedData.id } });
    }

    useEffect(() => {
        getGalleryArray(containerClient)
    }, [])

    return (
        <>
            <Navbar bg={themeBGs[theme][0]} variant="dark" expand="lg" style={{ boxShadow: "1px 1px  1px grey" }
            }>
                <Container>
                    <Navbar.Brand><img src="/assets/icons/favicon.png" width="40" height="40" className="d-inline-block align-top" /></Navbar.Brand>
                    {/*<Navbar.Brand>Gallery</Navbar.Brand>*/}
                    {/*<Navbar.Toggle aria-controls="basic-navbar-nav" /> */}
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
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
                                style={{ backgroundColor: themeBGs[theme][2], borderRadius: '20px', marginLeft: '15px' }}
                                onClick={(e) => iconClick(e, i[0])}
                            />
                        </Navbar.Brand>
                    </OverlayTrigger>
                    )
                }
            </Navbar >

            <Container fluid style={{ height: "auto", marginTop: "1rem" }}>
                <Row style={{ position: 'sticky', top: '0', zIndex: '100' }}>
                    <Col className="d-flex justify-content-end">
                        <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '5px', display: 'flex', justifyContent: 'flex-end' }}>
                            <p style={{ marginRight: '-30px' }}>Toggle Segmentations:</p>
                            <Form>
                                <Form.Check type="switch" id="seg-switch" label="Fo" >
                                    <Form.Check.Input id="inp" type="checkbox" onChange={(e) => setSegFlag(e.target.checked)} style={{ marginLeft: 'auto' }} />
                                </Form.Check>
                            </Form>
                        </div>
                    </Col>
                </Row>

                <Row >
                    {galleryImgArray.map((img, i) =>
                        <Col key={i} style={{ marginTop: "1rem" }} xl={3} lg={4} md={6} sm={12}>
                            <ImageCard key={i} index={i} src_img={url + '/gallery/' + img} src_seg={url + '/gallery/' + gallerySegArray[i]} title={"Image " + i} segFlag={segFlag} />
                        </Col>
                    )}

                </Row>
            </Container >

            <Modal show={showInfoModal} onHide={toggleInfoModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Image {activeIndex}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Material Name</Form.Label>
                            <Form.Control disabled type="text" value={activeMaterialName} />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Resolution (µm per pixel)</Form.Label>
                            <Form.Control disabled type="text" value={activeResolution} />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Instrument Type</Form.Label>
                            <Form.Control disabled type="text" value={activeInstrumentType} />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Image Size (h, w)</Form.Label>
                            <Form.Control disabled type="text" value={activeImgHeight + ', ' + activeImgWidth} />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Segmentation Quality</Form.Label>
                            <Form.Control disabled type="number" value={activeSegQuality} />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Additional Notes</Form.Label>
                            <Form.Control disabled type="text" value={activeAdditionalNotes} />
                        </Form.Group>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Button variant="dark m-1" onClick={handleDownload} >Download data</Button>
                            {(window.innerWidth > 1000) ? <Button variant="dark m-1" onClick={handleLoad} >Load into SAMBA</Button> : <></>}
                        </div>
                    </Form>
                </Modal.Body >
                <Modal.Footer>
                </Modal.Footer>
            </Modal >

        </>
    );
}

export default Gallery;