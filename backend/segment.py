"""Given an image and some labels, featurise then segment with random forest classiier."""
import numpy as np
from PIL import Image
from tifffile import imwrite
import os
from time import sleep
from typing import List
from math import floor, ceil

from forest_based import segment_with_features


def _check_featurising_done(n_imgs: int, UID: str):
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


def _get_split_inds(w: int, h: int) -> dict:
    nW = ceil(w / 1024)
    nH = ceil(h / 1024)
    dx = w / nW
    dy = h / nH
    wInds = [floor(dx * i) for i in range(nW)]
    hInds = [floor(dy * i) for i in range(nH)]
    inds = {"w": wInds, "h": hInds, "dx": dx, "dy": dy, "nW": nW, "nH": nH}
    return inds


def _save_as_tiff(
    arr_list: List[np.ndarray], mode: str, UID: str, large_w: int = 0, large_h: int = 0
) -> None:
    remasked_arrs = np.array(arr_list)
    max_class = np.amax(remasked_arrs)
    delta = floor(255 / (max_class - 1))
    if mode == "stack":
        print(remasked_arrs.shape)
        rescaled = ((remasked_arrs - 1) * delta).astype(np.uint8)
        imwrite(f"{UID}/seg.tiff", rescaled)
    elif mode == "large":
        large_seg = np.zeros((large_h, large_w), dtype=np.uint8)
        inds = _get_split_inds(large_w, large_h)
        img_count = 0
        w_inds, h_inds = inds["w"], inds["h"]
        w_inds.append(int(large_w) - 1)
        h_inds.append(int(large_h) - 1)
        for j in range(0, len(h_inds) - 1):
            for i in range(0, len(w_inds) - 1):
                seg = arr_list[img_count]
                h, w = seg.shape
                x0, x1 = w_inds[i], w_inds[i] + w
                y0, y1 = h_inds[j], h_inds[j] + h
                rescaled = (seg - 1) * delta
                large_seg[y0:y1, x0:x1] = rescaled
                img_count += 1
        imwrite(f"{UID}/seg.tiff", large_seg)


def segment(
    images: List[Image.Image],
    labels_dicts: List[dict],
    UID: str,
    save_mode: str,
    large_w: int = 0,
    large_h: int = 0,
) -> np.ndarray:
    """
    Perform FRF segmentation.

    Given list of label dicts, convert to arr, reshape to be same as corresponding image. Once
    the background featurisation is complete, then generate training data for RF, train and apply.
    Once result return, convert from probabilities to classes, flatten and return.
    """
    label_arrs: List[np.ndarray] = []
    for i in range(len(images)):
        image = images[i]
        label_dict = labels_dicts[i]
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(image.height, image.width)

        label_arrs.append(label_arr)
    # Block until featurising thread done
    _check_featurising_done(len(label_arrs), UID)

    remasked_arrs_list: List[np.ndarray] = []
    remasked_flattened_arrs: np.ndarray
    probs, model = segment_with_features(label_arrs, UID)

    for i in range(len(probs)):
        label_arr = label_arrs[i]
        classes = np.argmax(probs[i], axis=0).astype(np.uint8) + 1
        remasked = np.where(label_arr == 0, classes, label_arr).astype(np.uint8)
        remasked_arrs_list.append(remasked)
        if i == 0:
            remasked_flattened_arrs = remasked.flatten()
        else:
            remasked_flattened_arrs = np.concatenate(
                (remasked_flattened_arrs, remasked.flatten()), axis=0, dtype=np.uint8
            )
    _save_as_tiff(remasked_arrs_list, save_mode, UID, large_w, large_h)
    print(remasked_flattened_arrs.shape, label_arrs[0].shape)
    return remasked_flattened_arrs
