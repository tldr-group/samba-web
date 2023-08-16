"""Given an image and some labels, featurise then segment with random forest classiier."""
from zipfile import ZIP_DEFLATED
import numpy as np
from PIL import Image
from tifffile import imwrite
import os
from typing import List, Tuple
from math import floor, ceil
from pickle import dump
from skops.io import dump as skdump
from skops.io import loads as skloads
from skops.io import load as skload

from test_resources.call_weka import sep
from forest_based import segment_with_features, apply_features_done, EnsembleMethod
import matplotlib.cm as cm

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()


def _get_split_inds(w: int, h: int) -> dict:
    """Get coordinates to split large image at based on its height and width.

    :param w: img width
    :type w: int
    :param h: img height
    :type h: int
    :return: dictionary containing list of x coords to split at, y coords to split at, the h and w
    intervals of the sub-images and the number of sub-images in the x and y directions
    :rtype: dict
    """
    nW = ceil(w / 1024)
    nH = ceil(h / 1024)
    dx = w / nW
    dy = h / nH
    wInds = [floor(dx * i) for i in range(nW)]
    hInds = [floor(dy * i) for i in range(nH)]
    inds = {"w": wInds, "h": hInds, "dx": dx, "dy": dy, "nW": nW, "nH": nH}
    return inds


def _create_composite_tiff(
    arr_list: List[np.ndarray],
    mode: str,
    large_w: int = 0,
    large_h: int = 0,
    rescale=True,
) -> np.ndarray:
    """Create composite tiff.

    For an (large or stack) image that has been split into sub-images, loop through every arr in arr
    list (these can be img arrs, label arrs or segmentations arrs of shape (dx, dy)) and recomposite.
    For large images, sub images are placed into a (large_w, large_h) arr based on the indices
    information from _get_split_inds(). For stacks, sub images are simply placed in sequence.

    :param arr_list: list of arrs of sub-images
    :type arr_list: List[np.ndarray]
    :param mode: whether the image is large or a stack
    :type mode: str
    :param large_w: width of large image, defaults to 0
    :type large_w: int, optional
    :param large_h: height of large image, defaults to 0
    :type large_h: int, optional
    :param rescale: whether to rescale class values to make results visible, defaults to True
    :type rescale: bool, optional
    :raises Exception: if tiff mode is wrong, throw error
    :return: a composited tiff arr
    :rtype: np.ndarray
    """
    out: np.ndarray
    remasked_arrs = np.array(arr_list)
    max_class = np.amax(remasked_arrs)
    delta = floor(255 / (max_class))
    # this will save a tiff with 1, 2, 3 etc rather than 64, 128, etc
    if rescale is False:
        delta = 1
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
    arr_list: List[np.ndarray],
    mode: str,
    UID: str,
    large_w: int = 0,
    large_h: int = 0,
    score: float | None = None,
    rescale: bool = True,
    thumbnail: bool = True,
) -> int:
    """Given an arr of sub-images, composite then save to user directory.

    :param arr_list: list of arrs of sub-images
    :type arr_list: List[np.ndarray]
    :param mode: whether the image is large or a stack
    :type mode: str
    :param UID: user ID pointing to folder to store the tiff
    :type UID: str
    :param large_w: width of large image, defaults to 0
    :type large_w: int, optional
    :param large_h: height of large image, defaults to 0
    :type large_h: int, optional
    :param score: OOB score of classifier, stored in tiff software name
    :type score: float | None, optional
    :param rescale: whether to rescale class values to make results visible, defaults to True
    :type rescale: bool, optional
    :param thumbnail: whether to save cropped thumbnail for gallery, defaults to True
    :type thumbnail: bool, optional
    :return: 0 if successful
    :rtype: int
    """
    out = _create_composite_tiff(arr_list, mode, large_w=large_w, large_h=large_h, rescale=rescale)
    sw_name: str = "SAMBA"
    if score is not None:
        sw_name = f"SAMBA, val. score={score:.3f}"

    imwrite(
        f"{CWD}{sep}{UID}{sep}seg.tiff",
        out,
        photometric="minisblack",
        description="foo".encode("utf-8"),
        datetime=True,
        software=sw_name,
    )

    try:
        if thumbnail:
            _, x, y = out.shape
            t_size = 300
            Image.fromarray(
                out[
                    0,
                    x // 2 - t_size // 2 : x // 2 + t_size // 2,
                    y // 2 - t_size // 2 : y // 2 + t_size // 2,
                ]
            ).save(f"{CWD}{sep}{UID}{sep}seg_thumbnail.jpg")
            Image.fromarray(out[0]).save(f"{CWD}{sep}{UID}{sep}seg.png")
    except Exception as e:
        print(e)
    return 0


async def save_labels(
    img_dims: List[Tuple[int, int]],
    labels_dicts: List[dict],
    UID: str,
    mode: str,
    large_w: int = 0,
    large_h: int = 0,
    rescale=True,
) -> np.ndarray:
    """Create composite tiffs of the label arrs and return the bytes. This has 0 for unlabelled pixels.

    :param images: list of images. TODO: make this a lsit of (h, w) tuples
    :type images: List[Image.Image]
    :param labels_dicts: list of label dictionaries as sent over HTTP
    :type labels_dicts: List[dict]
    :param mode: whether the image is large or a stack
    :type mode: str
    :param large_w: width of large image, defaults to 0
    :type large_w: int, optional
    :param large_h: height of large image, defaults to 0
    :type large_h: int, optional
    :param rescale: whether to rescale class values to make results visible, defaults to True
    :type rescale: bool, optional
    :return: np array of the (composited) labels
    :rtype: np.ndarray
    """
    label_arrs: List[np.ndarray] = []
    for i in range(len(img_dims)):
        h, w = img_dims[i]
        label_dict = labels_dicts[i]
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(h, w)
        label_arrs.append(label_arr)
    label_out = _create_composite_tiff(label_arrs, mode, large_w, large_h, rescale)
    imwrite(
        f"{CWD}{sep}{UID}{sep}labels.tiff",
        label_out,
        photometric="minisblack",
        datetime=True,
    )
    return label_out


async def _save_classifier(model: EnsembleMethod, CWD: str, UID: str) -> int:
    """Save (trained) ensemble method to user data folder in both .pkl and .skops format.

    :param model: (trained) sklearn ensemble method
    :type model: EnsembleMethod
    :param CWD: current directory (found automatically)
    :type CWD: str
    :param UID: user ID
    :type UID: str
    :return: 0 if successful
    :rtype: int
    """
    with open(f"{CWD}{sep}{UID}{sep}classifier.pkl", "wb") as handle:
        dump(model, handle)
    skdump(
        model,
        f"{CWD}{sep}{UID}{sep}classifier.skops",
        compression=ZIP_DEFLATED,
        compresslevel=9,
    )
    return 0


async def load_classifier_from_http(file_bytes: bytes, CWD: str, UID: str) -> None:
    """Use skload to load sklearn model from $file_bytes, then save to user directory.

    :param file_bytes: bytes corresponing to skops file of classifier sent over HTTP
    :type file_bytes: bytes
    :param CWD: current working directory
    :type CWD: str
    :param UID: user id
    :type UID: str
    """
    model = skloads(file_bytes)
    skdump(
        model,
        f"{CWD}{sep}{UID}{sep}classifier.skops",
        compression=ZIP_DEFLATED,
        compresslevel=9,
    )
    print("Loaded skops successfully")


async def segment(
    img_dims: List[Tuple[int, int]],
    labels_dicts: List[dict],
    UID: str,
    save_mode: str,
    large_w: int = 0,
    large_h: int = 0,
    n_points: int = 50000,
    train_all: bool = True,
    rescale: bool = True,
    balance: bool = True,
) -> np.ndarray:
    """Perform FRF segmentation.

    Given list of label dicts, convert to arr, reshape to be same as corresponding image. Once
    the background featurisation is complete, then generate training data for RF, train and apply.
    Once result return, convert from probabilities to classes, flatten and return.

    :param img_dims: list of image dimensions
    :type img_dims: List[Tuple[int, int]]
    :param labels_dicts: list of label dictionaries as sent over HTTP
    :type labels_dicts: List[dict]
    :param UID: user id
    :type UID: str
    :param save_mode: whether the image is large or a stack
    :type save_mode: str
    :param large_w: width of large image, defaults to 0
    :type large_w: int, optional
    :param large_h: height of large image, defaults to 0
    :type large_h: int, optional
    :param n_points: number of training points to sample, defaults to 40000
    :type n_points: int, optional
    :param train_all: whether to train on all data, defaults to False
    :type train_all: bool, optional
    :param rescale: whether to rescale class values to make results visible, defaults to True
    :type rescale: bool, optional
    :param balance: whether to balance training points based on class frequency, defaults to True
    :type balance: bool, optional
    :return: flattened segementations (class values) where labels overwrite predictions if different.
    :rtype: np.ndarray
    """
    label_arrs: List[np.ndarray] = []
    for i in range(len(img_dims)):
        h, w = img_dims[i]
        label_dict = labels_dicts[i]
        labels_list = [item for keys, item in label_dict.items()]
        label_arr = np.array(labels_list).reshape(h, w)
        label_arrs.append(label_arr)

    remasked_arrs_list: List[np.ndarray] = []
    remasked_flattened_arrs: np.ndarray
    uncertainty_flattened_arrs: np.ndarray
    probs, model, score = segment_with_features(label_arrs, UID, n_points=n_points, train_all=train_all, balance_classes=balance)
    N_imgs = len(probs)

    for i in range(N_imgs):
        label_arr = label_arrs[i]
        max_certainty: np.ndarray = np.amax(probs[i], axis=0)
        uncertainties = 1 - max_certainty
        classes = np.argmax(probs[i], axis=0).astype(np.uint8) + 1
        remasked = np.where(label_arr == 0, classes, label_arr).astype(np.uint8)
        remasked_arrs_list.append(remasked)
        if i == 0:
            remasked_flattened_arrs = remasked.flatten()
            uncertainty_flattened_arrs = uncertainties.flatten()
        else:
            remasked_flattened_arrs = np.concatenate((remasked_flattened_arrs, remasked.flatten()), axis=0, dtype=np.uint8)
            uncertainty_flattened_arrs = np.concatenate((uncertainty_flattened_arrs, uncertainties.flatten()))
    await _save_as_tiff(remasked_arrs_list, save_mode, UID, large_w, large_h, score, rescale=rescale)
    await save_labels(img_dims, labels_dicts, UID, save_mode, large_w, large_h, rescale)
    await _save_classifier(model, CWD, UID)
    print(remasked_flattened_arrs.shape, label_arrs[0].shape)
    cmapped_flat = _cmap_uncertainties_return_flat_arr(uncertainty_flattened_arrs)
    return remasked_flattened_arrs, cmapped_flat #, least_certain_regions


async def apply(
    img_dims: List[Tuple[int, int]],
    UID: str,
    save_mode: str,
    large_w: int = 0,
    large_h: int = 0,
    rescale: bool = True,
) -> np.ndarray:
    """Apply a trained classifier to a collection of images, save the tiff(s) & return the flattened byte arrays.

    :param img_dims: list of image dimensions
    :type img_dims: List[Tuple[int, int]]
    :param UID: user id
    :type UID: str
    :param save_mode: whether the image is large or a stack
    :type save_mode: str
    :param large_w: width of large image, defaults to 0
    :type large_w: int, optional
    :param large_h: height of large image, defaults to 0
    :type large_h: int, optional
    :param rescale: whether to rescale class values to make results visible, defaults to True
    :type rescale: bool, optional
    :return: flattened segmentations (only class values)
    :rtype: np.ndarray
    """
    model = skload(f"{CWD}{sep}{UID}{sep}classifier.skops")
    probs = apply_features_done(model, UID, len(img_dims))
    N_imgs = len(probs)
    # array to store coords of least certain region
    #least_certain_regions = np.zeros((N_imgs * 4), dtype=np.int32) - 1

    arrs_list: List[np.ndarray] = []
    flattened_arrs: np.ndarray
    uncertainty_flattened_arrs: np.ndarray
    for i in range(len(img_dims)):
        max_certainty: np.ndarray = np.amax(probs[i], axis=0)
        uncertainties = 1 - max_certainty
        classes = np.argmax(probs[i], axis=0).astype(np.uint8) + 1
        arrs_list.append(classes)
        if i == 0:
            flattened_arrs = classes.flatten()
            uncertainty_flattened_arrs = uncertainties.flatten()
        else:
            flattened_arrs = np.concatenate((flattened_arrs, classes.flatten()), axis=0, dtype=np.uint8)
            uncertainty_flattened_arrs = np.concatenate((uncertainty_flattened_arrs, uncertainties.flatten()))
    await _save_as_tiff(arrs_list, save_mode, UID, large_w, large_h, rescale=rescale)
    cmapped_flat = _cmap_uncertainties_return_flat_arr(uncertainty_flattened_arrs)
    return flattened_arrs, cmapped_flat #, least_certain_regions


def _cmap_uncertainties_return_flat_arr(uncertainties: np.ndarray) -> np.ndarray:
    cmap = cm.get_cmap('plasma')
    cmapped: np.ndarray = cmap(uncertainties)
    
    sliced = cmapped[:, :3] # ignore alpha channel
    scaled = (sliced * 255).astype(np.uint8)
    print(cmapped.shape, np.amax(scaled), sliced.shape)
    return scaled.flatten()