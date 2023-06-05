"""
2D multi-scale featurisation of a single channel image.

Approach inspired by (1) https://scikit-image.org/docs/stable/api/skimage.feature.html#skimage.feature.multiscale_basic_features
Designed to be a Python equivalent of (most) of the features present at (2) https://imagej.net/plugins/tws/
Heavy use of skimage filters, filters.rank and feature. 
General approach is:
• for each $sigma (a scale over which to compute a feature for a pixel):
    • compute each singlescale singlechannel feature
• compute scale free features (difference of Gaussians, Membrane Projections, Bilateral)
• combine, stack as np array in form (HxWxN_features)

Singlescale feature computation is mapped over multiple threads as in (1).
Every feature computes a value for *every pixel* in the image.
"""
import numpy as np
from skimage import filters, feature
from skimage.util.dtype import img_as_float32
from scipy.ndimage import rotate, convolve
from skimage.draw import disk

from itertools import combinations_with_replacement, combinations, chain
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import cpu_count

from typing import Tuple, List

# - 2 to allow for main & gui threads
N_ALLOWED_CPUS = cpu_count() - 2
DEAFAULT_FEATURES = {
    "Gaussian Blur": 1,
    "Sobel Filter": 1,
    "Hessian": 1,
    "Difference of Gaussians": 1,
    "Membrane Projections": 1,
    "Mean": 0,
    "Minimum": 0,
    "Maximum": 0,
    "Median": 0,
    "Bilateral": 0,
    "Derivatives": 0,
    "Structure": 0,
    "Entropy": 0,
    "Neighbours": 1,
    "Membrane Thickness": 0,
    "Membrane Patch Size": 17,
    "Minimum Sigma": 0.5,
    "Maximum Sigma": 16,
}


# %% ===================================HELPER FUNCTIONS===================================
def make_footprint(sigma: int) -> np.ndarray:
    """Return array of zeros with centreed circle of radius sigma set to 1."""
    circle_footprint = np.zeros((2 * sigma + 1, 2 * sigma + 1))
    centre = (sigma, sigma)
    rr, cc = disk(centre, sigma)
    circle_footprint[rr, cc] = 1
    return circle_footprint


# %% ===================================SINGLESCALE FEATURES===================================
def singlescale_gaussian(img: np.ndarray, sigma: int) -> np.ndarray:
    """Gaussian blur of each pixel in $img of scale/radius $sigma."""
    return filters.gaussian(img, sigma, preserve_range=False)


def singlescale_edges(gaussian_filtered: np.ndarray) -> np.ndarray:
    """Sobel filter applied to gaussian filtered arr of scale sigma to detect edges."""
    return filters.sobel(gaussian_filtered)


def singlescale_hessian(gaussian_filtered: np.ndarray) -> Tuple[np.ndarray, ...]:
    """Compute mod, trace, det and eigenvalues of Hessian matrix of $gaussian_filtered image (i.e for every pixel)."""
    H_elems = [
        np.gradient(np.gradient(gaussian_filtered)[ax0], axis=ax1)
        for ax0, ax1 in combinations_with_replacement(range(gaussian_filtered.ndim), 2)
    ]
    a, b, d = H_elems
    mod = np.sqrt(a**2 + b**2 + d**2)
    trace = a + d
    det = a * d - b**2
    # orientation_1 = 0.5 * np.arccos(4 * b ** 2 +  (a - d) ** 2)
    # orientation_2 = orientation_1 + np.pi / 2
    eigvals = feature.hessian_matrix_eigvals(H_elems)
    return (mod, trace, det, *eigvals)


def singlescale_mean(
    byte_img: np.ndarray, sigma_rad_footprint: np.ndarray
) -> np.ndarray:
    """Mean pixel intensity over footprint $sigma_rad_footprint. Needs img in np.uint8 format."""
    return filters.rank.mean(byte_img, sigma_rad_footprint)


def singlescale_median(
    byte_img: np.ndarray, sigma_rad_footprint: np.ndarray
) -> np.ndarray:
    """Median pixel intensity over footprint $sigma_rad_footprint."""
    return filters.rank.median(byte_img, sigma_rad_footprint)


def singlescale_maximum(
    byte_img: np.ndarray, sigma_rad_footprint: np.ndarray
) -> np.ndarray:
    """Maximum pixel intensity over footprint $sigma_rad_footprint."""
    return filters.rank.maximum(byte_img, sigma_rad_footprint)


def singlescale_minimum(
    byte_img: np.ndarray, sigma_rad_footprint: np.ndarray
) -> np.ndarray:
    """Minimum pixel intensity over footprint $sigma_rad_footprint."""
    return filters.rank.minimum(byte_img, sigma_rad_footprint)


def singlescale_entropy(img: np.ndarray, sigma_rad_footprint: np.ndarray) -> np.ndarray:
    """Compute entropy of $n_bins histogram of $img in $sigma_rad_footprint. Memory intensive."""
    entropies = []
    for n_bins in [32, 64, 128]:  # was 32, 64, 128, 256
        histogram = filters.rank.windowed_histogram(
            img, sigma_rad_footprint, n_bins=n_bins
        )  # -> (H, W, N) array
        probs = np.divide(histogram, np.amax(histogram, axis=-1, keepdims=True))
        entropy = np.sum(-probs * np.log2(probs, where=(probs > 0)), axis=-1)
        entropies.append(entropy)
    return np.stack(entropies, axis=0)


def singlescale_structure_tensor(img: np.ndarray, sigma: int) -> np.ndarray:
    """Compute structure tensor eigenvalues of $img in $sigma radius."""
    tensor = feature.structure_tensor(img, sigma)
    eigvals = feature.structure_tensor_eigenvalues(tensor)
    return eigvals[:2]


def singlescale_neighbours(img: np.ndarray, sigma: int) -> List[np.ndarray]:
    """Singlescale neighbours.

    Find nearest neighbours of $img by convolving $sigma-dilated 3x3 kernel with $img.
    i.e sigma = 1:
    111
    101
    111

    i.e sigma = 2:
    10101
    00000
    10001
    00000
    10101

    etc.
    """
    sigma = int(sigma)
    kernel = np.zeros((2 * sigma + 1, 2 * sigma + 1), dtype=np.uint8)
    out_convs = []
    mid = (sigma, sigma)
    # this combination is every neighbour
    for x in [-1, 0, 1]:
        for y in [-1, 0, 1]:
            # ignore middle pixel
            if x == 0 and y == 0:
                pass
            else:
                k_temp = np.copy(kernel)
                neighbour_coord = (mid[1] + y * sigma, mid[0] + x * sigma)
                k_temp[neighbour_coord[0], neighbour_coord[1]] = 1
                result = convolve(img, k_temp)
                out_convs.append(result)
    return out_convs


def singlescale_higher_order_derivatives(
    img: np.ndarray, sigma_rad_footprint: np.ndarray
) -> List[np.ndarray]:
    """Compute d^n intensity gradients, n in [4, 6, 8, 10] of $img in $simga radius."""
    derivatives = []
    deriv_n = img
    for order in range(1, 11):
        # get higher ordr derivatives by repeatedly applying local gradient. I think this should work as x, y are equal orders
        deriv_n = filters.rank.gradient(deriv_n, sigma_rad_footprint)
        if order in [4, 6, 8, 10]:
            derivatives.append(deriv_n)
    return derivatives


def singlescale_laplacian(img: np.ndarray, sigma: int) -> np.ndarray:
    """Compute laplacian of $img on scale $simga. Not currently working."""
    sigma = int(sigma)
    return filters.laplace(img, sigma)


# %% ===================================SCALE-FREE FEATURES===================================
def bilateral(img: np.ndarray) -> np.ndarray:
    """For $sigma in [5, 10], for $value_range in [50, 100], compute mean of pixels in $sigma radius inside $value_range window for each pixel."""
    bilaterals = []
    for spatial_radius in [5, 10]:
        footprint = make_footprint(spatial_radius)
        for value_range in [50, 100]:  # check your pixels are [0, 255]
            bilateral = filters.rank.mean_bilateral(
                img, footprint, s0=value_range, s1=value_range
            )
            bilaterals.append(bilateral)
    return np.stack(bilaterals, axis=0)


def difference_of_gaussians(gaussian_blurs: List[np.ndarray]) -> List[np.ndarray]:
    """For each possible combination of arr in $gaussian_blurs (representing different $sigma scales), compute their difference."""
    combs = combinations(gaussian_blurs, 2)
    dogs = []
    for x, y in combs:
        dogs.append(x - y)
    return dogs


def membrane_projections(
    img: np.ndarray,
    membrane_patch_size: int = 19,
    membrane_thickness: int = 1,
    num_workers: int | None = N_ALLOWED_CPUS,
) -> List[np.ndarray]:
    """
    Membrane projections.

    Create a $membrane_patch_size^2 array with $membrane_thickness central columns set to 1, other entries set to 0.
    Next compute 30 different rotations of membrane kernel ($theta in [0, 180, step=6 degrees]).
    Convolve each of these kernels with $img to get HxWx30 array, then z-project the array by taking
    the sum, mean, std, median, max and min to get a HxWx6 array out.
    """
    kernel = np.zeros((membrane_patch_size, membrane_patch_size))
    x0 = membrane_patch_size // 2 - membrane_thickness // 2
    x1 = 1 + membrane_patch_size // 2 + membrane_thickness // 2
    kernel[:, x0:x1] = 1

    all_kernels = [np.rint(rotate(kernel, angle)) for angle in range(0, 180, 6)]
    # map these across threads to speed up (order unimportant)
    with ThreadPoolExecutor(max_workers=num_workers) as ex:
        out_angles = list(
            ex.map(
                lambda k: convolve(img, k),
                all_kernels,
            )
        )
    out_angles_np = np.stack(out_angles, axis=0)
    sum_proj = np.sum(out_angles_np, axis=0)
    mean_proj = np.mean(out_angles_np, axis=0)
    std_proj = np.std(out_angles_np, axis=0)
    median_proj = np.median(out_angles_np, axis=0)
    max_proj = np.amax(out_angles_np, axis=0)
    min_proj = np.amin(out_angles_np, axis=0)
    return [sum_proj, mean_proj, std_proj, median_proj, max_proj, min_proj]


# %% ===================================MANAGER FUNCTIONS===================================
def singlescale_advanced_features_singlechannel(
    unconverted_img: np.ndarray,
    sigma: int,
    intensity=True,
    edges=True,
    texture=True,
    mean=True,
    median=True,
    minimum=True,
    maximum=True,
    entropy=True,
    structure=True,
    neighbours=True,
    derivatives=True,
) -> Tuple[np.ndarray, ...]:
    """Compute all *selected* singlescale features for scale $sigma. Done s.t things like radial sigma kernel can be reused."""
    img = np.ascontiguousarray(img_as_float32(unconverted_img))
    results: Tuple[np.ndarray, ...] = ()
    gaussian_filtered = singlescale_gaussian(img, sigma)
    if intensity == 1:
        results += (gaussian_filtered,)
    if edges == 1:
        results += (singlescale_edges(gaussian_filtered),)
    if texture == 1:
        results += (*singlescale_hessian(gaussian_filtered),)

    byte_img = unconverted_img.astype(np.uint8)
    circle_footprint = make_footprint(int(np.ceil(sigma)))
    if mean == 1:
        mean_radius = singlescale_mean(byte_img, circle_footprint)
        results += (mean_radius,)
    if median == 1:
        median_radius = singlescale_median(byte_img, circle_footprint)
        results += (median_radius,)
    if minimum == 1:
        minimum_radius = singlescale_minimum(byte_img, circle_footprint)
        results += (minimum_radius,)
    if maximum == 1:
        maximum_radius = singlescale_maximum(byte_img, circle_footprint)
        results += (maximum_radius,)
    if entropy == 1:
        entropy = singlescale_entropy(byte_img, circle_footprint)
        results += (*entropy,)
    if structure == 1:
        structure_eigvals = singlescale_structure_tensor(img, sigma)
        results += (
            structure_eigvals[0],
            structure_eigvals[-1],
        )
    if neighbours == 1:
        neighbours_list = singlescale_neighbours(img, sigma)
        results += (*neighbours_list,)
    if derivatives == 1:
        derivs = singlescale_higher_order_derivatives(byte_img, circle_footprint)
        results += (*derivs,)
    return results


def multiscale_advanced_features(
    img: np.ndarray,
    feature_dict: dict,
    num_workers: int | None = None,
) -> np.ndarray:
    """
    Multiscale advanced features.

    Compute each of the selected features in $feature_dict.
    Singlescale features are computed over a ranged of length scales $sigma on different execution threads.
    Scale invariant features are computed onced.
    """
    sigma_min = (
        float(feature_dict["Minimum Sigma"])
        if feature_dict["Minimum Sigma"] != -1
        else 0.5
    )
    sigma_max = float(feature_dict["Maximum Sigma"])
    num_sigma = int(np.log2(sigma_max) - np.log2(sigma_min) + 1)
    sigmas = np.logspace(
        np.log2(sigma_min),
        np.log2(sigma_max),
        num=num_sigma,
        base=2,
        endpoint=True,
    )
    with ThreadPoolExecutor(max_workers=num_workers) as ex:
        out_sigmas = list(
            ex.map(
                lambda s: singlescale_advanced_features_singlechannel(
                    img,
                    s,
                    intensity=feature_dict["Gaussian Blur"],
                    edges=feature_dict["Sobel Filter"],
                    texture=feature_dict["Hessian"],
                    mean=feature_dict["Mean"],
                    median=feature_dict["Median"],
                    minimum=feature_dict["Minimum"],
                    maximum=feature_dict["Maximum"],
                    entropy=feature_dict["Entropy"],
                    structure=feature_dict["Structure"],
                    neighbours=feature_dict["Neighbours"],
                    derivatives=feature_dict["Derivatives"],
                ),
                sigmas,
            )
        )
    features = chain.from_iterable(out_sigmas)

    if feature_dict["Difference of Gaussians"] == 1:
        intensities = []
        for i in range(num_sigma):
            intensities.append(out_sigmas[i][0])
        dogs = difference_of_gaussians(intensities)
        features = chain(features, dogs)

    img = np.ascontiguousarray(img_as_float32(img))

    if feature_dict["Membrane Projections"] == 1:
        projections = membrane_projections(
            img,
            membrane_patch_size=int(float(feature_dict["Membrane Patch Size"])),
            membrane_thickness=int(float(feature_dict["Membrane Thickness"])),
            num_workers=num_workers,
        )
        features = chain(features, projections)

    if feature_dict["Bilateral"] == 1:
        byte_img = img.astype(np.uint8)
        bilateral = bilateral(byte_img)
        features = chain(features, bilateral)

    features = list(features)  # type: ignore
    features: np.ndarray = np.stack(features, axis=-1).astype(np.float16)  # type: ignore
    return features  # type: ignore
