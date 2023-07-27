"""
Tests for backend.

Unit tests for featurisation and random forest segmentation. 
"""

import unittest

import numpy as np
from math import isclose, pi
import matplotlib.pyplot as plt
from tifffile import imread, imwrite
from skimage.metrics import mean_squared_error

from typing import List, Tuple

import matplotlib.pyplot as plt

import features as ft
from test_resources.call_weka import (
    set_macro_path,
    set_config_file,
    run_weka,
    get_label_arr,
)
from forest_based import segment_no_features_get_arr

# add call to grab the weka features tif from azure blob
# set up git
SIGMA = 5
FOOTPRINT = ft.make_footprint(sigma=SIGMA)
CIRCLE = np.pad(FOOTPRINT, ((2, 2), (2, 2)))
CENTRE = (SIGMA + 2, SIGMA + 2)
CIRCLE_BYTE = (255 * CIRCLE).astype(np.uint8)
FIJI_PATH = "/home/ronan/Documents/uni_work/phd/fiji-linux64/Fiji.app/ImageJ-linux64"  # make argparse


def _test_centre_val(filtered_arr, val):
    centre_val = filtered_arr[CENTRE[1], CENTRE[0]]
    assert isclose(centre_val, val, abs_tol=1e-6)


def _test_sum(filtered_arr, val):
    assert isclose(np.sum(filtered_arr), val, abs_tol=1e-6)


class TestFeatures(unittest.TestCase):
    """Test featurisation functions in features.py."""

    def test_footprint(self) -> None:
        """
        Footprint test.

        Check if ratio of footprint circle to footprint square is close to pi*r^2/(2*r+1)^2 - obviously
        not exact as we're comparing discrete value to analytic expression.
        """
        sigma = 6
        footprint = ft.make_footprint(sigma=sigma)
        area_circle = np.sum(footprint)
        square_length = footprint.shape[0]
        area_square = square_length**2
        footprint_ratio = area_circle / area_square
        analytic_ratio = pi * sigma**2 / square_length**2
        assert isclose(footprint_ratio, analytic_ratio, rel_tol=0.05)

    def test_sobel(self) -> None:
        """
        Sobel filter test.

        Perform sobel edge detection on our circle array - should return some outline of the circle.
        Then subtract the original circle and measure circumfrence. If it's similar to the analytic
        circumfrence then ok. (Again discrete != anayltic so have high rel tolerance.)
        """
        filtered = ft.singlescale_edges(CIRCLE)
        subtracted = filtered.round(0) - CIRCLE
        circumfrence = np.sum(np.where(subtracted > 0, 1, 0))
        assert isclose(circumfrence, 2 * pi * SIGMA, rel_tol=0.15)

    def test_mean(self) -> None:
        """
        Mean filter test.

        Mean filter w/ footprint of size $SIGMA on our test arr $CIRCLE_BYTE. Because mean filter is same
        size as circle, the mean of the centre should be unity (times a scaling factor) and the sum
        should be unity as well.
        """
        filtered = ft.singlescale_mean(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)

    def test_max(self) -> None:
        """
        Max filter test.

        Max filter radius $SIGMA on our test arr $CIRCLE_BYTE should be 255 almost everywhere except top
        corners (as they are more than $SIGMA pixels away from disk).
        """
        filtered = ft.singlescale_maximum(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        top_left_val = filtered[0, 0]
        assert isclose(top_left_val, 0, abs_tol=1e-6)

    def test_min(self) -> None:
        """
        Min filter test.

        Min filter radius $SIGMA on our test arr $CIRCLE_BYTE should be 0 almost everywhere except
        centre - so centre value AND sum should equal 255.
        """
        filtered = ft.singlescale_minimum(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        _test_sum(filtered, 255)

    def test_median(self) -> None:
        """
        Median filter test.

        Median filter radius $SIGMA on our test arr $CIRCLE_BYTE should be the circle again but smaller.
        Again centre should be 255 and egdes 0.
        """
        filtered = ft.singlescale_median(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        top_left_val = filtered[0, 0]
        assert isclose(top_left_val, 0, abs_tol=1e-6)

    def test_neighbours(self) -> None:
        """
        Neighbour filter test.

        Compute nearest neighbours of 5x5 arr of 0's filled with 3x3 square of 1's and sum them. Compare to the
        analytic result (which is just convolution of 3x3 equally wegihted kernel and the image.)
        """
        number_of_neighbours_analytic = np.array(
            [
                [1, 2, 3, 2, 1],
                [2, 3, 5, 3, 2],
                [3, 5, 8, 5, 3],
                [2, 3, 5, 3, 2],
                [1, 2, 3, 2, 1],
            ]
        )
        square = np.zeros((5, 5))
        square[1:-1, 1:-1] = 1
        filtered = ft.singlescale_neighbours(square, 1)
        number_of_neighbours = np.sum(filtered, axis=0)
        assert number_of_neighbours.all() == number_of_neighbours_analytic.all()

    def test_membrane_projection(self) -> None:
        """
        Membrane projection filter test.

        Membrane projections emphasise lines of similar value pixels. Here we test it on a line of pixels -
        the max value should be in the centre and it should decrease montonically from that.
        """
        line = np.zeros((64, 64))
        line[:, 32] = 1
        z_projs = ft.membrane_projections(line)
        filtered = z_projs[0]
        prev_val = filtered[32, 32]
        for i in range(1, 5):
            current_val = filtered[32, 32 + i]
            assert current_val < prev_val
            prev_val = current_val

    def test_bilateral(self) -> None:
        """
        Bilateral filter test.

        Bilateral filter is mean of values in [5, 10] footprint with [50, 100] pixel values of the centre pixel.
        With a bilevel square - one half 20, one half 100 - our bilateral filter with window threhsold 50 won't do
        anything (i.e will average 20s wiwth 20s and 100s with 100s.). However, with window threshold 100, the filter will
        average the 20s and the 100s at the interface and decrease the total value of the array (because 20/100 not symmetric).
        Because our function returns [(5, 50), (5, 100), (10, 50), (10, 100)] where first value is footprint raidus and
        second value is threshold, we check if [0] > [1] as [1] has averaging, we check [0] == [2] as both no averaging
        and we check [0] > [3] as [3] has more averaging.
        """
        bilevel = np.ones((64, 64), dtype=np.uint8) * 20
        bilevel[:, 32:] = 100
        bilaterals = ft.bilateral(bilevel)
        assert np.sum(bilaterals[0]) > np.sum(bilaterals[1])
        assert np.sum(bilaterals[0]) == np.sum(bilaterals[2])
        assert np.sum(bilaterals[0]) > np.sum(bilaterals[3])


def weka_dog_per_sigma(sigma: int) -> int:
    """Get number of DoGs at given length scale when iterating through each filter."""
    if sigma < 2:
        return 0
    else:
        sigma -= 1
        return int(np.floor((sigma * (sigma - 1)) / 2))


def norm(arr: np.ndarray) -> np.ndarray:
    """Normalise array by subtracting its min then dividing my max of new arr. Works for mixes of positive and negative."""
    offset = arr - np.amin(arr)
    normed = offset / np.amax(offset)
    return np.abs(normed)


def norm_get_mse(filter_1: np.ndarray, filter_2: np.ndarray) -> float:
    """Normalise both filters (arrays) and get the mse."""
    n1 = norm(filter_1)
    n2 = norm(filter_2)
    return mean_squared_error(n1, n2)


SAMBA_PER_LENGTH_SCALE = 7
WEKA_PER_LENGTH_SCALE_BASE = 10
length_scales = [0, 1, 2, 4, 8, 16]


class CompareDefaultFeatures(unittest.TestCase):
    """
    CompareDefaultFeatures.

    Load a micrograph featurised with default filters in Weka. Featurise same micrograph
    in SAMBA backed. For each filter, normalise then get MSE between Weka and SAMBA.
    Do this for each singlescale feature as well as the scale-free features. Note that in Weka the
    Difference Of Gaussian filters appear at each length scale whereas in SAMBA they
    appear at the end, complicating analysis slightly. Plot the MSEs as a function
    of filter and save them. A default threshold of 0.01 (i.e 1%) is the fail cut-off.
    """

    # todo: use sphinx api docstring style for autogenerated docs

    def test_compare_defaults(self) -> None:
        """Handler for each test, shares the feature stacks with them so only computed once."""
        passed = True
        weka = imread("backend/test_resources/weka_default.tif")
        img = imread("backend/test_resources/super1.tif").astype(np.float32)
        samba = ft.multiscale_advanced_features(
            img, ft.DEAFAULT_FEATURES, ft.N_ALLOWED_CPUS
        ).transpose((2, 0, 1))
        imwrite("backend/test_resources/samba_default.tif", samba)
        singlescale_mse = self.compare_singlescale_default(weka, samba)
        dog_mse = self.compare_dog_default(weka, samba)
        membrane_mse = self.compare_membrane_projections(weka, samba)
        all_mses = singlescale_mse + dog_mse + membrane_mse
        self.plot_mses_save(all_mses)
        for m in all_mses:
            if m > 0.01:
                passed = False
        assert passed

    def compare_singlescale_default(self, weka, samba) -> List[float]:
        """Compare each singlescale feature, accounting for ordering differences."""
        mses: List[float] = []

        for i in range(len(length_scales) * SAMBA_PER_LENGTH_SCALE):
            scale = i // SAMBA_PER_LENGTH_SCALE
            n_dog = weka_dog_per_sigma(scale)
            weka_idx = (
                scale * WEKA_PER_LENGTH_SCALE_BASE + n_dog + i % SAMBA_PER_LENGTH_SCALE
            )
            weka_f, samba_f = weka[weka_idx], samba[i]
            mse = norm_get_mse(weka_f, samba_f)
            mses.append(mse)
        return mses

    def compare_dog_default(self, weka, samba) -> List[float]:
        """Compare DoG filters: in Weka these appear per length scale, in SAMBA these appear near the end."""
        mses: List[float] = []
        length_scales = [0, 1, 2, 4, 8, 16]
        samba_DoG_offset = len(length_scales) * SAMBA_PER_LENGTH_SCALE
        prev_total_n_dog = 0
        for n in range(3, 7):
            n_dog = n - 2
            weka_offset = n * WEKA_PER_LENGTH_SCALE_BASE + prev_total_n_dog
            for m in range(n_dog):
                weka_f = weka[weka_offset + m]
                samba_f = samba[samba_DoG_offset + prev_total_n_dog + m]
                mse = norm_get_mse(weka_f, samba_f)
                mses.append(mse)
            prev_total_n_dog += n_dog
        return mses

    def compare_membrane_projections(self, weka, samba) -> List[float]:
        """Compare membrane projection filters, for both tools these are at the end of the filter stacks."""
        mses = []
        for i in range(6):
            idx = i - 6
            weka_f = weka[idx]
            samba_f = samba[idx]
            mse = norm_get_mse(weka_f, samba_f)
            mses.append(mse)
        return mses

    def plot_mses_save(self, mses: List[float]) -> None:
        """Plot all the MSEs with correct names."""
        names: list[str] = []
        scale_filter_names = [
            "Gauss",
            "Sobel",
            "Hess_Mod",
            "Hess_Tr",
            "Hess_Det",
            "Hess_e1",
            "Hess_e2",
        ]
        for i in range(len(length_scales) * SAMBA_PER_LENGTH_SCALE):
            scale = i // SAMBA_PER_LENGTH_SCALE
            name = f"{scale_filter_names[i % 7]}_{length_scales[scale]}"
            names.append(name)
        for n in range(3, 7):
            n_dog = n - 2
            for m in range(n_dog):
                s1 = length_scales[n - 1]
                s2 = length_scales[m + 1]
                names.append(f"DoG_{s1}_{s2}")
        m_projs_names = ["mean", "max", "min", "sum", "std", "median"]
        for name in m_projs_names:
            names.append("membrane_" + name)

        plt.figure(figsize=(16, 16))
        x = np.arange(0, len(mses))
        plt.plot(x, mses, ".", ms=10)
        plt.xticks(ticks=x, labels=names, rotation="vertical", fontsize=12)
        plt.yticks(fontsize=12)
        plt.xlabel("Features", fontsize=14)
        plt.ylabel("MSE", fontsize=14)
        plt.savefig("backend/test_resources/test.png")


def get_scores(gt: np.ndarray, seg: np.ndarray) -> Tuple[float, float]:
    flat_gt = gt.flatten()
    flat_seg = seg.flatten()
    boolean_out = np.where(flat_gt == flat_seg, 1, 0)
    A, B, A_U_B = len(flat_gt), len(flat_seg), np.sum(boolean_out)
    iou_score = A_U_B / (A + B - A_U_B)
    dice_similarity = A_U_B * 2 / (A + B)
    return iou_score, dice_similarity


class CompareSegmentations(unittest.TestCase):
    def test_segmentations(self):
        set_macro_path()
        set_config_file("4_phase.tif")
        # run_weka(FIJI_PATH)
        img_arr = imread("backend/test_resources/4_phase.tif")
        weka_arr = imread("backend/test_resources/output.tif")
        label = get_label_arr("backend/test_resources/4_phase_roi_config.txt", img_arr)
        samba_arr = segment_no_features_get_arr(label, img_arr)
        scores = get_scores(weka_arr, samba_arr)
        print(scores)
        imwrite("backend/test_resources/output2.tif", samba_arr)
        # imwrite("backend/test_resources/label.tif", label)


if __name__ == "__main__":
    cases = (TestFeatures, CompareDefaultFeatures)
    suite = unittest.TestSuite(
        [unittest.TestLoader().loadTestsFromTestCase(c) for c in cases]
    )
    unittest.main()
