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
5. With your virtual environment activated and in the `samba-web` directory, run
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

## TODO:
# IO:
- [x] Fix line bug in large file saving - probably indexing 
- [x] Save tif stack into one file - need to poke around UTIF.JS. Might need to encode each seg are as a tif then encode list of tiffs then save
# Classifier/Backend:
- [x] Cache featurisations into a .npy file 
- [x] Ideally compute featurisations in background every time an image is loaded then cache. Will need to make sure what happens if seg requested before featurisations finished (loop till file available - should work as flask multithreaded)
- [ ] Load/apply classifier as .skops/restricted .pickle file. Overwrite on train/load. Don’t overwrite on apply 
- [x] Fix OOM errors: only compute feature stacks for images with labels before training. Then, compute feature stacks on demand in a loop, only saving the result. Might conflict with 1 & 2
- [ ] Train on only random subset of all label data: np.arange(N_data), shuffle, take first M indices where M is some (capped) sqrt function of N_data. Use last P points as validation data for which error, mIoU and Jaccard index are computed and returned
- [ ] Tests for backend: component and integration. Test each filter does as expected, then test if it matches Weka, then test the classification process produces similar results (for fixed labels and filters)
# Drawing:
- [x] Make animated canvas actually animated with requestAnimationFrame. (Some render loop - try avoid triggering re rendering)
- [x] Add in polygon labelling (track clicker points in a ref, draw lines between then every animation frame and a line from last point to current mouse position if correct brush mode), brush/eraser outline (draw circle at mouse position every request animation frame if correct brush mode)
- [x] Fix eraser bug/subtle Sam/draw bug where draw labels slightly dilated when added 
- [x] Make SAM suggestion change colour as soon as key pressed (should be fixed by 1 & 2)
# GUI:
- [ ] Make canvas and sidebar reactive - i.e sidebar should sit on LHS at 18 rem and canvas should fill the rest of the space
- [ ] Dark background/Dark mode (better for eyes) 
# Misc:
- [ ] Error messages as modals - have error text as a state in context (i.e share across all components). Have conditional rendering of modal of test set and set text to “” when modal quit clicked. 
- [ ] Comments
- [ ] Write a user manual (with gifs) on the GitHub, link to it in README and in app itself 
- [x] Fix tooltip jitter- seems to load a horizontal scroll bar occasionally on hover 
- [ ] Code cleanup: DRY etc
- [ ] Have a default microstructure with preloaded encoding so users can have a play with it w/out having their own
- [ ] Is SAMBA a good name?
- [ ] Post processing
- [ ] paper?
# Cloud
- [ ] Post segmentation quality review/share prompt - maybe as a toast notification 
- [ ] Deploy on Azure
- [ ] Database/datalake in backend
- [ ] Caps for budget
- [ ] Track total compute time in DB and add kill switch 
# Future
- [ ] Gallery page
