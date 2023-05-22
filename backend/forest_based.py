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
from PIL import Image
from features import multiscale_advanced_features, N_ALLOWED_CPUS

GPU_XGB: bool = False
try:
    import xgboost as xgb

    GPU_XGB = True
except ImportError:
    print("Cannot import XGBoost, gpu accelerated XGB is unavailable.")

from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.ensemble import HistGradientBoostingClassifier

from multiprocessing import Queue


from typing import List, Tuple, TypeAlias, Literal

EnsembleMethod: TypeAlias = (
    RandomForestClassifier
    | GradientBoostingClassifier
    | HistGradientBoostingClassifier
    | xgb.XGBClassifier
)

EnsembleMethodName: TypeAlias = Literal["FRF", "XGB", "XGB_gpu", "LGBM"]


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


def get_model(
    model_name: EnsembleMethodName = "XGB",
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
    elif model_name == "XGB_gpu":
        model = xgb.XGBClassifier(
            tree_method="gpu_hist",
            n_estimators=n_trees,
            max_features=n_features,
            max_depth=depth,
            n_jobs=N_ALLOWED_CPUS - 1,
        )
    return model


def featurise_then_segment(
    img: np.ndarray,
    selected_features: dict,
    labels: np.ndarray,
    model_name: EnsembleMethodName = "FRF",
    balance_classes: bool = True,
) -> np.ndarray:
    """Perform each step of classification: featurising, get data, get model, git, apply."""
    feature_stack = multiscale_advanced_features(img, selected_features)
    fit_data, target_data = get_training_data(feature_stack, labels)
    model = get_model(model_name)
    if balance_classes:
        weights = get_class_weights(target_data)
    else:
        weights = None
    model = fit(model, fit_data, target_data, weights)
    out_data = apply(model, [feature_stack])
    return out_data[0]
