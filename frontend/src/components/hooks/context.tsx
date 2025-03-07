import React, { useState } from "react";
import { modelInputProps, Label, ErrorMessage, SegmentFeatureState, ModalShow, Features, defaultFeatures, Theme, themeBGs, Settings, DEFAULT_LABEL_ALPHA, DEFAULT_SEG_ALPHA } from "../helpers/Interfaces";
import AppContext from "./createContext";

const AppContextProvider = (props: {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;
}) => {
  // Multi-image states. TODO: add list of encoding tensors (Array<any | null>)
  const [largeImg, setLargeImg] = useState<HTMLImageElement | null>(null);
  const [imgType, setImgType] = useState<"large" | "stack" | "multi" | "single">("single");
  const [imgIdx, setImgIdx] = useState<number>(0);
  const [imgArrs, setImgArrs] = useState<Array<HTMLImageElement>>([]);
  const [labelArrs, setLabelArrs] = useState<Array<Uint8ClampedArray>>([]);
  const [segArrs, setSegArrs] = useState<Array<Uint8ClampedArray>>([]);
  const [tensorArrs, setTensorArrs] = useState<Array<any | null>>([]);
  const [uncertainArrs, setUncertainArrs] = useState<Array<Uint8ClampedArray>>([]);

  // Current canvas states (i.e things corresponding to currently selected image)
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  // this why not work - should be null
  const [labelArr, setLabelArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));
  const [segArr, setSegArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(0));
  const [uncertainArr, setUncertainArr] = useState<Uint8ClampedArray>(new Uint8ClampedArray(1));

  // Labelling stuff
  const [clicks, setClicks] = useState<Array<modelInputProps> | null>(null);
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
  const [maskIdx, setMaskIdx] = useState<number>(3);
  const [labelClass, setLabelClass] = useState<number>(1);
  const [labelType, setLabelType] = useState<Label>("Brush");
  const [brushWidth, setBrushWidth] = useState<number>(20);

  const [postProcess, setPostProcess] = useState<boolean>(false);

  // Canvas display stuff
  const [overlayType, setOverlayType] = useState<"Segmentation" | "Label" | "Uncertainty" | "None">("None");
  const [labelOpacity, setLabelOpacity] = useState<number>(DEFAULT_LABEL_ALPHA);
  const [segOpacity, setSegOpacity] = useState<number>(DEFAULT_SEG_ALPHA);
  const [uncertaintyOpacity, setUncertaintyOpacity] = useState<number>(0);
  const [processing, setProcessing] = useState<"None" | "Encoding" | "Segmenting" | "Applying" | "Inactive">("Inactive");

  // Segment Feature stuff
  const [features, setFeatures] = useState<Features>(defaultFeatures)
  const [featureFlag, setFeatureFlag] = useState<boolean>(false)
  const [phaseFractions, setPhaseFractions] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])

  // Menus
  const [errorObject, setErrorObject] = useState<ErrorMessage>({ msg: "", stackTrace: "" })
  const [showToast, setShowToast] = useState<"None" | "Share" | "Metric">("None");
  const [modalShow, setModalShow] = useState<ModalShow>("None")
  const [theme, setTheme] = useState<Theme>("default")
  const [settings, setSettings] = useState<Settings>({ nPoints: 50000, trainAll: false, rescale: true, format: ".skops", balance: true })

  // Path to backend
  const [path, setPath] = useState<string>("http://localhost:5000")
  const [UID, setUID] = useState<string>("")

  const [galleryID, setGalleryID] = useState<string>("")

  return (
    <AppContext.Provider
      value={{
        largeImg: [largeImg, setLargeImg],
        imgType: [imgType, setImgType],
        imgIdx: [imgIdx, setImgIdx],
        imgArrs: [imgArrs, setImgArrs],
        labelArrs: [labelArrs, setLabelArrs],
        segArrs: [segArrs, setSegArrs],
        tensorArrs: [tensorArrs, setTensorArrs],
        uncertainArrs: [uncertainArrs, setUncertainArrs],

        image: [image, setImage],
        labelArr: [labelArr, setLabelArr],
        segArr: [segArr, setSegArr],
        uncertainArr: [uncertainArr, setUncertainArr],

        clicks: [clicks, setClicks],
        maskImg: [maskImg, setMaskImg],
        maskIdx: [maskIdx, setMaskIdx],
        labelClass: [labelClass, setLabelClass],
        labelType: [labelType, setLabelType],
        brushWidth: [brushWidth, setBrushWidth],

        postProcess: [postProcess, setPostProcess],

        overlayType: [overlayType, setOverlayType],
        labelOpacity: [labelOpacity, setLabelOpacity],
        segOpacity: [segOpacity, setSegOpacity],
        uncertaintyOpacity: [uncertaintyOpacity, setUncertaintyOpacity],
        processing: [processing, setProcessing],

        features: [features, setFeatures],
        featureFlag: [featureFlag, setFeatureFlag],
        phaseFractions: [phaseFractions, setPhaseFractions],

        errorObject: [errorObject, setErrorObject],
        showToast: [showToast, setShowToast],
        modalShow: [modalShow, setModalShow],
        theme: [theme, setTheme],
        settings: [settings, setSettings],
        path: [path, setPath],
        UID: [UID, setUID],

        galleryID: [galleryID, setGalleryID],
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
