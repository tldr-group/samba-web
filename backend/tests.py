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
import time
import sys
from azure.storage.blob import BlobServiceClient


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

load_weka = False
try:
    FIJI_PATH = sys.argv[1]
    load_weka = True
except:
    FIJI_PATH = ""
    print("No FIJI path supplied so cannot do end-to-end tests.")

URL = "https://sambasegment.blob.core.windows.net/resources/weka_default.tif"


def get_weka_default_from_azure() -> np.ndarray:
    """Grab weka default feature stack for image super1 from azure storage.

    :return: arr of weka default features downloaded from azure storage
    :rtype: np.ndarray
    """
    account_url = "https://sambasegment.blob.core.windows.net"
    blob_service_client = BlobServiceClient(account_url)
    container_client = blob_service_client.get_blob_client(
        container="resources", blob="weka_default.tif"
    )
    with open("backend/test_resources/weka_default.tif", "wb") as f:
        download_stream = container_client.download_blob()
        f.write(download_stream.readall())
    return imread("backend/test_resources/weka_default.tif")


try:
    weka = imread("backend/test_resources/weka_default.tif")
except FileNotFoundError:
    get_weka_default_from_azure()
    weka = imread("backend/test_resources/weka_default.tif")


def _test_centre_val(filtered_arr, val):
    centre_val = filtered_arr[CENTRE[1], CENTRE[0]]
    assert isclose(centre_val, val, abs_tol=1e-6)


def _test_sum(filtered_arr, val):
    assert isclose(np.sum(filtered_arr), val, abs_tol=1e-6)


class TestFeatures(unittest.TestCase):
    """Test featurisation functions in features.py."""

    def test_footprint(self) -> None:
        """Footprint test.

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
        """Sobel filter test.

        Perform sobel edge detection on our circle array - should return some outline of the circle.
        Then subtract the original circle and measure circumfrence. If it's similar to the analytic
        circumfrence then ok. (Again discrete != anayltic so have high rel tolerance.)
        """
        filtered = ft.singlescale_edges(CIRCLE)
        subtracted = filtered.round(0) - CIRCLE
        circumfrence = np.sum(np.where(subtracted > 0, 1, 0))
        assert isclose(circumfrence, 2 * pi * SIGMA, rel_tol=0.15)

    def test_mean(self) -> None:
        """Mean filter test.

        Mean filter w/ footprint of size $SIGMA on our test arr $CIRCLE_BYTE. Because mean filter is same
        size as circle, the mean of the centre should be unity (times a scaling factor) and the sum
        should be unity as well.
        """
        filtered = ft.singlescale_mean(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)

    def test_max(self) -> None:
        """Max filter test.

        Max filter radius $SIGMA on our test arr $CIRCLE_BYTE should be 255 almost everywhere except top
        corners (as they are more than $SIGMA pixels away from disk).
        """
        filtered = ft.singlescale_maximum(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        top_left_val = filtered[0, 0]
        assert isclose(top_left_val, 0, abs_tol=1e-6)

    def test_min(self) -> None:
        """Min filter test.

        Min filter radius $SIGMA on our test arr $CIRCLE_BYTE should be 0 almost everywhere except
        centre - so centre value AND sum should equal 255.
        """
        filtered = ft.singlescale_minimum(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        _test_sum(filtered, 255)

    def test_median(self) -> None:
        """Median filter test.

        Median filter radius $SIGMA on our test arr $CIRCLE_BYTE should be the circle again but smaller.
        Again centre should be 255 and egdes 0.
        """
        filtered = ft.singlescale_median(CIRCLE_BYTE, FOOTPRINT)
        _test_centre_val(filtered, 255)
        top_left_val = filtered[0, 0]
        assert isclose(top_left_val, 0, abs_tol=1e-6)

    def test_neighbours(self) -> None:
        """Neighbour filter test.

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
        """Membrane projection filter test.

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
        """Bilateral filter test.

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
    """Get number of DoGs at given length scale when iterating through each filter. Note there are weird offsets to account for looping.

    :param sigma: scale paramter
    :type sigma: int
    :return: number of DoGs at given sigma.
    :rtype: int
    """
    if sigma < 2:
        return 0
    else:
        sigma -= 1
        return int(np.floor((sigma * (sigma - 1)) / 2))


def norm(arr: np.ndarray) -> np.ndarray:
    """Normalise array by subtracting its min then dividing my max of new arr. Works for mixes of positive and negative.

    :param arr: arr to normalise
    :type arr: np.ndarray
    :return: normalised arr
    :rtype: np.ndarray
    """
    offset = arr - np.amin(arr)
    normed = offset / np.amax(offset)
    return np.abs(normed)


def norm_get_mse(filter_1: np.ndarray, filter_2: np.ndarray) -> float:
    """Normalise both filters (arrays) and get the mse.

    :param filter_1: first arr
    :type filter_1: np.ndarray
    :param filter_2: second arr
    :type filter_2: np.ndarray
    :return: mean squared error between normalised arrs
    :rtype: float
    """
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

    def test_compare_defaults(self) -> None:
        """Handler for each test, shares the feature stacks with them so only computed once."""
        passed = True

        img = imread("backend/test_resources/super1.tif").astype(np.float32)
        samba = ft.multiscale_advanced_features(
            img, ft.DEAFAULT_FEATURES, ft.N_ALLOWED_CPUS
        ).transpose((2, 0, 1))
        singlescale_mse = self.compare_singlescale_default(weka, samba)
        dog_mse = self.compare_dog_default(weka, samba)
        membrane_mse = self.compare_membrane_projections(weka, samba)
        all_mses = singlescale_mse + dog_mse + membrane_mse
        self.plot_mses_save(all_mses)
        for m in all_mses:
            if m > 0.01:
                passed = False
        assert passed

    def compare_singlescale_default(
        self, weka: np.ndarray, samba: np.ndarray
    ) -> List[float]:
        """Compare each singlescale feature, accounting for ordering differences.

        :param weka: arr of weka features (NxHxW)
        :type weka: np.ndarray
        :param samba: arr of SAMBA features (MxHxW). M < N and is in different order
        :type samba: np.ndarray
        :return: List of MSEs when comparing different singlescale features.
        :rtype: List[float]
        """
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

    def compare_dog_default(self, weka: np.ndarray, samba: np.ndarray) -> List[float]:
        """Compare Difference Of Gaussian (DoG) filters: in Weka these appear per length scale, in SAMBA these appear near the end.

        :param weka: arr of weka features (NxHxW)
        :type weka: np.ndarray
        :param samba: arr of SAMBA features (MxHxW). M < N and is in different order
        :type samba: np.ndarray
        :return: List of MSEs when comparing different DoG features.
        :rtype: List[float]
        """
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

    def compare_membrane_projections(
        self, weka: np.ndarray, samba: np.ndarray
    ) -> List[float]:
        """Compare membrane projection filters, for both tools these are at the end of the filter stacks.

        :param weka: arr of weka features (NxHxW)
        :type weka: np.ndarray
        :param samba: arr of SAMBA features (MxHxW). M < N and is in different order
        :type samba: np.ndarray
        :return: List of MSEs when comparing different membrane projections.
        :rtype: List[float]
        """
        mses = []
        for i in range(6):
            idx = i - 6
            weka_f = weka[idx]
            samba_f = samba[idx]
            mse = norm_get_mse(weka_f, samba_f)
            mses.append(mse)
        return mses

    def plot_mses_save(self, mses: List[float]) -> None:
        """Plot all the MSEs with correct names.

        :param mses: list of MSEs of (all) features.
        :type mses: List[float]
        """
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

        plt.figure(num=0, figsize=(16, 16))
        x = np.arange(0, len(mses))
        plt.plot(x, mses, ".", ms=10)
        plt.xticks(ticks=x, labels=names, rotation="vertical", fontsize=12)
        plt.yticks(fontsize=12)
        plt.xlabel("Features", fontsize=14)
        plt.ylabel("MSE", fontsize=14)
        plt.savefig("backend/test_resources/test_outputs/feature_test.png")


def get_scores(gt: np.ndarray, seg: np.ndarray) -> Tuple[float, float]:
    """Compute iou and dice scores for 2 arrays of same shape.

    :param gt: reference arr - the weka segmentation
    :type gt: np.ndarray
    :param seg: comparison arr - SAMBA segmentation
    :type seg: np.ndarray
    :return: tuple of iou_score and dice similarity
    :rtype: Tuple[float, float]
    """
    flat_gt = gt.flatten()
    flat_seg = seg.flatten()
    boolean_out = np.where(flat_gt == flat_seg, 1, 0)
    A, B, A_U_B = len(flat_gt), len(flat_seg), np.sum(boolean_out)
    iou_score = A_U_B / (A + B - A_U_B)
    dice_similarity = A_U_B * 2 / (A + B)
    return iou_score, dice_similarity


class CompareSegmentations(unittest.TestCase):
    """Integration test of SAMBA segmentations vs Weka (featurising, labels, training, applying)."""

    def test_segmentations(self):
        """Test_segmentations.

        For the three micrographs with N=2,3,4 phases, open the micrograph in Weka, featurise,
        add rectangular labels from a config file, train and segment via an ImageJ Macro. Then
        featurise and segment using SAMBA and calculate the Dice score between the two results.
        Assuming the Dice score is greater than 0.8 for each, then pass.
        """
        passed = True
        dice_scores = []
        weka_segmentations, samba_segmentations = [], []
        weka_times, samba_times = [], []

        if load_weka is False:
            assert passed
            return

        for n in range(2, 5):
            fname = f"{n}_phase"
            weka_arr, samba_arr, weka_t, samba_t = self.get_weka_samba_segs(fname)
            scores = get_scores(weka_arr, samba_arr)
            dice_scores.append(scores[1])
            weka_segmentations.append(weka_arr)
            samba_segmentations.append(samba_arr)
            weka_times.append(weka_t)
            samba_times.append(samba_t)

        self.plots(
            dice_scores,
            weka_segmentations,
            samba_segmentations,
            weka_times,
            samba_times,
        )

        for d in dice_scores:
            if d < 0.8:
                passed = False

        assert passed

    def get_weka_samba_segs(
        self, fname: str
    ) -> Tuple[np.ndarray, np.ndarray, float, float]:
        """Given a filename, adjust macro config files, call Weka, segment, save, load SAMBA, segment, then compare the two.

        :param fname: filename
        :type fname: str
        :return: tuple of weka segmentation arr, samba segmentation arr, time to compute weka segmentation, time to compute samba segmentation
        :rtype: Tuple[np.ndarray, np.ndarray, float, float]
        """
        set_macro_path()
        set_config_file(f"{fname}.tif")
        weka_t = run_weka(FIJI_PATH)
        img_arr = imread(f"backend/test_resources/{fname}.tif")
        weka_arr = imread("backend/test_resources/output.tif")
        label = get_label_arr(f"backend/test_resources/{fname}_roi_config.txt", img_arr)
        start_t = time.time()
        samba_arr = segment_no_features_get_arr(label, img_arr)
        end_t = time.time()
        samba_t = end_t - start_t
        return weka_arr, samba_arr, weka_t, samba_t

    def plots(
        self,
        scores: List[float],
        weka_segs: List[np.ndarray],
        samba_segs: List[np.ndarray],
        weka_times: List[float],
        samba_times: List[float],
    ) -> None:
        """Produce 2 plots: segmentation image comparisons w/ dice scores and times.

        :param scores: list of dice scores for each phase segmentation compared
        :type scores: List[float]
        :param weka_segs: list of weka segmentation arrs for each phase segmentation compared
        :type weka_segs: List[np.ndarray]
        :param samba_segs: list of SAMBA segmentation arrs for each phase segmentation compared
        :type samba_segs: List[np.ndarray]
        :param weka_times: list of times taken by Weka to segment
        :type weka_times: List[float]
        :param samba_times: list of times taken by SAMBA to segment
        :type samba_times: List[float]
        """
        fig = plt.figure(num=1, constrained_layout=True, figsize=(16, 16))
        subfigs = fig.subfigures(nrows=3, ncols=1)
        for row, sfig in enumerate(subfigs):
            sfig.suptitle(f"{2+row} phase, Dice Score={scores[row]:.4f}", fontsize=20)
            axs = sfig.subplots(nrows=1, ncols=2)
            axs[0].imshow(weka_segs[row], cmap="gist_gray")
            axs[0].set_axis_off()
            axs[1].imshow(samba_segs[row], cmap="gist_gray")
            axs[1].set_axis_off()
            if row == 0:
                axs[0].set_title("Weka", fontsize=16)
                axs[1].set_title("SAMBA", fontsize=16)
        plt.savefig("backend/test_resources/test_outputs/segmentation_comparison.png")

        fig2 = plt.figure(num=2, figsize=(16, 16))
        x = np.arange(2, 5)
        plt.plot(x, weka_times, marker=".", ms=15, label="Weka")
        plt.plot(x, samba_times, marker=".", ms=15, label="SAMBA")
        plt.legend(fontsize=14)
        plt.ylabel("Time (s)", fontsize=14)
        plt.xlabel("Number of phases", fontsize=14)
        plt.savefig("backend/test_resources/test_outputs/times_comparison.png")


if __name__ == "__main__":
    unittest.main(argv=[FIJI_PATH])
