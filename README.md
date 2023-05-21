## Segment Anything Model Based App

Web-based trainable segmentation with Segment Anything Model (SAM) based labelling for materials science.
This is a local version of INSERT_URL_LATER which contains the frontend for the website (React + TSX) and the backend (Python + Django).
The frontend handles labelling and the backend sends back SAM embeddings if requested and segmentations.


## Run the frontend
Download one of the ViT checkpoints for the SAM model - I choose the smallest, `vit_b`: [ViT-B SAM model.](https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth). Then, install the 'Segment Anything Model'
```
pip install git+https://github.com/facebookresearch/segment-anything.git
```

and followinh that the ONNX runtme libraries in python (conda is also available)
```
pip install onnxruntime onnx
```

Next run the script 'export_onnx_model.py' *in the same folder as the checkpoint* with the following arguments
```

python export_onnx_model.py --checkpoint 'sam_vit_b_01ec64.pth' --output 'model' --model-type 'vit_b' --opset 16 --quantize-out 'sam_onnx_quantized_example' --gelu-approximate
```

Copy the resulting file into 
```
frontend/models
```

Now we're ready to install the JS libraries needed to build and run the frontend. Install Yarn (and npm first if needed)
```
npm install --g yarn
```

Build and run:

```
yarn && yarn start
```

Navigate to [`http://localhost:8081/`](http://localhost:8081/)

