import React, { useRef, useContext, useEffect, useState } from "react";
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
import { BlobServiceClient } from '@azure/storage-blob';


const url = `https://sambasegment.blob.core.windows.net`
const blobServiceClient = new BlobServiceClient(
    url,
  );

const containerClient = await blobServiceClient.getContainerClient('gallery')

async function getGalleryArray(containerClient: any, setGalleryArray: any) {
  
    let iterator = containerClient.listBlobsFlat()
    const arr=[]; 
    for await(const i of iterator) arr.push(i.name); 
    setGalleryArray(arr)
  }

export const ToolTip = (str: string) => {
    return (
        <Tooltip id={str} style={{
            pointerEvents: 'none', fontSize: '1.2em'
        }}> {str}</Tooltip >
    )
}

const ImageCard = (props: any) => {
    return (
        <Card className='m-auto' style={{ width: '300px', height: '300px' }}>
            <Card.Img variant="top" src={props.src} />
            {/* <Card.Body> */}
                {/* <Card.Title>{props.title}</Card.Title> */}
            {/* </Card.Body> */}
        </Card>
    )
}



const Gallery = () => {

    const {
        modalShow: [modalShow, setModalShow],
        theme: [theme,],
    } = useContext(AppContext)!;

    const [galleryArray, setGalleryArray] = useState<any[]>([])


    const icons: string[][] = [
        ["Settings", "settings.png", "", ''],
        ["App", "app.png", "/",''],
        ["Paper", "paper.png", "coming_soon", '_blank'],
        ["Help", "help.png", "https://github.com/tldr-group/samba-web", '_blank'],
        ["TLDR Group", "tldr.png", "https://tldr-group.github.io/#/", '_blank']
    ]

    const iconClick = (e: any, i: string) => {
        if (i === "Settings") {
            const newModalShow: ModalShow = { welcome: false, settings: true, features: false }
            setModalShow(newModalShow)
        } else if (i === "Features") {
            const newModalShow: ModalShow = { welcome: false, settings: false, features: true }
            setModalShow(newModalShow)
        }
    };

    useEffect(() => {
        getGalleryArray(containerClient, setGalleryArray)}, [])

    return (
        <>
        <Navbar bg={themeBGs[theme][0]} variant="dark" expand="lg" style={{ boxShadow: "1px 1px  1px grey" }
        }>
            <Container>
                <Navbar.Brand style={{ fontSize: "2em", padding: "0px", marginRight: "5px" }}>&#128378;</Navbar.Brand>
                <Navbar.Brand>SAMBA</Navbar.Brand>
                <Navbar.Brand>Gallery</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
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
                            style={{ backgroundColor: themeBGs[theme][2], borderRadius: '20px' }}
                            onClick={(e) => iconClick(e, i[0])}
                        />
                    </Navbar.Brand>
                </OverlayTrigger>
                )
            }
        </Navbar >

        <Container fluid style={{ height: "100vh", marginTop:"4rem" }}>
            <Row >
                
                    {galleryArray.map((img, i) => 
                        <Col lg={3} md={6} sm={12}>
                        <ImageCard key={i} src={url+'/gallery/'+img} title={"Image " + i} />
                        </Col>
                        )}
                
            </Row>
        </Container>
        </>
    );
    }

export default Gallery;