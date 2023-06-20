"""Given an image, get its encoding with SAM and save to a .npy file."""
from segment_anything import SamPredictor, sam_model_registry
import numpy as np
from PIL import Image
from typing import List
import os
from io import BytesIO

from features import DEAFAULT_FEATURES, multiscale_advanced_features

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()

sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b_01ec64.pth")
sam_predictor = SamPredictor(sam)


def encode(image: Image.Image) -> bytes:
    """Given image, encode with SAM vit model and save to their folder."""
    rgb_arr = np.array(image)
    sam_predictor.set_image(rgb_arr)
    file_bytes_io = BytesIO()
    np.save(file_bytes_io, sam_predictor.features)
    file_bytes_io.seek(0)
    file_bytes = file_bytes_io.read()
    return file_bytes


async def featurise(
    images: List[Image.Image], UID: str, selected_features=DEAFAULT_FEATURES
) -> int:
    """For each img in images, convert to np array then featurise, saving the result to the user's folder."""
    for i, img in enumerate(images):
        img_arr = np.array(img.convert("L")) * 255
        feature_stack = multiscale_advanced_features(img_arr, selected_features)
        np.savez_compressed(f"{CWD}/{UID}/features_{i}", a=feature_stack)
    return 0
