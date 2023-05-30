"""Given an image, get its encoding with SAM and save to a .npy file."""
from segment_anything import SamPredictor, sam_model_registry
import numpy as np
from PIL import Image
from tifffile import imwrite


def encode(image: Image.Image, UID: str):
    rgb_arr = np.array(image)
    sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b_01ec64.pth")
    sam_predictor = SamPredictor(sam)
    sam_predictor.set_image(rgb_arr)
    np.save(f"{UID}_encoding.npy", sam_predictor.features)
    # imwrite("encoding.tif", sam_predictor.features.numpy())
