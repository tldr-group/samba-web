"""Given an image, get its encoding with SAM and save to a .npy file."""
from segment_anything import SamPredictor, sam_model_registry
import numpy as np
from PIL import Image
from typing import List

from features import DEAFAULT_FEATURES, multiscale_advanced_features


def encode(image: Image.Image, UID: str, img_id: int = 0) -> None:
    """Given image, encode with SAM vit model and save to their folder."""
    rgb_arr = np.array(image)
    sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b_01ec64.pth")
    sam_predictor = SamPredictor(sam)
    sam_predictor.set_image(rgb_arr)
    np.save(f"{UID}/encoding_{img_id}.npy", sam_predictor.features)


def featurise(
    images: List[Image.Image], UID: str, selected_features=DEAFAULT_FEATURES
) -> None:
    """For each img in images, convert to np array then featurise, saving the result to the user's folder."""
    for i, img in enumerate(images):
        img_arr = np.array(img.convert("L")) * 255
        feature_stack = multiscale_advanced_features(img_arr, selected_features)
        np.savez_compressed(f"{UID}/features_{i}", a=feature_stack)
