## Segment Anything Model Based App

Web-based trainable segmentation with Segment Anything Model (SAM) based labelling for materials science.
This is a local version of INSERT_URL_LATER which contains the frontend for the website (React + TSX) and the backend (Python + Django).
The frontend handles labelling and the backend sends back SAM embeddings if requested and segmentations.

## Run the frontend

Install Yarn (and npm first if needed)

```
npm install --g yarn
```

Build and run:

```
yarn && yarn start
```

Navigate to [`http://localhost:8081/`](http://localhost:8081/)

