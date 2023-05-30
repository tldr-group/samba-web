"""Given an image and some labels, featurise then segment with random forest classiier."""
import numpy as np
from PIL import Image
from tifffile import imwrite

from typing import List

from forest_based import featurise_then_segment
from features import DEAFAULT_FEATURES


def segment(images: List[Image.Image], labels_dicts: List[dict], UID: str):
    img_arrs: List[np.ndarray] = []
    label_arrs: List[np.ndarray] = []
    for i in range(len(images)):
        image = images[i]
        label_dict = labels_dicts[i]
        img_arr = np.array(image.convert("L")) * 255
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(image.height, image.width)

        img_arrs.append(img_arr)
        label_arrs.append(label_arr)

    remasked_flattened_arrs: np.ndarray
    probs, model = featurise_then_segment(img_arrs, DEAFAULT_FEATURES, label_arrs)

    for i in range(len(probs)):
        label_arr = label_arrs[i]
        classes = np.argmax(probs[i], axis=0).astype(np.uint8) + 1
        remasked = np.where(label_arr == 0, classes, label_arr).astype(np.uint8)
        if i == 0:
            remasked_flattened_arrs = remasked.flatten()
        else:
            remasked_flattened_arrs = np.concatenate(
                (remasked_flattened_arrs, remasked.flatten()), axis=0, dtype=np.uint8
            )
    print(remasked_flattened_arrs.shape, label_arrs[0].shape)
    return remasked_flattened_arrs
