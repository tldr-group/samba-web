import { createContext } from "react";
import { modelInputProps, Label, ErrorMessage, SegmentFeatureState, ModalShow, Features, Theme, Settings } from "../helpers/Interfaces";

interface contextProps {
  largeImg: [
    largeImg: HTMLImageElement | null,
    setLargeImg: (e: HTMLImageElement | null) => void
  ];
  imgType: [
    imgType: "large" | "stack" | "multi" | "single",
    setImgType: (e: "large" | "stack" | "multi" | "single") => void
  ];
  imgIdx: [
    imgIdX: number,
    setImgIdx: (e: number) => void
  ];
  imgArrs: [
    imgArrs: Array<HTMLImageElement>,
    setImgArrs: (e: Array<HTMLImageElement>) => void
  ];
  segArrs: [
    segArrs: Array<Uint8ClampedArray>,
    setSegArrs: (e: Array<Uint8ClampedArray>) => void
  ];
  tensorArrs: [
    tensorArrs: Array<any | null>,
    setTensorArrs: (e: Array<any | null>) => void
  ];
  labelArrs: [
    labelArrs: Array<Uint8ClampedArray>,
    setLabelArrs: (e: Array<Uint8ClampedArray>) => void
  ];


  image: [
    image: HTMLImageElement | null,
    setImage: (e: HTMLImageElement | null) => void
  ];
  labelArr: [
    labelArr: Uint8ClampedArray,
    setLabelArr: (e: Uint8ClampedArray) => void
  ];
  segArr: [
    segArr: Uint8ClampedArray,
    setSegArr: (e: Uint8ClampedArray) => void
  ];


  clicks: [
    clicks: modelInputProps[] | null,
    setClicks: (e: modelInputProps[] | null) => void
  ];
  maskImg: [
    maskImg: HTMLImageElement | null,
    setMaskImg: (e: HTMLImageElement | null) => void
  ];
  maskIdx: [
    maskIdx: number,
    setMaskIdx: (e: number) => void
  ];
  labelClass: [
    labelClass: number,
    setlabelClass: (e: number) => void
  ];
  labelType: [
    labelType: Label,
    setLabelType: (e: Label) => void
  ];


  overlayType: [
    overlayType: "Segmentation" | "Label",
    setOverlayType: (e: "Segmentation" | "Label") => void
  ];
  labelOpacity: [
    labelOpacity: number,
    setLabelOpacity: (e: number) => void
  ];
  segOpacity: [
    segOpacity: number,
    setSegOpacity: (e: number) => void
  ];
  brushWidth: [
    brushWidth: number,
    setBrushWidth: (e: number) => void
  ];
  processing: [
    processing: "None" | "Encoding" | "Segmenting",
    setProcessing: (e: "None" | "Encoding" | "Segmenting") => void
  ];

  segmentFeature: [
    segmentFeature: SegmentFeatureState,
    setSegmentFeature: (e: SegmentFeatureState) => void
  ]
  features: [
    features: Features,
    setFeatures: (e: Features) => void
  ]

  errorObject: [
    errorObject: ErrorMessage,
    setErrorObject: (e: ErrorMessage) => void
  ];
  showToast: [
    showToast: boolean,
    setShowToast: (e: boolean) => void,
  ];
  modalShow: [
    modalShow: ModalShow,
    setModalShow: (e: ModalShow) => void,
  ];
  theme: [
    theme: Theme,
    setTheme: (e: Theme) => void
  ]
  settings: [
    settings: Settings,
    setSettings: (e: Settings) => void
  ]
}

const AppContext = createContext<contextProps | null>(null);

export default AppContext;
