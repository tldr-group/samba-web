<h1 align="center">
<img src="https://sambasegment.blob.core.windows.net/resources/samba_logo_wide.png" width="600">
</h1><br>

![Tests](https://github.com/tldr-group/samba-web/actions/workflows/tests.yml/badge.svg)



`SAMBA` (Segment Anything Model Based App) is a trainable segmentation tool for materials science that uses [deep learning](https://github.com/facebookresearch/segment-anything) for fast, high-quality labels and random forests for robust, generalizable segmentations. It is accessible in the browser ([https://www.sambasegment.com](https://www.sambasegment.com)), without the need to download any external dependencies. This repo is a local version of the website which contains the frontend for the website (React + TSX) and the backend (Python + Flask). The frontend handles labelling and the backend sends back SAM embeddings (if requested) and segmentations.

Check out the [tutorial/user manual](MANUAL.md) if help is needed!
<p align="center">
    <img src="https://sambasegment.blob.core.windows.net/resources/labelling_compressed.gif">
</p>
<p align="center">
    <img src="https://sambasegment.blob.core.windows.net/resources/overwrite.gif">
</p>

## Local Installation Instructions

These instructions are for installing and running the model locally. They assume a UNIX enviroment (mac or linux), but adapting for Windows is straightforward. Note you will need 2 terminals, one for the frontend local server and one for the backend local server.

### Preliminaries

Download one of the ViT checkpoints for the SAM model - I chose the smallest, `vit_b`: [ViT-B SAM model](https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth). Copy this into the [`backend/`](backend) directory.

### Install & run the backend

0. Setup a [virtual environment in Python](https://docs.python.org/3/library/venv.html) and activate it (not necessary but recommended)
1. Install libraries from [`backend/requirements.txt`](backend/requirements.txt):

```
pip install -r backend/requirements.txt
```

2. With your virtual environment activated and inside the `backend/` directory, run

```
python -m flask --app server run
```

The server is now setup and listening for requests from our frontend!


### Install & run the frontend

0. Install the JS libraries needed to build and run the frontend. Install Yarn (and npm first if needed)

```
npm install --g yarn
```

1. Build and run:

```
yarn && yarn start
```

2. Navigate to [`http://localhost:8081/`](http://localhost:8081/) or [`http://localhost:8080/`](http://localhost:8080/) depending on the port (it should do this automatically).

## Testing Instructions

1. Run (with your virtual enviroment activated!)

```
python backend/tests.py $FIJI_PATH
```

where `$FIJI_PATH` is the absolute path to your [FIJI](https://imagej.net/software/fiji/) installation.

## Citing

If you use SAMBA in one your works, please cite its [JOSS publication](https://joss.theoj.org/papers/10.21105/joss.06159) via [`CITATION.cff`](CITATION.cff) or clicking the 'cite this repository' button at the top of the page:
```
Docherty et al., (2024). SAMBA: A Trainable Segmentation Web-App with Smart Labelling. Journal of Open Source Software, 9(98), 6159, https://doi.org/10.21105/joss.06159
```