"""
Tests for backend.

Unit tests for featurisation and random forest segmentation. 
"""

import unittest
import numpy as np

from scipy.ndimage import rotate, convolve, sobel
from math import isclose, pi
import matplotlib.pyplot as plt


import features as ft

SIGMA = 5
FOOTPRINT = ft.make_footprint(sigma=SIGMA)
CIRCLE = np.pad(FOOTPRINT, ((2, 2), (2, 2)))
CENTRE = (SIGMA + 2, SIGMA + 2)
CIRCLE_BYTE = (255 * CIRCLE).astype(np.uint8)


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
        filtered = z_projs[1]
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

    # test entropy by seeing if entropy of disk + random noise > random nosie
    # test derivatives on polynomials
    # have seperate integration test for both features and classifier - basically check results match weka


if __name__ == "__main__":
    unittest.main()
