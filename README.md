## Segment Anything Model Based App (SAMBA) - web demo

Web-based trainable segmentation with Segment Anything Model (SAM) based labelling for materials science.
This is a local version of INSERT_URL_LATER which contains the frontend for the website (React + TSX) and the backend (Python + Flask).
The frontend handles labelling and the backend sends back SAM embeddings if requested and segmentations.

## Preliminaries
Download one of the ViT checkpoints for the SAM model - I choose the smallest, `vit_b`: [ViT-B SAM model.](https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth)

## Run the backend
0. Setup a virtual environment in Python (I recommend using conda for this) and activate it
1. Install flask:
```
pip install flask
```
2. Install the 'Segment Anything Model' - this should also install libraries like Pytorch, numpy, Pillow, etc which will be useful later
```
pip install git+https://github.com/facebookresearch/segment-anything.git
```
3. Install sklearn (for the classifiers)
```
pip install -U scikit-learn
```
4. Install scikit-image (for the classifier features)
```
pip install -U scikit-image
```
5. Install tifffile 
```
pip install tifffile
```
6. With your virtual environment activated and in the `samba-web` directory, run
```
python -m flask --app server run
```
The server is now setup and listening for requests from our frontend!

## Run the frontend
1. Install ONNX runtme libraries in python (conda is also available)
```
pip install onnxruntime onnx
```
2. Next run the script `export_onnx_model.py` *in the same folder* as the checkpoint file with the following arguments (or adjust filepath if in a different one)
```
python export_onnx_model.py --checkpoint 'sam_vit_b_01ec64.pth' --output 'model' --model-type 'vit_b' --opset 16 --quantize-out 'sam_onnx_quantized_example.onnx' --gelu-approximate
```
3. Copy the resulting file (`sam_onnx_quantized_example.onnx`) into 
```
frontend/model
```
4. Now we're ready to install the JS libraries needed to build and run the frontend. Install Yarn (and npm first if needed)
```
npm install --g yarn
```
5. Build and run:

```
yarn && yarn start
```
6. Navigate to [`http://localhost:8081/`](http://localhost:8081/) or [`http://localhost:8080/`](http://localhost:8080/) depending on the port (it should do this automatically).
