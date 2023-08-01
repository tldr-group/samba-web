# SAMBA Tutorial

## Handling data
![GIF showing data loading process](https://sambasegment.blob.core.windows.net/resources/data.gif)

#### Loading
Click the 'Add' button in the 'Data' dropdown or drag and drop an image file. Accepted types are `.jpg`. `.png` and `.tiff`. The image cannot be larger than 50MB.
#### Large `.tiff`
If the image is larger than 1024 pixels in height and/or width it will be split into sub-images - this is because the highest resolution SAM can process without downsampling is (1024, 1024). These sub-images can be navigated between by clicking on the thumbnail in the 'Navigation' pane on the right, and act as a single image for most purposes. These sub-images will be composited back into the original shape when saving the segmentation.
#### `.tiff` stack
If the image is a `.tiff` stack of many images with the same dimensions, this wil also be split into sub-images. These can be navigated between using the slider on the 'Navigation' pane. If the image is a stack where the images are larger than (1024, 1024) `SAMBA` will not work. As with large `.tiff` files, the sub-images will be stacked into their original shape when saving. 
#### Removing
Pressing 'Remove' on the 'Data' tab will remove the current (sub-) image. If the image is large, this will remove all the associated images but will only remove a single sub-image in a stack. 
#### Clear All
'Clear all' will remove all images currently loaded. **It is recommended** you use this if you want to process a different dataset.

## Labelling
![GIF showing labelling process](https://sambasegment.blob.core.windows.net/resources/labelling_compressed.gif)

Labelling is the process of clicking on pixels in the image to assign them to a given, arbitrary class which the segmentation algorithm is then trained against. Important note: **when adding labels on top of other labels, the oldest labels will be kept**. This is useful if you want to label edges around a particle with class 2 that has been smart-labelled with class 1. If you want to remove labels, use the Eraser.
#### Changing Class
Change the selected label class by clicking on the corresponding button on the sidebar or by using the **number keys** (i.e '1' => Class 1). Note using the number keys will only work if the focus is on the canvas (*i.e,* the image or the whitespace around has been clicked).
#### Smart Labelling
Once this is pressed, the app will request a SAM embedding from the server (this can take around 10s). Once returned, **moving the mouse** around the image will return the SAM suggested segmentation for that mouse position. **Left click** will add this suggestion as a label for the current class. **Right click** will cycle the SAM scale parameter, which adjusts what size objects SAM will suggest in the segmentation (small, medium, large). If unhappy with the suggested label, try switching scales or moving the mouse to different positions on the same object.
#### Brush
**Left click and hold** to draw on the image with a variable width brush. When the left mouse button is released, the label will be added. A preview at the cursor's location will show you what the brush will look like. The brush size can be adjusted using the 'Brush Width' slider in the 'Label' tab that appears when the brush is active.
#### Polygon
**Left click** to add points to a polygon. Once complete (either with a **right click** or a **left click at the start point**), the filled polygon will be added as a label.
#### Erase
**Left click and hold** to erase added labels. Like when using the brush, an 'Erase Width' slider will appear in the 'Label' tab.

## Viewing
![GIF showing viewing options](https://sambasegment.blob.core.windows.net/resources/viewing.gif)

#### Zoom/Pan
Use **WASD** or the **arrow keys** to move the image around the canvas. Use the **scroll wheel** to zoom in or out of the image. Everything works as expected with pans and zooms. 
#### Overlays
Labels (and later, segmentations) exist as a variable opacity overlay, which can be increased or decreased using the slider in the 'Overlay' tab. The 'Overlay Type' dropdown can be used to choose which overlay the slider will change the opacity of. Use the **V** key to quickly cycle opacities of the overlays: labels only -> segmentation only -> no overlays -> labels only. The overlay system allows you to add more labels where the segmentation may be incorrect.
#### Themes
Different colour schemes can be chosen in the 'Settings' tab, including a dark mode.

## Segmenting
![GIF showing segmentation process](https://sambasegment.blob.core.windows.net/resources/segmenting.gif)

The segmentation process involves training a random forest classifier to map image features to the class labels, then applying this classifier to unlabelled pixels. These features are computed on the server in the background when the image is first loaded. For large images, this featurisation can take a while. When 'Train Classifier!' is pressed and the features have been calculated, the labels are sent to the server to train the random forest and generate a segmentation. This is then returned to the user.
#### Settings
Under the 'Settings' menu (gear icon), various segmentation related settings can be adjusted. By default, N data points are sampled and used to train the classifier. This can be increased using the 'Number of training points' field, or by ticking the 'Train on all data' box. The 'Rescale segmentations & labels' adjusts how the segmentations are saved - either as 1, 2, 3, ... corresponding to their class (which will appear black), or as evenly spaced intervals over the 0-255 range (such that they display on the resulting image).
#### Features
Under the 'Classifier' dropdown, the 'Features' option allows the selection of which features will be applied to generate the feature stack the classifier trains off. Adding more features will slow training, but choosing ones relevant to your data can improve the quality of the result. For explanations of how these features work, check out the [Trainable Weka Segmentation page](https://imagej.net/plugins/tws/). 
#### Load Classifier
Under the 'Classifier' dropdown, the 'Load' button lets you load a trained `.skops` classifier to apply to data.
#### Apply Classifier
Under the 'Classifier' dropdown, the 'Apply' button applies a saved trained classifier (either loaded or from trainign) to data.

## Outputs
![GIF showing segmentation process](https://sambasegment.blob.core.windows.net/resources/saving.gif)

#### Save Segmentation
The resulting segmentation can be downloaded as a `.tiff` file. As previously discussed, large `.tiff` files and `.tiff` stacks will be reconstructed. By default, the segmentation will have the classes mapped evenly over the the 0-255 interval, this can be toggled off in the 'Settings' tab.
#### Share Segmentation
Once a segmentation is saved, a popup will appear asking you to share the segmentation with a future open dataset and/or the gallery page. **This is entirely optional** - no user data is stored long-term unless explicitly allowed. If shared, another popup will prompt you to add metadata about the image: what material it is, instrument type & resolution and any notes. Once approved, the shared segmentations will be available in the 'Gallery' page. 
#### Save Labels
The added labels will be downloaded. Unlabelled pixels will have a class of 0, **this will affect the rescaling** relative to the saved segmentation. This option can be useful if you want to use SAMBA as a labelling platform to generate manual labels for training a different segmentation algorithm, like a CNN.
#### Save Classifier
This option in the 'Classifier' tab allows you to download the trained classifier, for use on later datasets either in Python or SAMBA. The available formats are `.skops` (a secure scikit-learn storage format) and `.pkl` (a more common format, but unsecure). Note that `.pkl` classifiers can't be loaded into SAMBA, for security reasons.

## Gallery
The gallery page lets you view shared micrographs and their associated segmentations. The toggle switch in the top left lets you view the segmentations. Clicking on a micrograph opens a popup with data descriptions, allowing you to download the data (image, segmentation, labels) associated with that micrograph.