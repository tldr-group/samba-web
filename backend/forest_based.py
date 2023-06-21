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
from features import multiscale_advanced_features, N_ALLOWED_CPUS

print(N_ALLOWED_CPUS)

from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.ensemble import HistGradientBoostingClassifier


from typing import List, Tuple, TypeAlias, Literal

EnsembleMethod: TypeAlias = (
    RandomForestClassifier | GradientBoostingClassifier | HistGradientBoostingClassifier
)

EnsembleMethodName: TypeAlias = Literal["FRF", "XGB", "LGBM"]


def get_class_weights(target_data: np.ndarray) -> np.ndarray:
    """
    Get class weights array.

    Given flat array of label data ($target_data), create arr of same shape where
    each entry is the class weight corresponding to the class present at the entry
    in target data. Used for balancing training.
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
    return weights_arr


def get_training_data(
    feature_stack: np.ndarray, labels: np.ndarray, method="cpu"
) -> Tuple[np.ndarray, np.ndarray]:
    """Given $feature_stack and $labels, flatten both and reshape accordingly. Add a class offset if using XGB gpu."""
    h, w, feat = feature_stack.shape
    flat_labels = labels.reshape((h * w))
    flat_features = feature_stack.reshape((h * w, feat))
    labelled_mask = np.nonzero(flat_labels)

    fit_data = flat_features[labelled_mask[0], :]
    target_data = flat_labels[labelled_mask[0]]
    if method == "gpu":
        target_data -= 1
    return fit_data, target_data


def get_training_data_multiple_images(
    imgs: List[np.ndarray], labels: List[np.ndarray], selected_features: dict
) -> Tuple[List[np.ndarray], np.ndarray, np.ndarray]:
    """For each image, featurise. Then check if it's labelled and if it is get the training data and concat."""
    feature_stacks: List[np.ndarray] = []
    fit_data_set = False
    all_fit_data: np.ndarray
    all_target_data: np.ndarray
    for i in range(len(imgs)):
        img, label = imgs[i], labels[i]
        feature_stack = multiscale_advanced_features(img, selected_features)
        feature_stacks.append(feature_stack)
        is_labelled = np.sum(label) >= 1
        # print(i, is_labelled, fit_data_set, np.sum(label))
        if is_labelled:
            fit_data, target_data = get_training_data(feature_stack, label)
            if fit_data_set is False:
                all_fit_data = fit_data
                all_target_data = target_data
                fit_data_set = True
            else:
                all_fit_data = np.concatenate((all_fit_data, fit_data), axis=0)
                all_target_data = np.concatenate((all_target_data, target_data), axis=0)
    return (feature_stacks, all_fit_data, all_target_data)


def get_training_data_features_done(
    labels: List[np.ndarray], UID: str
) -> Tuple[np.ndarray, np.ndarray]:
    """For each image, featurise. Then check if it's labelled and if it is get the training data and concat."""
    fit_data_set = False
    all_fit_data: np.ndarray
    all_target_data: np.ndarray
    for i, label in enumerate(labels):
        feature_stack = np.load(f"{UID}/features_{i}.npz")["a"]  # need to index
        is_labelled = np.sum(label) >= 1
        if is_labelled:
            fit_data, target_data = get_training_data(feature_stack, label)
            if fit_data_set is False:
                all_fit_data = fit_data
                all_target_data = target_data
                fit_data_set = True
            else:
                all_fit_data = np.concatenate((all_fit_data, fit_data), axis=0)
                all_target_data = np.concatenate((all_target_data, target_data), axis=0)
    return (all_fit_data, all_target_data)


def fit(
    model: EnsembleMethod,
    train_data: np.ndarray,
    target_data: np.ndarray,
    weights: np.ndarray | None,
) -> EnsembleMethod:
    """Apply EnsembleMethod's fit method. This works because they all share the sklearn api."""
    if weights is None:
        model.fit(train_data, target_data)
    else:
        model.fit(train_data, target_data, weights)
    return model


def apply(
    model: EnsembleMethod, feature_stacks: List[np.ndarray], reorder: bool = True
) -> List[np.ndarray]:
    """Given $model, apply it to each feature stack in $feature stacks."""
    out: List[np.ndarray] = []
    for feature_stack in feature_stacks:
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


def apply_features_done(
    model: EnsembleMethod, UID: str, n_imgs: int, reorder: bool = True
) -> List[np.ndarray]:
    """Assuming feature stacks saved in folder, decompress each one, apply trained classifier and return segmentation."""
    out: List[np.ndarray] = []
    for i in range(n_imgs):
        feature_stack = np.load(f"{UID}/features_{i}.npz")["a"]
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
    """Initialise and return EnsembleMethod given by $model_name with supplied parameters."""
    depth: int | None = max_depth
    if max_depth == -1:
        depth = None
    if model_name == "FRF":
        model = RandomForestClassifier(
            n_estimators=n_trees,
            max_features=n_features,
            max_depth=depth,
            n_jobs=N_ALLOWED_CPUS - 1,
        )
    elif model_name == "XGB":
        model = GradientBoostingClassifier(
            n_estimators=n_trees, max_features=n_features, max_depth=depth
        )
    elif model_name == "LGBM_cpu":
        model = HistGradientBoostingClassifier()
    return model


def featurise_then_segment(
    imgs: List[np.ndarray],
    selected_features: dict,
    labels: List[np.ndarray],
    model_name: EnsembleMethodName = "FRF",
    balance_classes: bool = True,
) -> Tuple[List[np.ndarray], EnsembleMethod]:
    """Perform each step of classification: featurising, get data, get model, fit, apply."""
    # TODO: fix out of memory errors by only computing feature stacks of labelled images and then computing and applying on demand?
    # compute one at a time, saving to a file each time? how would this work w/out loading the whole thing into memory?
    # will it matter how much memory the VM/cloud instance if it's shared between users (i.e could one user use too much memory?)
    feature_stacks, fit_data, target_data = get_training_data_multiple_images(
        imgs, labels, selected_features
    )  # get_training_data(feature_stack, labels)
    model = get_model(model_name)
    if balance_classes:
        weights = get_class_weights(target_data)
    else:
        weights = None
    model = fit(model, fit_data, target_data, weights)
    out_data = apply(model, feature_stacks)
    return out_data, model


def segment_with_features(
    labels: List[np.ndarray],
    UID: str,
    model_name: EnsembleMethodName = "FRF",
    balance_classes: bool = True,
) -> Tuple[List[np.ndarray], EnsembleMethod]:
    """Assuming a list of feature stacks are saved at the folder, get training data then fit then apply."""
    fit_data, target_data = get_training_data_features_done(labels, UID)
    model = get_model(model_name)
    if balance_classes:
        weights = get_class_weights(target_data)
    else:
        weights = None
    model = fit(model, fit_data, target_data, weights)
    out_data = apply_features_done(model, UID, len(labels))
    return out_data, model
