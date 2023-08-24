"""Functions for suggesting regions for user to label pre- and post- segmentation."""
import numpy as np
import matplotlib.pyplot as plt

from typing import Tuple

N_W: int = 3
N_H: int = 3
DEBUG = False


def find_least_certain_region(probs: np.ndarray) -> Tuple[int, int, int, int]:
    """Patch segmentation probs into N_W x N_H square, find total region uncertainty and return max.

    :param probs: _description_
    :type probs: np.ndarray
    :return: _description_
    :rtype: Tuple[int, int, int, int]
    """
    max_certainty: np.ndarray = np.amax(probs, axis=0)
    uncertainties = 1 - max_certainty
    overwrite = np.zeros_like(uncertainties)
    h, w = uncertainties.shape
    dx: int = w // N_W
    dy: int = h // N_H
    region_uncertainties: np.ndarray = np.zeros((N_W * N_H))
    i = 0
    for y in range(N_H - 1):
        for x in range(N_W - 1):
            x0, x1 = x * dx, (x + 1) * dx
            y0, y1 = y * dy, (y + 1) * dy
            sub_region = uncertainties[y0: y1, x0: x1]
            total_region_uncertaintiy = np.sum(sub_region)
            overwrite[y0: y1, x0: x1] = total_region_uncertaintiy
            region_uncertainties[i] = total_region_uncertaintiy
            i += 1
    max_uncertainty_loc = int(np.argmax(region_uncertainties))
    mx = max_uncertainty_loc % N_W
    my = max_uncertainty_loc // N_H
    if DEBUG:
        plt.imsave('uncertainties.png', uncertainties, cmap='plasma')
        plt.imsave('overwrite.png', overwrite, cmap='plasma')
    return (mx, my, dx, dy)
