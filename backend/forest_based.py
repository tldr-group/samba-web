"""
Forest based ensemble classifiers.

Given an image and some desired features, we create a feature stack using features.py.
Then, we train a ensemble classifier (random forest, XGBoost or LGBM) to map from this
feature stack to a set of user labels in pixel space. Finally, we apply this trained
classifier to the whole image to generate a segmentation for each image in the app.

This is written in 2 styles: functional backbone that can be composed to be used on
say a cloud function or as a smaller part of a threaded classifier object (which can
memoise things like feature computation) that is part of a GUI app.
"""
import numpy as np
from features import multiscale_advanced_features, N_ALLOWED_CPUS, DEAFAULT_FEATURES
from test_resources.call_weka import sep
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from typing import List, Tuple, TypeAlias, Literal

print(N_ALLOWED_CPUS)

EnsembleMethod: TypeAlias = (
    RandomForestClassifier | GradientBoostingClassifier | HistGradientBoostingClassifier
)

EnsembleMethodName: TypeAlias = Literal["FRF", "XGB", "LGBM"]


def get_class_weights(target_data: np.ndarray) -> Tuple[np.ndarray, List[int]]:
    """Get class weights array.

    Given flat array of label data ($target_data), create arr of same shape where
    each entry is the class weight corresponding to the class present at the entry
    in target data. Used for balancing training.

    :param target_data: flat arr of class values corresponding to labelled pixels
    :type target_data: np.ndarray
    :return: tuple of arrs, same shape as $target_data of both the weights and frequencies of each class
    :rtype: Tuple[np.ndarray, List[int]]
    """
    weights_arr = np.ones_like(target_data)
    unique_classes = np.unique(target_data)
    class_freqs: List[int] = []
    for class_val in unique_classes:
        matches = np.where(target_data == class_val, 1, 0)
        class_freq = np.sum(matches)
        class_freqs.append(class_freq)
    class_weights = [max(class_freqs) / i for i in class_freqs]

    for i, class_val in enumerate(unique_classes):
        weights_arr = np.where(target_data == class_val, class_weights[i], weights_arr)
    return weights_arr, class_freqs


def get_training_data(
    feature_stack: np.ndarray, labels: np.ndarray, method="cpu"
) -> Tuple[np.ndarray, np.ndarray]:
    """Given $feature_stack and $labels, flatten both and reshape accordingly. Add a class offset if using XGB gpu.

    :param feature_stack: NxHxW arr of features from featurisation
    :type feature_stack: np.ndarray
    :param labels: HxW arr of user labels of class values. 0=unlabelled, 1,2,3,... are classes
    :type labels: np.ndarray
    :param method: which RF to use, defaults to "cpu"
    :type method: str, optional
    :return: flattened arrs of fit data (feature vectors of all labelled pixels) and
        target data (class values of all labelled pixels)
    :rtype: Tuple[np.ndarray, np.ndarray]
    """
    h, w, feat = feature_stack.shape
    flat_labels = labels.reshape((h * w))
    flat_features = feature_stack.reshape((h * w, feat))
    labelled_mask = np.nonzero(flat_labels)

    fit_data = flat_features[labelled_mask[0], :]
    target_data = flat_labels[labelled_mask[0]]
    if method == "gpu":
        target_data -= 1
    return fit_data, target_data


def get_training_data_features_done(
    labels: List[np.ndarray], UID: str
) -> Tuple[np.ndarray, np.ndarray]:
    """For each img, load cached features. Check if img is labelled and if it is get the training data and concat.

    :param labels: label arr
    :type labels: List[np.ndarray]
    :param UID: user ID, points to folder where features are cached
    :type UID: str
    :return: tuple of fit data and target data over all (labelled) imgs
    :rtype: Tuple[np.ndarray, np.ndarray]
    """
    fit_data_set = False
    all_fit_data: np.ndarray
    all_target_data: np.ndarray
    for i, label in enumerate(labels):
        is_labelled = np.sum(label) >= 1
        if is_labelled:
            feature_stack = np.load(f"{UID}{sep}features_{i}.npz")["a"]  # need to index
            fit_data, target_data = get_training_data(feature_stack, label)
            if fit_data_set is False:
                all_fit_data = fit_data
                all_target_data = target_data
                fit_data_set = True
            else:
                all_fit_data = np.concatenate((all_fit_data, fit_data), axis=0)
                all_target_data = np.concatenate((all_target_data, target_data), axis=0)
    return (all_fit_data, all_target_data)


def _shuffle_fit_target(
    fit: np.ndarray, target: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    """Shuffle both the fit and target arrs in same way by shuffling an index arr.

    :param fit: flat fit data arr
    :type fit: np.ndarray
    :param target: flat target data arr
    :type target: np.ndarray
    :return: tuple og shuffled fit and target arrs
    :rtype: Tuple[np.ndarray, np.ndarray]
    """
    all_shuffle_inds = np.arange(0, target.shape[0], 1)
    np.random.shuffle(all_shuffle_inds)
    print(f"sampled and shuffled {len(all_shuffle_inds)} points")
    return fit[all_shuffle_inds], target[all_shuffle_inds]


def sample_training_data(
    fit_data: np.ndarray,
    target_data: np.ndarray,
    class_counts: List[int],
    n_points: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Sample training data randomly up to n_points.

    Given flat arrays of fit and target data, class frequencies and desired number of points, loop through each class,
    sample class_freq * $n_points randomly of each class, put into array then shuffle once all classes sampled from.

    :param fit_data: flat fit data arr
    :type fit_data: np.ndarray
    :param target_data: flat target data arr
    :type target_data: np.ndarray
    :param class_counts: frequencies of each class
    :type class_counts: List[int]
    :param n_points: total number of points to sample over all classes
    :type n_points: int
    :return: tuple of shuffled and sampled flat fit data and target data arrs
    :rtype: Tuple[np.ndarray, np.ndarray]
    """
    sampled_fit_data: np.ndarray
    sampled_target_data: np.ndarray
    class_freqs = [i / sum(class_counts) for i in class_counts]
    for i, freq in enumerate(class_freqs):
        class_val = i + 1
        n_points_per_class = int(n_points * freq)

        matching_inds = np.nonzero(np.where(target_data == class_val, 1, 0))
        class_filtered_fit = fit_data[matching_inds]
        class_filtered_target = (
            np.zeros(shape=(class_filtered_fit.shape[0],)) + class_val
        )
        print(f"sampling up to {n_points_per_class} points for class {class_val}")

        shuffle_inds = np.arange(0, len(class_filtered_fit), 1)
        np.random.shuffle(shuffle_inds)
        shuffled_fit = class_filtered_fit[shuffle_inds]

        sampled_fit = shuffled_fit[:n_points_per_class]
        sampled_target: np.ndarray = class_filtered_target[:n_points_per_class]
        if i == 0:
            sampled_fit_data = sampled_fit
            sampled_target_data = sampled_target
        else:
            sampled_fit_data = np.concatenate((sampled_fit_data, sampled_fit), axis=0)
            sampled_target_data = np.concatenate(
                (sampled_target_data, sampled_target), axis=0
            )
    # now globally shuffle our data
    return _shuffle_fit_target(sampled_fit_data, sampled_target_data)


def fit(
    model: EnsembleMethod,
    train_data: np.ndarray,
    target_data: np.ndarray,
    weights: np.ndarray | None,
) -> EnsembleMethod:
    """Apply EnsembleMethod's fit method with optional class weights. This works because they all share the sklearn api.

    :param model: a sklearn ensemble model (FRF, XGB, LGBM, etc)
    :type model: EnsembleMethod
    :param train_data: flat train (fit) data arr
    :type train_data: np.ndarray
    :param target_data: flat target data arr
    :type target_data: np.ndarray
    :param weights: flat weights arr
    :type weights: np.ndarray | None
    :return: trained ensemble model
    :rtype: EnsembleMethod
    """
    if weights is None:
        model.fit(train_data, target_data)
    else:
        model.fit(train_data, target_data, weights)
    return model


def apply_features_done(
    model: EnsembleMethod, UID: str, n_imgs: int, reorder: bool = True
) -> List[np.ndarray]:
    """Assuming feature stacks saved in folder, decompress each one, apply trained classifier and return segmentation.

    :param model: a *trained* sklearn ensemble method
    :type model: EnsembleMethod
    :param UID: user ID pointing to folder where data stroed
    :type UID: str
    :param n_imgs: number of images to loop over
    :type n_imgs: int
    :param reorder: reorder for sending to GUI, defaults to True
    :type reorder: bool, optional
    :return: np array of predictions for all images
    :rtype: List[np.ndarray]
    """
    out: List[np.ndarray] = []
    for i in range(n_imgs):
        feature_stack = np.load(f"{UID}{sep}features_{i}.npz")["a"]
        h, w, feat = feature_stack.shape
        flat_apply_data = feature_stack.reshape((h * w, feat))
        out_probs = model.predict_proba(flat_apply_data)
        _, n_classes = out_probs.shape
        # gui expects arr in form (n_classes, h, w)
        if reorder:
            out_probs_arr = out_probs.T.reshape((n_classes, h, w))
        else:
            out_probs_arr = out_probs
        out.append(out_probs_arr)
    return out


def get_model(
    model_name: EnsembleMethodName = "FRF",
    n_trees: int = 200,
    n_features: int = 2,
    max_depth: int = 10,
) -> EnsembleMethod:
    """Initialise and return EnsembleMethod given by $model_name with supplied parameters.

    :param model_name: string corresponding to an sklearn ensemble method, defaults to "FRF"
    :type model_name: EnsembleMethodName, optional
    :param n_trees: number of trees in ensemble method, defaults to 200
    :type n_trees: int, optional
    :param n_features: number of features considered per split, defaults to 2
    :type n_features: int, optional
    :param max_depth: max depth of trees, defaults to 10
    :type max_depth: int, optional
    :return: an sklearn ensemble method with desired parameters
    :rtype: EnsembleMethod
    """
    depth: int | None = max_depth
    if max_depth == -1:
        depth = None
    if model_name == "FRF":
        model = RandomForestClassifier(
            n_estimators=n_trees,
            max_features=n_features,
            max_depth=depth,
            n_jobs=N_ALLOWED_CPUS - 1,
            oob_score=True,
        )
    elif model_name == "XGB":
        model = GradientBoostingClassifier(
            n_estimators=n_trees, max_features=n_features, max_depth=depth
        )
    elif model_name == "LGBM_cpu":
        model = HistGradientBoostingClassifier()
    return model


def segment_with_features(
    labels: List[np.ndarray],
    UID: str,
    model_name: EnsembleMethodName = "FRF",
    n_points: int = 40000,
    balance_classes: bool = True,
    train_all: bool = False,
) -> Tuple[List[np.ndarray], EnsembleMethod, float]:
    """Assuming a list of feature stacks are saved at the folder, get training data, fit then apply.

    :param labels: list of label arrs
    :type labels: List[np.ndarray]
    :param UID: user ID pointing to a folder with the features
    :type UID: str
    :param model_name: model string, defaults to "FRF"
    :type model_name: EnsembleMethodName, optional
    :param n_points: number of training points to sample, defaults to 40000
    :type n_points: int, optional
    :param balance_classes: whether to apply weights during training, defaults to True
    :type balance_classes: bool, optional
    :param train_all: whether to train on all data, defaults to False
    :type train_all: bool, optional
    :return: list of all segmentations (as class probabilities), the sklearn ensemble method and the out-of-bag-score
    :rtype: Tuple[List[np.ndarray], EnsembleMethod, float]
    """
    fit_data, target_data = get_training_data_features_done(labels, UID)
    model = get_model(model_name)
    weights: np.ndarray | None
    new_weights: np.ndarray | None
    weights, class_counts = get_class_weights(target_data)
    if train_all or target_data.shape[0] < n_points:
        print("all")
        sample_fit_data, sample_target_data = _shuffle_fit_target(
            fit_data,
            target_data,
        )
        new_weights = weights
    else:
        sample_fit_data, sample_target_data = sample_training_data(
            fit_data, target_data, class_counts, n_points
        )
        new_weights, _ = get_class_weights(sample_target_data)

    if balance_classes is False:
        new_weights = None

    model = fit(model, sample_fit_data, sample_target_data, new_weights)
    print(model.oob_score_)
    out_data = apply_features_done(model, UID, len(labels))
    return out_data, model, model.oob_score_


def segment_no_features_get_arr(
    label_arr: np.ndarray, img_arr: np.ndarray, feature_dict: dict = DEAFAULT_FEATURES
) -> np.ndarray:
    """For a *single img*, featurise, get training data (with no sampling), fit classifier then segment.

    :param label_arr: arr of labels
    :type label_arr: np.ndarray
    :param img_arr: img arr to featurise
    :type img_arr: np.ndarray
    :return: segmentation arr as class probabilities.
    :rtype: np.ndarray
    """
    feature_stack = multiscale_advanced_features(img_arr, feature_dict, N_ALLOWED_CPUS)
    fit_data, target_data = get_training_data(feature_stack, label_arr)
    model = get_model("FRF")
    model = fit(model, fit_data, target_data, None)
    h, w, feat = feature_stack.shape
    flat_apply_data = feature_stack.reshape((h * w, feat))
    out_probs = model.predict_proba(flat_apply_data)
    _, n_classes = out_probs.shape
    out_probs = out_probs.T.reshape((n_classes, h, w))
    classes = np.argmax(out_probs, axis=0).astype(np.uint8)
    return classes
