"""Functions to run weka as subprocess and quit on exit."""
import os
import subprocess
import time
import numpy as np

from typing import List

if os.name == "nt":
    sep = "\\"
else:
    sep = "/"

run_folder_path = os.path.dirname(os.path.realpath(__file__))


def set_macro_path() -> None:
    """Open the macro and add the path of the folder this script is in to it."""
    with open(f"{run_folder_path}{sep}classify.ijm", "r+") as f:
        lines = f.readlines()
    line = f'path = "{run_folder_path}{sep}"\n'
    lines[0] = line
    with open(f"{run_folder_path}{sep}classify.ijm", "w+") as f:
        f.writelines(lines)


def set_config_file(fname: str) -> None:
    """Open the config settings txt file, write the features we want to enable in weka (the defaults).

    :param fname: short filename (without extension)
    :type fname: str
    """
    with open(f"{run_folder_path}{sep}classification_config.txt", "w+") as file:
        # the image we want to segment is first line of this file
        file.write(f"{fname}\n")
        # enable default features
        for i in [
            "Gaussian Blur",
            "Hessian",
            "Sobel filter",
            "Difference of gaussians",
            "Membrane projections",
        ]:
            file.write(f"{i}=True\n")


def get_label_arr(config_file_path: str, img_arr: np.ndarray) -> np.ndarray:
    """Open given weka style roi file, loop through and add those labels to empty array.

    :param config_file_path: path to the roi config file containing reactangular rois
    :type config_file_path: str
    :param img_arr: np array of the image with shape (h, w)
    :type img_arr: np.ndarray
    :return: a (h, w) array where labelled regions have class value c=1,2,3,.. and unlabelled pixels have value=0
    :rtype: np.ndarray
    """
    with open(config_file_path) as f:
        lines = f.read().splitlines()
    labels = np.zeros_like(img_arr)
    roi_counter = 0
    current_roi: List[int] = []
    for l in lines:
        if l[0] == "#" or l[0] == "N":
            pass
        elif roi_counter < 4 and l.isnumeric():
            current_roi.append(int(l))
            roi_counter += 1
        elif roi_counter == 4:
            current_roi.append(int(l))
            roi_counter = 0
            x, y, w, h, c = current_roi
            labels[y : y + h, x : x + w] = c + 1
            current_roi = []
    return labels


def run_weka(fiji_path: str) -> float:
    """Given path to FIJI installation, run that with the classification macro and default features.

    :param fiji_path: path to FIJI binary on the system.
    :type fiji_path: str
    :return: time taken to run the macro (including boot time)
    :rtype: float
    """
    start_t = time.time()
    if os.name == "nt":
        os.system(f"{fiji_path} -macro {run_folder_path}{sep}classify.ijm")
    else:
        subprocess.run(
            [f"{fiji_path}", "-macro", f"{run_folder_path}{sep}classify.ijm"]
        )
    end_t = time.time()
    return end_t - start_t
