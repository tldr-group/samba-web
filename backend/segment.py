"""Given an image and some labels, featurise then segment with random forest classiier."""
import numpy as np
from PIL import Image
from tifffile import imwrite
import os
from typing import List
from math import floor, ceil
from pickle import dump
from io import BytesIO

from forest_based import segment_with_features

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()


def _get_split_inds(w: int, h: int) -> dict:
    nW = ceil(w / 1024)
    nH = ceil(h / 1024)
    dx = w / nW
    dy = h / nH
    wInds = [floor(dx * i) for i in range(nW)]
    hInds = [floor(dy * i) for i in range(nH)]
    inds = {"w": wInds, "h": hInds, "dx": dx, "dy": dy, "nW": nW, "nH": nH}
    return inds


def _create_composite_tiff(
    arr_list: List[np.ndarray], mode: str, large_w: int = 0, large_h: int = 0
) -> np.ndarray:
    out: np.ndarray
    remasked_arrs = np.array(arr_list)
    max_class = np.amax(remasked_arrs)
    delta = floor(255 / (max_class))
    print(mode, remasked_arrs.shape)
    if mode == "stack":
        rescaled = ((remasked_arrs) * delta).astype(np.uint8)
        out = rescaled
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
                rescaled = (seg) * delta
                large_seg[y0:y1, x0:x1] = rescaled
                img_count += 1
        out = large_seg
    elif mode == "single":
        rescaled = ((remasked_arrs) * delta).astype(np.uint8)
        out = rescaled
    else:
        raise Exception("wrong tiff mode")
    return out


async def _save_as_tiff(
    arr_list: List[np.ndarray], mode: str, UID: str, large_w: int = 0, large_h: int = 0
) -> int:
    out = _create_composite_tiff(arr_list, mode, large_w=large_w, large_h=large_h)
    imwrite(f"{CWD}/{UID}/seg.tiff", out, photometric="minisblack")
    return 0


def save_labels(
    images: List[Image.Image],
    labels_dicts: List[dict],
    mode: str,
    large_w: int = 0,
    large_h: int = 0,
) -> bytes:
    label_arrs: List[np.ndarray] = []
    for i in range(len(images)):
        image = images[i]
        label_dict = labels_dicts[i]
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(image.height, image.width)
        label_arrs.append(label_arr)
    label_out = _create_composite_tiff(label_arrs, mode, large_w, large_h)
    file_bytes_io = BytesIO()
    imwrite(file_bytes_io, label_out, photometric="minisblack")
    file_bytes_io.seek(0)
    file_bytes = file_bytes_io.read()
    return file_bytes


async def _save_classifier(model, CWD: str, UID: str) -> int:
    with open(f"{CWD}/{UID}/classifier.pkl", "wb") as handle:
        dump(model, handle)
    return 0


async def segment(
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
    await _save_as_tiff(remasked_arrs_list, save_mode, UID, large_w, large_h)
    await _save_classifier(model, CWD, UID)
    print(remasked_flattened_arrs.shape, label_arrs[0].shape)
    return remasked_flattened_arrs
