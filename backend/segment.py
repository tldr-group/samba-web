"""Given an image and some labels, featurise then segment with random forest classiier."""
import numpy as np
from PIL import Image
from tifffile import imwrite
import os
from time import sleep
from typing import List

from forest_based import segment_with_features


def check_featurising_done(n_imgs: int, UID: str):
    # TODO: ensure this doesn't block threads. Not sure this is a good idea.
    quit = False
    finished_writing = False
    while quit is False:
        n_feature_files = 0
        files = os.listdir(UID)
        for fname in files:
            if "features" in fname:
                n_feature_files += 1
            if "success" in fname:
                finished_writing = True
        if n_feature_files == n_imgs and finished_writing:
            quit = True
            print("Featurising done!")
        else:
            sleep(0.25)


def segment(images: List[Image.Image], labels_dicts: List[dict], UID: str):
    label_arrs: List[np.ndarray] = []
    for i in range(len(images)):
        image = images[i]
        label_dict = labels_dicts[i]
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(image.height, image.width)

        label_arrs.append(label_arr)
    # Block until featurising thread done
    check_featurising_done(len(label_arrs), UID)

    remasked_flattened_arrs: np.ndarray
    # probs, model = featurise_then_segment(img_arrs, DEAFAULT_FEATURES, label_arrs)
    probs, model = segment_with_features(label_arrs, UID)

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
