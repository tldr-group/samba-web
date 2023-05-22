"""Given an image and some labels, featurise then segment with random forest classiier."""
import numpy as np
from PIL import Image
from tifffile import imwrite

from forest_based import featurise_then_segment
from features import DEAFAULT_FEATURES


def segment(image: Image.Image, labels_dict):
    img_arr = np.array(image.convert("L")) * 255
    labels_list = [item for keys, item in labels_dict.items()]
    labels_arr = np.array(labels_list).reshape(image.height, image.width)
    # imwrite("labels.tif", labels_arr)  # debug
    probs = featurise_then_segment(img_arr, DEAFAULT_FEATURES, labels_arr)
    classes = np.argmax(probs, axis=0).astype(np.uint8) + 1
    return classes.flatten()
