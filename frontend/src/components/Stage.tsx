// Not entirely sure I need this file anymore - could just be part of app really.
import React, { useContext } from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import Canvas from "./Canvas"
import AppContext from "./hooks/createContext";
import { StageProps } from "./helpers/Interfaces";


import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

const Stage = ({ loadImages, requestEmbedding, trainClassifier, changeToImage, saveSeg, saveClassifier }: StageProps) => {
  const {
    errorObject: [errorObject,]
  } = useContext(AppContext)!;
  const flexCenterClasses = "flex items-center justify-center";

  return (
    <div className={`w-full h-full`} >
      <Topbar loadImages={loadImages} saveSeg={saveSeg} saveClassifier={saveClassifier} />
      <div className={`flex`} style={{ margin: '1.5%' }}> {/*Canvas div on left, sidebar on right*/}
        <div className={`${flexCenterClasses} relative w-[70%] h-[70%]`}>
          <Canvas />
        </div>
        <Sidebar requestEmbedding={requestEmbedding} trainClassifier={trainClassifier} changeToImage={changeToImage} />
      </div>
      <ErrorMessage />
    </div >
  );
};

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

export default Stage;
