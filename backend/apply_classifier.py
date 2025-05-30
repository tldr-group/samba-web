import numpy as np
from features import (
    multiscale_advanced_features,
    N_ALLOWED_CPUS,
    DEAFAULT_FEATURES,
    BACKEND,
)
from sklearn.ensemble import RandomForestClassifier
from skops.io import load as skload
from pickle import load
from math import floor

from tifffile import imread, imwrite, COMPRESSION


CURRENT_WEB_FEATURES = {
    "Gaussian Blur": 1,
    "Sobel Filter": 1,
    "Hessian": 1,
    "Difference of Gaussians": 0,
    "Membrane Projections": 0,
    "Mean": 0,
    "Minimum": 0,
    "Maximum": 0,
    "Median": 0,
    "Bilateral": 0,
    "Derivatives": 0,
    "Structure": 0,
    "Entropy": 0,
    "Neighbours": 0,
    "Membrane Thickness": 1,
    "Membrane Patch Size": 19,
    "Minimum Sigma": 0,  # note 0 scale is not true 0 scale
    "Maximum Sigma": 16,
}


def load_classifier_from_file(path_to_classifier: str) -> RandomForestClassifier:
    classifier: RandomForestClassifier
    with open(path_to_classifier, "rb") as f:
        if ".pkl" in path_to_classifier:
            classifier = load(f)
        elif ".skops" in path_to_classifier:
            classifier = skload(path_to_classifier)
        else:
            raise Exception("classfier format must be .pkl or .skops")
    return classifier


PATH_TO_DATA = "backend/apply/stack.tif"
if __name__ == "__main__":
    model = load_classifier_from_file("backend/apply/classifier.skops")

    data_stack = imread(PATH_TO_DATA)  # (D,H,W)
    out_seg = np.zeros_like(data_stack)
    slice_arr: np.ndarray
    for i, slice_arr in enumerate(data_stack):
        feature_stack = multiscale_advanced_features(slice_arr, CURRENT_WEB_FEATURES)
        h, w, feat = feature_stack.shape
        flat_apply_data = feature_stack.reshape((h * w, feat))

        out_probs = model.predict_proba(flat_apply_data)
        seg_of_slice = np.argmax(out_probs, axis=-1).reshape((h, w))

        out_seg[i, :, :] = seg_of_slice
    imwrite("backend/apply/segmented.tiff", out_seg, compression=COMPRESSION.DEFLATE)
    delta = floor(255 / (np.argmax(out_seg)))
    imwrite(
        "backend/apply/segmented_rescaled.tiff",
        out_seg * delta,
        compression=COMPRESSION.DEFLATE,
    )
