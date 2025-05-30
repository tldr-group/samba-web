import numpy as np
from itertools import product, chain
from scipy.stats import norm  # type: ignore
from scipy.optimize import minimize  # type: ignore

from typing import TypedDict

DEFAULT_N_DIV = 301
VERBOSE = False

# %% ======================== TWO-POINT CORRELATION METHODS ========================


def autocorrelation_orthant(
    binary_img: np.ndarray, num_elements: int, n_dims: int, desired_length: int = 100
) -> np.ndarray:
    """Calculates the autocorrelation function of a binary image using the FFT method
    for a single orthant, in all vectors right and down from the origin. Using the FFT
    computes the TPC for all these vectors in a single pass, instead of explicitly
    shifting the image by every vector r in [(0, 1) ... (0, l) .. (l, l)] and taking
    the product. This reduces the number of operations for an image of size N from
    N^2 (N shifts * N for each product) -> Nlog(N). We slice to $desired_length
    after to speed up calculations later.

    Note Two-Point Correlation (TPC) = autocorrelation and are used interchangably.

    [1] 'Microstructure sensitive design for performance optimization', 2012
    Adams, Brent L and Kalidindi, Surya R and Fullwood, David T
    [2] 'Efficient generation of anisotropic N-field microstructures
    from 2-point statistics using multi-output Gaussian random fields', 2022
    Robertson, Andreas E and Kalidindi, Surya R

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param num_elements: total N elements in microstructure
    :type num_elements: int
    :param n_dims: whether arr is 2/3D
    :type n_dims: int
    :param desired_length: post TPC crop length, defaults to 100
    :type desired_length: int, optional
    :return:  2/3D array for orthant where tpc[y, x] is the tpc for the vector (y,x)
    :rtype: np.nddary
    """
    ax = list(range(0, len(binary_img.shape)))
    img_FFT = np.fft.rfftn(binary_img, axes=ax)
    tpc = (
        np.fft.irfftn(img_FFT.conjugate() * img_FFT, s=binary_img.shape, axes=ax).real
        / num_elements
    )
    # multidimensional slicing up to desired length i.e tpc[:100, :100, :100]
    return tpc[tuple(map(slice, (desired_length,) * n_dims))]


def two_point_correlation_orthant(
    binary_img: np.ndarray,
    n_dims: int,
    desired_length: int = 100,
    periodic: bool = True,
) -> np.ndarray:
    """Calculates the two point correlation function of an image along an orthant.
    If we do not want to use periodic boundary conditions for calculating the autocorrelation,
    it pads the image with $desired_length number of zeros before calculating the 2PC function
    using the FFT method. After the FFT calculation, it normalises the result by the number of
    possible occurences of the 2PC function.

    Periodic BCs are better for stability, so not using them (i.e not periodic == True) is uncommon.

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param n_dims: whether arr is 2/3D
    :type n_dims: int
    :param desired_length: post TPC crop length, defaults to 100
    :type desired_length: int, optional
    :param periodic: whether periodic BCs applied, defaults to True
    :type periodic: bool, optional
    :return: (normalised) tpc for a orthant
    :rtype: np.ndarray
    """
    img_shape = binary_img.shape
    normalisation_for_tpc: np.ndarray
    if not periodic:  # padding the image with zeros
        indices_img = np.indices(img_shape) + 1

        normalisation_for_tpc = np.flip(np.prod(indices_img, axis=0))
        # normalisation_for_tpc is an arr where the entry arr[x, y] counts the number of the original entries of img that
        # will be present after shifting by x,y i.e for a shift 0,0 this is mag(img)
        # this lets you normalise the mean with the 'ghost dimensions' later for non-periodic images
        binary_img = np.pad(
            binary_img, [(0, desired_length) for _ in range(n_dims)], "constant"
        )

    num_elements = int(np.prod(img_shape))
    # 2D tpc array up to $desired_legth * $desired_length
    tpc_desired = autocorrelation_orthant(
        binary_img, num_elements, n_dims, desired_length
    )

    if not periodic:
        # normalising the result as we have more 0s than would otherwise have
        normalisation_for_tpc = normalisation_for_tpc[
            tuple(map(slice, tpc_desired.shape))
        ]  # multidimensional slicing
        normalisation_for_tpc = num_elements / normalisation_for_tpc
        # normalisation_for_tpc is an array of adjustments applied pointwise to the tpc_desired
        return normalisation_for_tpc * tpc_desired
    else:
        return tpc_desired


def two_point_correlation(
    binary_img: np.ndarray,
    desired_length: int = 100,
    volumetric: bool = False,
    periodic: bool = True,
) -> np.ndarray:
    """Compute TPC for all orthants (ND quadrants) in the input data. These orthants are related to
    directions of vectors we would use to shift the image before computing the self-product were we
    not using the FFT approach. They correspond to the axes of the image that are flipped before
    performing the FFT. The orthant TPCs are then recombined into $result

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param desired_length: post TPC crop length, defaults to 100
    :type desired_length: int, optional
    :param volumetric: if 3D or 2D, defaults to False
    :type volumetric: bool, optional
    :param periodic: whether periodic BCs applied, defaults to True
    :type periodic: bool, optional
    :return: a 2/3D array composed of orthant-wise tpcs. For a 2D array this is
    (2 * $desired_length, 2 * $desired_length).
    :rtype: np.ndarray
    """
    n_dims = 3 if volumetric else 2
    # orthant = N-D quadrant. stored here, indexed by axis
    orthants: dict[tuple, np.ndarray] = {}
    # calculating the 2PC function for each orthant, saving the result in a dictionary
    for axis in product((1, 0), repeat=n_dims - 1):
        # flip list is just a list of axes to flip, sometimes no flip happens
        # computing tpc of left and down img = computing tpc of left and up flipped (T->B) image
        flip_list = np.arange(n_dims - 1)[~np.array(axis, dtype=bool)]
        # flipping img to the opposite side for calculation of the 2PC:
        flipped_img = np.flip(binary_img, flip_list)

        tpc_orthant = two_point_correlation_orthant(
            flipped_img, n_dims, desired_length + 1, periodic
        )
        original_tpc_orthant = np.flip(tpc_orthant, flip_list)
        orthants[axis + (1,)] = original_tpc_orthant

        # flipping the orthant to the opposite side
        opposite_axis = tuple(1 - np.array(axis)) + (0,)
        # symmetry flip
        orthants[opposite_axis] = np.flip(original_tpc_orthant)

    # result is our 2/3D array of TPC values up to desired length (in half-manhattan distance NOT euclidean)
    result = np.zeros((desired_length * 2 + 1,) * n_dims)
    for axis in orthants.keys():
        # axis looks like (1, 1)
        axis_idx = np.array(axis) * desired_length
        # axis_idx looks like (100, 100)
        # slice to input: mapping of orthant axis to location in result i.e [0:100, 0:100]
        slice_to_input = tuple(map(slice, axis_idx, axis_idx + desired_length + 1))
        result[slice_to_input] = orthants[axis]
    return result


def radial_tpc(
    binary_img: np.ndarray, volumetric: bool = False, periodic: bool = True
) -> np.ndarray:
    """TPC entrypoint"""
    # this is a problem where arr not square, should take minimum of dimension (for now)
    # TODO: make desired length different in all dimensions
    # TODO: does this need to be its own function that takes all the same arguments as two_point_...
    img_y_length: int = min(binary_img.shape)
    # img_y_length = binary_img.shape[0]
    # img_y_length: int = binary_img.shape[0]
    # desired length: dims of output of fft arr,
    desired_length = (img_y_length // 2) if periodic else (img_y_length - 1)
    return two_point_correlation(
        binary_img,
        desired_length=desired_length,
        volumetric=volumetric,
        periodic=periodic,
    )


# %% ======================== STATISTICAL CLS METHODS ========================


def divide_img_to_subimages(img: np.ndarray, subimg_ratio: int) -> np.ndarray:
    """Divide $img with edge length $L into non-overlapping patches/sub-images of edge length
    $L/$subimg_ratio

    :param img: image to patch
    :type img: np.ndarray
    :param subimg_ratio: ratio of img edge length / subimg edge length
    :type subimg_ratio: int
    :return: np array of $n_images non-overlapping patches from $img
    :rtype: np.ndarray
    """

    img = img[np.newaxis, :]
    threed = len(img.shape) == 4
    one_img_shape = np.array(img.shape)[1:]
    subimg_shape = one_img_shape // subimg_ratio
    n_images = one_img_shape // subimg_shape
    im_to_divide_size = n_images * subimg_shape
    im_to_divide_size = np.insert(im_to_divide_size, 0, img.shape[0])
    im_to_divide = img[tuple(map(slice, im_to_divide_size))]
    reshape_shape = list(chain.from_iterable(zip(n_images, subimg_shape)))
    im_to_divide = im_to_divide.reshape(img.shape[0], *reshape_shape)
    im_to_divide = im_to_divide.swapaxes(2, 3)
    if threed:
        im_to_divide = im_to_divide.swapaxes(4, 5).swapaxes(3, 4)
    # NB: in this case img.shape[0] === 1 and np.prod(n_images) == n_images
    return im_to_divide.reshape((np.prod(n_images) * img.shape[0], *subimg_shape))


def calc_std_from_ratio(binary_img: np.ndarray, ratio: int):
    """Split binary image (side length $L) into non-overlapping patches of side length
    $L / $ratio, measure standard deviation of the $phase_fraction.

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param ratio: side length ratio for patches edge length to image edge length
    :type ratio: float
    :return: standard deviation of patch phase fractions
    :rtype: float?
    """
    divided_img = divide_img_to_subimages(binary_img, ratio)
    along_axis = tuple(np.arange(1, len(binary_img.shape)))
    ddof = 1  # for unbiased std
    return np.std(np.mean(divided_img, axis=along_axis), ddof=ddof)


def image_stats(
    binary_img: np.ndarray, image_pf: float, ratios: list[int], z_score: float = 1.96
) -> list[float]:
    """For each of the side length $ratios (relative to full image) in $ratios,
    calculate the standard deviation in phase fraction over the patches
    (image split into smaller images of side length L_full / $ratio)

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param image_pf: measured image phase fraction
    :type image_pf: float
    :param ratios: list of ratios to divide image length by to create patches
    :type ratios: list[float]
    :param z_score: _description_, defaults to 1.96
    :type z_score: float, optional
    :return: list of patch phase fraction standard errors
    :rtype: list[float]
    """
    errs = []  # std_err of patch phase fractions realtive to image pf
    for ratio in ratios:
        std_ratio = calc_std_from_ratio(binary_img, ratio)
        errs.append(100 * ((z_score * std_ratio) / image_pf))
    return errs


def n_samples_from_dims(img_dims: list[np.ndarray], cls: float) -> list:
    """Translation from CLS -> number of samples of side length CLS in each
    of the patches whose sizes are in $img_dims. This is the number of samples
    made in our Bernoulli distribution.

    :param img_dims: list of patch image dimensions
    :type img_dims: list[np.ndarray]
    :param cls: characteristic length scale/integral range - edge lengths
    :type integral_range: float
    :return: number of length $cls (hyper) cubes in image of size i in $img_dims
    :rtype: list
    """
    # img dims is a list of image dimensions i.e [(h1, w1), (h2, w2)] from our patches
    n_dims = len(img_dims[0])
    # den = denominator
    cls_cube_volume = cls**n_dims
    # subimage (hyper)volume / integral range (hyper) volume
    return [np.prod(np.array(i)) / cls_cube_volume for i in img_dims]


def bernouli(pf: float, ns: list[int], conf: float = 0.95) -> np.ndarray:
    errs = []
    for n in ns:
        std_theo = ((1 / n) * (pf * (1 - pf))) ** 0.5
        errs.append(100 * (norm.interval(conf, scale=std_theo)[1] / pf))
    return np.array(errs, dtype=np.float64)


def test_all_cls_in_range(
    patch_pf_errors: np.ndarray,
    image_pf: float,
    cls_range: np.ndarray,
    img_dims: list[np.ndarray],
) -> float:
    """Test all the CLS values in $cls_range by computing the difference between the
    measured $patch_pf_errors and the expected pf_error based on the bernoulli assumption
    for that CLS. The best CLS is the one which minimises this error.

    :param patch_pf_errors: pf error of patches from measured pf
    :type patch_pf_errors: np.ndarray
    :param image_pf: measured image pf
    :type image_pf: float
    :param cls_range: range over which to test the CLSes
    :type cls_range: np.ndarray
    :param img_dims: list of patch image dimensions
    :type img_dims: list[np.ndarray]
    :return: best CLS in $cls_range
    :rtype: int
    """
    err_fit = []
    for cls in cls_range:
        n_samples = n_samples_from_dims(img_dims, cls)
        # given that the CLS is correct, this is the error in the standard statistical method
        err_model = bernouli(image_pf, n_samples)
        difference = abs(patch_pf_errors - err_model)
        err = np.mean(difference)
        err_fit.append(err)
    cls = cls_range[np.argmin(err_fit)].item()
    return cls


def fit_statisical_cls_from_errors(
    patch_pf_errors: list[float],
    img_dims: list[np.ndarray],
    image_pf: float,
    max_cls: int = 150,
) -> float:
    """Find the CLS that best explains the $patch_pf_errors, given our
    assumption the image is composed of M squares of length CLS sampled from a
    Bernoulli distribution with probability $image_pf. We do this by performing
    a coarse scan across CLSes based on our parameters and then doing a fine
    scan around the best coarse value.

    NB: the Bernoulli assumption holds if the features are finite; we also assume
    the max feature size < 150px and the overall image size > 200px

    :param patch_pf_errors: differences between a patch's phase fraction and the image phase fraction
    :type patch_pf_errors: list[float]
    :param img_dims: list of the patch sizes
    :type img_dims: list[np.ndarray]
    :param image_pf: measured image phase fraction
    :type image_pf: float
    :param max_cls: maximum allowed CLS, defaults to 150
    :type max_cls: int, optional
    :return: statistically fitted CLS
    :rtype: int
    """
    patch_errors_arr = np.array(patch_pf_errors)
    coarse_cls = test_all_cls_in_range(
        patch_errors_arr, image_pf, np.arange(1, max_cls, 1), img_dims
    )
    fine_cls = test_all_cls_in_range(
        patch_errors_arr,
        image_pf,
        np.linspace(coarse_cls - 1, coarse_cls + 1, 50),
        img_dims,
    )
    return fine_cls


def stat_analysis_error_classic(
    binary_img: np.ndarray, image_phase_fraction: float
) -> float:
    """Estimate the CLS of $binary_img using the statistical method: taking
    different non-overlapping patches of the image in powers of 2
    (i.e 1/2 patches, 1/4 patches, 1/8 patches), measuring the difference
    between the phase fractions of these patches and the $image_phase_fraction
    and fitting to find the CLS that best explains these errors.

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param image_phase_fraction: measured phase fraction from the image
    :type image_phase_fraction: float
    :return: statisically predicted CLS
    :rtype: float
    """
    # TODO: our ratios should be dimension specific
    shortest_side = min(binary_img.shape)
    ratios = [2**i for i in np.arange(1, int(np.log2(shortest_side)) - 5)]
    ratios.reverse()
    if binary_img.shape[0] > 1:
        ratios.append(1)
    # avoid having too many small patches (as their PF will be quite unstable)
    ratios = ratios[-4:]
    edge_lengths = [binary_img.shape[1] // r for r in ratios]
    img_dims = [np.array((l,) * (len(binary_img.shape) - 1)) for l in edge_lengths]
    patch_pf_errors = image_stats(binary_img, image_phase_fraction, ratios)
    statistical_cls = fit_statisical_cls_from_errors(
        patch_pf_errors, img_dims, image_phase_fraction
    )
    # TODO different size image 1000 vs 1500
    return statistical_cls


def pred_cls_is_off(
    model_cls: float, binary_img: np.ndarray, image_phase_fraction: float
) -> tuple[bool, int]:
    """Compare our model's (FFT) predicted CLS to statistically predicted CLS. If our model's CLS
    is less than 2/3x or more than 2x the statistical CLS, return True and the 'sign' of
    the error (1 for underestimate, -1 for overestimate).

    NB: statistical method is based on estimating feature size from non-overlapping
    patches of the image with various side lengths.

    :param model_cls: model predicted CLS (in pixels)
    :type model_cls: float
    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param image_phase_fraction: measured phase fraction from the image
    :type pf: float
    :return: boolean if our cls is wrong and an integer for the direction
    :rtype: tuple[bool, int]
    """
    if model_cls < 1:
        return True, 1
    # one image statistical/classical prediction of the cls
    statistical_cls = stat_analysis_error_classic(binary_img, image_phase_fraction)
    if statistical_cls > 1:  # could be erroneous stat. analysis prediction
        # if pred cls too low or too high compared to statistical method,
        # return true and the direction of the error (1 for too low, -1 for too high)
        if model_cls / statistical_cls < 1 / 3:
            return True, 1
        if model_cls / statistical_cls > 3:
            return True, -1
    return False, 0


def change_pred_cls(
    coeff: float,
    tpc: np.ndarray,
    phase_fraction: float,
    pf_squared: float,
    bool_array: np.ndarray,
    im_shape: tuple[int, ...],
    sign: float,
) -> tuple[np.ndarray, float]:
    """If our estimated cls outside range of statistical/classical cls,
    adjust the tpc values directly in the direction of the error
    then recompute cls. We do this instead of just taking the statistical
    cls or the highest tpc value inside the error bounds as adjusting
    the tpcs and re-running the model is more likely to return a better
    value for our model than just snapping to the error bound regions
    of [(2/3) * stat_pred, 2 * stat_pred]

    :param coeff: _description_
    :type coeff: float
    :param tpc: 2D array of orthant TPCs, shape (2*$desired_length, 2*$desired_length) in 2D
    :type tpc: np.ndarray
    :param phase_fraction: measured IMAGE phase fraction
    :type phase_fraction: float
    :param pf_squared: mean of image pf and tpc-estimated pf, squared
    :type pf_squared: float
    :param bool_array: all indices up to r_0/end_dist
    :type bool_array: np.ndarray
    :param im_shape: shape of binary array
    :type im_shape: tuple[int, ...]
    :param sign: whether the CLS is an under/overestimate
    :type sign: float
    :return: updated TPC 2D array and the new predicted CLS from that
    :rtype: tuple[np.ndarray, float]
    """

    if sign > 0:
        negatives = np.where(tpc - pf_squared < 0)
        tpc[negatives] += (pf_squared - tpc[negatives]) / 10
    else:
        positives = np.where(tpc - pf_squared > 0)
        tpc[positives] -= (tpc[positives] - pf_squared) / 10
    pred_cls = calc_pred_cls(
        coeff, tpc, phase_fraction, pf_squared, bool_array, im_shape
    )
    return tpc, pred_cls


# %% ======================== CHARACTERISTIC LENGTH SCALE METHODS ========================


def calc_coeff_for_cls_prediction(
    norm_vol: np.ndarray,
    img_volume: int,
    bool_array: np.ndarray,
) -> float:
    """Find the C_r0 equivalent we need for CLS prediction based on r0 (via $bool_array)
    and $img_volume

    :param norm_vol: normalisations needed to be applied to the radii < r0 before summing them
    :type norm_vol: np.ndarray
    :param img_volume: product of all image dimensions
    :type img_volume: int
    :param bool_array: boolean array of indices up to r0
    :type bool_array: np.ndarray
    :return: coeffs
    :rtype: float
    """
    # sum of normalisations of all vectors less than r_0/end_dist
    sum_of_small_radii = np.sum(norm_vol[bool_array])
    coeff_1 = img_volume / (img_volume - sum_of_small_radii)
    coeff_2 = (1 / img_volume) * (np.sum(bool_array) - sum_of_small_radii)

    coeff_product = coeff_1 * coeff_2
    while coeff_product > 1:
        if VERBOSE:
            print(f"coeff product = {coeff_product}")
        coeff_product /= 1.1
    # output is effectively (but not exactly) C_r0
    return coeff_1 / (1 - coeff_product)


def find_end_dist_idx(
    image_pf: float, tpc: np.ndarray, dist_arr: np.ndarray, ring_distances: np.ndarray
) -> int:
    """Find the (radial) distance before the TPC function plateaus. This means looking at the
    percentage of all TPCs in a ring (width distances[i] - distances[i-1], usually 100) a
    certain distance from the centre that are outside of 5% of the image phase fraction squared.
    The TPC should tend to the (true) phase fraction squared, but the image phase fraction
    is a good approximation.

    If there less than 5% of all the TPCs in the ring are more than 5% out from the image
    phase fraction at a certain distance D, return it as our end distance.

    :param image_pf: measured image phase fraction
    :type pf: float
    :param tpc: 2D array of orthant TPCs, shape (2*$desired_length, 2*$desired_length) in 2D
    :type tpc: np.ndarray
    :param dist_arr: _description_
    :type dist_arr: np.ndarray
    :param ring_distances: list of ints that define start/stop of ring i.e [0, 100, 200, ...]
    :type ring_distances: np.ndarray
    :return: ring distance where the tpc stops fluctuating
    :rtype: int
    """

    percentage = 0.05
    small_change = (image_pf - image_pf**2) * percentage
    for dist_i in np.arange(1, len(ring_distances) - 1):
        start_dist, end_dist = ring_distances[dist_i], ring_distances[dist_i + 1]
        bool_array = (dist_arr >= start_dist) & (dist_arr < end_dist)
        sum_dev = np.sum(tpc[bool_array] - image_pf**2 > small_change)
        deviation = sum_dev / np.sum(bool_array)
        if deviation < 0.03:
            return int(ring_distances[dist_i])
    return ring_distances[1]


def find_end_dist_tpc(
    phase_fraction: float, tpc: np.ndarray, dist_arr: np.ndarray
) -> float:
    """Defines search range for endpoint, calls main fn"""
    # Assumption is image is at least 200 in every dimenson
    max_img_dim = np.max(dist_arr)  # len(dist_arr)  # np.max(dist_arr)
    # 200/2 * sqrt(N) where N is the number of dimensions for max dim 200 px:
    threshold_for_small_method = int(200 / 2 * np.sqrt(len(tpc.shape)))
    if max_img_dim < threshold_for_small_method:
        print(f"Max img dim of {max_img_dim} < 200px, using small method")
        # this gives more unstable results but works for smaller images
        distances = np.linspace(0, int(max_img_dim), 100)
    else:
        # this is the correct way as it reduces number of operations (but fails for small images)
        distances = np.concatenate([np.arange(0, int(max_img_dim), 100)])

    # check the tpc change and the comparison to pf^2
    # over bigger and bigger discs:
    return find_end_dist_idx(phase_fraction, tpc, dist_arr, distances)


def calc_pred_cls(
    coeff: float,
    tpc: np.ndarray,
    image_pf: float,
    mean_pf_squared: float,
    bool_array: np.ndarray,
    im_shape: tuple[int, ...],
) -> float:
    """Calculate the model predicted CLS based on equation (11) in the paper.

    NB: don't need |X_r|/|X| norm in summand as in psi in eq (9) as already taken care of due
    to periodicity and coeffs found previously

    :param coeff: normalisation coefficient (some function of C_r0)
    :type coeff: float
    :param tpc: 2D array of orthant TPCs, shape (2*$desired_length, 2*$desired_length) in 2D
    :type tpc: np.ndarray
    :param image_pf: measured image phase fraction
    :type image_pf: float
    :param mean_pf_squared: mean of measured image phase fraction and TPC-calculated phase fraction, squared
    :type mean_pf_squared: float
    :param bool_array: boolean array of indices < r0
    :type bool_array: np.ndarray
    :param im_shape: shape of $binary_img
    :type im_shape: tuple[int, ...]
    :return: characteristic length scale (CLS) / feature size of the phase in $binary_image
    :rtype: float
    """
    # second term is integral of tpc - pf_squared
    pred_cls = (
        coeff / (image_pf - mean_pf_squared) * np.sum(tpc[bool_array] - mean_pf_squared)
    )
    # this goes from length^N -> length to get a length scale
    if pred_cls > 0:
        pred_cls = pred_cls ** (1 / 3) if len(im_shape) == 3 else pred_cls ** (1 / 2)
    return float(pred_cls)


def tpc_to_cls(tpc: np.ndarray, binary_image: np.ndarray) -> float:
    """Compute the Characteristic Length Scale (CLS) from the TPC array and microstructure.
    First, the distance where the TPC stops fluctuating (r_0) is found. Using this the TPC-estimated
    phase fraction is found. The model from the paper (sections 4.1 and 4.2) is used to calculate
    the coefficients. All these quantities are then used to calculate the CLS. This TPC-predicted
    CLS is compared to the classical (statistical) method for CLS estimation and adjusted if
    less than 2/3x or more than 2X of CLS_stats.

    NB: no guarantee end_dist < our $desired_length

    :param tpc: 2D array of orthant TPCs, shape (2*$desired_length, 2*$desired_length) in 2D
    :type tpc: np.ndarray
    :param binary_image: 2/3D binary arr for the microstructure
    :type binary_image: np.ndarray
    :return: CLS of the binary microstructure (roughly the feature size)
    :rtype: float
    """
    # tpc = np.array(tpc)
    img_shape = binary_image.shape
    # the middle index is the 0,0 TPC because of how the TPC function laid them out
    middle_idx = np.array(tpc.shape) // 2
    # this is the measured image phase fraction (i.e the product of the image with itself)
    image_phase_fraction = tpc[
        tuple(map(slice, middle_idx, middle_idx + 1))
    ].item()  # [0][0]
    # 'raw_dist_arr' = before taking sqrts
    raw_dist_arr = np.indices(tpc.shape)
    # arr indices != coordinates, we care about distances from centre of coords so remap
    remapped_dist_arr = np.abs((raw_dist_arr.T - middle_idx.T).T)
    img_volume = np.prod(img_shape)
    # normalising the tpc s.t. different vectors would have different weights,
    # According to their volumes.
    # number of r s.t x + r \in x i.e same as other normaliser
    norm_vol = (np.array(img_shape).T - remapped_dist_arr.T).T
    norm_vol = np.prod(norm_vol, axis=0) / img_volume
    # euclidean distances
    euc_dist_arr: np.ndarray = np.sqrt(np.sum(remapped_dist_arr**2, axis=0))
    # end dist = r0 = dist when tpc stops fluctuating
    end_dist = find_end_dist_tpc(image_phase_fraction, tpc, euc_dist_arr)

    # take mean of tpcs in the outer ring width 10 from end dist
    tpc_phase_fraction_squared = np.mean(
        tpc[(euc_dist_arr >= end_dist - 10) & (euc_dist_arr <= end_dist)]
    )
    # take mean of this estimated pf_square from tpc and measured pf_squared from image
    # emprical result - broadly speaking mean is more stable
    phase_fraction_squared = (tpc_phase_fraction_squared + image_phase_fraction**2) / 2
    bool_array = euc_dist_arr < end_dist

    # calculate the coefficient needed for the cls prediction
    coeff = calc_coeff_for_cls_prediction(norm_vol, int(img_volume), bool_array)

    pred_cls = calc_pred_cls(
        coeff, tpc, image_phase_fraction, phase_fraction_squared, bool_array, img_shape
    )
    # use classical apporach to see if CLS is off
    pred_is_off, sign = pred_cls_is_off(pred_cls, binary_image, image_phase_fraction)
    while pred_is_off:
        how_off = "negative" if sign > 0 else "positive"
        if VERBOSE:
            print(f"pred cls = {pred_cls} is too {how_off}, CHANGING TPC VALUES")
        tpc, pred_cls = change_pred_cls(
            coeff,
            tpc,
            image_phase_fraction,
            phase_fraction_squared,
            bool_array,
            img_shape,
            sign,
        )
        pred_is_off, sign = pred_cls_is_off(
            pred_cls, binary_image, image_phase_fraction
        )
    return pred_cls


# %% ======================== POST-CLS ERROR ESTIMATION ========================


def fit_to_errs_function(
    dim: int, n_voxels: int | np.ndarray, a: float, b: float
) -> float | np.ndarray:
    return a / n_voxels**b


def get_std_model(dim: int, n_voxels: int) -> float:
    """Experimentally measured correction factors to adjust the std prediction of the model based on
    measurements from the microlib library.

    :param dim: whether 2D or 3D
    :type dim: int
    :param n_voxels: number of elements in the binary img
    :type n_voxels: int
    :return: correction factor
    :rtype: float
    """
    # fit from microlib
    popt = {"2d": [48.20175315, 0.4297919], "3d": [444.803518, 0.436974444]}
    return fit_to_errs_function(dim, n_voxels, *popt[f"{dim}d"])


def normal_dist(
    x: np.ndarray, mean: float | np.ndarray, std: float | np.ndarray
) -> np.ndarray:  #
    return (1.0 / (std * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x - mean) / std) ** 2)


def get_prediction_interval(
    image_pf: float,
    pred_std: float,
    pred_std_error_std: float,
    conf_level: float = 0.95,
    n_divisions: int = DEFAULT_N_DIV,
) -> tuple[tuple[np.ndarray, np.ndarray], np.ndarray, np.ndarray]:
    """Get the prediction interval for the phase fraction of the material given the image phase
    fraction, the predicted standard deviation and the standard deviation of the prediction error.

    :param image_pf: measured image phase fraction
    :type image_pf: float
    :param pred_std: model predicted pf standard deviation around $image_pf
    :type pred_std: float
    :param pred_std_error_std: model error weighting
    :type pred_std_error_std: float
    :param conf_level: what confidence level this pf interval represents, defaults to 0.95
    :type conf_level: float, optional
    :param n_divisions: number of points over which to calculate the std around the image pf, defaults to 101
    :type n_divisions: int, optional
    :return: _description_
    :rtype: tuple[float, float]
    """
    # have a large enough number of stds to converge to 0 at both ends,
    # but not too large to make the calculation slow:
    std_dist_std = pred_std * pred_std_error_std  # TODO see if this fits
    num_stds = min(pred_std / std_dist_std - pred_std / std_dist_std / 10, 6)
    # First, make the "weights" or "error" distribution, the normal distribution of the stds
    # where the prediction std is the mean of this distribution:
    x_std_dist_bounds = (
        pred_std - num_stds * std_dist_std,
        pred_std + num_stds * std_dist_std,
    )
    x_std_dist: np.ndarray = np.linspace(*x_std_dist_bounds, n_divisions)
    std_dist = normal_dist(x_std_dist, mean=pred_std, std=std_dist_std)
    # Next, make the pf distributions, each row correspond to a different std, with
    # the same mean (observed pf) but different stds (x_std_dist), multiplied by the
    # weights distribution (std_dist).
    pf_locs = np.ones((n_divisions, n_divisions)) * image_pf
    pf_x_bounds = (image_pf - num_stds * pred_std, image_pf + num_stds * pred_std)
    pf_x_1d: np.ndarray = np.linspace(*pf_x_bounds, n_divisions)
    pf_mesh, std_mesh = np.meshgrid(pf_x_1d, x_std_dist)
    # Before normalising by weight:
    pf_dist_before_norm = normal_dist(pf_mesh, mean=pf_locs, std=std_mesh)
    # Normalise by weight:
    pf_dist = (pf_dist_before_norm.T * std_dist).T
    # Sum the distributions over the different stds
    val = np.diff(x_std_dist)[0]
    sum_dist_norm = np.sum(pf_dist, axis=0) * val
    # need a bit of normalization for symmetric bounds (it's very close to 1 already)
    sum_dist_norm /= np.trapz(sum_dist_norm, pf_x_1d)
    # Find the alpha confidence bounds
    cum_sum_sum_dist_norm = np.cumsum(sum_dist_norm * np.diff(pf_x_1d)[0])
    half_conf_level = (1 + conf_level) / 2
    conf_level_beginning = np.where(cum_sum_sum_dist_norm > 1 - half_conf_level)[0][0]
    conf_level_end = np.where(cum_sum_sum_dist_norm > half_conf_level)[0][0]

    # Calculate the interval
    return (
        (pf_x_1d[conf_level_beginning], pf_x_1d[conf_level_end]),
        pf_x_1d,
        cum_sum_sum_dist_norm,
    )


def find_n_for_err_targ(
    n: int,
    image_pf: float,
    pred_std_error_std: float,
    err_target: float,
    conf_level: float = 0.95,
    n_divisions: int = DEFAULT_N_DIV,
) -> float:
    """Find the number of samples needed from a bernoulli distribution probability $image_pf needed
    to reach a certain $err_target error in the phase fraction at a given $conf_level.

    :param n: number of samples of length CLS (hyper)cubes currently in the image
    :type n: int
    :param image_pf: measured image phase fraction
    :type image_pf: float
    :param pred_std_error_std: model error weighting
    :type pred_std_error_std: float
    :param err_target: user-defined desired % error from 'true vf' i.e desired width of pf interval
    :type err_target: float
    :param conf_level: what confidence level this pf interval represents, defaults to 0.95
    :type conf_level: float, optional
    :param n_divisions: number of points over which to calculate the std around the image pf, defaults to 101
    :type n_divisions: int, optional
    :return: number of samples needed to reach error target
    :rtype: float
    """
    n = n[0]  # needs to be here during the optimize
    std_bernoulli = ((1 / n) * (image_pf * (1 - image_pf))) ** 0.5
    pred_interval, _, _ = get_prediction_interval(
        image_pf, std_bernoulli, pred_std_error_std, conf_level, n_divisions
    )
    err_for_img = image_pf - pred_interval[0]
    # TODO: check whether **2 or np.abs is better - originally was np.abs
    return np.abs(err_target - err_for_img)  # ** 2


def dims_from_n(n_samples_needed: int, equal_shape: bool, cls: float, dims: int) -> int:
    """Given $n_samples_needed from our bernoulli distribution of (hyper)cubes of edge length cls,
    find the dimensions of the image needed.

    :param n_samples_needed: number of samples from bernoulli dist. needed for given pf confidence
    :type n_samples_needed: int
    :param equal_shape: ?
    :type equal_shape: bool
    :param cls: characteristic length scale/feature size of binary image
    :type cls: float
    :param dims: 2 or 3 D
    :type dims: int
    :raises ValueError: _description_
    :return: measured image length required to reach given confidence in phase fraction
    :rtype: int
    """
    den = cls**dims
    if equal_shape:
        return (n_samples_needed * den) ** (1 / dims)
    else:
        # if dims == len(shape):
        raise ValueError("cannot define all the dimensions")
        # if len(shape) == 1:
        #    return ((n * den) / (shape[0] + cls - 1)) ** (1 / (dims - 1)) - cls + 1
        # else:
        #    return ((n * den) / ((shape[0] + cls - 1) * (shape[1] + cls - 1))) - cls + 1


# %% ======================== PUT IT ALL TOGETHER ========================
class ModelResult(TypedDict):
    phase_fraction: float
    integral_range: float
    std_model: float
    percent_err: float
    abs_err: float
    l: float
    pf_1d: list
    cum_sum_sum: list


def make_error_prediction(
    binary_img: np.ndarray,
    confidence: float = 0.95,
    target_error: float = 0.05,
    equal_shape: bool = True,
    model_error: bool = True,
) -> ModelResult:
    """Given $binary_img, compute the $target_error % phase fraction bounds around the
    measured phase fraction in $binary_img. Also find the length needed to reduce the
    % error bounds to a given $target_error. All these intervals are found to $confidence
    confidence, i.e the 'true' phase fraction will be found in measured pf +/- error% confidence%
    of the time.

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param confidence: confidence level of returned pf interval, defaults to 0.95
    :type confidence: float, optional
    :param target_error: user-specified desired phase fraction uncertainty, defaults to 0.05
    :type target_error: float, optional
    :param equal_shape: ???, defaults to True
    :type equal_shape: bool, optional
    :param model_error: whether to account for model error in the returned values, defaults to True
    :type model_error: bool, optional
    :return: _description_
    :rtype: dict
    """
    phase_fraction = float(np.mean(binary_img))
    n_dims = len(binary_img.shape)  # 2D or 3D
    n_elems = int(np.prod(binary_img.shape))

    two_point_correlation = radial_tpc(binary_img, n_dims == 3, True)
    integral_range = tpc_to_cls(
        two_point_correlation,
        binary_img,
    )

    n = n_samples_from_dims(
        [np.array(binary_img.shape, dtype=np.int32)], integral_range
    )
    # bern = bernouilli
    std_bern = (
        (1 / n[0]) * (phase_fraction * (1 - phase_fraction))
    ) ** 0.5  # this is the std of phi relative to Phi with
    std_model = get_std_model(n_dims, n_elems)
    abs_err_target = target_error * phase_fraction
    z, pf_1d, cum_sum_sum = 0, [0], [0]
    if model_error:
        # calculate the absolute error for the image:
        conf_bounds, pf_1d, cum_sum_sum = get_prediction_interval(
            phase_fraction, std_bern, std_model, confidence, DEFAULT_N_DIV
        )
        abs_err_for_img = phase_fraction - conf_bounds[0]
        # calculate the n for the error target:
        args = (
            phase_fraction,
            std_model,
            abs_err_target,
            confidence,
        )  # was 'target_error'
        n_for_err_targ = minimize(
            find_n_for_err_targ, n, args=args, method="nelder-mead", bounds=[(10, 10e8)]
        )
        n_for_err_targ = n_for_err_targ.x[0]

    else:  # TODO what is this useful for.. for when you trust the model completely?
        z = norm.interval(confidence)[1]
        abs_err_for_img = z * std_bern
        n_for_err_targ = (
            phase_fraction * (1 - phase_fraction) * (z / abs_err_target) ** 2
        )
    # w model error n for err targ << w/out
    # => weird length scales
    l_for_err_targ = dims_from_n(n_for_err_targ, equal_shape, integral_range, n_dims)
    percentage_err_for_img = abs_err_for_img / phase_fraction

    result: ModelResult = {
        "phase_fraction": phase_fraction,
        "integral_range": integral_range,
        "std_model": std_model,
        "percent_err": float(percentage_err_for_img),
        "abs_err": float(abs_err_for_img),
        "l": l_for_err_targ,
        "pf_1d": list(pf_1d),
        "cum_sum_sum": list(cum_sum_sum),
    }
    return result


def get_l_for_target_from_result(
    binary_img: np.ndarray, result: ModelResult, confidence: float, target_error: float
) -> float:
    """Given the $result have already been computed, reuse them to calculate the length needed to meet
    the target $confidence and $target_error. NB: this is the 'with model error approach'.

    :param binary_img: 2/3D binary arr for the microstructure
    :type binary_img: np.ndarray
    :param result: results from previous model call
    :param confidence: confidence level of returned pf interval
    :type result: ModelResult
    :type confidence: float
    :param target_error: user-specified desired phase fraction uncertainty
    :type target_error: float, optional
    :return: _description_
    :rtype: float
    """
    phase_fraction = result["phase_fraction"]
    integral_range = result["integral_range"]
    abs_err_target = target_error * phase_fraction

    n_dims = len(binary_img.shape)
    n = n_samples_from_dims(
        [np.array(binary_img.shape, dtype=np.int32)], integral_range
    )
    args = (
        phase_fraction,
        result["std_model"],
        abs_err_target,
        confidence,
    )
    n_for_err_targ = minimize(
        find_n_for_err_targ, n, args=args, method="nelder-mead", bounds=[(10, 10e8)]
    )
    n_for_err_targ = n_for_err_targ.x[0]
    l_for_err_targ = dims_from_n(n_for_err_targ, True, integral_range, n_dims)
    return l_for_err_targ


def get_bounds_for_targets_from_result(
    result: ModelResult, confidence: float
) -> tuple[float, float]:
    """Given the $result have already been computed, reuse them to calculate the uncertainty bounds
    for a given user $confidence

    :param result: _description_
    :type result: ModelResult
    :param confidence: _description_
    :type confidence: float
    :return: _description_
    :rtype: tuple[float, float]
    """
    cum_sum_sum_dist_norm = np.array(result["cum_sum_sum"])
    pf_1d = np.array(result["pf_1d"])
    half_conf_level = (1 + confidence) / 2
    conf_level_beginning = np.where(cum_sum_sum_dist_norm > 1 - half_conf_level)[0][0]
    conf_level_end = np.where(cum_sum_sum_dist_norm > half_conf_level)[0][0]
    return (pf_1d[conf_level_beginning], pf_1d[conf_level_end])
